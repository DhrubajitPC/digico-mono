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

// --- ORDER MANAGEMENT SYSTEM SCHEMAS ---

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "pending_review",
  "confirmed",
  "on_hold",
  "processing",
  "completed",
  "cancelled",
]);

export const orderOriginEnum = pgEnum("order_origin", ["whatsapp_ai", "manual_sales"]);

/** Resellers / Dealers registered in Digico's system */
export const dealers = pgTable("dealers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone").notNull().unique(),
  address: text("address"),
  status: text("status").notNull().default("active"), // "active", "suspended"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Product Catalog */
export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sku: text("sku").notNull().unique(),
  brand: text("brand").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  model: text("model"),
  specifications: text("specifications"),
  unitPrice: integer("unit_price").notNull(), // price in BDT (taka)
  stockQuantity: integer("stock_quantity").notNull().default(0),
  aliases: jsonb("aliases").notNull().default([]), // e.g. ["HP 15s", "15s-i5"]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** B2B Orders */
export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderNumber: text("order_number").notNull().unique(), // e.g. #ORD-7585
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  conversationId: integer("conversation_id").references(() => messages.id),
  status: orderStatusEnum("status").notNull().default("pending_review"),
  origin: orderOriginEnum("origin").notNull().default("whatsapp_ai"),
  totalAmount: integer("total_amount").notNull().default(0),
  notes: text("notes"),
  proposedMessage: text("proposed_message"), // live editable WA confirmation message
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Line Items for each Order */
export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // in BDT
  lineTotal: integer("line_total").notNull(), // quantity * unitPrice
});

/** Status change audit log */
export const orderHistory = pgTable("order_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  previousStatus: orderStatusEnum("previous_status"),
  newStatus: orderStatusEnum("new_status").notNull(),
  changedBy: text("changed_by").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Dealer = typeof dealers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderHistory = typeof orderHistory.$inferSelect;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderOrigin = (typeof orderOriginEnum.enumValues)[number];
