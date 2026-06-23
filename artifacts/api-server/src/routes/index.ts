import { Router, type IRouter } from "express";
import healthRouter from "./health";
import actionsRouter from "./actions";
import transactionsRouter from "./transactions";
import snapshotsRouter from "./snapshots";
import codeRouter from "./code";
import { getDb } from "../lib/database";
import { logger } from "../lib/logger";

const router: IRouter = Router();

try {
  getDb();
  logger.info("Database initialized");
} catch (err) {
  logger.error({ err }, "Failed to initialize database");
}

router.use(healthRouter);
router.use(actionsRouter);
router.use(transactionsRouter);
router.use(snapshotsRouter);
router.use(codeRouter);

export default router;
