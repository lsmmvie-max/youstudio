import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { generateImage } from "./image-router.js";

const CHARACTERS_DIR = "C:\\YouStudio\\characters";
const ASSETS_DIR = "C:\\YouStudio\\assets";

const router = Router();

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

router.get("/characters", (_req: Request, res: Response) => {
  if (!fs.existsSync(CHARACTERS_DIR)) {
    res.json({ characters: [] });
    return;
  }

  const chars = fs
    .readdirSync(CHARACTERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const charDir = path.join(CHARACTERS_DIR, d.name);
      const variants = fs
        .readdirSync(charDir)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
      return {
        name: d.name,
        variants: variants.map((v) => ({
          filename: v,
          url: `/forge/character-image/${d.name}/${v}`,
        })),
        variantCount: variants.length,
      };
    });

  res.json({ characters: chars });
});

router.get("/character-image/:name/:file", (req: Request, res: Response) => {
  const name = String(req.params.name);
  const file = String(req.params.file);
  const fp = path.join(CHARACTERS_DIR, name, file);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(fp);
});

router.get("/assets", (_req: Request, res: Response) => {
  if (!fs.existsSync(ASSETS_DIR)) {
    res.json({ assets: [] });
    return;
  }

  const assets: {
    date: string;
    filename: string;
    url: string;
    size: number;
    createdAt: string;
  }[] = [];

  const entries = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)) {
      const dateDir = path.join(ASSETS_DIR, entry.name);
      const files = fs.readdirSync(dateDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
      for (const f of files) {
        const stat = fs.statSync(path.join(dateDir, f));
        assets.push({
          date: entry.name,
          filename: f,
          url: `/forge/image/${entry.name}/${f}`,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      }
    } else if (entry.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
      const stat = fs.statSync(path.join(ASSETS_DIR, entry.name));
      assets.push({
        date: "unsorted",
        filename: entry.name,
        url: `/forge/image/unsorted/${entry.name}`,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      });
    }
  }

  assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ assets });
});

router.get("/image/unsorted/:filename", (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  const fp = path.join(ASSETS_DIR, filename);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(fp);
});

router.get("/image/:date/:filename", (req: Request, res: Response) => {
  const date = String(req.params.date);
  const filename = String(req.params.filename);
  const fp = path.join(ASSETS_DIR, date, filename);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(fp);
});

router.post("/generate", async (req: Request, res: Response) => {
  const { prompt, style, filename } = req.body as {
    prompt?: string;
    style?: "LIGHT" | "INTENSE";
    filename?: string;
  };

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const fullPrompt =
    style === "INTENSE"
      ? `${prompt}, dark dramatic lighting, high contrast, intense atmosphere`
      : prompt;

  try {
    const data = await generateImage({
      prompt: fullPrompt,
      width: 1280,
      height: 720,
    });

    const today = getTodayString();
    const outDir = path.join(ASSETS_DIR, today);
    fs.mkdirSync(outDir, { recursive: true });

    const outName = filename ?? `scene_${Date.now()}.png`;
    const outPath = path.join(outDir, outName);

    if (data.url.startsWith("http")) {
      const imgRes = await fetch(data.url);
      if (!imgRes.ok) throw new Error("Failed to download generated image");
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(outPath, buffer);
    } else if (fs.existsSync(data.url)) {
      fs.copyFileSync(data.url, outPath);
    }

    res.json({
      provider: data.provider,
      url: `/forge/image/${today}/${outName}`,
      localPath: outPath,
      filename: outName,
    });
  } catch (err) {
    console.error("[Forge] Generate failed:", err);
    res.status(500).json({ error: "Image generation failed" });
  }
});

export default router;
