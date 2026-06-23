import { Router, type Request, type Response } from "express";
import { getKey, markUsed, markExhausted, getAllKeys, getDailyUsage } from "./key-manager.js";

const router = Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OLLAMA_URL = "http://localhost:11434/api/chat";

interface ChatRequest {
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

async function callOpenRouter(body: ChatRequest, apiKey: string): Promise<globalThis.Response> {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "YouStudio",
    },
    body: JSON.stringify({
      model: body.model ?? "anthropic/claude-sonnet-4",
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 4096,
      stream: body.stream ?? false,
    }),
  });
}

async function callGroq(body: ChatRequest, apiKey: string): Promise<globalThis.Response> {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: body.model ?? "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 4096,
      stream: body.stream ?? false,
    }),
  });
}

async function callOllama(body: ChatRequest): Promise<globalThis.Response> {
  return fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body.model ?? "llama3.1",
      messages: body.messages,
      stream: body.stream ?? false,
      options: {
        temperature: body.temperature ?? 0.7,
        num_predict: body.max_tokens ?? 4096,
      },
    }),
  });
}

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequest;

  if (!body.messages || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Try all OpenRouter keys before falling back
  const keyCount = getAllKeys("openrouter").length;
  for (let attempt = 0; attempt < keyCount; attempt++) {
    const entry = getKey("openrouter");
    if (!entry || !entry.key) continue;

    try {
      const response = await callOpenRouter(body, entry.key);

      if (!response.ok) {
        markExhausted("openrouter", entry.index);
        continue;
      }

      markUsed("openrouter", entry.index);

      if (body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const reader = response.body?.getReader();
        if (!reader) {
          res.status(500).json({ error: "No response stream" });
          return;
        }
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { res.end(); return; }
            res.write(value);
          }
        };
        await pump();
      } else {
        const data = await response.json();
        res.status(response.status).json(data);
      }
      return;
    } catch {
      markExhausted("openrouter", entry.index);
      continue;
    }
  }

  // Fallback: OpenRouter → Groq → Ollama
  const groqKeyCount = getAllKeys("groq").length;
  for (let attempt = 0; attempt < groqKeyCount; attempt++) {
    const entry = getKey("groq");
    if (!entry || !entry.key) continue;

    try {
      const groqRes = await callGroq(body, entry.key);

      if (!groqRes.ok) {
        markExhausted("groq", entry.index);
        continue;
      }

      markUsed("groq", entry.index);

      if (body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const reader = groqRes.body?.getReader();
        if (!reader) {
          res.status(500).json({ error: "No response stream" });
          return;
        }
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { res.end(); return; }
            res.write(value);
          }
        };
        await pump();
      } else {
        const data = await groqRes.json();
        res.status(groqRes.status).json({ ...(data as object), _fallback: "groq" });
      }
      return;
    } catch {
      markExhausted("groq", entry.index);
      continue;
    }
  }

  // Fallback to Ollama
  try {
    const ollamaRes = await callOllama(body);
    const data = await ollamaRes.json();

    // Normalize Ollama response to OpenAI format
    res.json({
      choices: [
        {
          message: {
            role: "assistant",
            content: (data as { message?: { content?: string } }).message?.content ?? "",
          },
          finish_reason: "stop",
        },
      ],
      model: body.model ?? "llama3.1",
      _fallback: "ollama",
    });
  } catch {
    res.status(503).json({
      error: "All AI providers unavailable",
      detail: "OpenRouter and Groq keys exhausted and Ollama is not reachable",
    });
  }
});

router.post("/timeline-command", async (req: Request, res: Response) => {
  const { message, timelineState } = req.body as {
    message: string;
    timelineState: { clips: { id: string; name: string; startTime: number; duration: number; track: number }[] };
  };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const systemPrompt = `You are a timeline editing assistant. The user has a video timeline with these clips:
${JSON.stringify(timelineState?.clips ?? [], null, 2)}

The user will give you a natural language instruction. Respond with ONLY a JSON object (no markdown, no explanation) with this structure:
{ "command": "<command>", "params": { ... }, "description": "<what you did>" }

Available commands:
- "add_clip": params: { src: string, name: string, startTime: number, duration: number, track: number }
- "remove_clip": params: { id: string }
- "move_clip": params: { id: string, startTime: number }
- "trim_clip": params: { id: string, duration: number }
- "clear_timeline": params: {}
- "none": params: {} (when the request is not a timeline action, just answer in description)

Always respond with valid JSON only.`;

  const chatBody: ChatRequest = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    temperature: 0.3,
    max_tokens: 512,
  };

  const keyCount = getAllKeys("openrouter").length;
  for (let attempt = 0; attempt < keyCount; attempt++) {
    const entry = getKey("openrouter");
    if (!entry || !entry.key) continue;
    try {
      const response = await callOpenRouter(chatBody, entry.key);
      if (!response.ok) { markExhausted("openrouter", entry.index); continue; }
      markUsed("openrouter", entry.index);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        res.json(parsed);
      } catch {
        res.json({ command: "none", params: {}, description: raw });
      }
      return;
    } catch { markExhausted("openrouter", entry.index); continue; }
  }

  const groqKeyCount = getAllKeys("groq").length;
  for (let attempt = 0; attempt < groqKeyCount; attempt++) {
    const entry = getKey("groq");
    if (!entry || !entry.key) continue;
    try {
      const groqRes = await callGroq(chatBody, entry.key);
      if (!groqRes.ok) { markExhausted("groq", entry.index); continue; }
      markUsed("groq", entry.index);
      const data = await groqRes.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        res.json(parsed);
      } catch {
        res.json({ command: "none", params: {}, description: raw });
      }
      return;
    } catch { markExhausted("groq", entry.index); continue; }
  }

  try {
    const ollamaRes = await callOllama(chatBody);
    const data = await ollamaRes.json() as { message?: { content?: string } };
    const raw = data.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      res.json(parsed);
    } catch {
      res.json({ command: "none", params: {}, description: raw });
    }
  } catch {
    res.status(503).json({ error: "All AI providers unavailable" });
  }
});

router.get("/usage", (_req: Request, res: Response) => {
  res.json(getDailyUsage("openrouter"));
});

export default router;
