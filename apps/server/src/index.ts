import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import aiRouter from "./ai-router.js";
import imageRouter from "./image-router.js";
import voiceRouter from "./voice-router.js";
import forgeRouter from "./forge-router.js";
import { startMcpServer } from "./mcp-server.js";
import { getDailyUsage, reloadKeys, type Provider } from "./key-manager.js";
import { runOvernightBrain } from "./overnight-brain.js";

const QUEUE_DIR = "C:\\YouStudio\\queue";

const PORT = 3737;
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(express.json({ limit: "50mb" }));

app.use("/ai", aiRouter);
app.use("/image", imageRouter);
app.use("/voice", voiceRouter);
app.use("/forge", forgeRouter);

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

app.delete("/brief/today", (_req, res) => {
  try {
    if (!fs.existsSync(QUEUE_DIR)) {
      res.json({ ok: true, message: "No queue directory" });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const manifestPath = path.join(QUEUE_DIR, today, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete manifest" });
  }
});

app.use("/brief/image", express.static(QUEUE_DIR));

app.get("/brief/script", (_req, res) => {
  try {
    if (!fs.existsSync(QUEUE_DIR)) {
      res.status(404).json({ error: "No script available" });
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
        res.json({
          readingScript: manifest.readingScript ?? "",
          editingScript: manifest.editingScript ?? [],
          wordCount: manifest.wordCount ?? 0,
        });
        return;
      }
    }

    res.status(404).json({ error: "No script available" });
  } catch {
    res.status(500).json({ error: "Failed to read script" });
  }
});

app.get("/brief/story-queue", (_req, res) => {
  const STORY_QUEUE_PATH = "C:\\YouStudio\\story-queue.json";
  try {
    if (!fs.existsSync(STORY_QUEUE_PATH)) {
      res.json([]);
      return;
    }
    const raw = fs.readFileSync(STORY_QUEUE_PATH, "utf-8").trim();
    if (!raw) {
      res.json([]);
      return;
    }
    res.json(JSON.parse(raw));
  } catch {
    res.json([]);
  }
});

app.put("/brief/story-queue", (req, res) => {
  const STORY_QUEUE_PATH = "C:\\YouStudio\\story-queue.json";
  try {
    const queue = req.body;
    if (!Array.isArray(queue)) {
      res.status(400).json({ error: "Expected an array" });
      return;
    }
    fs.writeFileSync(STORY_QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
    res.json({ ok: true, count: queue.length });
  } catch {
    res.status(500).json({ error: "Failed to save story queue" });
  }
});

app.post("/brief/run", async (_req, res) => {
  try {
    const manifest = await runOvernightBrain((step, detail) => {
      console.log(`[POST /brief/run] ${step}: ${detail}`);
    });
    res.json(manifest);
  } catch (err) {
    console.error("[POST /brief/run] Failed:", err);
    res.status(500).json({ error: "Overnight Brain pipeline failed" });
  }
});

const EXPORTS_DIR = "C:\\YouStudio\\exports";

app.post("/packaging/export-youtube", (req, res) => {
  try {
    const { title, description, tags } = req.body as {
      title?: string;
      description?: string;
      tags?: string;
    };

    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(EXPORTS_DIR, today, "youtube");
    fs.mkdirSync(dir, { recursive: true });

    if (title) fs.writeFileSync(path.join(dir, "title.txt"), title, "utf-8");
    if (description) fs.writeFileSync(path.join(dir, "description.txt"), description, "utf-8");
    if (tags) fs.writeFileSync(path.join(dir, "tags.txt"), tags, "utf-8");

    res.json({
      ok: true,
      path: dir,
      files: ["title.txt", "description.txt", "tags.txt"],
    });
  } catch {
    res.status(500).json({ error: "Failed to export YouTube package" });
  }
});

app.post("/packaging/export-reel", (req, res) => {
  try {
    const { start, end, title } = req.body as {
      start?: string;
      end?: string;
      title?: string;
    };

    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(EXPORTS_DIR, today, "reel");
    fs.mkdirSync(dir, { recursive: true });

    const metadata = { title: title ?? "", start: start ?? "00:00", end: end ?? "00:15", exportedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dir, "reel-metadata.json"), JSON.stringify(metadata, null, 2), "utf-8");

    res.json({ ok: true, path: dir });
  } catch {
    res.status(500).json({ error: "Failed to export reel metadata" });
  }
});

app.post("/keys/reload", (_req, res) => {
  reloadKeys();
  res.json({ ok: true, message: "Keys reloaded from disk" });
});

const KEYS_PATH = "C:\\YouStudio\\keys.json";
const PROFILE_PATH = "C:\\YouStudio\\channel-profile.json";

function maskKey(key: string): string {
  if (!key || key.length < 5) return key ? "****" : "";
  return key.slice(0, 4) + "...";
}

app.get("/settings/keys", (_req, res) => {
  try {
    const raw = JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
    const masked = {
      openrouter: (raw.openrouter ?? []).map(maskKey),
      groq: (raw.groq ?? []).map(maskKey),
      cloudflare: {
        accountId: maskKey(raw.cloudflare?.accountId ?? ""),
        tokens: (raw.cloudflare?.tokens ?? []).map(maskKey),
      },
      fal: (raw.fal ?? []).map(maskKey),
      stability: (raw.stability ?? []).map(maskKey),
      youtube: maskKey(typeof raw.youtube === "string" ? raw.youtube : ""),
    };
    res.json(masked);
  } catch {
    res.status(500).json({ error: "Failed to read keys" });
  }
});

app.put("/settings/keys", (req, res) => {
  try {
    const existing = JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
    const body = req.body as Record<string, unknown>;

    const mergeArr = (newArr: string[] | undefined, oldArr: string[]): string[] => {
      if (!newArr) return oldArr;
      return newArr.map((v, i) => (v && !v.endsWith("...") ? v : oldArr[i] ?? ""));
    };

    const updated = {
      ...existing,
      openrouter: mergeArr(body.openrouter as string[], existing.openrouter ?? []),
      groq: mergeArr(body.groq as string[], existing.groq ?? []),
      fal: mergeArr(body.fal as string[], existing.fal ?? []),
      stability: mergeArr(body.stability as string[], existing.stability ?? []),
      zenmux: existing.zenmux ?? [],
      cloudflare: {
        accountId: (() => {
          const cf = body.cloudflare as { accountId?: string; tokens?: string[] } | undefined;
          const v = cf?.accountId ?? "";
          return v && !v.endsWith("...") ? v : existing.cloudflare?.accountId ?? "";
        })(),
        tokens: mergeArr(
          (body.cloudflare as { tokens?: string[] })?.tokens,
          existing.cloudflare?.tokens ?? [],
        ),
      },
      youtube: (() => {
        const v = body.youtube as string ?? "";
        return v && !v.endsWith("...") ? v : existing.youtube ?? "";
      })(),
    };

    fs.writeFileSync(KEYS_PATH, JSON.stringify(updated, null, 2), "utf-8");
    reloadKeys();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save keys" });
  }
});

app.get("/settings/test-key", async (req, res) => {
  const provider = String(req.query.provider ?? "");
  const key = String(req.query.key ?? "");
  if (!provider || !key) {
    res.json({ ok: false, error: "provider and key required" });
    return;
  }
  try {
    let ok = false;
    if (provider === "openrouter" || provider === "groq") {
      const base = provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.groq.com/openai/v1";
      const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
      ok = r.ok;
    } else if (provider === "fal") {
      ok = key.includes(":");
    } else if (provider === "stability") {
      const r = await fetch("https://api.stability.ai/v1/user/balance", { headers: { Authorization: `Bearer ${key}` } });
      ok = r.ok;
    } else if (provider === "cloudflare") {
      const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { Authorization: `Bearer ${key}` } });
      ok = r.ok;
    } else {
      ok = key.length > 0;
    }
    res.json({ ok });
  } catch {
    res.json({ ok: false });
  }
});

app.get("/settings/profile", (_req, res) => {
  try {
    if (!fs.existsSync(PROFILE_PATH)) {
      res.json({ channelName: "", mainCharacterName: "", contentStyle: "Storytelling", targetAudienceAge: "", language: "Portuguese" });
      return;
    }
    res.json(JSON.parse(fs.readFileSync(PROFILE_PATH, "utf-8")));
  } catch {
    res.status(500).json({ error: "Failed to read profile" });
  }
});

app.put("/settings/profile", (req, res) => {
  try {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// --- Project save/load ---
const PROJECTS_DIR = "C:\\YouStudio\\projects";

app.post("/projects/save", (req, res) => {
  try {
    const { name, clips, transitions } = req.body as {
      name: string;
      clips: unknown[];
      transitions: unknown[];
    };
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    const timestamp = Date.now();
    const id = `proj-${timestamp}`;
    const filename = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}-${timestamp}.json`;
    const filePath = path.join(PROJECTS_DIR, filename);
    const project = {
      id,
      name,
      date: new Date().toISOString(),
      clipCount: clips?.length ?? 0,
      clips: clips ?? [],
      transitions: transitions ?? [],
    };
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), "utf-8");
    res.json({ id, path: filePath });
  } catch {
    res.status(500).json({ error: "Failed to save project" });
  }
});

app.get("/projects/list", (_req, res) => {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      res.json({ projects: [] });
      return;
    }
    const files = fs
      .readdirSync(PROJECTS_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    const projects = files.map((f) => {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(PROJECTS_DIR, f), "utf-8")
        );
        return {
          id: raw.id ?? f,
          name: raw.name ?? f.replace(".json", ""),
          date: raw.date ?? "",
          clipCount: raw.clipCount ?? 0,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    res.json({ projects });
  } catch {
    res.status(500).json({ error: "Failed to list projects" });
  }
});

app.get("/projects/:id", (req, res) => {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(PROJECTS_DIR, f), "utf-8")
        );
        if (raw.id === req.params.id) {
          res.json({ clips: raw.clips ?? [], transitions: raw.transitions ?? [] });
          return;
        }
      } catch { /* skip corrupt files */ }
    }
    res.status(404).json({ error: "Project not found" });
  } catch {
    res.status(500).json({ error: "Failed to load project" });
  }
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
