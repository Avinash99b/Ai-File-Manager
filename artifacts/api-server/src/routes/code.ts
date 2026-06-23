import { Router } from "express";
import vm from "vm";
import fs from "fs";
import path from "path";
import { filesDir, tmpDir } from "../lib/database";
import { getTransaction } from "../lib/transactions";
import { logger } from "../lib/logger";

const router = Router();

const ALLOWED_MODULES = new Set(["path", "crypto", "os", "url", "querystring", "util"]);

router.post("/code/execute", (req, res) => {
  const { code, transactionId } = req.body as { code: string; transactionId: string };
  if (!code) return res.status(400).json({ error: "code is required" });
  if (!transactionId) return res.status(400).json({ error: "transactionId is required" });

  const txn = getTransaction(transactionId);
  const workDir = txn?.tmp_path ?? path.join(tmpDir, transactionId);
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  const startTime = Date.now();
  const outputLines: string[] = [];
  const filesCreated: string[] = [];

  const sandboxFs = {
    writeFileSync: (fp: string, content: string) => {
      const safe = path.join(workDir, path.basename(fp));
      fs.writeFileSync(safe, content);
      filesCreated.push(path.basename(fp));
    },
    readFileSync: (fp: string, enc?: string) => {
      const safe = path.join(workDir, path.basename(fp));
      return fs.readFileSync(safe, (enc as BufferEncoding) ?? "utf-8");
    },
    readdirSync: (fp: string) => {
      if (fp === "." || fp === "./") return fs.readdirSync(workDir);
      return [];
    },
    existsSync: (fp: string) => {
      const safe = path.join(workDir, path.basename(fp));
      return fs.existsSync(safe);
    },
  };

  const sandbox = {
    console: {
      log: (...args: unknown[]) => outputLines.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => outputLines.push("ERROR: " + args.map(String).join(" ")),
      warn: (...args: unknown[]) => outputLines.push("WARN: " + args.map(String).join(" ")),
    },
    fs: sandboxFs,
    require: (mod: string) => {
      if (!ALLOWED_MODULES.has(mod)) throw new Error(`require('${mod}') is not allowed`);
      return require(mod);
    },
    __workDir: workDir,
    __output: outputLines,
    __filesCreated: filesCreated,
    process: { env: {}, cwd: () => workDir },
  };

  try {
    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 10000 });

    return res.json({
      success: true,
      output: outputLines.join("\n"),
      filesCreated,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, transactionId }, "Code execution error");
    return res.json({
      success: false,
      output: outputLines.join("\n"),
      error: message,
      filesCreated,
      executionTimeMs: Date.now() - startTime,
    });
  }
});

export default router;
