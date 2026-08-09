import type mysql from "mysql2/promise";
import { getMariaDbPool } from "./client.ts";

/** Ensure WhatsApp message log tables exist in MariaDB */
export async function ensureMariaDbLogTables(): Promise<void> {
  const p = getMariaDbPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS joy_whatsapp_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id VARCHAR(255) UNIQUE NOT NULL,
        from_phone VARCHAR(64) NOT NULL,
        contact_name VARCHAR(255),
        kind VARCHAR(32) NOT NULL,
        inbound_text TEXT,
        resolved_text TEXT,
        transcript TEXT,
        status VARCHAR(32) DEFAULT 'received',
        error TEXT,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS joy_whatsapp_ai_calls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        provider VARCHAR(64) NOT NULL,
        model VARCHAR(64) NOT NULL,
        request_messages LONGTEXT,
        response_text LONGTEXT,
        error TEXT,
        latency_ms INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS joy_whatsapp_outbound_replies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        to_phone VARCHAR(64) NOT NULL,
        reply_text LONGTEXT NOT NULL,
        status VARCHAR(32) NOT NULL,
        error TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error("Failed to ensure MariaDB log tables", err);
  }
}

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

export async function recordMariaDbInboundMessage(
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

export async function setMariaDbResolvedText(
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

export async function recordMariaDbAiCall(input: RecordAiCallInput): Promise<void> {
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

export async function recordMariaDbOutboundReply(input: RecordOutboundReplyInput): Promise<void> {
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

export async function markMariaDbMessageStatus(
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

export async function listMariaDbMessages(
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

export async function getMariaDbMessageDetail(id: number) {
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

export async function getMariaDbRecentConversationHistory(
  fromPhone: string,
  limit = 8,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  await ensureMariaDbLogTables();
  const p = getMariaDbPool();
  try {
    const [msgs] = await p.query<mysql.RowDataPacket[]>(
      `
      SELECT id, inbound_text, resolved_text, received_at
      FROM joy_whatsapp_messages
      WHERE from_phone = ?
      ORDER BY received_at DESC, id DESC
      LIMIT ?
    `,
      [fromPhone, limit],
    );

    if (!msgs || msgs.length === 0) return [];

    const msgIds = msgs.map((m: any) => m.id);
    const [replies] = await p.query<mysql.RowDataPacket[]>(
      `
      SELECT message_id, reply_text, sent_at
      FROM joy_whatsapp_outbound_replies
      WHERE message_id IN (?)
      ORDER BY sent_at ASC
    `,
      [msgIds],
    );

    const historyItems: Array<{ time: Date; role: "user" | "assistant"; content: string }> = [];

    for (const m of msgs) {
      const text = m.resolved_text || m.inbound_text;
      if (text && text.trim().length > 0) {
        historyItems.push({
          time: new Date(m.received_at),
          role: "user",
          content: text.trim(),
        });
      }
    }

    for (const r of replies) {
      if (r.reply_text && r.reply_text.trim().length > 0) {
        historyItems.push({
          time: new Date(r.sent_at),
          role: "assistant",
          content: r.reply_text.trim(),
        });
      }
    }

    historyItems.sort((a, b) => a.time.getTime() - b.time.getTime());
    return historyItems.map((h) => ({ role: h.role, content: h.content }));
  } catch (err) {
    console.error("Failed to fetch conversation history from MariaDB", err);
    return [];
  }
}
