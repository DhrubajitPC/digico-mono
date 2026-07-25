import { integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const messageKind = pgEnum("message_kind", ["text", "audio"]);

export const messageStatus = pgEnum("message_status", ["received", "completed", "failed"]);

export const replyStatus = pgEnum("reply_status", ["sent", "failed"]);

/** One row per inbound WhatsApp message the webhook accepted for processing. */
export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  messageId: text("message_id").notNull().unique(), // WhatsApp wamid
  fromPhone: text("from_phone").notNull(),
  contactName: text("contact_name"),
  kind: messageKind("kind").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  inboundText: text("inbound_text"), // present for kind = text
  transcript: text("transcript"), // present for kind = audio (Whisper output)
  resolvedText: text("resolved_text"), // the text actually sent to the AI
  status: messageStatus("status").notNull().default("received"),
  error: text("error"), // top-level pipeline failure, if any
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/** One row per AI provider call made while handling a message. */
export const aiCalls = pgTable("ai_calls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id),
  provider: text("provider").notNull(), // e.g. "deepseek"
  model: text("model").notNull(),
  requestMessages: jsonb("request_messages").notNull(), // the chat messages array sent
  responseText: text("response_text"),
  error: text("error"),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per WhatsApp send attempt made while handling a message. */
export const outboundReplies = pgTable("outbound_replies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id),
  toPhone: text("to_phone").notNull(),
  replyText: text("reply_text").notNull(),
  status: replyStatus("status").notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messages.$inferSelect;
export type AiCall = typeof aiCalls.$inferSelect;
export type OutboundReply = typeof outboundReplies.$inferSelect;
export type MessageKind = (typeof messageKind.enumValues)[number];
export type MessageStatus = (typeof messageStatus.enumValues)[number];
export type ReplyStatus = (typeof replyStatus.enumValues)[number];
