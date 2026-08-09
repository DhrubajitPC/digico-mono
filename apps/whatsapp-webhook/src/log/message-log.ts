import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { isMariaDbAvailable, getMariaDbRecentConversationHistory } from "../db/mariadb.ts";
import { aiCalls, messages, outboundReplies } from "../db/schema.ts";
import type {
  AiCall,
  Message,
  MessageKind,
  MessageStatus,
  OutboundReply,
  ReplyStatus,
} from "../db/schema.ts";

export interface RecordInboundMessageInput {
  messageId: string;
  fromPhone: string;
  contactName: string | null;
  kind: MessageKind;
  rawPayload: unknown;
  inboundText?: string | null;
}

export type RecordInboundMessageResult =
  | { outcome: "created"; message: Message }
  | { outcome: "duplicate" };

/** Postgres SQLSTATE for unique_violation — stable across pg and PGlite. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

/**
 * Insert the inbound message row. `messageId` is unique, so this insert is
 * also the durable de-duplication check — the database, not an in-memory
 * set, is the source of truth for "have we already seen this message?".
 * A retried/redelivered webhook (or a process restart) can't cause it to be
 * processed twice.
 */
export async function recordInboundMessage(
  db: Db,
  input: RecordInboundMessageInput,
): Promise<RecordInboundMessageResult> {
  try {
    const [row] = await db
      .insert(messages)
      .values({
        messageId: input.messageId,
        fromPhone: input.fromPhone,
        contactName: input.contactName,
        kind: input.kind,
        rawPayload: input.rawPayload,
        inboundText: input.inboundText ?? null,
      })
      .returning();
    return { outcome: "created", message: row! };
  } catch (error) {
    if (isUniqueViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/** Record the text that was actually sent to the AI (identity for text, transcript for audio). */
export async function setResolvedText(
  db: Db,
  id: number,
  input: { resolvedText: string; transcript?: string | null },
): Promise<void> {
  await db
    .update(messages)
    .set({ resolvedText: input.resolvedText, transcript: input.transcript ?? null })
    .where(eq(messages.id, id));
}

export interface RecordAiCallInput {
  messageId: number;
  provider: string;
  model: string;
  requestMessages: unknown;
  responseText?: string | null;
  error?: string | null;
  latencyMs: number;
}

export async function recordAiCall(db: Db, input: RecordAiCallInput): Promise<AiCall> {
  const [row] = await db
    .insert(aiCalls)
    .values({
      messageId: input.messageId,
      provider: input.provider,
      model: input.model,
      requestMessages: input.requestMessages,
      responseText: input.responseText ?? null,
      error: input.error ?? null,
      latencyMs: input.latencyMs,
    })
    .returning();
  return row!;
}

export interface RecordOutboundReplyInput {
  messageId: number;
  toPhone: string;
  replyText: string;
  status: ReplyStatus;
  error?: string | null;
}

export async function recordOutboundReply(
  db: Db,
  input: RecordOutboundReplyInput,
): Promise<OutboundReply> {
  const [row] = await db
    .insert(outboundReplies)
    .values({
      messageId: input.messageId,
      toPhone: input.toPhone,
      replyText: input.replyText,
      status: input.status,
      error: input.error ?? null,
    })
    .returning();
  return row!;
}

/** Final state for a message once the pipeline finishes (successfully or not). */
export async function markMessageStatus(
  db: Db,
  id: number,
  status: Extract<MessageStatus, "completed" | "failed">,
  error?: string | null,
): Promise<void> {
  await db
    .update(messages)
    .set({ status, error: error ?? null, completedAt: new Date() })
    .where(eq(messages.id, id));
}

export interface ListMessagesFilter {
  phone?: string;
  status?: MessageStatus;
  limit?: number;
  offset?: number;
}

export interface ListMessagesResult {
  items: Message[];
  total: number;
}

export async function listMessages(
  db: Db,
  filter: ListMessagesFilter = {},
): Promise<ListMessagesResult> {
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  const conditions = [
    filter.phone ? eq(messages.fromPhone, filter.phone) : undefined,
    filter.status ? eq(messages.status, filter.status) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [totalRow]] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(where)
      .orderBy(desc(messages.receivedAt), desc(messages.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(messages).where(where),
  ]);

  return { items, total: totalRow?.value ?? 0 };
}

export interface MessageDetail {
  message: Message;
  aiCalls: AiCall[];
  outboundReplies: OutboundReply[];
}

export async function getMessageDetail(db: Db, id: number): Promise<MessageDetail | undefined> {
  const [message] = await db.select().from(messages).where(eq(messages.id, id));
  if (!message) return undefined;

  const [calls, replies] = await Promise.all([
    db.select().from(aiCalls).where(eq(aiCalls.messageId, id)).orderBy(aiCalls.createdAt),
    db
      .select()
      .from(outboundReplies)
      .where(eq(outboundReplies.messageId, id))
      .orderBy(outboundReplies.sentAt),
  ]);

  return { message, aiCalls: calls, outboundReplies: replies };
}

export async function getRecentConversationHistory(
  db: Db,
  fromPhone: string,
  limit = 8,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  if (await isMariaDbAvailable()) {
    const mariaHistory = await getMariaDbRecentConversationHistory(fromPhone, limit);
    if (mariaHistory.length > 0) return mariaHistory;
  }

  const recentMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.fromPhone, fromPhone))
    .orderBy(desc(messages.receivedAt), desc(messages.id))
    .limit(limit);

  if (recentMsgs.length === 0) return [];

  const historyItems: Array<{
    time: Date;
    id: number;
    role: "user" | "assistant";
    content: string;
  }> = [];

  for (const m of recentMsgs) {
    const text = m.resolvedText || m.inboundText;
    if (text && text.trim().length > 0) {
      historyItems.push({
        time: m.receivedAt,
        id: m.id,
        role: "user",
        content: text.trim(),
      });
    }

    const replies = await db
      .select()
      .from(outboundReplies)
      .where(eq(outboundReplies.messageId, m.id))
      .orderBy(outboundReplies.sentAt);

    for (const r of replies) {
      if (r.replyText && r.replyText.trim().length > 0) {
        historyItems.push({
          time: r.sentAt,
          id: r.id,
          role: "assistant",
          content: r.replyText.trim(),
        });
      }
    }
  }

  historyItems.sort((a, b) => a.time.getTime() - b.time.getTime() || a.id - b.id);

  return historyItems.map((h) => ({ role: h.role, content: h.content }));
}
