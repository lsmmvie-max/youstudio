import fs from "fs";
import path from "path";

const QUEUE_DIR = "C:\\YouStudio\\queue";
const STORY_QUEUE_PATH = "C:\\YouStudio\\story-queue.json";
const AI_URL = "http://localhost:3737/ai/chat";

interface EditingBlock {
  timestamp: string;
  narration: string;
  style: "LIGHT" | "INTENSE";
  characterVariant: string;
  background: string;
}

interface ImagePrompt {
  scene: number;
  prompt: string;
  filename: string;
  status: "pending";
}

interface Manifest {
  date: string;
  title: string;
  concept: string;
  estimatedDuration: number;
  wordCount: number;
  readingScript: string;
  editingScript: EditingBlock[];
  imagePrompts: ImagePrompt[];
  imagesGenerated: number;
  imagesTotal: number;
  generatedAt: string;
}

async function aiChat(
  system: string,
  userMessage: string,
  maxTokens = 4096
): Promise<string> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI call failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    message?: { content?: string };
  };
  return (
    data.choices?.[0]?.message?.content ?? data.message?.content ?? ""
  );
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getNextStoryIdea(): string | null {
  if (!fs.existsSync(STORY_QUEUE_PATH)) return null;
  try {
    const raw = fs.readFileSync(STORY_QUEUE_PATH, "utf-8").trim();
    if (!raw) return null;
    const queue = JSON.parse(raw) as string[];
    if (!Array.isArray(queue) || queue.length === 0) return null;
    const next = queue.shift()!;
    fs.writeFileSync(STORY_QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
    return next;
  } catch {
    return null;
  }
}

const PROFILE_PATH = "C:\\YouStudio\\channel-profile.json";

function getChannelProfile(): { storyStylePrompt?: string } | null {
  try {
    if (!fs.existsSync(PROFILE_PATH)) return null;
    return JSON.parse(fs.readFileSync(PROFILE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

const LEE_ANIMATIONS_SYSTEM = `You are a creative writer for "Lee Animations", a YouTube storytelling channel.

Style guide:
- Protagonist is ALWAYS a Portuguese teenager (male, ~16 years old)
- Stories involve school situations, family drama, friend groups, crushes, embarrassing moments
- Comedic timing is essential — build tension then release with humor
- Target duration: 10-15 minutes when read aloud (~2000-2500 words)
- Voice: conversational, like a teen telling a story to friends. Use "bro", casual language, mild exaggeration
- Structure: hook (first 30 seconds must grab attention), rising action, climax, resolution with a twist or lesson
- Cultural references: Portuguese school system, pastéis de nata, family Sunday lunches, strict parents, neighborhood dynamics
- NO profanity, NO violence, keep it family-friendly but relatable to teens`;

export async function runOvernightBrain(
  onProgress?: (step: string, detail: string) => void
): Promise<Manifest> {
  const today = getTodayString();
  const todayDir = path.join(QUEUE_DIR, today);
  const manifestPath = path.join(todayDir, "manifest.json");

  if (fs.existsSync(manifestPath)) {
    const existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
    return existing;
  }

  const log = (step: string, detail: string) => {
    console.log(`[OvernightBrain] ${step}: ${detail}`);
    onProgress?.(step, detail);
  };

  // Step 1: Get or generate story concept
  log("concept", "Finding next story idea...");
  let concept = getNextStoryIdea();

  const profile = getChannelProfile();
  let systemPrompt = LEE_ANIMATIONS_SYSTEM;
  if (profile?.storyStylePrompt) {
    systemPrompt += `\n\nAdditional story style guidance from the creator:\n${profile.storyStylePrompt}`;
  }

  if (!concept) {
    log("concept", "No queued ideas — generating one with AI...");
    concept = await aiChat(
      systemPrompt,
      `Generate a single story concept for a new Lee Animations episode.
Just give me the concept in 2-3 sentences — the situation, the conflict, and why it's funny.
Do NOT write the script, just the concept.`,
      500
    );
  }

  log("concept", `Got concept: ${concept.slice(0, 80)}...`);

  // Step 2: Generate reading script
  log("script", "Generating reading script...");
  const readingScript = await aiChat(
    systemPrompt,
    `Write the full narration script for this story concept:

"${concept}"

Requirements:
- 2000-2500 words
- First-person narration from the teenager's perspective
- Start with a strong hook
- Include dialogue (format with character names)
- Build comedic tension
- End with a twist or funny resolution
- Write it as a continuous reading script — this will be read aloud as a voiceover

Write ONLY the script text, nothing else.`,
    8192
  );

  const wordCount = readingScript.split(/\s+/).filter(Boolean).length;
  log("script", `Script generated: ${wordCount} words`);

  // Step 3: Generate editing script with image prompts
  log("editing", "Generating editing script and image prompts...");
  const editingRaw = await aiChat(
    `You are a video editor assistant for Lee Animations. You convert reading scripts into editing instructions.`,
    `Convert this reading script into an editing script with image prompts.

SCRIPT:
${readingScript}

Output EXACTLY this JSON format (no markdown fences, just raw JSON):
{
  "title": "Episode title (catchy, YouTube-style)",
  "editingScript": [
    {
      "timestamp": "0:00-0:30",
      "narration": "First chunk of narration text",
      "style": "LIGHT",
      "characterVariant": "casual standing",
      "background": "bedroom with posters"
    }
  ],
  "imagePrompts": [
    {
      "scene": 1,
      "prompt": "Detailed image generation prompt for this scene - anime style, Portuguese teenager, specific scene description",
      "filename": "scene_001.png"
    }
  ]
}

Rules:
- Split into 8-15 blocks of ~30-60 seconds each
- style is either "LIGHT" (comedy, casual) or "INTENSE" (drama, tension, climax)
- characterVariant describes the protagonist's pose/expression
- background describes the scene setting
- One imagePrompt per editing block
- Image prompts should be detailed enough for AI image generation — always mention "anime style, Portuguese teenage boy"`,
    8192
  );

  let title = "Untitled Episode";
  let editingScript: EditingBlock[] = [];
  let imagePrompts: ImagePrompt[] = [];

  try {
    const cleaned = editingRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      title?: string;
      editingScript?: EditingBlock[];
      imagePrompts?: Array<{ scene: number; prompt: string; filename: string }>;
    };
    title = parsed.title ?? title;
    editingScript = parsed.editingScript ?? [];
    imagePrompts = (parsed.imagePrompts ?? []).map((p) => ({
      ...p,
      status: "pending" as const,
    }));
  } catch {
    log("editing", "Failed to parse editing script JSON — saving raw output");
    editingScript = [
      {
        timestamp: "0:00-end",
        narration: "See reading script",
        style: "LIGHT",
        characterVariant: "default",
        background: "default",
      },
    ];
  }

  log("editing", `Editing script: ${editingScript.length} blocks, ${imagePrompts.length} image prompts`);

  // Step 4: Save manifest
  const manifest: Manifest = {
    date: today,
    title,
    concept,
    estimatedDuration: Math.round(wordCount / 150),
    wordCount,
    readingScript,
    editingScript,
    imagePrompts,
    imagesGenerated: 0,
    imagesTotal: imagePrompts.length,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(todayDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  log("done", `Manifest saved to ${manifestPath}`);

  return manifest;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("overnight-brain.ts")) {
  console.log("[OvernightBrain] Starting content generation pipeline...");
  runOvernightBrain()
    .then((m) => {
      console.log(`[OvernightBrain] Done! Episode: "${m.title}" (${m.wordCount} words, ${m.imagePrompts.length} images)`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[OvernightBrain] Failed:", err);
      process.exit(1);
    });
}
