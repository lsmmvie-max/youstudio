import { Router, type Request, type Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

const RECORDINGS_DIR = "C:\\YouStudio\\recordings";

function getTodayDir(): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return path.join(RECORDINGS_DIR, date);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = getTodayDir();
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    cb(null, `take-${Date.now()}.webm`);
  },
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const router = Router();

router.post("/upload", upload.single("audio"), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }
  res.json({
    id: path.basename(file.filename, ".webm"),
    filename: file.filename,
    path: file.path,
  });
});

router.get("/takes", (_req: Request, res: Response) => {
  const dir = getTodayDir();
  if (!fs.existsSync(dir)) {
    res.json({ takes: [], selected: null });
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      return {
        id: path.basename(f, ".webm"),
        filename: f,
        size: stat.size,
        duration: null,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let selected: string | null = null;
  const selPath = path.join(dir, "selected-take.json");
  if (fs.existsSync(selPath)) {
    try {
      selected = JSON.parse(fs.readFileSync(selPath, "utf-8")).id ?? null;
    } catch {}
  }

  res.json({ takes: files, selected });
});

router.delete("/takes/:id", (req: Request, res: Response) => {
  const dir = getTodayDir();
  const fp = path.join(dir, `${req.params.id}.webm`);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Take not found" });
    return;
  }
  fs.unlinkSync(fp);
  res.json({ ok: true });
});

router.put("/takes/:id/select", (req: Request, res: Response) => {
  const dir = getTodayDir();
  const fp = path.join(dir, `${req.params.id}.webm`);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Take not found" });
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "selected-take.json"),
    JSON.stringify({ id: req.params.id, selectedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
  res.json({ ok: true, id: req.params.id });
});

router.post("/transcribe", (_req: Request, res: Response) => {
  const dir = getTodayDir();
  const selPath = path.join(dir, "selected-take.json");

  if (!fs.existsSync(selPath)) {
    res.status(400).json({ error: "No take selected. Select a take first." });
    return;
  }

  let takeId: string;
  try {
    takeId = JSON.parse(fs.readFileSync(selPath, "utf-8")).id;
  } catch {
    res.status(500).json({ error: "Failed to read selected take" });
    return;
  }

  const audioPath = path.join(dir, `${takeId}.webm`);
  if (!fs.existsSync(audioPath)) {
    res.status(404).json({ error: "Selected take file not found" });
    return;
  }

  // Try whisper.cpp first
  const whisperPaths = [
    "C:\\whisper.cpp\\main.exe",
    "C:\\whisper.cpp\\build\\bin\\Release\\main.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "whisper.cpp", "main.exe"),
  ];
  const modelPaths = [
    "C:\\whisper.cpp\\models\\ggml-base.en.bin",
    "C:\\whisper.cpp\\models\\ggml-base.bin",
    "C:\\whisper.cpp\\models\\ggml-small.en.bin",
  ];

  const whisperBin = whisperPaths.find((p) => fs.existsSync(p));
  const modelFile = modelPaths.find((p) => fs.existsSync(p));

  if (!whisperBin || !modelFile) {
    res.json({
      text: "[Whisper not installed — showing mock transcript]",
      segments: [
        { start: 0, end: 5, text: "This is a mock transcript." },
        { start: 5, end: 10, text: "Install whisper.cpp to get real transcription." },
      ],
      mock: true,
      installGuide:
        "Install whisper.cpp: git clone https://github.com/ggerganov/whisper.cpp C:\\whisper.cpp && cd C:\\whisper.cpp && cmake -B build && cmake --build build --config Release && .\\models\\download-ggml-model.cmd base.en",
    });
    return;
  }

  const outputPath = path.join(dir, `${takeId}-transcript`);
  execFile(
    whisperBin,
    ["-m", modelFile, "-f", audioPath, "-otxt", "-of", outputPath],
    { timeout: 120_000 },
    (err) => {
      if (err) {
        console.error("[Whisper] Error:", err);
        res.status(500).json({ error: "Whisper transcription failed", detail: err.message });
        return;
      }

      const txtPath = `${outputPath}.txt`;
      if (!fs.existsSync(txtPath)) {
        res.status(500).json({ error: "Whisper produced no output" });
        return;
      }

      const text = fs.readFileSync(txtPath, "utf-8").trim();
      res.json({ text, segments: [], mock: false });
    }
  );
});

router.get("/transcript", (_req: Request, res: Response) => {
  const dir = getTodayDir();
  const selPath = path.join(dir, "selected-take.json");

  if (!fs.existsSync(selPath)) {
    res.status(404).json({ error: "No take selected" });
    return;
  }

  let takeId: string;
  try {
    takeId = JSON.parse(fs.readFileSync(selPath, "utf-8")).id;
  } catch {
    res.status(500).json({ error: "Failed to read selected take" });
    return;
  }

  const txtPath = path.join(dir, `${takeId}-transcript.txt`);
  const jsonPath = path.join(dir, `${takeId}-transcript.json`);

  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      res.json(data);
      return;
    } catch {}
  }

  if (fs.existsSync(txtPath)) {
    const text = fs.readFileSync(txtPath, "utf-8").trim();
    res.json({ text, segments: [], mock: false });
    return;
  }

  res.json({
    text: "",
    segments: [
      { start: 0, end: 3, text: "Sample caption line one." },
      { start: 3, end: 6, text: "Sample caption line two." },
      { start: 6, end: 9, text: "Sample caption line three." },
    ],
    mock: true,
  });
});

router.get("/audio/:filename", (req: Request, res: Response) => {
  const dir = getTodayDir();
  const filename = String(req.params.filename);
  const fp = path.join(dir, filename);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(fp);
});

export default router;
