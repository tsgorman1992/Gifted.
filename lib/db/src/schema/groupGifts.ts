import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

// Platform-wide Chip In guardrails. Kept as named constants (not per-row
// defaults only) so route code and schema defaults can't drift apart.
export const CHIP_IN_MIN_CONTRIBUTION_CENTS = 1_000;   // $10 — matches existing gift minimum
export const CHIP_IN_MAX_CONTRIBUTION_CENTS = 100_000; // $1,000 — typo/sanity ceiling, not a fraud wall
export const CHIP_IN_MAX_CONTRIBUTORS = 20;            // keeps campaigns "your circle," not public fundraising

// A campaign is the pre-gift, money-collecting stage of a Chip In. It only
// becomes a real `gifts` row (via sentGiftId) once the organizer sends it —
// until then it cannot affect anything in the existing single-gift or free
// Group Moment flows.
export const groupCampaigns = pgTable("group_campaigns", {
  id: text("id").primaryKey(),
  shareToken: text("share_token").notNull().unique(),

  organizerUserId: text("organizer_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organizerName: text("organizer_name").notNull(),
  organizerContributes: boolean("organizer_contributes").notNull().default(false),

  // Recipient + gift content — same shape as the `gifts` table so materializing
  // a sent campaign into a real gift is a straight copy, not a translation.
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  occasion: text("occasion").notNull(),
  giftTitle: text("gift_title").notNull(),
  experience: text("experience").notNull(),
  personalNote: text("personal_note"),
  videoPath: text("video_path"),
  photoPaths: jsonb("photo_paths").$type<string[]>(),
  playlistUrl: text("playlist_url"),
  extraLinks: jsonb("extra_links").$type<Array<{ url: string; label: string; subtitle?: string }>>(),

  // Contributor-facing only — never shown to the recipient. This is what a
  // contributor actually sees before paying (see contentLockedAt below).
  pitchMessage: text("pitch_message").notNull(),

  // Every contributor pays this exact amount (V1 fixed-only). Stored in cents
  // to avoid the parseFloat/text-amount pattern used on the legacy `gifts`
  // table — money here is always an integer.
  fixedAmountCents: integer("fixed_amount_cents").notNull(),
  maxContributors: integer("max_contributors").notNull().default(CHIP_IN_MAX_CONTRIBUTORS),

  // open -> sending -> sent
  //              \-> canceled / refunding -> refunded
  status: text("status").notNull().default("open"),

  // Set the moment the first contribution is confirmed paid. After this,
  // recipientName / occasion / fixedAmountCents / pitchMessage are locked —
  // contributors already paid based on these values, so they can't quietly
  // change underneath them. Gift *content* (video/photos/note) stays editable
  // up to send, since contributors never see it before the reveal anyway.
  contentLockedAt: timestamp("content_locked_at", { withTimezone: true }),

  sentGiftId: text("sent_gift_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),

  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGroupCampaignSchema = createInsertSchema(groupCampaigns).omit({
  createdAt: true,
});
export type GroupCampaign = typeof groupCampaigns.$inferSelect;
export type InsertGroupCampaign = z.infer<typeof insertGroupCampaignSchema>;

// One row per contributor. Guests are fully supported — contributorUserId is
// nullable, and contributorName/contributorEmail (typed at checkout) are the
// only identity a guest ever needs to provide.
export const groupContributions = pgTable("group_contributions", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => groupCampaigns.id, { onDelete: "cascade" }),

  // Unguessable token mailed to guest contributors so they have a durable,
  // login-free way to check on their contribution later (the "magic link").
  statusToken: text("status_token").notNull().unique(),

  contributorUserId: text("contributor_user_id"),
  contributorName: text("contributor_name").notNull(),
  contributorEmail: text("contributor_email").notNull(),
  message: text("message"),
  notifyOnOpen: boolean("notify_on_open").notNull().default(false),

  amountCents: integer("amount_cents").notNull(),

  // invited -> pending -> paid -> refunded
  //                  \-> failed
  // "invited" means the organizer pre-created this row before the contributor
  // clicked through. "pending" means a Stripe checkout session has been opened
  // but not yet confirmed. Only ever flipped to "paid" by a server-side Stripe
  // re-verification — never trusted from the client directly.
  status: text("status").notNull().default("pending"),

  // Single-use token for organizer-initiated invites. Null for open-link
  // contributors. Once checkout starts the row transitions to "pending" and
  // this token is invalidated (can't be reused).
  inviteToken: text("invite_token").unique(),
  invitedAt: timestamp("invited_at", { withTimezone: true }),

  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),

  paidAt: timestamp("paid_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGroupContributionSchema = createInsertSchema(groupContributions).omit({
  createdAt: true,
});
export type GroupContribution = typeof groupContributions.$inferSelect;
export type InsertGroupContribution = z.infer<typeof insertGroupContributionSchema>;
