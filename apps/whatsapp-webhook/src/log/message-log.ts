import type mysql from "mysql2/promise";
import type { Db } from "../db/client.ts";
import {
  getMariaDbPool,
  ensureMariaDbLogTables,
  getMariaDbRecentConversationHistory,
} from "../db/mariadb.ts";

export interface RecordInboundMessageInput {
  messageId: string;
  fromPhone: string;
  contactName: string | null;
  kind: string;
  rawPayload: unknown;
  inboundText?: string | null;
}

export type RecordInboundMessageResult =
  | { outcome: "created"; message: { id: number; messageId: string } }
  | { outcome: "duplicate" };

export async function recordInboundMessage(
  _db: Db,
  input: RecordInboundMessageInput,
): Promise<RecordInboundMessageResult> {
  await ensureMariaDbLogTables();
  const pool = getMariaDbPool();

  try {
    const [res] = await pool.query<mysql.ResultSetHeader>(
      `
      INSERT INTO joy_whatsapp_messages (message_id, from_phone, contact_name, kind, inbound_text)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        input.messageId,
        input.fromPhone,
        input.contactName || null,
        input.kind,
        input.inboundText || null,
      ],
    );
    return { outcome: "created", message: { id: res.insertId, messageId: input.messageId } };
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || String(error).includes("Duplicate entry")) {
      return { outcome: "duplicate" };
    }
    throw error;
  }
}

export async function setResolvedText(
  _db: Db,
  id: number,
  input: { resolvedText: string; transcript?: string | null },
): Promise<void> {
  const pool = getMariaDbPool();
  await pool.query(
    `UPDATE joy_whatsapp_messages SET resolved_text = ?, transcript = ? WHERE id = ?`,
    [input.resolvedText, input.transcript || null, id],
  );
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

export async function recordAiCall(_db: Db, input: RecordAiCallInput): Promise<void> {
  await ensureMariaDbLogTables();
  const pool = getMariaDbPool();
  await pool.query(
    `
    INSERT INTO joy_whatsapp_ai_calls (message_id, provider, model, request_messages, response_text, error, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [
      input.messageId,
      input.provider,
      input.model,
      JSON.stringify(input.requestMessages),
      input.responseText || null,
      input.error || null,
      input.latencyMs,
    ],
  );
}

export interface RecordOutboundReplyInput {
  messageId: number;
  toPhone: string;
  replyText: string;
  status: string;
  error?: string | null;
}

export async function recordOutboundReply(_db: Db, input: RecordOutboundReplyInput): Promise<void> {
  await ensureMariaDbLogTables();
  const pool = getMariaDbPool();
  await pool.query(
    `
    INSERT INTO joy_whatsapp_outbound_replies (message_id, to_phone, reply_text, status, error)
    VALUES (?, ?, ?, ?, ?)
  `,
    [input.messageId, input.toPhone, input.replyText, input.status, input.error || null],
  );
}

export async function markMessageStatus(
  _db: Db,
  id: number,
  status: string,
  error?: string | null,
): Promise<void> {
  const pool = getMariaDbPool();
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `UPDATE joy_whatsapp_messages SET status = ?, error = ?, completed_at = ? WHERE id = ?`,
    [status, error || null, nowStr, id],
  );
}

export async function listMessages(
  _db: Db,
  filter: { phone?: string; status?: string; limit?: number; offset?: number } = {},
) {
  await ensureMariaDbLogTables();
  const pool = getMariaDbPool();
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  let sql = `SELECT * FROM joy_whatsapp_messages`;
  const params: any[] = [];

  if (filter.phone) {
    sql += ` WHERE from_phone = ?`;
    params.push(filter.phone);
  }

  sql += ` ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
  return { items: rows || [], total: rows?.length || 0 };
}

export async function getMessageDetail(_db: Db, id: number) {
  await ensureMariaDbLogTables();
  const pool = getMariaDbPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM joy_whatsapp_messages WHERE id = ?`,
    [id],
  );
  const message = rows?.[0];
  if (!message) return undefined;

  const [aiCalls] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM joy_whatsapp_ai_calls WHERE message_id = ? ORDER BY created_at ASC`,
    [id],
  );
  const [outboundReplies] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM joy_whatsapp_outbound_replies WHERE message_id = ? ORDER BY sent_at ASC`,
    [id],
  );

  return { message, aiCalls: aiCalls || [], outboundReplies: outboundReplies || [] };
}

export async function getRecentConversationHistory(
  _db: Db,
  fromPhone: string,
  limit = 8,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  return await getMariaDbRecentConversationHistory(fromPhone, limit);
}
