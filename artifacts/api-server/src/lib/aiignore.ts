import fs from "fs";
import path from "path";

interface IgnoreRule {
  pattern: RegExp;
  negate: boolean;
  directory: boolean;
}

function parsePattern(raw: string): IgnoreRule | null {
  let line = raw.trim();
  if (!line || line.startsWith("#")) return null;

  const negate = line.startsWith("!");
  if (negate) line = line.slice(1);

  const directory = line.endsWith("/");
  if (directory) line = line.slice(0, -1);

  // Convert glob to regex
  const escaped = line
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "##DOUBLESTAR##")
    .replace(/\*/g, "[^/]*")
    .replace(/##DOUBLESTAR##/g, ".*")
    .replace(/\?/g, "[^/]");

  const anchored = line.startsWith("/");
  const regexStr = anchored ? `^${escaped}` : `(^|/)${escaped}`;

  try {
    return { pattern: new RegExp(`${regexStr}($|/)`), negate, directory };
  } catch {
    return null;
  }
}

export function loadAiIgnoreRules(dir: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  let current = dir;

  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const ignorePath = path.join(current, ".aiignore");
    if (fs.existsSync(ignorePath)) {
      const lines = fs.readFileSync(ignorePath, "utf-8").split("\n");
      lines.forEach((line) => {
        const rule = parsePattern(line);
        if (rule) rules.unshift(rule);
      });
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return rules;
}

export function shouldIgnore(filePath: string, rootDir: string, rules: IgnoreRule[]): boolean {
  const relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
  let ignored = false;

  for (const rule of rules) {
    if (rule.pattern.test(relative)) {
      ignored = !rule.negate;
    }
  }

  return ignored;
}
