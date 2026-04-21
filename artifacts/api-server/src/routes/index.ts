import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import rewriteNoteRouter from "./gifted/rewrite-note";
import giftsRouter from "./gifted/gifts";
import stripeRouter from "./gifted/stripe";
import otpRouter from "./gifted/otp";
import sendLinkRouter from "./gifted/send-link";
import validatePhoneRouter from "./gifted/validate-phone";
import contactsRouter from "./gifted/contacts";
import physicalGiftsRouter from "./gifted/physical-gifts";
import storageRouter from "./storage";
import shareRouter from "./share";
import readyRouter from "./ready";
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
router.use(validatePhoneRouter);
router.use(contactsRouter);
router.use(physicalGiftsRouter);
router.use(storageRouter);
router.use(shareRouter);
router.use(readyRouter);
router.use("/og", ogRouter);
router.use(adminRouter);

export default router;
