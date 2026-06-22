import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import aiRouter from "./ai-router.js";
import imageRouter from "./image-router.js";
import { startMcpServer } from "./mcp-server.js";
import { getDailyUsage, type Provider } from "./key-manager.js";

const QUEUE_DIR = "C:\\YouStudio\\queue";

const PORT = 3737;
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/ai", aiRouter);
app.use("/image", imageRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0", name: "YouStudio Server" });
});

app.get("/brief/today", (_req, res) => {
  try {
    if (!fs.existsSync(QUEUE_DIR)) {
      res.status(404).json({ error: "No episodes prepared" });
      return;
    }

    const dirs = fs
      .readdirSync(QUEUE_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();

    for (const dir of dirs) {
      const manifestPath = path.join(QUEUE_DIR, dir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        res.json(manifest);
        return;
      }
    }

    res.status(404).json({ error: "No episodes prepared" });
  } catch {
    res.status(500).json({ error: "Failed to read queue" });
  }
});

app.use("/brief/image", express.static(QUEUE_DIR));

app.get("/usage", (_req, res) => {
  const providers: Provider[] = ["openrouter", "fal", "stability", "youtube"];
  const usage: Record<string, unknown> = {};
  for (const p of providers) {
    usage[p] = getDailyUsage(p);
  }
  res.json(usage);
});

app.listen(PORT, () => {
  console.log(`[YouStudio] API server running on http://localhost:${PORT}`);
});

startMcpServer();
