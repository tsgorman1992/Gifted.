import { Router } from "express";
import { nanoid } from "nanoid";
import Stripe from "stripe";
import twilio from "twilio";
import {
  db,
  gifts,
  groupCampaigns,
  groupContributions,
  usersTable,
  CHIP_IN_MIN_CONTRIBUTION_CENTS,
  CHIP_IN_MAX_CONTRIBUTION_CENTS,
  CHIP_IN_MAX_CONTRIBUTORS,
} from "@workspace/db";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  sendContributionReceipt,
  sendCampaignSentNotice,
  sendContributionRefundNotice,
  sendGroupInviteEmail,
} from "../../lib/email";

async function sendInviteSms(to: string | null, body: string) {
  if (!to) return;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const tok  = process.env.TWILIO_AUTH_TOKEN;
  if (!from || !sid || !tok) return;
  try {
    const client = twilio(sid, tok);
    await client.messages.create({ from, to, body });
  } catch (err) {
    console.error("[group-gifts] invite SMS failed:", err);
  }
}

const router = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Same fee formula used for regular gifts in stripe.ts — kept in sync
 * deliberately so a contributor sees the identical fee transparency a
 * sender sees today. amountDollars is the amount that lands in the pool;
 * returns everything needed to build a 3-line-item Checkout session.
 */
function computeCheckoutLineItems(amountDollars: number) {
  const amountCents = Math.round(amountDollars * 100);
  const platformFee = amountDollars * 0.08;
  const platformCents = Math.round(platformFee * 100);
  const totalDollars = (amountDollars * 1.08 + 0.3) / 0.971;
  const totalCents = Math.round(totalDollars * 100);
  const processingCents = totalCents - amountCents - platformCents;
  return { amountCents, platformCents, processingCents };
}

/** Fresh, never-cached aggregate — the only source of truth for "how much
 *  has been raised." Recomputed on every read so there's nothing to drift. */
async function getCampaignTotals(campaignId: string) {
  const [row] = await db
    .select({
      paidCount: sql<number>`count(*) filter (where ${groupContributions.status} = 'paid')`,
      paidTotalCents: sql<number>`coalesce(sum(${groupContributions.amountCents}) filter (where ${groupContributions.status} = 'paid'), 0)`,
    })
    .from(groupContributions)
    .where(eq(groupContributions.campaignId, campaignId));
  return {
    paidCount: Number(row?.paidCount ?? 0),
    paidTotalCents: Number(row?.paidTotalCents ?? 0),
  };
}

// ─── POST /gifted/group-gifts — organizer creates a campaign ─────────────────
router.post("/gifted/group-gifts", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({ error: "Sign in to start a Chip In." });
      return;
    }

    const {
      organizerName,
      organizerContributes,
      recipientName,
      recipientPhone,
      occasion,
      giftTitle,
      experience,
      personalNote,
      videoPath,
      photoPaths,
      playlistUrl,
      extraLinks,
      pitchMessage,
      fixedAmount,
      maxContributors,
      isTest,
    } = req.body as Record<string, unknown>;

    if (
      !organizerName || typeof organizerName !== "string" ||
      !recipientName || typeof recipientName !== "string" ||
      !occasion || typeof occasion !== "string" ||
      !giftTitle || typeof giftTitle !== "string" ||
      !experience || typeof experience !== "string" ||
      !pitchMessage || typeof pitchMessage !== "string" ||
      typeof fixedAmount !== "number"
    ) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    if (pitchMessage.trim().length === 0) {
      res.status(400).json({ error: "Tell contributors what this is for." });
      return;
    }

    const fixedAmountCents = Math.round(fixedAmount * 100);
    if (fixedAmountCents < CHIP_IN_MIN_CONTRIBUTION_CENTS || fixedAmountCents > CHIP_IN_MAX_CONTRIBUTION_CENTS) {
      res.status(400).json({
        error: `Each contribution must be between $${CHIP_IN_MIN_CONTRIBUTION_CENTS / 100} and $${CHIP_IN_MAX_CONTRIBUTION_CENTS / 100}.`,
      });
      return;
    }

    let maxContributorsClamped = CHIP_IN_MAX_CONTRIBUTORS;
    if (typeof maxContributors === "number") {
      maxContributorsClamped = Math.min(CHIP_IN_MAX_CONTRIBUTORS, Math.max(1, Math.round(maxContributors)));
    }

    const id = nanoid(12);
    const shareToken = nanoid(20);

    await db.insert(groupCampaigns).values({
      id,
      shareToken,
      organizerUserId: userId,
      organizerName: organizerName.trim(),
      organizerContributes: organizerContributes === true,
      recipientName: recipientName.trim(),
      recipientPhone: (typeof recipientPhone === "string" && recipientPhone.trim()) ? recipientPhone.trim() : null,
      occasion,
      giftTitle,
      experience,
      personalNote: (typeof personalNote === "string" && personalNote.trim()) ? personalNote.trim() : null,
      videoPath: (typeof videoPath === "string" && videoPath) ? videoPath : null,
      photoPaths: Array.isArray(photoPaths) && photoPaths.length > 0 ? photoPaths : null,
      playlistUrl: (typeof playlistUrl === "string" && playlistUrl) ? playlistUrl : null,
      extraLinks: Array.isArray(extraLinks) && extraLinks.length > 0 ? extraLinks : null,
      pitchMessage: pitchMessage.trim(),
      fixedAmountCents,
      maxContributors: maxContributorsClamped,
      status: "open",
      isTest: isTest === true,
    });

    // Fire-and-forget SMS to the organizer with their private dashboard link.
    // APP_ORIGIN is set in production; REPLIT_DEV_DOMAIN is used in dev.
    const appOrigin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
    const dashboardUrl = `${appOrigin}/chip-in/dashboard/${id}`;
    db.select({ phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then(([userRow]) => {
        const phone = userRow?.phone ?? null;
        if (phone) {
          sendInviteSms(
            phone,
            `gifted. 🎁 Your Group Moment for ${(recipientName as string).trim()} is live! Manage it here: ${dashboardUrl} Reply STOP to opt out.`,
          );
        }
      })
      .catch(() => {});

    res.status(201).json({ id, shareToken });
  } catch (err) {
    console.error("[group-gifts] create campaign error:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─── GET /gifted/group-gifts/my-campaigns — organizer's active campaigns ──────
router.get("/gifted/group-gifts/my-campaigns", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({ error: "Sign in to view your campaigns." });
      return;
    }

    const campaigns = await db
      .select()
      .from(groupCampaigns)
      .where(
        and(
          eq(groupCampaigns.organizerUserId, userId),
          sql`${groupCampaigns.status} IN ('open', 'refunding')`,
        ),
      );

    const results = await Promise.all(
      campaigns.map(async (c) => {
        const { paidCount, paidTotalCents } = await getCampaignTotals(c.id);
        return {
          id: c.id,
          shareToken: c.shareToken,
          recipientName: c.recipientName,
          occasion: c.occasion,
          giftTitle: c.giftTitle,
          status: c.status,
          fixedAmountCents: c.fixedAmountCents,
          maxContributors: c.maxContributors,
          paidCount,
          paidTotalCents,
          createdAt: c.createdAt,
        };
      }),
    );

    // Most recently created first
    results.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    res.json(results);
  } catch (err) {
    console.error("[group-gifts] my-campaigns error:", err);
    res.status(500).json({ error: "Failed to load campaigns" });
  }
});

// ─── GET /gifted/group-gifts/public/:shareToken — contributor landing data ───
// No auth. Deliberately returns a content *manifest*, never the actual
// video/photos/note — the recipient could plausibly click this same link,
// and the whole point of the reveal is that it hasn't been seen yet.
router.get("/gifted/group-gifts/public/:shareToken", async (req, res) => {
  try {
    const { shareToken } = req.params;
    const [campaign] = await db
      .select()
      .from(groupCampaigns)
      .where(eq(groupCampaigns.shareToken, shareToken))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const { paidCount, paidTotalCents } = await getCampaignTotals(campaign.id);

    res.json({
      recipientName: campaign.recipientName,
      occasion: campaign.occasion,
      giftTitle: campaign.giftTitle,
      experience: campaign.experience,
      organizerName: campaign.organizerName,
      pitchMessage: campaign.pitchMessage,
      contentManifest: {
        hasVideo: !!campaign.videoPath,
        photoCount: (campaign.photoPaths ?? []).length,
        hasNote: !!campaign.personalNote,
        hasPlaylist: !!campaign.playlistUrl,
        extraLinkCount: (campaign.extraLinks ?? []).length,
      },
      fixedAmountCents: campaign.fixedAmountCents,
      maxContributors: campaign.maxContributors,
      paidCount,
      paidTotalCents,
      status: campaign.status,
      full: paidCount >= campaign.maxContributors,
    });
  } catch (err) {
    console.error("[group-gifts] public campaign fetch error:", err);
    res.status(500).json({ error: "Failed to load campaign" });
  }
});

// ─── GET /gifted/group-gifts/public/invite/:inviteToken — validate invite link ─
// No auth. Lets the chip-in page verify a personal invite token before
// showing the pre-filled form.
router.get("/gifted/group-gifts/public/invite/:inviteToken", async (req, res) => {
  try {
    const { inviteToken } = req.params;
    const [contribution] = await db
      .select({
        id: groupContributions.id,
        contributorName: groupContributions.contributorName,
        status: groupContributions.status,
        campaignId: groupContributions.campaignId,
        invitedAt: groupContributions.invitedAt,
      })
      .from(groupContributions)
      .where(eq(groupContributions.inviteToken, inviteToken))
      .limit(1);

    if (!contribution) {
      res.status(404).json({ valid: false, reason: "not-found" });
      return;
    }
    if (contribution.status !== "invited") {
      res.status(410).json({ valid: false, reason: "used" });
      return;
    }
    // Check expiry (7 days from when the organizer sent the invite).
    if (contribution.invitedAt) {
      const expiresAt = new Date(contribution.invitedAt);
      expiresAt.setDate(expiresAt.getDate() + 7);
      if (Date.now() > expiresAt.getTime()) {
        res.status(410).json({ valid: false, reason: "expired" });
        return;
      }
    }

    const [campaign] = await db
      .select({ shareToken: groupCampaigns.shareToken, recipientName: groupCampaigns.recipientName, occasion: groupCampaigns.occasion })
      .from(groupCampaigns)
      .where(eq(groupCampaigns.id, contribution.campaignId))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ valid: false, reason: "not-found" });
      return;
    }

    res.json({
      valid: true,
      name: contribution.contributorName,
      shareToken: campaign.shareToken,
      recipientName: campaign.recipientName,
      occasion: campaign.occasion,
    });
  } catch (err) {
    console.error("[group-gifts] invite validate error:", err);
    res.status(500).json({ error: "Failed to validate invite" });
  }
});

// ─── POST /gifted/group-gifts/public/:shareToken/contribute — pay in ─────────
// No auth required — guest checkout by design. Name + email only.
// Supports an optional inviteToken body field for organizer-invited contributors.
router.post("/gifted/group-gifts/public/:shareToken/contribute", async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { contributorName, contributorEmail, message, notifyOnOpen, returnUrl, inviteToken } = req.body as {
      contributorName?: string;
      contributorEmail?: string;
      message?: string;
      notifyOnOpen?: boolean;
      returnUrl?: string;
      inviteToken?: string;
    };

    if (!contributorName || contributorName.trim().length === 0 || contributorName.trim().length > 80) {
      res.status(400).json({ error: "Name is required (max 80 characters)." });
      return;
    }
    if (!contributorEmail || !EMAIL_RE.test(contributorEmail.trim())) {
      res.status(400).json({ error: "A valid email is required." });
      return;
    }
    if (message && typeof message === "string" && message.length > 500) {
      res.status(400).json({ error: "Message is too long (max 500 characters)." });
      return;
    }
    if (!returnUrl || typeof returnUrl !== "string") {
      res.status(400).json({ error: "returnUrl is required." });
      return;
    }

    const [campaign] = await db
      .select()
      .from(groupCampaigns)
      .where(eq(groupCampaigns.shareToken, shareToken))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (campaign.status !== "open") {
      res.status(409).json({ error: "This campaign is no longer accepting contributions." });
      return;
    }

    // Amount is always re-derived from the campaign, never accepted from the
    // client — the fixed-amount rule is enforced here, not just in the UI.
    const amountCents = campaign.fixedAmountCents;
    const amountDollars = amountCents / 100;

    const contributorUserId = (req as any).user?.id ?? null;

    // Two paths: (1) organizer-invited contributor with a personal invite token,
    // (2) open-link contributor (existing behaviour).
    let contributionId: string;
    let statusToken: string;

    if (inviteToken) {
      // Invite path: atomically claim the pre-reserved "invited" slot.
      // A single conditional UPDATE (status='invited' + non-expired) is
      // race-safe — only one concurrent request can flip the row to "pending".
      // If 0 rows are updated the token was already used, expired, or invalid.
      const [claimed] = await db
        .update(groupContributions)
        .set({
          status: "pending",
          contributorName: contributorName.trim(),
          contributorEmail: contributorEmail.trim().toLowerCase(),
          message: (message && message.trim()) ? message.trim() : null,
          notifyOnOpen: notifyOnOpen === true,
          contributorUserId,
        })
        .where(and(
          eq(groupContributions.inviteToken, inviteToken),
          eq(groupContributions.campaignId, campaign.id),
          eq(groupContributions.status, "invited"),
          sql`${groupContributions.invitedAt} > now() - interval '7 days'`,
        ))
        .returning({ id: groupContributions.id, statusToken: groupContributions.statusToken });

      if (!claimed) {
        res.status(410).json({ error: "This invite link has already been used or has expired." });
        return;
      }

      contributionId = claimed.id;
      statusToken = claimed.statusToken;
    } else {
      // Open-link path: count ALL active slots (paid + pending + invited) so
      // that invited slots are treated as reserved capacity and open-link
      // contributors cannot push past maxContributors.
      const [slotRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(groupContributions)
        .where(and(
          eq(groupContributions.campaignId, campaign.id),
          sql`${groupContributions.status} IN ('paid', 'pending', 'invited')`,
        ));
      const activeSlots = Number(slotRow?.count ?? 0);
      if (activeSlots >= campaign.maxContributors) {
        res.status(409).json({ error: "This moment is fully funded." });
        return;
      }

      // Create a fresh contribution row.
      contributionId = nanoid(12);
      statusToken = nanoid(24);

      await db.insert(groupContributions).values({
        id: contributionId,
        campaignId: campaign.id,
        statusToken,
        contributorUserId,
        contributorName: contributorName.trim(),
        contributorEmail: contributorEmail.trim().toLowerCase(),
        message: (message && message.trim()) ? message.trim() : null,
        notifyOnOpen: notifyOnOpen === true,
        amountCents,
        status: "pending",
      });
    }

    const stripe = getStripe();
    const { amountCents: lineAmount, platformCents, processingCents } = computeCheckoutLineItems(amountDollars);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: contributorEmail.trim().toLowerCase(),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Chip in for ${campaign.recipientName}`,
              description: `Contribution to ${campaign.giftTitle} — sent via gifted.`,
            },
            unit_amount: lineAmount,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "gifted. service fee",
              description: "8% platform fee — same as every gifted. gift",
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
      metadata: { contributionId, campaignId: campaign.id },
      payment_intent_data: { metadata: { contributionId, campaignId: campaign.id } },
      success_url: `${returnUrl}?paid=true&contribution_id=${contributionId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?cancelled=true`,
    });

    await db
      .update(groupContributions)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(groupContributions.id, contributionId));

    res.status(201).json({ url: session.url, contributionId, statusToken });
  } catch (err) {
    console.error("[group-gifts] create contribution error:", err);
    res.status(500).json({ error: "Failed to start contribution" });
  }
});

// ─── POST /gifted/group-gifts/contributions/:id/confirm — post-redirect check ─
// Fast-path UI confirmation. Never trusted on its own — always re-verified
// against Stripe, same principle as confirm-payment for regular gifts. The
// webhook (in stripe.ts) is the durable source of truth; this just makes the
// UI feel instant instead of waiting on webhook delivery.
router.post("/gifted/group-gifts/contributions/:id/confirm", async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const [contribution] = await db
      .select()
      .from(groupContributions)
      .where(eq(groupContributions.id, id))
      .limit(1);

    if (!contribution) {
      res.status(404).json({ error: "Contribution not found" });
      return;
    }
    if (contribution.status === "paid") {
      res.json({ success: true, alreadyPaid: true });
      return;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed" });
      return;
    }
    if (session.metadata?.contributionId !== id) {
      res.status(400).json({ error: "Session does not match this contribution." });
      return;
    }

    await markContributionPaid({
      contributionId: id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[group-gifts] confirm contribution error:", err);
    res.status(500).json({ error: "Failed to confirm contribution" });
  }
});

/**
 * The single place a contribution is ever marked paid. Called from both the
 * confirm endpoint (fast UI path) and the Stripe webhook (durable source of
 * truth) — safe to call from both/either/twice, because the DB update is
 * conditional on status still being 'pending'. A duplicate call is a no-op,
 * not a double-count.
 */
export async function markContributionPaid(params: {
  contributionId: string;
  paymentIntentId: string | null;
}): Promise<void> {
  const { contributionId, paymentIntentId } = params;

  const updated = await db
    .update(groupContributions)
    .set({ status: "paid", paidAt: new Date(), stripePaymentIntentId: paymentIntentId })
    .where(and(eq(groupContributions.id, contributionId), eq(groupContributions.status, "pending")))
    .returning({
      id: groupContributions.id,
      campaignId: groupContributions.campaignId,
      contributorName: groupContributions.contributorName,
      contributorEmail: groupContributions.contributorEmail,
      amountCents: groupContributions.amountCents,
      statusToken: groupContributions.statusToken,
    });

  if (updated.length === 0) {
    // Already handled by the other path (webhook vs confirm racing each other) — fine, no-op.
    return;
  }

  const contribution = updated[0];

  // Lock the campaign's contributor-facing fields on the first paid
  // contribution — conditional update so this only ever fires once.
  const [campaign] = await db
    .select({ recipientName: groupCampaigns.recipientName, occasion: groupCampaigns.occasion })
    .from(groupCampaigns)
    .where(eq(groupCampaigns.id, contribution.campaignId))
    .limit(1);

  await db
    .update(groupCampaigns)
    .set({ contentLockedAt: new Date() })
    .where(and(eq(groupCampaigns.id, contribution.campaignId), isNull(groupCampaigns.contentLockedAt)));

  if (campaign) {
    sendContributionReceipt({
      to: contribution.contributorEmail,
      contributorName: contribution.contributorName,
      recipientName: campaign.recipientName,
      occasion: campaign.occasion,
      amountCents: contribution.amountCents,
      statusToken: contribution.statusToken,
    }).catch(() => {});
  }
}

// ─── GET /gifted/group-gifts/contributions/status/:token — guest magic link ──
// No auth — the token itself is the credential. Scoped to exactly one
// contribution; read-only once the campaign has been sent.
router.get("/gifted/group-gifts/contributions/status/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [contribution] = await db
      .select()
      .from(groupContributions)
      .where(eq(groupContributions.statusToken, token))
      .limit(1);

    if (!contribution) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [campaign] = await db
      .select()
      .from(groupCampaigns)
      .where(eq(groupCampaigns.id, contribution.campaignId))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const { paidCount, paidTotalCents } = await getCampaignTotals(campaign.id);

    res.json({
      yourAmountCents: contribution.amountCents,
      yourStatus: contribution.status,
      notifyOnOpen: contribution.notifyOnOpen,
      recipientName: campaign.recipientName,
      occasion: campaign.occasion,
      campaignStatus: campaign.status,
      sentAt: campaign.sentAt,
      sentGiftId: campaign.status === "sent" ? campaign.sentGiftId : null,
      paidCount,
      paidTotalCents,
    });
  } catch (err) {
    console.error("[group-gifts] status lookup error:", err);
    res.status(500).json({ error: "Failed to load status" });
  }
});

// ─── GET /gifted/group-gifts/:id — organizer dashboard ───────────────────────
router.get("/gifted/group-gifts/:id", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { id } = req.params;

    const [campaign] = await db.select().from(groupCampaigns).where(eq(groupCampaigns.id, id)).limit(1);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (!userId || userId !== campaign.organizerUserId) {
      res.status(403).json({ error: "Only the organizer can view this dashboard." });
      return;
    }

    const contributions = await db
      .select({
        id: groupContributions.id,
        contributorName: groupContributions.contributorName,
        contributorEmail: groupContributions.contributorEmail,
        amountCents: groupContributions.amountCents,
        status: groupContributions.status,
        message: groupContributions.message,
        paidAt: groupContributions.paidAt,
        createdAt: groupContributions.createdAt,
        invitedAt: groupContributions.invitedAt,
      })
      .from(groupContributions)
      .where(eq(groupContributions.campaignId, id))
      .orderBy(groupContributions.createdAt);

    const { paidCount, paidTotalCents } = await getCampaignTotals(id);

    res.json({ campaign, contributions, paidCount, paidTotalCents });
  } catch (err) {
    console.error("[group-gifts] dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── POST /gifted/group-gifts/:id/send — the locked, one-shot send ───────────
router.post("/gifted/group-gifts/:id/send", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { id } = req.params;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const newGiftId = nanoid(12);

    const result = await db.transaction(async (tx) => {
      // Row lock — nothing else touching this campaign can proceed until we're done.
      const lockResult: any = await tx.execute(sql`select * from group_campaigns where id = ${id} for update`);
      const campaign = (lockResult.rows ?? lockResult)[0];

      if (!campaign) throw new Error("NOT_FOUND");
      if (campaign.organizer_user_id !== userId) throw new Error("FORBIDDEN");
      // Re-check status *inside* the lock — this is what makes a double-click
      // or a duplicate request safe: the second call sees 'sending' or 'sent'
      // and aborts instead of creating a second gift.
      if (campaign.status !== "open") throw new Error("ALREADY_SENT_OR_CLOSED");

      await tx.update(groupCampaigns).set({ status: "sending" }).where(eq(groupCampaigns.id, id));

      const paid = await tx
        .select()
        .from(groupContributions)
        .where(and(eq(groupContributions.campaignId, id), eq(groupContributions.status, "paid")));

      if (paid.length === 0) throw new Error("NO_CONTRIBUTIONS");

      const totalCents = paid.reduce((sum, c) => sum + c.amountCents, 0);

      const [organizer] = await tx
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      await tx.insert(gifts).values({
        id: newGiftId,
        senderUserId: userId,
        senderName: campaign.organizer_name,
        senderEmail: organizer?.email ?? null,
        recipientName: campaign.recipient_name,
        recipientPhone: campaign.recipient_phone,
        occasion: campaign.occasion,
        giftTitle: campaign.gift_title,
        experience: campaign.experience,
        personalNote: campaign.personal_note,
        videoPath: campaign.video_path,
        photoPaths: campaign.photo_paths,
        playlistUrl: campaign.playlist_url,
        extraLinks: campaign.extra_links,
        amount: (totalCents / 100).toFixed(2),
        paid: true,
        isTest: campaign.is_test,
        groupCampaignId: id,
      });

      await tx
        .update(groupCampaigns)
        .set({ status: "sent", sentGiftId: newGiftId, sentAt: new Date() })
        .where(eq(groupCampaigns.id, id));

      return {
        contributors: paid.map(c => ({ email: c.contributorEmail, name: c.contributorName })),
        recipientName: campaign.recipient_name as string,
      };
    });

    // Notify contributors after the transaction has committed — never inside it.
    for (const c of result.contributors) {
      sendCampaignSentNotice({ to: c.email, contributorName: c.name, recipientName: result.recipientName }).catch(() => {});
    }

    res.json({ success: true, giftId: newGiftId });
  } catch (err: any) {
    const msg = err?.message;
    if (msg === "NOT_FOUND") { res.status(404).json({ error: "Campaign not found" }); return; }
    if (msg === "FORBIDDEN") { res.status(403).json({ error: "Only the organizer can send this gift." }); return; }
    if (msg === "ALREADY_SENT_OR_CLOSED") { res.status(409).json({ error: "This campaign has already been sent or closed." }); return; }
    if (msg === "NO_CONTRIBUTIONS") { res.status(400).json({ error: "No confirmed contributions yet." }); return; }
    console.error("[group-gifts] send error:", err);
    res.status(500).json({ error: "Failed to send gift" });
  }
});

// ─── POST /gifted/group-gifts/:id/cancel — organizer cancels, full refunds ───
router.post("/gifted/group-gifts/:id/cancel", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { id } = req.params;

    const [campaign] = await db.select().from(groupCampaigns).where(eq(groupCampaigns.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (!userId || userId !== campaign.organizerUserId) { res.status(403).json({ error: "Only the organizer can cancel this campaign." }); return; }
    if (campaign.status === "sent") { res.status(409).json({ error: "This moment has already been sent and can't be cancelled." }); return; }
    if (campaign.status === "canceled" || campaign.status === "refunded") { res.json({ success: true, alreadyCanceled: true }); return; }

    await db.update(groupCampaigns).set({ status: "refunding" }).where(eq(groupCampaigns.id, id));

    const paid = await db
      .select()
      .from(groupContributions)
      .where(and(eq(groupContributions.campaignId, id), eq(groupContributions.status, "paid")));

    const stripe = getStripe();

    for (const contribution of paid) {
      try {
        if (contribution.stripePaymentIntentId) {
          // Full refund, including platform fee and processing — nobody
          // who chipped in should end up down money for a gift that never went out.
          await stripe.refunds.create({ payment_intent: contribution.stripePaymentIntentId });
        }
        await db
          .update(groupContributions)
          .set({ status: "refunded", refundedAt: new Date() })
          .where(eq(groupContributions.id, contribution.id));

        sendContributionRefundNotice({
          to: contribution.contributorEmail,
          contributorName: contribution.contributorName,
          recipientName: campaign.recipientName,
          amountCents: contribution.amountCents,
          reason: "campaign_canceled",
        }).catch(() => {});
      } catch (refundErr) {
        // Don't let one failed refund block the rest — log and keep going,
        // this contribution stays 'paid' so it's visible for manual follow-up.
        console.error(`[group-gifts] refund failed for contribution ${contribution.id}:`, refundErr);
      }
    }

    await db.update(groupCampaigns).set({ status: "canceled", canceledAt: new Date() }).where(eq(groupCampaigns.id, id));

    res.json({ success: true });
  } catch (err) {
    console.error("[group-gifts] cancel error:", err);
    res.status(500).json({ error: "Failed to cancel campaign" });
  }
});

// ─── POST /gifted/group-gifts/:id/invite — organizer invites someone ─────────
router.post("/gifted/group-gifts/:id/invite", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { id } = req.params;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
    if (!name || name.trim().length === 0 || name.trim().length > 80) {
      res.status(400).json({ error: "Name is required (max 80 characters)." }); return;
    }
    if (!email || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ error: "A valid email address is required." }); return;
    }

    const [campaign] = await db.select().from(groupCampaigns).where(eq(groupCampaigns.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (userId !== campaign.organizerUserId) { res.status(403).json({ error: "Only the organizer can send invites." }); return; }
    if (campaign.status !== "open") { res.status(409).json({ error: "This campaign is no longer accepting contributions." }); return; }

    // Count all active slots: paid + pending + invited (not failed/refunded)
    const [slotRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groupContributions)
      .where(and(
        eq(groupContributions.campaignId, id),
        sql`${groupContributions.status} IN ('paid', 'pending', 'invited')`,
      ));
    const activeSlots = Number(slotRow?.count ?? 0);

    if (activeSlots >= campaign.maxContributors) {
      res.status(409).json({ error: "All spots are taken. No room to invite anyone else." }); return;
    }

    const contributionId = nanoid(12);
    const statusToken    = nanoid(24);
    const inviteToken    = nanoid(32);

    await db.insert(groupContributions).values({
      id: contributionId,
      campaignId: campaign.id,
      statusToken,
      contributorName: name.trim(),
      contributorEmail: email.trim().toLowerCase(),
      amountCents: campaign.fixedAmountCents,
      status: "invited",
      inviteToken,
      invitedAt: new Date(),
    });

    const appOrigin = process.env.APP_ORIGIN ?? "";
    const basePath  = process.env.BASE_PATH ?? "";
    const inviteUrl = `${appOrigin}${basePath}/chip-in/${campaign.shareToken}?invite=${inviteToken}`;

    sendGroupInviteEmail({
      to: email.trim().toLowerCase(),
      inviteeName: name.trim(),
      organizerName: campaign.organizerName,
      recipientName: campaign.recipientName,
      occasion: campaign.occasion,
      amountCents: campaign.fixedAmountCents,
      inviteUrl,
    }).catch(() => {});

    if (typeof phone === "string" && phone.trim()) {
      sendInviteSms(phone.trim(),
        `${campaign.organizerName} invited you to chip in for ${campaign.recipientName}'s gift on gifted. Chip in here: ${inviteUrl}`,
      ).catch(() => {});
    }

    res.status(201).json({
      id: contributionId,
      contributorName: name.trim(),
      contributorEmail: email.trim().toLowerCase(),
      status: "invited",
      amountCents: campaign.fixedAmountCents,
      invitedAt: new Date().toISOString(),
      paidAt: null,
      createdAt: new Date().toISOString(),
      message: null,
    });
  } catch (err) {
    console.error("[group-gifts] invite error:", err);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

// ─── DELETE /gifted/group-gifts/:id/invites/:contributionId — cancel invite ──
router.delete("/gifted/group-gifts/:id/invites/:contributionId", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { id, contributionId } = req.params;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [campaign] = await db.select().from(groupCampaigns).where(eq(groupCampaigns.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (userId !== campaign.organizerUserId) { res.status(403).json({ error: "Only the organizer can cancel invites." }); return; }

    const [contribution] = await db
      .select()
      .from(groupContributions)
      .where(and(eq(groupContributions.id, contributionId), eq(groupContributions.campaignId, id)))
      .limit(1);

    if (!contribution) { res.status(404).json({ error: "Invite not found" }); return; }
    if (contribution.status !== "invited") {
      res.status(409).json({ error: "This invite has already been used and cannot be cancelled." }); return;
    }

    await db.delete(groupContributions).where(eq(groupContributions.id, contributionId));
    res.json({ success: true });
  } catch (err) {
    console.error("[group-gifts] cancel invite error:", err);
    res.status(500).json({ error: "Failed to cancel invite" });
  }
});

// ─── DELETE /gifted/group-gifts/:id/contributors/:contributionId — refund one ─
router.delete("/gifted/group-gifts/:id/contributors/:contributionId", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { id, contributionId } = req.params;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [campaign] = await db.select().from(groupCampaigns).where(eq(groupCampaigns.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (userId !== campaign.organizerUserId) { res.status(403).json({ error: "Only the organizer can refund contributors." }); return; }
    if (campaign.status !== "open") {
      res.status(409).json({ error: "Cannot refund contributors after the campaign has been sent or cancelled." }); return;
    }

    const [contribution] = await db
      .select()
      .from(groupContributions)
      .where(and(eq(groupContributions.id, contributionId), eq(groupContributions.campaignId, id)))
      .limit(1);

    if (!contribution) { res.status(404).json({ error: "Contributor not found" }); return; }
    if (contribution.status !== "paid") {
      res.status(409).json({ error: "Can only refund confirmed contributors." }); return;
    }

    const stripe = getStripe();
    if (contribution.stripePaymentIntentId) {
      await stripe.refunds.create({ payment_intent: contribution.stripePaymentIntentId });
    }

    await db
      .update(groupContributions)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(eq(groupContributions.id, contributionId));

    sendContributionRefundNotice({
      to: contribution.contributorEmail,
      contributorName: contribution.contributorName,
      recipientName: campaign.recipientName,
      amountCents: contribution.amountCents,
      reason: "campaign_canceled",
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[group-gifts] contributor refund error:", err);
    res.status(500).json({ error: "Failed to refund contributor" });
  }
});

// GET /by-gift/:giftId — contributor credit lookup for the reveal page.
// Returns { isGroupGift: false } for every regular gift so the reveal can
// call this unconditionally without branching on gift type up front.
router.get("/by-gift/:giftId", async (req, res) => {
  try {
    const { giftId } = req.params;
    const [campaign] = await db
      .select()
      .from(groupCampaigns)
      .where(eq(groupCampaigns.sentGiftId, giftId))
      .limit(1);

    if (!campaign) {
      res.json({ isGroupGift: false });
      return;
    }

    const contribs = await db
      .select({
        name: groupContributions.contributorName,
        message: groupContributions.message,
      })
      .from(groupContributions)
      .where(
        and(
          eq(groupContributions.campaignId, campaign.id),
          eq(groupContributions.status, "paid")
        )
      );

    res.json({ isGroupGift: true, contributors: contribs });
  } catch (err) {
    console.error("[group-gifts] by-gift error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
