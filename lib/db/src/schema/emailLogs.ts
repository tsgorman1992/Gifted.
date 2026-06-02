import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const emailLogs = pgTable("email_logs", {
  id:              serial("id").primaryKey(),
  userId:          varchar("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  email:           text("email").notNull(),
  type:            text("type").notNull(),
  sentAt:          timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  resendMessageId: text("resend_message_id"),
  status:          text("status").notNull().default("sent"),
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;
