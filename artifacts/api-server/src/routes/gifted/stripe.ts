import { Router } from "express";
import Stripe from "stripe";
import twilio from "twilio";
import { db, gifts } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    const amountCents = Math.round(parseFloat(gift.amount) * 100);
    const feeCents    = Math.round(amountCents * 0.05);

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
              name: "gifted. platform fee",
              description: "5% service fee for premium gifting experience",
            },
            unit_amount: feeCents,
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

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);

    await db
      .update(gifts)
      .set({
        paid: true,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      })
      .where(eq(gifts.id, giftId));

    if (gift && !gift.paid) {
      const amount = gift.amount ? `$${parseFloat(gift.amount).toFixed(2)}` : "";
      smsTo(
        gift.senderPhone,
        `gifted. ✅\nPayment confirmed — your ${amount} gift for ${gift.recipientName} is ready. Share the link whenever you're ready. We'll text you when they open it.`
      );
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
      .set({ redeemedAt: new Date() })
      .where(eq(gifts.id, giftId));

    const amount = gift.amount ? `$${parseFloat(gift.amount).toFixed(2)}` : "";

    // Notify sender via SMS
    smsTo(
      gift.senderPhone,
      `gifted. 🎉\n${gift.recipientName} redeemed their ${amount} gift. Your generosity made their day!`
    );

    // Notify operator via SMS
    if (payoutName && payoutMethod && payoutHandle) {
      const methodLabel = payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1);
      const senderLabel = gift.senderName ? ` from ${gift.senderName}` : "";
      await notifyOperator(
        `gifted. redemption 🎁\n${amount || "unknown amount"} — ${payoutName}\n${methodLabel}: ${payoutHandle}\nGift${senderLabel} → send now`
      );
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

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
    }
  } catch (err) {
    console.error("Webhook signature error:", err);
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const giftId = session.metadata?.giftId;

    if (giftId && session.payment_status === "paid") {
      const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
      const alreadyPaid = gift?.paid ?? false;

      await db
        .update(gifts)
        .set({
          paid: true,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
        })
        .where(eq(gifts.id, giftId));

      if (gift && !alreadyPaid) {
        const amount = gift.amount ? `$${parseFloat(gift.amount).toFixed(2)}` : "";
        smsTo(
          gift.senderPhone,
          `gifted. ✅\nPayment confirmed — your ${amount} gift for ${gift.recipientName} is ready. Share the link whenever you're ready. We'll text you when they open it.`
        );
      }
    }
  }

  res.json({ received: true });
});

export default router;
