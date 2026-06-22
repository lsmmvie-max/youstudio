import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { getKey, markUsed, markExhausted, getAllKeys, getDailyUsage, getCloudflareConfig, type Provider } from "./key-manager.js";

const router = Router();

const CLOUDFLARE_URL = "https://api.cloudflare.com/client/v4/accounts";
const ZENMUX_URL = "https://zenmux.ai/api/v1/images/generations";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";
const FAL_URL = "https://fal.run/fal-ai/flux/dev";
const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/core";
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

async function callCloudflare(body: ImageRequest, accountId: string, token: string): Promise<{ url: string }> {
  const url = `${CLOUDFLARE_URL}/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt: body.prompt,
      num_steps: 4,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let buffer: Buffer;

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { image?: string; result?: { image?: string } };
    const b64 = data.image ?? data.result?.image;
    if (!b64) throw new Error("No image data in Cloudflare JSON response");
    buffer = Buffer.from(b64, "base64");
  } else {
    buffer = Buffer.from(await response.arrayBuffer());
  }

  const dir = ensureDateDir();
  const filename = `gen_${Date.now()}.png`;
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, buffer);

  return { url: outPath };
}

async function callZenMux(body: ImageRequest, apiKey: string): Promise<{ url: string }> {
  const response = await fetch(ZENMUX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-free",
      prompt: body.prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    throw new Error(`ZenMux returned ${response.status}`);
  }

  const data = (await response.json()) as {
    data?: { b64_json?: string }[];
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data in ZenMux response");

  const dir = ensureDateDir();
  const filename = `gen_${Date.now()}.png`;
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, Buffer.from(b64, "base64"));

  return { url: outPath };
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
  formData.append("output_format", "jpeg");

  const response = await fetch(STABILITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Stability AI returned ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = ensureDateDir();
  const filename = `gen_${Date.now()}.jpg`;
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, buffer);

  return { url: outPath };
}

async function tryProvider(
  provider: Provider,
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

  // Fallback chain: Cloudflare → fal.ai → Gemini → Stability AI
  let result: { provider: string; url: string } | null = null;

  const cf = getCloudflareConfig();
  if (cf.accountId && cf.token) {
    try {
      const r = await callCloudflare(body, cf.accountId, cf.token);
      console.log("[image] cloudflare succeeded");
      result = { provider: "cloudflare", ...r };
    } catch (err) {
      console.error("[image] cloudflare failed:", (err as Error).message);
    }
  }

  if (!result) {
    result =
      (await tryProvider("fal", callFal, body)) ??
      (await tryProvider("gemini", callGemini, body)) ??
      (await tryProvider("stability", callStability, body));
  }

  if (result) {
    res.json(result);
    return;
  }

  res.status(503).json({
    error: "All image providers unavailable",
    detail: "Cloudflare, fal.ai, Gemini, and Stability AI keys exhausted or unreachable",
  });
});

router.get("/usage", (_req: Request, res: Response) => {
  res.json({
    cloudflare: getDailyUsage("cloudflare"),
    gemini: getDailyUsage("gemini"),
    fal: getDailyUsage("fal"),
    stability: getDailyUsage("stability"),
  });
});

router.get("/test", (_req: Request, res: Response) => {
  const providers = ["cloudflare", "gemini", "fal", "stability"] as const;
  const status = providers.map((p) => {
    const keys = getAllKeys(p);
    const configured = keys.filter((k) => k.length > 0).length;
    const usage = getDailyUsage(p);
    return {
      provider: p,
      keysTotal: keys.length,
      keysConfigured: configured,
      todayRequests: usage.total,
      perKey: usage.perKey,
    };
  });

  res.json({
    timestamp: new Date().toISOString(),
    providers: status,
    fallbackOrder: ["cloudflare", "fal", "gemini", "stability"],
  });
});

export async function generateImage(body: ImageRequest): Promise<{ provider: string; url: string }> {
  let result: { provider: string; url: string } | null = null;

  const cf = getCloudflareConfig();
  if (cf.accountId && cf.token) {
    try {
      const r = await callCloudflare(body, cf.accountId, cf.token);
      result = { provider: "cloudflare", ...r };
    } catch (err) {
      console.error("[image] cloudflare failed:", (err as Error).message);
    }
  }

  if (!result) {
    result =
      (await tryProvider("fal", callFal, body)) ??
      (await tryProvider("gemini", callGemini, body)) ??
      (await tryProvider("stability", callStability, body));
  }

  if (!result) {
    throw new Error("All image providers unavailable");
  }

  return result;
}

export default router;
