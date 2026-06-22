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

router.get("/usage", (_req: Request, res: Response) => {
  res.json(getDailyUsage("openrouter"));
});

export default router;
