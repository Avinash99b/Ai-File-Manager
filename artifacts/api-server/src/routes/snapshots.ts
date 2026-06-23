import { Router } from "express";
import { listSnapshots, restoreSnapshot } from "../lib/transactions";
import { logger } from "../lib/logger";

const router = Router();

router.get("/snapshots", (_req, res) => {
  const rows = listSnapshots();
  const snapshots = rows.map((r) => ({
    id: r.id,
    timestamp: new Date(r.timestamp).toISOString(),
    transactionId: r.transaction_id,
    affectedFiles: JSON.parse(r.affected_files),
    location: r.location,
    sizeMb: r.size_mb,
    checksum: r.checksum ?? undefined,
    restorable: true,
  }));
  return res.json({ snapshots });
});

router.post("/snapshots/:id/restore", (req, res) => {
  try {
    const filesRestored = restoreSnapshot(req.params.id);
    logger.info({ snapshotId: req.params.id, filesRestored }, "Snapshot restored");
    return res.json({ status: "restored", filesRestored });
  } catch (err) {
    logger.error({ err, snapshotId: req.params.id }, "Snapshot restore failed");
    return res.status(500).json({ error: "Restore failed", details: String(err) });
  }
});

export default router;
