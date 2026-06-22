import fs from "fs";
import path from "path";
import { Database } from "bun:sqlite";

const DATA_DIR = "C:\\YouStudio";
const KEYS_PATH = path.join(DATA_DIR, "keys.json");
const DB_PATH = path.join(DATA_DIR, "youstudio.db");

interface KeysFile {
  openrouter: string[];
  gemini: string[];
  fal: string[];
  stability: string[];
  zenmux: string[];
  cloudflare: { accountId: string; tokens: string[] };
  youtube: string[];
  groq: string[];
}

export type Provider = keyof KeysFile;

let keys: KeysFile | null = null;
const rotationIndex: Record<Provider, number> = {
  openrouter: 0,
  gemini: 0,
  fal: 0,
  stability: 0,
  zenmux: 0,
  cloudflare: 0,
  youtube: 0,
  groq: 0,
};

function getProviderTokens(provider: Provider): string[] {
  const val = loadKeys()[provider];
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object" && "tokens" in val) return (val as { tokens: string[] }).tokens;
  return [];
}

function loadKeys(): KeysFile {
  if (keys) return keys;
  const raw = fs.readFileSync(KEYS_PATH, "utf-8");
  keys = JSON.parse(raw) as KeysFile;
  return keys;
}

export function reloadKeys(): void {
  keys = null;
  loadKeys();
}

const db = new Database(DB_PATH, { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS key_usage (
    provider TEXT NOT NULL,
    key_index INTEGER NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (provider, key_index, date)
  )
`);

const incrStmt = db.prepare(`
  INSERT INTO key_usage (provider, key_index, date, count)
  VALUES (?1, ?2, ?3, 1)
  ON CONFLICT (provider, key_index, date)
  DO UPDATE SET count = count + 1
`);

const usageStmt = db.prepare(`
  SELECT key_index, count FROM key_usage
  WHERE provider = ?1 AND date = ?2
`);

const totalStmt = db.prepare(`
  SELECT COALESCE(SUM(count), 0) as total FROM key_usage
  WHERE provider = ?1 AND date = ?2
`);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getKey(provider: Provider): { key: string; index: number } | null {
  const providerKeys = getProviderTokens(provider);
  if (providerKeys.length === 0) return null;

  const idx = rotationIndex[provider] % providerKeys.length;
  rotationIndex[provider] = idx + 1;

  return { key: providerKeys[idx], index: idx };
}

export function getAllKeys(provider: Provider): string[] {
  return getProviderTokens(provider);
}

export function getCloudflareConfig(): { accountId: string; token: string | null } {
  const cf = loadKeys().cloudflare;
  const tokens = cf.tokens ?? [];
  if (tokens.length === 0) return { accountId: cf.accountId, token: null };

  const idx = rotationIndex.cloudflare % tokens.length;
  rotationIndex.cloudflare = idx + 1;

  const token = tokens[idx];
  return { accountId: cf.accountId, token: token || null };
}

export function markUsed(provider: Provider, keyIndex: number): void {
  incrStmt.run(provider, keyIndex, today());
}

export function getDailyUsage(provider: Provider): { total: number; perKey: { index: number; count: number }[] } {
  const total = (totalStmt.get(provider, today()) as { total: number }).total;
  const perKey = usageStmt.all(provider, today()) as { key_index: number; count: number }[];
  return {
    total,
    perKey: perKey.map((r) => ({ index: r.key_index, count: r.count })),
  };
}

export function markExhausted(provider: Provider, keyIndex: number): void {
  const providerKeys = getProviderTokens(provider);
  if (providerKeys.length <= 1) return;
  if (rotationIndex[provider] % providerKeys.length === keyIndex) {
    rotationIndex[provider]++;
  }
}

