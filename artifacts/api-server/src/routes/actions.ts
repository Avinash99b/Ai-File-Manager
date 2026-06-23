import { Router } from "express";
import { parseCommand } from "../lib/aiparser";
import {
  createTransaction,
  setupTmpDir,
  applyActionToTmp,
  updateTransaction,
} from "../lib/transactions";

const router = Router();

router.post("/actions/parse", (req, res) => {
  const { command, contextPath } = req.body as { command: string; contextPath?: string };
  if (!command) return res.status(400).json({ error: "command is required" });

  const plan = parseCommand(command, contextPath);
  createTransaction(plan.transactionId, command, plan.actionsSummary, plan.actions);

  return res.json(plan);
});

router.post("/actions/preview", (req, res) => {
  const { transactionId, actions } = req.body as {
    transactionId: string;
    actions: Array<{
      id: string;
      action: string;
      mode: string;
      target: string;
      params: { replacement?: string; dest?: string; content?: string; code?: string };
      isSafe: boolean;
    }>;
  };

  if (!transactionId) return res.status(400).json({ error: "transactionId is required" });

  const tmpPath = setupTmpDir(transactionId);

  const previewFiles: Array<{ before?: string; after?: string; action: string; error?: string }> = [];
  const errors: string[] = [];

  for (const action of actions) {
    const result = applyActionToTmp(action, tmpPath);
    previewFiles.push(result);
    if (result.error) errors.push(result.error);
  }

  updateTransaction(transactionId, {
    status: "previewed",
    tmp_path: tmpPath,
    actions_json: JSON.stringify(actions),
  });

  return res.json({
    transactionId,
    status: errors.length > 0 ? "partial" : "ready",
    previewFiles,
    errors,
  });
});

export default router;
