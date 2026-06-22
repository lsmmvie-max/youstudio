import http from "http";

const MCP_PORT = 19789;

interface McpRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

interface TimelineClip {
  id: string;
  trackId: string;
  start: number;
  end: number;
  sourceUrl: string;
  type: "video" | "audio" | "image";
}

// In-memory timeline state (will be synced with the frontend via events)
let timelineState: {
  clips: TimelineClip[];
  duration: number;
  fps: number;
} = {
  clips: [],
  duration: 0,
  fps: 30,
};

export function updateTimelineState(state: typeof timelineState): void {
  timelineState = state;
}

const tools: Record<string, { description: string; parameters: Record<string, unknown>; handler: (params: Record<string, unknown>) => unknown | Promise<unknown> }> = {
  get_timeline_state: {
    description: "Returns the current timeline state including all clips, tracks, and duration",
    parameters: {},
    handler: () => timelineState,
  },

  add_clip_to_timeline: {
    description: "Adds a media clip to the timeline at the specified position",
    parameters: {
      trackId: { type: "string", description: "Target track ID" },
      sourceUrl: { type: "string", description: "Path or URL of the media file" },
      start: { type: "number", description: "Start time in seconds" },
      end: { type: "number", description: "End time in seconds" },
      type: { type: "string", enum: ["video", "audio", "image"], description: "Clip media type" },
    },
    handler: (params) => {
      const clip: TimelineClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        trackId: params.trackId as string,
        sourceUrl: params.sourceUrl as string,
        start: params.start as number,
        end: params.end as number,
        type: (params.type as TimelineClip["type"]) ?? "video",
      };
      timelineState.clips.push(clip);
      timelineState.duration = Math.max(timelineState.duration, clip.end);
      return { success: true, clip };
    },
  },

  move_clip: {
    description: "Moves a clip to a new position on the timeline",
    parameters: {
      clipId: { type: "string", description: "ID of the clip to move" },
      newStart: { type: "number", description: "New start time in seconds" },
      trackId: { type: "string", description: "Optional new track ID" },
    },
    handler: (params) => {
      const clip = timelineState.clips.find((c) => c.id === params.clipId);
      if (!clip) return { success: false, error: "Clip not found" };
      const duration = clip.end - clip.start;
      clip.start = params.newStart as number;
      clip.end = clip.start + duration;
      if (params.trackId) clip.trackId = params.trackId as string;
      timelineState.duration = Math.max(...timelineState.clips.map((c) => c.end));
      return { success: true, clip };
    },
  },

  trim_clip: {
    description: "Trims a clip's start and/or end point",
    parameters: {
      clipId: { type: "string", description: "ID of the clip to trim" },
      newStart: { type: "number", description: "New start time (optional)" },
      newEnd: { type: "number", description: "New end time (optional)" },
    },
    handler: (params) => {
      const clip = timelineState.clips.find((c) => c.id === params.clipId);
      if (!clip) return { success: false, error: "Clip not found" };
      if (params.newStart !== undefined) clip.start = params.newStart as number;
      if (params.newEnd !== undefined) clip.end = params.newEnd as number;
      timelineState.duration = Math.max(...timelineState.clips.map((c) => c.end));
      return { success: true, clip };
    },
  },

  delete_clip: {
    description: "Removes a clip from the timeline",
    parameters: {
      clipId: { type: "string", description: "ID of the clip to delete" },
    },
    handler: (params) => {
      const idx = timelineState.clips.findIndex((c) => c.id === params.clipId);
      if (idx === -1) return { success: false, error: "Clip not found" };
      const removed = timelineState.clips.splice(idx, 1)[0];
      if (timelineState.clips.length > 0) {
        timelineState.duration = Math.max(...timelineState.clips.map((c) => c.end));
      } else {
        timelineState.duration = 0;
      }
      return { success: true, removed };
    },
  },

  get_assets: {
    description: "Lists available media assets in the YouStudio assets folder",
    parameters: {
      type: { type: "string", description: "Filter by file type: video, audio, image, or all" },
    },
    handler: (params) => {
      const fs = require("fs") as typeof import("fs");
      const assetsDir = "C:\\YouStudio\\assets";
      if (!fs.existsSync(assetsDir)) return { assets: [] };

      const files = fs.readdirSync(assetsDir);
      const typeFilter = (params.type as string) ?? "all";

      const extMap: Record<string, string[]> = {
        video: [".mp4", ".mov", ".avi", ".mkv", ".webm"],
        audio: [".mp3", ".wav", ".ogg", ".flac", ".aac"],
        image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"],
      };

      const allowedExts = typeFilter === "all"
        ? Object.values(extMap).flat()
        : extMap[typeFilter] ?? [];

      const assets = files
        .filter((f) => {
          const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
          return allowedExts.includes(ext);
        })
        .map((f) => ({
          name: f,
          path: `C:\\YouStudio\\assets\\${f}`,
          type: Object.entries(extMap).find(([, exts]) =>
            exts.includes(f.slice(f.lastIndexOf(".")).toLowerCase())
          )?.[0] ?? "unknown",
        }));

      return { assets };
    },
  },

  generate_image: {
    description: "Generates an image using AI (fal.ai or Stability AI) and saves it to assets",
    parameters: {
      prompt: { type: "string", description: "Image generation prompt" },
      width: { type: "number", description: "Image width (default 1024)" },
      height: { type: "number", description: "Image height (default 1024)" },
    },
    handler: async (params) => {
      const response = await fetch("http://localhost:3737/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return response.json();
    },
  },

  get_transcript: {
    description: "Returns the transcript for a media file if available",
    parameters: {
      filePath: { type: "string", description: "Path to the media file" },
    },
    handler: (params) => {
      const fs = require("fs") as typeof import("fs");
      const filePath = params.filePath as string;
      const srtPath = filePath.replace(/\.[^.]+$/, ".srt");
      const vttPath = filePath.replace(/\.[^.]+$/, ".vtt");
      const jsonPath = filePath.replace(/\.[^.]+$/, ".transcript.json");

      for (const p of [jsonPath, srtPath, vttPath]) {
        if (fs.existsSync(p)) {
          return { format: p.split(".").pop(), content: fs.readFileSync(p, "utf-8") };
        }
      }
      return { error: "No transcript found for this file" };
    },
  },
};

async function handleMcpRequest(request: McpRequest): Promise<McpResponse> {
  if (request.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "youstudio-mcp", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    };
  }

  if (request.method === "tools/list") {
    const toolList = Object.entries(tools).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: {
        type: "object",
        properties: def.parameters,
      },
    }));
    return { jsonrpc: "2.0", id: request.id, result: { tools: toolList } };
  }

  if (request.method === "tools/call") {
    const toolName = request.params?.name as string;
    const toolArgs = (request.params?.arguments ?? {}) as Record<string, unknown>;
    const tool = tools[toolName];

    if (!tool) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      };
    }

    try {
      const result = await tool.handler(toolArgs);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }] },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message: String(err) },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: `Unknown method: ${request.method}` },
  };
}

export function startMcpServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString();

    try {
      const request = JSON.parse(body) as McpRequest;
      const response = await handleMcpRequest(request);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
    }
  });

  server.listen(MCP_PORT, () => {
    console.log(`[YouStudio] MCP server running on http://localhost:${MCP_PORT}`);
  });

  return server;
}
