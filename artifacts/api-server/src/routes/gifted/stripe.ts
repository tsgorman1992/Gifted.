import { Router } from "express";
import Stripe from "stripe";
import twilio from "twilio";
import { db, gifts, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  sendSenderReceipt,
  sendSenderRedemptionNotice,
  sendOperatorCashoutAlert,
  sendRecipientPayoutConfirmation,
} from "../../lib/email";

function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function normPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

async function smsTo(to: string | null | undefined, body: string) {
  if (!to) return;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return;
  try {
    const client = getTwilioClient();
    if (!client) return;
    await client.messages.create({ to: normPhone(to), from: normPhone(from), body });
  } catch (err) {
    console.error("SMS failed:", err);
  }
}

async function notifyOperator(message: string) {
  await smsTo(process.env.OPERATOR_PHONE, message);
}

const router = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

/**
 * POST /gifted/checkout-session
 * Creates a Stripe Checkout Session for paying a gift balance.
 * Body: { giftId, returnUrl }
 */
router.post("/gifted/checkout-session", async (req, res) => {
  try {
    const { giftId, returnUrl } = req.body as { giftId: string; returnUrl: string };

    if (!giftId || !returnUrl) {
      res.status(400).json({ error: "giftId and returnUrl are required" });
      return;
    }

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }
    if (!gift.amount || parseFloat(gift.amount) <= 0) {
      res.status(400).json({ error: "Gift has no balance to pay" });
      return;
    }

    const stripe = getStripe();
    const giftAmount     = parseFloat(gift.amount);
    const amountCents    = Math.round(giftAmount * 100);
    const platformFee    = giftAmount * 0.08;
    const platformCents  = Math.round(platformFee * 100);
    const totalDollars   = (giftAmount * 1.08 + 0.30) / 0.971;
    const totalCents     = Math.round(totalDollars * 100);
    const processingCents = totalCents - amountCents - platformCents;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Gift balance for ${gift.recipientName}`,
              description: gift.intent
                ? `"${gift.intent}" — sent via gifted.`
                : `Sent via gifted. by ${gift.senderName}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "gifted. service fee",
              description: "8% platform fee — covers premium gifting experience and same-day payouts",
            },
            unit_amount: platformCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Card processing",
              description: "Stripe payment processing fee passed through at cost",
            },
            unit_amount: processingCents,
          },
          quantity: 1,
        },
      ],
      metadata: { giftId },
      success_url: `${returnUrl}?paid=true&gift_id=${giftId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * POST /gifted/confirm-payment
 * Called after redirect from Stripe Checkout to verify + record payment.
 * Body: { sessionId, giftId }
 */
router.post("/gifted/confirm-payment", async (req, res) => {
  try {
    const { sessionId, giftId } = req.body as { sessionId: string; giftId: string };

    if (!sessionId || !giftId) {
      res.status(400).json({ error: "sessionId and giftId are required" });
      return;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed" });
      return;
    }

    // Fetch gift before update so we know if this is a new payment transition
    const [existing] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
    const alreadyPaid = existing?.paid ?? false;

    const senderEmail = session.customer_details?.email ?? null;

    await db
      .update(gifts)
      .set({
        paid: true,
        senderEmail,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      })
      .where(eq(gifts.id, giftId));

    // Send sender receipt email only on the first payment confirmation
    if (!alreadyPaid && senderEmail && existing) {
      sendSenderReceipt({
        to: senderEmail,
        senderName:    existing.senderName,
        recipientName: existing.recipientName,
        giftId:        existing.id,
        amount:        existing.amount,
        occasion:      existing.occasion,
        giftTitle:     existing.giftTitle,
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Confirm payment error:", err);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

/**
 * POST /gifted/redeem
 * Marks a gift as redeemed and notifies the operator via SMS.
 * Body: { giftId, payoutName, payoutMethod, payoutHandle }
 */
router.post("/gifted/redeem", async (req, res) => {
  try {
    const { giftId, payoutName, payoutMethod, payoutHandle } = req.body as {
      giftId: string;
      payoutName?: string;
      payoutMethod?: string;
      payoutHandle?: string;
    };

    if (!giftId) {
      res.status(400).json({ error: "giftId is required" });
      return;
    }

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }
    if (gift.redeemedAt) {
      res.json({ success: true, alreadyRedeemed: true });
      return;
    }

    if (gift.amount && parseFloat(gift.amount) > 0 && !gift.paid) {
      res.status(402).json({ error: "This gift balance has not been paid yet. Please ask the sender to complete payment." });
      return;
    }

    await db
      .update(gifts)
      .set({
        redeemedAt: new Date(),
        payoutName:   payoutName   || null,
        payoutMethod: payoutMethod || null,
        payoutHandle: payoutHandle || null,
      })
      .where(eq(gifts.id, giftId));

    const amount = gift.amount ? `$${parseFloat(gift.amount).toFixed(2)}` : "";

    // Notify sender via SMS
    smsTo(
      gift.senderPhone,
      `gifted. 🎉\n${gift.recipientName} redeemed their ${amount} gift. Your generosity made their day!\n\nReply STOP to opt out.`
    );

    // Notify sender via email
    if (gift.senderEmail) {
      sendSenderRedemptionNotice({
        to:            gift.senderEmail,
        senderName:    gift.senderName,
        recipientName: gift.recipientName,
        giftId:        gift.id,
        amount:        gift.amount,
        payoutMethod:  payoutMethod ?? null,
      }).catch(() => {});
    }

    // Notify operator via SMS + email
    if (payoutName && payoutMethod && payoutHandle) {
      const methodLabel = payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1);
      const senderLabel = gift.senderName ? ` from ${gift.senderName}` : "";
      await notifyOperator(
        `gifted. redemption 🎁\n${amount || "unknown amount"} — ${payoutName}\n${methodLabel}: ${payoutHandle}\nGift${senderLabel} → send now`
      );
      sendOperatorCashoutAlert({
        recipientName: gift.recipientName,
        senderName:    gift.senderName,
        giftId:        gift.id,
        amount:        gift.amount,
        payoutMethod,
        payoutHandle,
        payoutName,
      }).catch(() => {});

      // Confirmation SMS to recipient — silent if Twilio unavailable
      const methodLabelSms = payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1);
      smsTo(
        gift.recipientPhone,
        `gifted. 🎁\nYour ${amount || "gift"} payout has been confirmed! We'll send it via ${methodLabelSms} today.\n\nQuestions? help@gifted.page — Reply STOP to opt out.`
      );

      // Confirmation email to recipient — look up via session or recipientUserId
      if (gift.amount && parseFloat(gift.amount) > 0) {
        try {
          let recipientEmail: string | null = null;

          // Prefer authenticated session user
          const sessionEmail = (req as any).user?.email as string | undefined;
          if (sessionEmail) {
            recipientEmail = sessionEmail;
          } else if (gift.recipientUserId) {
            const [ru] = await db
              .select({ email: usersTable.email })
              .from(usersTable)
              .where(eq(usersTable.id, gift.recipientUserId))
              .limit(1);
            if (ru?.email) recipientEmail = ru.email;
          }

          if (recipientEmail) {
            sendRecipientPayoutConfirmation({
              to:            recipientEmail,
              recipientName: gift.recipientName,
              senderName:    gift.senderName,
              amount:        gift.amount,
              payoutMethod,
              payoutHandle,
            }).catch(() => {});
          }
        } catch {
          // non-fatal — operator and sender are already notified
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Redeem error:", err);
    res.status(500).json({ error: "Failed to mark gift as redeemed" });
  }
});

/**
 * POST /stripe/webhook
 * Stripe webhook handler — marks gifts as paid on checkout.session.completed.
 * Requires STRIPE_WEBHOOK_SECRET to be set in Stripe dashboard.
 */
router.post("/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const bodyType = Buffer.isBuffer(req.body) ? "Buffer" : typeof req.body;
  const bodyLen  = Buffer.isBuffer(req.body) ? req.body.length : JSON.stringify(req.body ?? "").length;
  console.log(`[stripe/webhook] body=${bodyType}(${bodyLen}B) sig=${sig ? sig.slice(0, 40) + "..." : "MISSING"} secret=${webhookSecret ? "SET" : "MISSING"}`);

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
    }
  } catch (err) {
    console.error("[stripe/webhook] Signature error:", err);
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const giftId = session.metadata?.giftId;

    if (giftId && session.payment_status === "paid") {
      const [existing] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
      const alreadyPaid = existing?.paid ?? false;
      const senderEmail = session.customer_details?.email ?? null;

      await db
        .update(gifts)
        .set({
          paid: true,
          senderEmail,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
        })
        .where(eq(gifts.id, giftId));

      console.log(`[stripe/webhook] checkout.session.completed giftId=${giftId} alreadyPaid=${alreadyPaid}`);

      // Send receipt if not already sent (webhook may fire after confirm-payment already handled it)
      if (!alreadyPaid && senderEmail && existing) {
        sendSenderReceipt({
          to: senderEmail,
          senderName:    existing.senderName,
          recipientName: existing.recipientName,
          giftId:        existing.id,
          amount:        existing.amount,
          occasion:      existing.occasion,
          giftTitle:     existing.giftTitle,
        }).catch(() => {});
      }
    }
  }

  res.json({ received: true });
});

export default router;
