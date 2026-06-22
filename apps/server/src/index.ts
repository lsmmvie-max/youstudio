import express from "express";
import cors from "cors";
import aiRouter from "./ai-router.js";
import imageRouter from "./image-router.js";
import { startMcpServer } from "./mcp-server.js";
import { getDailyUsage, type Provider } from "./key-manager.js";

const PORT = 3737;
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/ai", aiRouter);
app.use("/image", imageRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0", name: "YouStudio Server" });
});

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
