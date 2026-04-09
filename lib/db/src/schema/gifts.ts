import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface TrackingEvent {
  status: string;
  message: string;
  location?: string;
  timestamp: string;
}

export const gifts = pgTable("gifts", {
  id: text("id").primaryKey(),
  senderUserId: text("sender_user_id"),
  recipientUserId: text("recipient_user_id"),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  senderName: text("sender_name").notNull(),
  experience: text("experience").notNull(),
  occasion: text("occasion").notNull(),
  giftTitle: text("gift_title").notNull(),
  personalNote: text("personal_note"),
  videoPath: text("video_path"),
  photoPaths: jsonb("photo_paths").$type<string[]>(),
  playlistUrl: text("playlist_url"),
  extraLinks: jsonb("extra_links").$type<Array<{ url: string; label: string; subtitle?: string }>>(),
  amount: text("amount"),
  intent: text("intent"),
  paid: boolean("paid").default(false),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  senderPhone: text("sender_phone"),
  senderEmail: text("sender_email"),
  redemptionOtp: text("redemption_otp"),
  redemptionOtpExpiry: timestamp("redemption_otp_expiry", { withTimezone: true }),
  redemptionVerified: boolean("redemption_verified").default(false),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  payoutName: text("payout_name"),
  payoutMethod: text("payout_method"),
  payoutHandle: text("payout_handle"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  scheduleDelivered: boolean("schedule_delivered").default(false),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  reaction: text("reaction"),
  reactionAt: timestamp("reaction_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  senderHidden: boolean("sender_hidden").default(false),
  recipientHidden: boolean("recipient_hidden").default(false),
  trackingCarrier: text("tracking_carrier"),
  trackingNumber: text("tracking_number"),
  aftershipTrackingId: text("aftership_tracking_id"),
  trackingStatus: jsonb("tracking_status").$type<TrackingEvent[]>(),
  trackingDeliveredAt: timestamp("tracking_delivered_at", { withTimezone: true }),
  nudgeSentAt: timestamp("nudge_sent_at", { withTimezone: true }),
  nudge2SentAt: timestamp("nudge2_sent_at", { withTimezone: true }),
  unredeemedReminderSentAt: timestamp("unredeemed_reminder_sent_at", { withTimezone: true }),
  unredeemedFinalReminderSentAt: timestamp("unredeemed_final_reminder_sent_at", { withTimezone: true }),
  cashoutPaidAt: timestamp("cashout_paid_at", { withTimezone: true }),
  autoRefundedAt: timestamp("auto_refunded_at", { withTimezone: true }),
});

export const insertGiftSchema = createInsertSchema(gifts).omit({
  createdAt: true,
});

export type Gift = typeof gifts.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;

export const physicalGifts = pgTable("physical_gifts", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  recipientName: text("recipient_name"),
  senderName: text("sender_name"),
  direction: text("direction").notNull().default("sent"),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  aftershipTrackingId: text("aftership_tracking_id"),
  trackingStatus: jsonb("tracking_status").$type<TrackingEvent[]>(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  giftId: text("gift_id"),
  hidden: boolean("hidden").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PhysicalGift = typeof physicalGifts.$inferSelect;
