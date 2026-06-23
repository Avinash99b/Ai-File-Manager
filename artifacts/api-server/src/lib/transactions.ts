import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DatabaseSync } from "node:sqlite";
import { getDb, filesDir, tmpDir, snapshotsDir } from "./database";
import { indexFile, removeFromIndex } from "./embeddings";
import { logger } from "./logger";

export interface DbTransaction {
  id: string;
  command: string;
  actions_summary: string;
  actions_json: string;
  status: string;
  tmp_path: string | null;
  snapshot_id: string | null;
  completed_actions: string;
  created_at: number;
  updated_at: number;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createTransaction(id: string, command: string, actionsSummary: string, actions: unknown[]): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO transactions (id, command, actions_summary, actions_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, command, actionsSummary, JSON.stringify(actions), now, now);
}

export function updateTransaction(id: string, updates: Record<string, unknown>): void {
  const db = getDb();
  const fields = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(updates), Date.now(), id];
  db.prepare(`UPDATE transactions SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
}

export function getTransaction(id: string): DbTransaction | null {
  const db = getDb();
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as DbTransaction | null;
}

export function listTransactions(): DbTransaction[] {
  const db = getDb();
  return db.prepare("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50").all() as DbTransaction[];
}

export function setupTmpDir(transactionId: string): string {
  const tmpPath = path.join(tmpDir, transactionId);
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true });
  copyDirRecursive(filesDir, tmpPath);
  return tmpPath;
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

interface Action {
  id: string;
  action: string;
  mode: string;
  target: string;
  params: { replacement?: string; dest?: string; content?: string; code?: string; [key: string]: unknown };
  isSafe: boolean;
}

export function applyActionToTmp(
  action: Action,
  tmpPath: string,
): { before?: string; after?: string; action: string; error?: string } {
  const srcFile = path.join(tmpPath, action.target);
  try {
    switch (action.action) {
      case "rename": {
        if (!fs.existsSync(srcFile)) return { action: action.action, error: `File not found: ${action.target}` };
        const newName = action.params.replacement ?? "";
        const newPath = path.join(path.dirname(srcFile), newName);
        fs.renameSync(srcFile, newPath);
        return { before: action.target, after: path.join(path.dirname(action.target), newName), action: action.action };
      }
      case "delete": {
        if (!fs.existsSync(srcFile)) return { action: action.action, error: `File not found: ${action.target}` };
        fs.unlinkSync(srcFile);
        return { before: action.target, action: action.action };
      }
      case "move": {
        if (!fs.existsSync(srcFile)) return { action: action.action, error: `File not found: ${action.target}` };
        const destDir = path.join(tmpPath, action.params.dest ?? "");
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const destFile = path.join(destDir, path.basename(action.target));
        fs.renameSync(srcFile, destFile);
        return { before: action.target, after: path.join(action.params.dest ?? "", path.basename(action.target)), action: action.action };
      }
      case "copy": {
        if (!fs.existsSync(srcFile)) return { action: action.action, error: `File not found: ${action.target}` };
        const destPath = path.join(tmpPath, action.params.dest ?? `${action.target}.copy`);
        fs.copyFileSync(srcFile, destPath);
        return { before: action.target, after: action.params.dest, action: action.action };
      }
      case "create": {
        const createPath = path.join(tmpPath, action.target);
        fs.mkdirSync(path.dirname(createPath), { recursive: true });
        fs.writeFileSync(createPath, action.params.content ?? "");
        return { after: action.target, action: action.action };
      }
      default:
        return { action: action.action };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { action: action.action, error: message };
  }
}

export function commitTransaction(transactionId: string, tmpPath: string, actions: Action[]): string {
  const db = getDb();
  const snapshotId = genId();
  const affectedFiles = actions.map((a) => a.target);
  const snapshotPath = path.join(snapshotsDir, snapshotId);
  fs.mkdirSync(snapshotPath, { recursive: true });

  let sizeMb = 0;
  const hash = crypto.createHash("sha256");

  affectedFiles.forEach((relPath) => {
    const srcFile = path.join(filesDir, relPath);
    if (fs.existsSync(srcFile)) {
      const destFile = path.join(snapshotPath, relPath);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
      const stat = fs.statSync(srcFile);
      sizeMb += stat.size / (1024 * 1024);
      hash.update(fs.readFileSync(srcFile));
    }
  });

  const checksum = hash.digest("hex");
  db.prepare(`
    INSERT INTO snapshots (id, transaction_id, affected_files, location, size_mb, checksum, snapshot_path, timestamp)
    VALUES (?, ?, ?, 'local', ?, ?, ?, ?)
  `).run(snapshotId, transactionId, JSON.stringify(affectedFiles), sizeMb, checksum, snapshotPath, Date.now());

  for (const action of actions) {
    const srcReal = path.join(filesDir, action.target);
    try {
      switch (action.action) {
        case "rename": {
          const newName = action.params.replacement ?? "";
          const realNewPath = path.join(path.dirname(srcReal), newName);
          if (fs.existsSync(srcReal)) { fs.renameSync(srcReal, realNewPath); removeFromIndex(action.target); indexFile(realNewPath); }
          break;
        }
        case "delete": {
          if (fs.existsSync(srcReal)) { fs.unlinkSync(srcReal); removeFromIndex(action.target); }
          break;
        }
        case "move": {
          const destDir = path.join(filesDir, action.params.dest ?? "");
          fs.mkdirSync(destDir, { recursive: true });
          const destFile = path.join(destDir, path.basename(action.target));
          if (fs.existsSync(srcReal)) { fs.renameSync(srcReal, destFile); removeFromIndex(action.target); indexFile(destFile); }
          break;
        }
        case "copy": {
          const destPath = path.join(filesDir, action.params.dest ?? `${action.target}.copy`);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          if (fs.existsSync(srcReal)) { fs.copyFileSync(srcReal, destPath); indexFile(destPath); }
          break;
        }
        case "create": {
          const createPath = path.join(filesDir, action.target);
          fs.mkdirSync(path.dirname(createPath), { recursive: true });
          fs.writeFileSync(createPath, action.params.content ?? "");
          indexFile(createPath);
          break;
        }
        case "code_execute": {
          if (fs.existsSync(tmpPath)) copyDirRecursive(tmpPath, filesDir);
          break;
        }
      }
    } catch (err) {
      logger.warn({ err, action }, "Error committing action");
    }
  }

  try { fs.rmSync(tmpPath, { recursive: true, force: true }); } catch {}
  return snapshotId;
}

export function cleanupTmp(tmpPath: string) {
  try { fs.rmSync(tmpPath, { recursive: true, force: true }); } catch {}
}

export interface DbSnapshot {
  id: string;
  transaction_id: string;
  affected_files: string;
  location: string;
  size_mb: number;
  checksum: string | null;
  snapshot_path: string;
  timestamp: number;
}

export function listSnapshots(): DbSnapshot[] {
  const db = getDb();
  return db.prepare("SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 20").all() as DbSnapshot[];
}

export function getSnapshot(id: string): DbSnapshot | null {
  const db = getDb();
  return db.prepare("SELECT * FROM snapshots WHERE id = ?").get(id) as DbSnapshot | null;
}

export function restoreSnapshot(snapshotId: string): number {
  const snap = getSnapshot(snapshotId);
  if (!snap || !fs.existsSync(snap.snapshot_path)) throw new Error("Snapshot not found or path missing");

  const affectedFiles: string[] = JSON.parse(snap.affected_files);
  let restored = 0;
  affectedFiles.forEach((relPath) => {
    const snapFile = path.join(snap.snapshot_path, relPath);
    const realFile = path.join(filesDir, relPath);
    if (fs.existsSync(snapFile)) {
      fs.mkdirSync(path.dirname(realFile), { recursive: true });
      fs.copyFileSync(snapFile, realFile);
      indexFile(realFile);
      restored++;
    }
  });
  return restored;
}
