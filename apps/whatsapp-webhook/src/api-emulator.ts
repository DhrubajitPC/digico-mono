import type mysql from "mysql2/promise";
import type { Db } from "./db/client.ts";
import { ensureMariaDbLogTables } from "./db/mariadb.ts";
import { handleIncomingMessage } from "./handle-message.ts";
import { parseIncomingMessages } from "./parse-webhook.ts";

export interface EmulatorSendInput {
  fromPhone: string;
  contactName?: string;
  text: string;
}

export interface EmulatorChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  model?: string;
  latencyMs?: number;
  status?: string;
  error?: string | null;
  rawPayload?: unknown;
}

/** Constructs an authentic Meta WhatsApp Cloud API Webhook payload and processes it through the pipeline */
export async function sendEmulatorMessage(input: EmulatorSendInput) {
  const { fromPhone, contactName, text } = input;
  const messageId = `wamid.HBgL${Date.now()}EMULATOR`;

  const metaPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "EMULATOR_ACCOUNT",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+15550001234",
                phone_number_id: "EMULATOR",
              },
              contacts: [
                {
                  profile: { name: contactName || "Dealer Contact" },
                  wa_id: fromPhone,
                },
              ],
              messages: [
                {
                  from: fromPhone,
                  id: messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsed = parseIncomingMessages(metaPayload);
  if (parsed.length === 0) {
    throw new Error("Failed to parse simulated Meta webhook payload");
  }

  for (const msg of parsed) {
    await handleIncomingMessage(msg);
  }

  return {
    success: true,
    messageId,
    metaPayload,
  };
}

/** Fetches full chat history & DeepSeek diagnostics for a given phone number from MariaDB */
export async function getEmulatorChatHistory(db: Db, fromPhone: string) {
  await ensureMariaDbLogTables();
  const pool = db;
  const [userMessages] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM joy_whatsapp_messages WHERE from_phone = ? ORDER BY received_at DESC, id DESC`,
    [fromPhone],
  );

  const chatThread: EmulatorChatMessage[] = [];

  for (const msg of userMessages || []) {
    // Add User Bubble
    chatThread.push({
      id: msg.id,
      role: "user",
      text: msg.resolved_text || msg.inbound_text || "—",
      timestamp: new Date(msg.received_at).toISOString(),
      status: msg.status,
      error: msg.error,
      rawPayload: msg.raw_payload ? JSON.parse(msg.raw_payload) : undefined,
    });

    // Fetch corresponding AI call & outbound reply
    const [calls] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM joy_whatsapp_ai_calls WHERE message_id = ? ORDER BY created_at ASC`,
      [msg.id],
    );
    const [replies] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM joy_whatsapp_outbound_replies WHERE message_id = ? ORDER BY sent_at ASC`,
      [msg.id],
    );

    const latestCall = calls?.[calls.length - 1];
    const latestReply = replies?.[replies.length - 1];

    if (latestReply || latestCall) {
      chatThread.push({
        id: latestReply?.id || msg.id * 1000,
        role: "assistant",
        text: latestReply?.reply_text || latestCall?.response_text || "No response generated.",
        timestamp: new Date(
          latestReply?.sent_at || latestCall?.created_at || msg.received_at,
        ).toISOString(),
        model: latestCall?.model || "deepseek-chat",
        latencyMs: latestCall?.latency_ms || undefined,
        status: latestReply?.status || "sent",
        error: latestReply?.error || latestCall?.error || null,
      });
    }
  }

  // Sort chronological
  chatThread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return chatThread;
}
