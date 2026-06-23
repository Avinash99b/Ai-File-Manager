import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import actionsRouter from "./actions";
import transactionsRouter from "./transactions";
import snapshotsRouter from "./snapshots";
import codeRouter from "./code";
import { getDb } from "../lib/database";
import { indexDirectory } from "../lib/embeddings";
import { logger } from "../lib/logger";

const router: IRouter = Router();

try {
  getDb();
  const count = indexDirectory();
  logger.info({ count }, "Initial file indexing complete");
} catch (err) {
  logger.error({ err }, "Failed to initialize database or index");
}

router.use(healthRouter);
router.use(filesRouter);
router.use(actionsRouter);
router.use(transactionsRouter);
router.use(snapshotsRouter);
router.use(codeRouter);

export default router;
