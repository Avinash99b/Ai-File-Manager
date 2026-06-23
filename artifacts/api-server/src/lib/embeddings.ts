import fs from "fs";
import path from "path";
import { getDb, filesDir } from "./database";
import { loadAiIgnoreRules, shouldIgnore } from "./aiignore";
import { logger } from "./logger";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "it", "its", "this", "that",
  "and", "or", "but", "not", "no", "so", "if", "then", "than",
]);

function computeTf(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  tokens.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1));
  freq.forEach((v, k) => freq.set(k, v / tokens.length));
  return freq;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  a.forEach((va, term) => {
    const vb = b.get(term) ?? 0;
    dot += va * vb;
    magA += va * va;
  });
  b.forEach((vb) => { magB += vb * vb; });
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function indexDirectory(dirPath: string = filesDir): number {
  const rules = loadAiIgnoreRules(dirPath);
  let count = 0;

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (shouldIgnore(fullPath, dirPath, rules)) continue;
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        indexFile(fullPath, dirPath);
        count++;
      }
    }
  }

  walk(dirPath);
  logger.info({ count, dirPath }, "Indexed directory");
  return count;
}

export function indexFile(filePath: string, rootDir: string = filesDir) {
  const db = getDb();
  try {
    const relativePath = path.relative(rootDir, filePath);
    const name = path.basename(filePath);
    let content = "";
    const ext = path.extname(name).toLowerCase();
    const textExts = [".txt", ".md", ".json", ".js", ".ts", ".csv", ".log", ".yaml", ".yml", ".xml", ".html", ".css"];
    if (textExts.includes(ext)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      content = raw.slice(0, 5000);
    }

    const text = `${name} ${relativePath.replace(/[/\\]/g, " ")} ${content}`;
    const tokens = tokenize(text);
    const tf = computeTf(tokens);
    const tfidfJson = JSON.stringify(Object.fromEntries(tf));
    const snippet = content.slice(0, 200).replace(/\n/g, " ").trim();

    db.prepare(`
      INSERT INTO file_index (path, name, content_snippet, tfidf_tokens, indexed_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        name=excluded.name,
        content_snippet=excluded.content_snippet,
        tfidf_tokens=excluded.tfidf_tokens,
        indexed_at=excluded.indexed_at
    `).run(relativePath, name, snippet, tfidfJson, Date.now());
  } catch (err) {
    logger.warn({ err, filePath }, "Failed to index file");
  }
}

export function removeFromIndex(relativePath: string) {
  const db = getDb();
  db.prepare("DELETE FROM file_index WHERE path = ?").run(relativePath);
}

export interface IndexedFile {
  path: string;
  name: string;
  snippet: string;
  score: number;
  matchType: "semantic" | "filename" | "both";
}

interface FileRow {
  path: string;
  name: string;
  content_snippet: string;
  tfidf_tokens: string;
}

export function searchSemantic(query: string, limit = 20): IndexedFile[] {
  const db = getDb();
  const queryTokens = tokenize(query);
  const queryTf = computeTf(queryTokens);

  const rows = db.prepare("SELECT path, name, content_snippet, tfidf_tokens FROM file_index").all() as FileRow[];

  return rows
    .map((row) => {
      let docTf: Map<string, number>;
      try {
        docTf = new Map(Object.entries(JSON.parse(row.tfidf_tokens || "{}")));
      } catch {
        docTf = new Map();
      }
      const score = cosineSimilarity(queryTf, docTf);
      return { path: row.path, name: row.name, snippet: row.content_snippet || "", score, matchType: "semantic" as const };
    })
    .filter((r) => r.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

interface SimpleRow {
  path: string;
  name: string;
  content_snippet: string;
}

export function searchByFilename(query: string, limit = 20): IndexedFile[] {
  const db = getDb();
  const lower = query.toLowerCase();
  const rows = db.prepare("SELECT path, name, content_snippet FROM file_index").all() as SimpleRow[];

  return rows
    .filter((r) => r.name.toLowerCase().includes(lower) || r.path.toLowerCase().includes(lower))
    .map((r) => ({
      path: r.path,
      name: r.name,
      snippet: r.content_snippet || "",
      score: r.name.toLowerCase() === lower ? 1.0 : r.name.toLowerCase().startsWith(lower) ? 0.8 : 0.5,
      matchType: "filename" as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchBoth(query: string, limit = 20): IndexedFile[] {
  const semantic = searchSemantic(query, limit);
  const filename = searchByFilename(query, limit);
  const byPath = new Map<string, IndexedFile>();

  filename.forEach((r) => byPath.set(r.path, r));
  semantic.forEach((r) => {
    const existing = byPath.get(r.path);
    if (existing) {
      existing.score = Math.max(existing.score, r.score);
      existing.matchType = "both";
    } else {
      byPath.set(r.path, r);
    }
  });

  return Array.from(byPath.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
