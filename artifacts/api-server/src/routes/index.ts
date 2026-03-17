import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import rewriteNoteRouter from "./gifted/rewrite-note";
import giftsRouter from "./gifted/gifts";
import stripeRouter from "./gifted/stripe";
import storageRouter from "./storage";
import shareRouter from "./share";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(rewriteNoteRouter);
router.use(giftsRouter);
router.use(stripeRouter);
router.use(storageRouter);
router.use(shareRouter);

export default router;
