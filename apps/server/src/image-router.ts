import { Router, type Request, type Response } from "express";
import { getKey, markUsed, markExhausted, getAllKeys, getDailyUsage } from "./key-manager.js";

const router = Router();

const FAL_URL = "https://queue.fal.run/fal-ai/flux/dev";
const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/sd3";

interface ImageRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
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

  // Stability returns base64 — save to assets and return path
  const filename = `gen_${Date.now()}.png`;
  const outPath = `C:\\YouStudio\\assets\\${filename}`;
  const buffer = Buffer.from(data.image, "base64");
  const fs = await import("fs");
  fs.writeFileSync(outPath, buffer);

  return { url: outPath };
}

router.post("/generate", async (req: Request, res: Response) => {
  const body = req.body as ImageRequest;

  if (!body.prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  // Try all fal.ai keys
  const falKeyCount = getAllKeys("fal").length;
  for (let attempt = 0; attempt < falKeyCount; attempt++) {
    const entry = getKey("fal");
    if (!entry) break;

    try {
      const result = await callFal(body, entry.key);
      markUsed("fal", entry.index);
      res.json({ provider: "fal", ...result });
      return;
    } catch {
      markExhausted("fal", entry.index);
      continue;
    }
  }

  // Fallback to Stability AI
  const stabKeyCount = getAllKeys("stability").length;
  for (let attempt = 0; attempt < stabKeyCount; attempt++) {
    const entry = getKey("stability");
    if (!entry) break;

    try {
      const result = await callStability(body, entry.key);
      markUsed("stability", entry.index);
      res.json({ provider: "stability", ...result });
      return;
    } catch {
      markExhausted("stability", entry.index);
      continue;
    }
  }

  res.status(503).json({
    error: "All image providers unavailable",
    detail: "fal.ai and Stability AI keys exhausted or unreachable",
  });
});

router.get("/usage", (_req: Request, res: Response) => {
  res.json({ fal: getDailyUsage("fal"), stability: getDailyUsage("stability") });
});

export default router;
