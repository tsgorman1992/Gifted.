import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import rewriteNoteRouter from "./gifted/rewrite-note";
import giftsRouter from "./gifted/gifts";
import stripeRouter from "./gifted/stripe";
import otpRouter from "./gifted/otp";
import sendLinkRouter from "./gifted/send-link";
import storageRouter from "./storage";
import shareRouter from "./share";
import ogRouter from "./og";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(rewriteNoteRouter);
router.use(giftsRouter);
router.use(stripeRouter);
router.use(otpRouter);
router.use(sendLinkRouter);
router.use(storageRouter);
router.use(shareRouter);
router.use("/og", ogRouter);
router.use(adminRouter);

export default router;
