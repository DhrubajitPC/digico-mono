import type { Db } from "./db/client.ts";
import { aiCalls, messages, outboundReplies } from "./db/schema.ts";
import { handleIncomingMessage } from "./handle-message.ts";
import { parseIncomingMessages } from "./parse-webhook.ts";
import { eq, desc } from "drizzle-orm";

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

/** Fetches full chat history & DeepSeek diagnostics for a given phone number */
export async function getEmulatorChatHistory(db: Db, fromPhone: string) {
  const userMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.fromPhone, fromPhone))
    .orderBy(desc(messages.receivedAt));

  const chatThread: EmulatorChatMessage[] = [];

  for (const msg of userMessages) {
    // Add User Bubble
    chatThread.push({
      id: msg.id,
      role: "user",
      text: msg.resolvedText || msg.inboundText || "—",
      timestamp: msg.receivedAt.toISOString(),
      status: msg.status,
      error: msg.error,
      rawPayload: msg.rawPayload,
    });

    // Fetch corresponding AI call & outbound reply
    const calls = await db.select().from(aiCalls).where(eq(aiCalls.messageId, msg.id));
    const replies = await db
      .select()
      .from(outboundReplies)
      .where(eq(outboundReplies.messageId, msg.id));

    const latestCall = calls[calls.length - 1];
    const latestReply = replies[replies.length - 1];

    if (latestReply || latestCall) {
      chatThread.push({
        id: latestReply?.id || msg.id * 1000,
        role: "assistant",
        text: latestReply?.replyText || latestCall?.responseText || "No response generated.",
        timestamp: (latestReply?.sentAt || latestCall?.createdAt || msg.receivedAt).toISOString(),
        model: latestCall?.model || "deepseek-chat",
        latencyMs: latestCall?.latencyMs,
        status: latestReply?.status || "sent",
        error: latestReply?.error || latestCall?.error,
      });
    }
  }

  // Sort chronologically ascending
  chatThread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    fromPhone,
    messages: chatThread,
  };
}
