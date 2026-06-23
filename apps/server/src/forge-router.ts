import { Router, type Request, type Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { generateImage } from "./image-router.js";

const CHARACTERS_DIR = "C:\\YouStudio\\characters";
const ASSETS_DIR = "C:\\YouStudio\\assets";
const REFERENCES_DIR = "C:\\YouStudio\\references";
const BACKGROUNDS_DIR = "C:\\YouStudio\\backgrounds";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

router.post("/characters", upload.single("image"), (req: Request, res: Response) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "image is required" });
    return;
  }
  const charDir = path.join(CHARACTERS_DIR, name);
  fs.mkdirSync(charDir, { recursive: true });
  const outPath = path.join(charDir, "reference.png");
  fs.writeFileSync(outPath, req.file.buffer);
  res.json({ ok: true, path: outPath });
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

router.get("/references", (_req: Request, res: Response) => {
  if (!fs.existsSync(REFERENCES_DIR)) {
    res.json({ references: [] });
    return;
  }
  const files = fs.readdirSync(REFERENCES_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  res.json({
    references: files.map((f) => ({
      filename: f,
      url: `/forge/reference-image/${f}`,
    })),
  });
});

router.post("/references", upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "image is required" });
    return;
  }
  fs.mkdirSync(REFERENCES_DIR, { recursive: true });
  const outPath = path.join(REFERENCES_DIR, req.file.originalname);
  fs.writeFileSync(outPath, req.file.buffer);
  res.json({ ok: true, filename: req.file.originalname, url: `/forge/reference-image/${req.file.originalname}` });
});

router.get("/reference-image/:filename", (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  const fp = path.join(REFERENCES_DIR, filename);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(fp);
});

router.get("/backgrounds", (_req: Request, res: Response) => {
  if (!fs.existsSync(BACKGROUNDS_DIR)) {
    res.json({ backgrounds: [] });
    return;
  }
  const files = fs.readdirSync(BACKGROUNDS_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  res.json({
    backgrounds: files.map((f) => ({
      filename: f,
      url: `/forge/background-image/${f}`,
    })),
  });
});

router.get("/background-image/:filename", (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  const fp = path.join(BACKGROUNDS_DIR, filename);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(fp);
});

router.post("/generate", async (req: Request, res: Response) => {
  const { prompt, style, filename, references, type } = req.body as {
    prompt?: string;
    style?: "LIGHT" | "INTENSE";
    filename?: string;
    references?: string[];
    type?: "character" | "background" | "asset";
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

    const outName = filename ?? `scene_${Date.now()}.png`;
    let outDir: string;
    let urlPath: string;

    if (type === "character") {
      outDir = path.join(CHARACTERS_DIR, "generated");
      fs.mkdirSync(outDir, { recursive: true });
      urlPath = `/forge/character-image/generated/${outName}`;
    } else if (type === "background") {
      outDir = BACKGROUNDS_DIR;
      fs.mkdirSync(outDir, { recursive: true });
      urlPath = `/forge/background-image/${outName}`;
    } else {
      const today = getTodayString();
      outDir = path.join(ASSETS_DIR, today);
      fs.mkdirSync(outDir, { recursive: true });
      urlPath = `/forge/image/${today}/${outName}`;
    }

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
      url: urlPath,
      localPath: outPath,
      filename: outName,
      type: type ?? "asset",
    });
  } catch (err) {
    console.error("[Forge] Generate failed:", err);
    res.status(500).json({ error: "Image generation failed" });
  }
});

router.post("/upload-asset", upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "image is required" }); return; }
  const today = getTodayString();
  const outDir = path.join(ASSETS_DIR, today);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, req.file.originalname);
  fs.writeFileSync(outPath, req.file.buffer);
  res.json({ ok: true, filename: req.file.originalname, url: `/forge/image/${today}/${req.file.originalname}` });
});

router.post("/upload-character", upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "image is required" }); return; }
  const charName = String(req.body?.name ?? "").trim() || "uploaded";
  const charDir = path.join(CHARACTERS_DIR, charName);
  fs.mkdirSync(charDir, { recursive: true });
  const outPath = path.join(charDir, req.file.originalname);
  fs.writeFileSync(outPath, req.file.buffer);
  res.json({ ok: true, filename: req.file.originalname, url: `/forge/character-image/${charName}/${req.file.originalname}` });
});

router.post("/upload-background", upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "image is required" }); return; }
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  const outPath = path.join(BACKGROUNDS_DIR, req.file.originalname);
  fs.writeFileSync(outPath, req.file.buffer);
  res.json({ ok: true, filename: req.file.originalname, url: `/forge/background-image/${req.file.originalname}` });
});

export default router;
