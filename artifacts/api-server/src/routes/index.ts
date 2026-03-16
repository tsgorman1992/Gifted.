import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rewriteNoteRouter from "./gifted/rewrite-note";
import storageRouter from "./storage";
import shareRouter from "./share";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rewriteNoteRouter);
router.use(storageRouter);
router.use(shareRouter);

export default router;
