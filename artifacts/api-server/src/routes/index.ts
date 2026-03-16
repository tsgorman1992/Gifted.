import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rewriteNoteRouter from "./gifted/rewrite-note";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rewriteNoteRouter);

export default router;
