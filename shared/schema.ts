import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  textContent: text("text_content"),
  htmlContent: text("html_content"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
  isImportant: boolean("is_important").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  attachments: text("attachments").array().default([]),
  isForwarded: boolean("is_forwarded").notNull().default(false),
  originalFrom: text("original_from"),
  originalFromName: text("original_from_name"),
  originalTo: text("original_to"),
  originalDate: text("original_date"),
  originalSubject: text("original_subject"),
  actualSenderEmail: text("actual_sender_email"),
  actualSenderName: text("actual_sender_name"),
});

export const voiceCommands = pgTable("voice_commands", {
  id: serial("id").primaryKey(),
  transcript: text("transcript").notNull(),
  intent: text("intent").notNull(),
  confidence: integer("confidence").notNull(),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
  success: boolean("success").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  receivedAt: true,
});

export const insertVoiceCommandSchema = createInsertSchema(voiceCommands).omit({
  id: true,
  executedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertVoiceCommand = z.infer<typeof insertVoiceCommandSchema>;
export type VoiceCommand = typeof voiceCommands.$inferSelect;
