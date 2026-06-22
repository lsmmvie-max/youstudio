import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { getKey, markUsed, markExhausted, getAllKeys, getDailyUsage } from "./key-manager.js";

const router = Router();

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";
const FAL_URL = "https://fal.run/fal-ai/flux/dev";
const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/sd3";
const ASSETS_DIR = "C:\\YouStudio\\assets";

interface ImageRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
}

function ensureDateDir(): string {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(ASSETS_DIR, date);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function callGemini(body: ImageRequest, apiKey: string): Promise<{ url: string }> {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: body.prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini returned ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
  };

  const parts = data.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData) throw new Error("No image data in Gemini response");

  const dir = ensureDateDir();
  const filename = `gen_${Date.now()}.png`;
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, "base64"));

  return { url: outPath };
}

async function callFal(body: ImageRequest, apiKey: string): Promise<{ url: string }> {
  const response = await fetch(FAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: body.prompt,
      negative_prompt: body.negative_prompt ?? "",
      image_size: {
        width: body.width ?? 1024,
        height: body.height ?? 1024,
      },
      num_inference_steps: body.steps ?? 28,
      num_images: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`fal.ai returned ${response.status}`);
  }

  const data = (await response.json()) as { images?: { url: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image URL in fal.ai response");
  return { url };
}

async function callStability(body: ImageRequest, apiKey: string): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("prompt", body.prompt);
  if (body.negative_prompt) formData.append("negative_prompt", body.negative_prompt);
  formData.append("output_format", "png");
  formData.append("width", String(body.width ?? 1024));
  formData.append("height", String(body.height ?? 1024));
  formData.append("steps", String(body.steps ?? 28));

  const response = await fetch(STABILITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Stability AI returned ${response.status}`);
  }

  const data = (await response.json()) as { image?: string };
  if (!data.image) throw new Error("No image data in Stability response");

  const dir = ensureDateDir();
  const filename = `gen_${Date.now()}.png`;
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, Buffer.from(data.image, "base64"));

  return { url: outPath };
}

async function tryProvider(
  provider: "gemini" | "fal" | "stability",
  callFn: (body: ImageRequest, key: string) => Promise<{ url: string }>,
  body: ImageRequest,
): Promise<{ provider: string; url: string } | null> {
  const keyCount = getAllKeys(provider).length;
  console.log(`[image] trying ${provider} (${keyCount} keys available)`);
  for (let attempt = 0; attempt < keyCount; attempt++) {
    const entry = getKey(provider);
    if (!entry) break;
    try {
      const result = await callFn(body, entry.key);
      markUsed(provider, entry.index);
      console.log(`[image] ${provider} key[${entry.index}] succeeded`);
      return { provider, ...result };
    } catch (err) {
      console.error(`[image] ${provider} key[${entry.index}] failed:`, (err as Error).message);
      markExhausted(provider, entry.index);
    }
  }
  return null;
}

router.post("/generate", async (req: Request, res: Response) => {
  const body = req.body as ImageRequest;

  if (!body.prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  // Fallback chain: Gemini → fal.ai → Stability AI
  const result =
    (await tryProvider("gemini", callGemini, body)) ??
    (await tryProvider("fal", callFal, body)) ??
    (await tryProvider("stability", callStability, body));

  if (result) {
    res.json(result);
    return;
  }

  res.status(503).json({
    error: "All image providers unavailable",
    detail: "Gemini, fal.ai, and Stability AI keys exhausted or unreachable",
  });
});

router.get("/usage", (_req: Request, res: Response) => {
  res.json({
    gemini: getDailyUsage("gemini"),
    fal: getDailyUsage("fal"),
    stability: getDailyUsage("stability"),
  });
});

export default router;
