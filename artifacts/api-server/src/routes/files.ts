import { Router } from "express";
import fs from "fs";
import path from "path";
import { filesDir, getDb } from "../lib/database";
import { loadAiIgnoreRules, shouldIgnore } from "../lib/aiignore";
import { searchSemantic, searchByFilename, searchBoth, indexDirectory } from "../lib/embeddings";

const router = Router();

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".js": "application/javascript",
    ".ts": "application/typescript",
    ".csv": "text/csv",
    ".log": "text/plain",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
    ".xml": "application/xml",
    ".html": "text/html",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

router.get("/files/list", (req, res) => {
  const rawPath = (req.query.path as string) ?? "/";
  const relPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
  const dirPath = relPath ? path.join(filesDir, relPath) : filesDir;

  if (!dirPath.startsWith(filesDir)) {
    return res.status(400).json({ error: "Path traversal not allowed" });
  }
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Directory not found" });
  }

  const rules = loadAiIgnoreRules(filesDir);
  const db = getDb();
  const indexedPaths = new Set(
    (db.prepare("SELECT path FROM file_index").all() as { path: string }[]).map((r) => r.path),
  );

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries
    .filter((e) => {
      const full = path.join(dirPath, e.name);
      return !shouldIgnore(full, filesDir, rules);
    })
    .map((e) => {
      const full = path.join(dirPath, e.name);
      const stat = fs.statSync(full);
      const relFilePath = path.relative(filesDir, full);
      return {
        name: e.name,
        path: relFilePath,
        type: e.isDirectory() ? "directory" : "file",
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        mimeType: e.isFile() ? getMimeType(e.name) : undefined,
        isIndexed: indexedPaths.has(relFilePath),
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const currentPath = relPath ? `/${relPath}` : "/";
  return res.json({ files, currentPath });
});

router.get("/files/content", (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path is required" });

  const full = path.join(filesDir, filePath);
  if (!full.startsWith(filesDir)) return res.status(400).json({ error: "Path traversal not allowed" });
  if (!fs.existsSync(full)) return res.status(404).json({ error: "File not found" });

  const stat = fs.statSync(full);
  const mimeType = getMimeType(path.basename(filePath));
  const isText = mimeType.startsWith("text/") || ["application/json", "application/javascript", "application/typescript", "application/yaml"].includes(mimeType);

  const content = isText ? fs.readFileSync(full, "utf-8") : "[Binary file — cannot display]";
  return res.json({ content, path: filePath, size: stat.size, mimeType });
});

router.post("/files/search", (req, res) => {
  const { query, mode = "both", limit = 20 } = req.body as {
    query: string;
    mode?: "semantic" | "filename" | "both";
    limit?: number;
  };

  if (!query) return res.status(400).json({ error: "query is required" });

  let results;
  if (mode === "semantic") results = searchSemantic(query, limit);
  else if (mode === "filename") results = searchByFilename(query, limit);
  else results = searchBoth(query, limit);

  const mapped = results.map((r) => {
    const full = path.join(filesDir, r.path);
    const stat = fs.existsSync(full) ? fs.statSync(full) : null;
    return {
      file: {
        name: path.basename(r.path),
        path: r.path,
        type: "file",
        size: stat?.size ?? 0,
        modifiedAt: stat?.mtime.toISOString() ?? new Date().toISOString(),
        mimeType: getMimeType(r.path),
        isIndexed: true,
      },
      score: r.score,
      matchType: r.matchType,
      snippet: r.snippet,
    };
  });

  return res.json({ results: mapped, query, mode });
});

router.post("/files/index", (req, res) => {
  const { path: dirPath = "/" } = req.body as { path?: string };
  const full = dirPath === "/" ? filesDir : path.join(filesDir, dirPath);

  if (!full.startsWith(filesDir)) return res.status(400).json({ error: "Path traversal not allowed" });

  const filesIndexed = indexDirectory(full);
  return res.json({ status: "indexed", filesIndexed });
});

export default router;
