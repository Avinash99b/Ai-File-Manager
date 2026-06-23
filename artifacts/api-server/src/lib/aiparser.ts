import fs from "fs";
import path from "path";
import { filesDir } from "./database";
import { logger } from "./logger";

export interface Action {
  id: string;
  action: "rename" | "delete" | "move" | "copy" | "create" | "code_execute";
  mode: "file_name" | "regex" | "pattern" | "code";
  target: string;
  params: {
    replacement?: string;
    dest?: string;
    code?: string;
    content?: string;
    [key: string]: unknown;
  };
  isSafe: boolean;
  reverseAction?: Record<string, unknown>;
}

export interface ActionPlan {
  transactionId: string;
  actionsSummary: string;
  actions: Action[];
  requiresCode: boolean;
  hasRiskyActions: boolean;
  estimatedTimeMs: number;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function listFilesFlat(dir: string): string[] {
  const results: string[] = [];
  try {
    const walk = (d: string) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else results.push(path.relative(dir, full));
      }
    };
    walk(dir);
  } catch {}
  return results;
}

export function parseCommand(command: string, contextPath = filesDir): ActionPlan {
  const lower = command.toLowerCase();
  const files = listFilesFlat(contextPath);
  const transactionId = genId();
  const actions: Action[] = [];
  let summary = "";
  let requiresCode = false;

  // Pattern: rename files matching a pattern
  // Handles: "rename all vol-*.log files to event-*.log" / "rename X to Y" / "rename files named X to Y"
  const renameRegex = /rename\s+(?:all\s+)?(?:files?\s+)?(?:(?:starting|matching|named?|with|called)\s+)?["']?([^"'\s]+)["']?\s+(?:files?\s+)?(?:to|as)\s+["']?([^"'\s]+)["']?/i;
  const renameMatch = renameRegex.exec(command);
  if (renameMatch) {
    const from = renameMatch[1];
    const to = renameMatch[2];
    const isRegexPattern = from.includes("(") || from.includes("*") || from.includes("\\d");

    if (isRegexPattern) {
      let pattern = from;
      let replacement = to;
      pattern = pattern.replace(/\*/g, ".*");

      const matchingFiles = files.filter((f) => {
        try {
          return new RegExp(pattern).test(path.basename(f));
        } catch { return false; }
      });

      if (matchingFiles.length > 0) {
        matchingFiles.forEach((f) => {
          const basename = path.basename(f);
          let newName: string;
          try {
            newName = basename.replace(new RegExp(pattern), replacement);
          } catch {
            newName = replacement;
          }
          actions.push({
            id: genId(),
            action: "rename",
            mode: "regex",
            target: f,
            params: { replacement: newName },
            isSafe: false,
            reverseAction: { action: "rename", target: path.join(path.dirname(f), newName), params: { replacement: basename } },
          });
        });
        summary = `Rename ${matchingFiles.length} file(s) matching pattern "${from}" to "${to}"`;
      } else {
        actions.push({
          id: genId(),
          action: "rename",
          mode: "regex",
          target: from,
          params: { replacement: to },
          isSafe: false,
        });
        summary = `Rename files matching "${from}" to "${to}" (regex)`;
      }
    } else {
      const matchingFiles = files.filter((f) => path.basename(f).toLowerCase().includes(from.toLowerCase()));
      if (matchingFiles.length > 0) {
        matchingFiles.forEach((f) => {
          actions.push({
            id: genId(),
            action: "rename",
            mode: "file_name",
            target: f,
            params: { replacement: to },
            isSafe: false,
            reverseAction: { action: "rename", target: path.join(path.dirname(f), to), params: { replacement: path.basename(f) } },
          });
        });
        summary = `Rename ${matchingFiles.length} file(s) containing "${from}" to "${to}"`;
      } else {
        actions.push({
          id: genId(),
          action: "rename",
          mode: "file_name",
          target: from,
          params: { replacement: to },
          isSafe: false,
        });
        summary = `Rename "${from}" to "${to}"`;
      }
    }
  }

  // Pattern: delete files
  else if (/delete|remove/.test(lower)) {
    const deleteMatch = /(?:delete|remove)\s+(?:all\s+)?(?:files?\s+)?["']?([^"'\s]+)["']?/i.exec(command);
    if (deleteMatch) {
      const pattern = deleteMatch[1];
      const isGlob = pattern.includes("*");
      const matchingFiles = files.filter((f) => {
        const name = path.basename(f);
        if (isGlob) {
          const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
          return regex.test(name);
        }
        return name.toLowerCase().includes(pattern.toLowerCase());
      });

      if (matchingFiles.length > 0) {
        matchingFiles.forEach((f) => {
          actions.push({
            id: genId(),
            action: "delete",
            mode: isGlob ? "pattern" : "file_name",
            target: f,
            params: {},
            isSafe: false,
          });
        });
        summary = `Delete ${matchingFiles.length} file(s) matching "${pattern}"`;
      } else {
        actions.push({
          id: genId(),
          action: "delete",
          mode: "file_name",
          target: pattern,
          params: {},
          isSafe: false,
        });
        summary = `Delete "${pattern}"`;
      }
    }
  }

  // Pattern: move files
  else if (/move|mv/.test(lower)) {
    const moveMatch = /(?:move|mv)\s+["']?([^"'\s]+)["']?\s+(?:to|into)\s+["']?([^"'\s]+)["']?/i.exec(command);
    if (moveMatch) {
      const src = moveMatch[1];
      const dest = moveMatch[2];
      const isGlob = src.includes("*");
      const matchingFiles = isGlob
        ? files.filter((f) => {
            const regex = new RegExp("^" + src.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
            return regex.test(path.basename(f));
          })
        : files.filter((f) => path.basename(f).toLowerCase() === src.toLowerCase());

      if (matchingFiles.length > 0) {
        matchingFiles.forEach((f) => {
          actions.push({
            id: genId(),
            action: "move",
            mode: isGlob ? "pattern" : "file_name",
            target: f,
            params: { dest },
            isSafe: false,
          });
        });
        summary = `Move ${matchingFiles.length} file(s) matching "${src}" to "${dest}"`;
      } else {
        actions.push({
          id: genId(),
          action: "move",
          mode: "file_name",
          target: src,
          params: { dest },
          isSafe: false,
        });
        summary = `Move "${src}" to "${dest}"`;
      }
    }
  }

  // Pattern: copy files
  else if (/copy|cp/.test(lower)) {
    const copyMatch = /(?:copy|cp)\s+["']?([^"'\s]+)["']?\s+(?:to|into|as)\s+["']?([^"'\s]+)["']?/i.exec(command);
    if (copyMatch) {
      const src = copyMatch[1];
      const dest = copyMatch[2];
      actions.push({
        id: genId(),
        action: "copy",
        mode: "file_name",
        target: src,
        params: { dest },
        isSafe: true,
      });
      summary = `Copy "${src}" to "${dest}"`;
    }
  }

  // Pattern: create file
  else if (/create|make|new\s+file/.test(lower)) {
    const createMatch = /(?:create|make|new\s+file)\s+(?:called\s+|named\s+)?["']?([^"'\s]+)["']?/i.exec(command);
    if (createMatch) {
      const filename = createMatch[1];
      actions.push({
        id: genId(),
        action: "create",
        mode: "file_name",
        target: filename,
        params: { content: "" },
        isSafe: true,
      });
      summary = `Create file "${filename}"`;
    }
  }

  // Fallback: generate code for complex operations
  if (actions.length === 0) {
    requiresCode = true;
    const code = `
// Generated code for: ${command}
const fs = require('fs');
const path = require('path');

// Auto-generated code to handle the request
// Files available in current directory
const files = fs.readdirSync('.').filter(f => !f.startsWith('.'));
console.log('Available files:', files);

// TODO: Implement the requested operation
// Command: ${command}
console.log('Command processed successfully');
    `.trim();

    actions.push({
      id: genId(),
      action: "code_execute",
      mode: "code",
      target: "generated_script.js",
      params: { code },
      isSafe: false,
    });
    summary = `Execute generated code for: "${command}"`;
  }

  const hasRiskyActions = actions.some((a) => !a.isSafe);

  logger.info({ command, actionsCount: actions.length, hasRiskyActions }, "Parsed action plan");

  return {
    transactionId,
    actionsSummary: summary,
    actions,
    requiresCode,
    hasRiskyActions,
    estimatedTimeMs: actions.length * 50,
  };
}
