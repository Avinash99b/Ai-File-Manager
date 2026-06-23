import { Router } from "express";
import {
  getTransaction,
  listTransactions,
  updateTransaction,
  commitTransaction,
  cleanupTmp,
  setupTmpDir,
  restoreSnapshot,
} from "../lib/transactions";
import { logger } from "../lib/logger";

const router = Router();

router.get("/transactions", (_req, res) => {
  const rows = listTransactions();
  const transactions = rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    status: r.status,
    command: r.command,
    actionsSummary: r.actions_summary,
    actions: JSON.parse(r.actions_json),
    snapshotId: r.snapshot_id ?? undefined,
    tmpPath: r.tmp_path ?? undefined,
    completedActions: JSON.parse(r.completed_actions ?? "[]"),
  }));
  return res.json({ transactions });
});

router.get("/transactions/:id", (req, res) => {
  const row = getTransaction(req.params.id);
  if (!row) return res.status(404).json({ error: "Transaction not found" });

  return res.json({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    status: row.status,
    command: row.command,
    actionsSummary: row.actions_summary,
    actions: JSON.parse(row.actions_json),
    snapshotId: row.snapshot_id ?? undefined,
    tmpPath: row.tmp_path ?? undefined,
    completedActions: JSON.parse(row.completed_actions ?? "[]"),
  });
});

router.post("/transactions/:id/approve", (req, res) => {
  const row = getTransaction(req.params.id);
  if (!row) return res.status(404).json({ error: "Transaction not found" });

  if (row.status === "completed") {
    return res.json({ status: "already_completed", snapshotId: row.snapshot_id ?? undefined });
  }

  const actions = JSON.parse(row.actions_json);
  let tmpPath = row.tmp_path;

  if (!tmpPath) {
    tmpPath = setupTmpDir(row.id);
  }

  try {
    updateTransaction(row.id, { status: "approved" });
    const snapshotId = commitTransaction(row.id, tmpPath, actions);
    updateTransaction(row.id, { status: "completed", snapshot_id: snapshotId, tmp_path: null });
    logger.info({ transactionId: row.id, snapshotId }, "Transaction committed");
    return res.json({ status: "completed", snapshotId });
  } catch (err) {
    logger.error({ err, transactionId: row.id }, "Transaction commit failed");
    updateTransaction(row.id, { status: "failed" });
    return res.status(500).json({ error: "Transaction failed", details: String(err) });
  }
});

router.post("/transactions/:id/revert", (req, res) => {
  const row = getTransaction(req.params.id);
  if (!row) return res.status(404).json({ error: "Transaction not found" });

  if (row.status !== "completed") {
    return res.status(400).json({ error: "Only completed transactions can be reverted" });
  }

  if (!row.snapshot_id) {
    return res.status(400).json({ error: "Transaction has no linked snapshot — cannot revert" });
  }

  try {
    const filesRestored = restoreSnapshot(row.snapshot_id);
    updateTransaction(row.id, { status: "reverted" });
    logger.info({ transactionId: row.id, snapshotId: row.snapshot_id, filesRestored }, "Transaction reverted");
    return res.json({ status: "reverted", filesRestored });
  } catch (err) {
    logger.error({ err, transactionId: row.id }, "Transaction revert failed");
    return res.status(500).json({ error: "Revert failed", details: String(err) });
  }
});

router.post("/transactions/:id/reject", (req, res) => {
  const row = getTransaction(req.params.id);
  if (!row) return res.status(404).json({ error: "Transaction not found" });

  if (row.tmp_path) {
    cleanupTmp(row.tmp_path);
  }

  updateTransaction(row.id, { status: "rejected", tmp_path: null });
  return res.json({ status: "rejected" });
});

export default router;
