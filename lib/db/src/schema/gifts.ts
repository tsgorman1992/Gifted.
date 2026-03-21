import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  senderPhone: text("sender_phone"),
  redemptionOtp: text("redemption_otp"),
  redemptionOtpExpiry: timestamp("redemption_otp_expiry", { withTimezone: true }),
  redemptionVerified: boolean("redemption_verified").default(false),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  scheduleDelivered: boolean("schedule_delivered").default(false),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  reaction: text("reaction"),
  reactionAt: timestamp("reaction_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGiftSchema = createInsertSchema(gifts).omit({
  createdAt: true,
});

export type Gift = typeof gifts.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;
