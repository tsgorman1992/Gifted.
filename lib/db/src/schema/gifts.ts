import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gifts = pgTable("gifts", {
  id: text("id").primaryKey(),
  recipientName: text("recipient_name").notNull(),
  senderName: text("sender_name").notNull(),
  experience: text("experience").notNull(),
  occasion: text("occasion").notNull(),
  giftTitle: text("gift_title").notNull(),
  personalNote: text("personal_note"),
  videoPath: text("video_path"),
  photoPaths: jsonb("photo_paths").$type<string[]>(),
  playlistUrl: text("playlist_url"),
  amount: text("amount"),
  intent: text("intent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGiftSchema = createInsertSchema(gifts).omit({
  createdAt: true,
});

export type Gift = typeof gifts.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;
