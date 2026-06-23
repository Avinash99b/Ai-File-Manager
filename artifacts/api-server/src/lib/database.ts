import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

const workspaceRoot = (() => {
  let dir = process.cwd();
  if (dir.endsWith(path.join("artifacts", "api-server"))) {
    return path.resolve(dir, "../..");
  }
  return dir;
})();

export const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
export const filesDir = path.resolve(dataDir, "files");
export const tmpDir = path.resolve(dataDir, "tmp");
export const snapshotsDir = path.resolve(dataDir, "snapshots");
export const dbDir = path.resolve(dataDir, "db");

export function ensureDirectories() {
  [dataDir, filesDir, tmpDir, snapshotsDir, dbDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  ensureDirectories();
  const dbPath = path.join(dbDir, "filemanager.db");
  _db = new DatabaseSync(dbPath);
  initSchema(_db);
  seedSampleFiles();
  logger.info({ dbPath }, "Database initialized");
  return _db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      content_snippet TEXT,
      tfidf_tokens TEXT,
      indexed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      actions_summary TEXT NOT NULL,
      actions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tmp_path TEXT,
      snapshot_id TEXT,
      completed_actions TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      affected_files TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'local',
      size_mb REAL NOT NULL DEFAULT 0,
      checksum TEXT,
      snapshot_path TEXT,
      timestamp INTEGER NOT NULL
    );
  `);
}

function seedSampleFiles() {
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
  const sampleFiles = [
    {
      name: "README.md",
      content: `# AI File Manager\n\nThis is your managed file space. Use natural language commands to organize, search, and manage your files.\n\n## Getting Started\n\n- Use the search tab to find files by name or content\n- Use the AI command bar to perform bulk operations\n- All changes are transaction-based — review before committing\n`,
    },
    {
      name: "notes.txt",
      content: `Meeting notes - Q4 Planning\n\nAgenda:\n1. Review Q3 results\n2. Set Q4 targets\n3. Team updates\n4. Product roadmap\n\nAction items:\n- Follow up with design team\n- Review budget allocations\n- Schedule 1:1s with leads\n`,
    },
    {
      name: "vol-01.log",
      content: `[2024-01-01 00:00:01] Server started\n[2024-01-01 00:00:02] Connected to database\n[2024-01-01 00:01:00] Request processed\n`,
    },
    {
      name: "vol-02.log",
      content: `[2024-01-02 00:00:01] Server started\n[2024-01-02 00:05:00] Warning: High memory usage\n[2024-01-02 00:10:00] Recovered\n`,
    },
    {
      name: "vol-03.log",
      content: `[2024-01-03 00:00:01] Server started\n[2024-01-03 08:00:00] Peak load detected\n[2024-01-03 23:59:59] Shutdown\n`,
    },
    {
      name: "data.csv",
      content: `id,name,value,category\n1,Alpha,100,A\n2,Beta,200,B\n3,Gamma,150,A\n4,Delta,300,C\n5,Epsilon,250,B\n`,
    },
    {
      name: "config.json",
      content: JSON.stringify({ version: "1.0.0", environment: "development", maxSnapshots: 10, autoIndex: true, searchMode: "both" }, null, 2),
    },
    {
      name: "script.js",
      content: `// Sample JavaScript file\nconst data = [1, 2, 3, 4, 5];\nconst doubled = data.map(x => x * 2);\nconsole.log('Doubled values:', doubled);\n\nfunction greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nmodule.exports = { greet, doubled };\n`,
    },
  ];

  const subdir = path.join(filesDir, "archive");
  if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
  const archiveFiles = [
    { name: "old-report.txt", content: "Archived report from previous quarter.\n" },
    { name: "backup.json", content: '{"archived": true, "date": "2024-01-01"}\n' },
  ];

  sampleFiles.forEach(({ name, content }) => {
    const fp = path.join(filesDir, name);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, content);
  });
  archiveFiles.forEach(({ name, content }) => {
    const fp = path.join(subdir, name);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, content);
  });

  const aiIgnorePath = path.join(filesDir, ".aiignore");
  if (!fs.existsSync(aiIgnorePath)) {
    fs.writeFileSync(aiIgnorePath, `# AI File Manager ignore file\n# Syntax follows .gitignore rules\n\n*.tmp\n*.swp\n.DS_Store\n`);
  }
}
