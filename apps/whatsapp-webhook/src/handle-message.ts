import { buildChatMessages, deepSeekModel, replyWithDeepSeekFull } from "./deepseek.ts";
import { getDb } from "./db/instance.ts";
import type { Db } from "./db/client.ts";
import {
  getRecentConversationHistory,
  markMessageStatus,
  recordAiCall,
  recordInboundMessage,
  recordOutboundReply,
  setResolvedText,
} from "./log/message-log.ts";
import type { IncomingWhatsAppMessage } from "./parse-webhook.ts";
import { transcribeAudio } from "./transcribe.ts";
import { downloadWhatsAppMedia } from "./whatsapp-media.ts";
import { sendWhatsAppText } from "./whatsapp-send.ts";
import { fetchMariaDbOrders, searchMariaDbProducts, isMariaDbAvailable } from "./db/mariadb.ts";
import { listProductsForApi } from "./api-orders.ts";
import { routeIntent } from "./intent-router.ts";
import { validateAndExecuteOrderTool } from "./tools/order-tools.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Records the pipeline for one message. Every write is best-effort — a
 * logging failure must never stop a dealer from getting their reply, so
 * every method swallows and logs its own errors instead of throwing.
 */
class PipelineLog {
  private readonly db: Db;
  private id: number | undefined;

  private constructor(db: Db, id: number | undefined) {
    this.db = db;
    this.id = id;
  }

  /**
   * Returns "duplicate" when this exact messageId was already recorded —
   * the database's unique constraint is the durable de-duplication check,
   * so a retried webhook or a process restart can't cause double-processing.
   * Any other failure to record still opens a (silently unlogged) pipeline,
   * since a DB hiccup must never stop a dealer from getting their reply.
   */
  static async open(db: Db, message: IncomingWhatsAppMessage): Promise<PipelineLog | "duplicate"> {
    try {
      const result = await recordInboundMessage(db, {
        messageId: message.messageId,
        fromPhone: message.from,
        contactName: message.contactName,
        kind: message.kind,
        rawPayload: message,
        inboundText: message.text,
      });
      if (result.outcome === "duplicate") return "duplicate";
      return new PipelineLog(db, result.message.id);
    } catch (error) {
      console.error("Failed to record inbound message", error);
      return new PipelineLog(db, undefined);
    }
  }

  async resolvedText(resolvedText: string, transcript?: string): Promise<void> {
    if (this.id === undefined) return;
    try {
      await setResolvedText(this.db, this.id, { resolvedText, transcript });
    } catch (error) {
      console.error("Failed to record resolved text", error);
    }
  }

  async aiCall(input: {
    requestMessages: unknown;
    responseText?: string;
    error?: string;
    latencyMs: number;
  }): Promise<void> {
    if (this.id === undefined) return;
    try {
      await recordAiCall(this.db, {
        messageId: this.id,
        provider: "deepseek",
        model: deepSeekModel(),
        ...input,
      });
    } catch (error) {
      console.error("Failed to record AI call", error);
    }
  }

  async outboundReply(input: {
    toPhone: string;
    replyText: string;
    status: "sent" | "failed";
    error?: string;
  }): Promise<void> {
    if (this.id === undefined) return;
    try {
      await recordOutboundReply(this.db, { messageId: this.id, ...input });
    } catch (error) {
      console.error("Failed to record outbound reply", error);
    }
  }

  async status(status: "completed" | "failed", error?: string): Promise<void> {
    if (this.id === undefined) return;
    try {
      await markMessageStatus(this.db, this.id, status, error);
    } catch (err) {
      console.error("Failed to record final status", err);
    }
  }
}

async function resolveUserText(
  log: PipelineLog,
  message: IncomingWhatsAppMessage,
): Promise<string> {
  if (message.kind === "text" && message.text) {
    await log.resolvedText(message.text);
    return message.text;
  }

  if (message.kind === "audio" && message.audio) {
    console.log("Downloading audio media", message.audio.mediaId);
    const media = await downloadWhatsAppMedia(message.audio.mediaId);
    console.log("Transcribing audio", {
      bytes: media.bytes.byteLength,
      mimeType: media.mimeType,
    });
    const transcript = await transcribeAudio(media);
    console.log("Transcript:", transcript);
    await log.resolvedText(transcript, transcript);
    return transcript;
  }

  throw new Error(`Unsupported message kind: ${message.kind}`);
}

/** Process one inbound message: (transcribe) → LLM → WhatsApp reply. */
export async function handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<void> {
  console.log("Incoming WhatsApp message:", JSON.stringify(message, null, 2));

  const db = await getDb();
  const log = await PipelineLog.open(db, message);
  if (log === "duplicate") {
    console.log("Skipping duplicate message", message.messageId);
    return;
  }

  let userText: string;
  try {
    userText = await resolveUserText(log, message);
  } catch (error) {
    console.error("Failed to resolve user text", error);
    await log.status("failed", errorMessage(error));
    await sendWhatsAppText(
      message.from,
      "Sorry, I couldn't understand that voice note. Could you type it instead?",
    );
    return;
  }

  // Step 1: Rule-Based Intent Interceptor (0 LLM Token Cost & 10ms Latency)
  const routeResult = await routeIntent(userText, message.from, db);
  if (routeResult.handled && routeResult.replyText) {
    console.log("[Intent Router] Intercepted deterministically without LLM call:", userText);
    const isEmulator = message.phoneNumberId === "EMULATOR" || message.from.includes("EMULATOR");
    await sendWhatsAppText(message.from, routeResult.replyText, isEmulator);
    await log.outboundReply({
      toPhone: message.from,
      replyText: routeResult.replyText,
      status: "sent",
    });
    await log.status("completed");
    return;
  }

  // Step 2: RAG Catalog Search (Retrieve top 3-5 candidate products for compressed LLM prompt)
  let productsList: any[] = [];
  let dealerInfo: any = null;

  try {
    if (await isMariaDbAvailable()) {
      productsList = await searchMariaDbProducts(userText, 5);
      const mariaOrders = await fetchMariaDbOrders();
      const matchOrder = mariaOrders.find((o) => o.dealer.phone === message.from);
      if (matchOrder) {
        dealerInfo = matchOrder.dealer;
      }
    } else {
      productsList = await listProductsForApi(db);
    }
  } catch (err) {
    console.error("Failed to fetch database context for DeepSeek prompt", err);
  }

  // Step 3: DeepSeek Completion with Tool Calling & Multi-Turn History
  const isEmulator = message.phoneNumberId === "EMULATOR" || message.from.includes("EMULATOR");
  const chatHistory = await getRecentConversationHistory(db, message.from, 8);
  const promptContext = { products: productsList, dealer: dealerInfo };
  const requestMessages = buildChatMessages(userText, promptContext, chatHistory);
  const startedAt = Date.now();

  let deepseekResult: { text: string; toolCalls?: any[] };
  try {
    deepseekResult = await replyWithDeepSeekFull(userText, promptContext, chatHistory);
  } catch (error) {
    await log.aiCall({
      requestMessages,
      error: errorMessage(error),
      latencyMs: Date.now() - startedAt,
    });
    await log.status("failed", errorMessage(error));
    throw error;
  }

  let reply = deepseekResult.text;
  await log.aiCall({ requestMessages, responseText: reply, latencyMs: Date.now() - startedAt });
  console.log("DeepSeek reply:", reply);

  // Step 4: Execute Tool Calls with Server-Side Guardrails (Confirmation + Stock/Price Truth)
  if (deepseekResult.toolCalls && deepseekResult.toolCalls.length > 0) {
    for (const call of deepseekResult.toolCalls) {
      if (call.function?.name === "draft_order") {
        try {
          const payload = JSON.parse(call.function.arguments);
          const execResult = await validateAndExecuteOrderTool(payload);
          console.log("Tool execution result:", execResult);
        } catch (err) {
          console.error("Failed to execute draft_order tool call", err);
        }
      }
    }
  }

  // Fallback: Check [ORDER_DATA: ...] tag if tool call wasn't directly generated
  const orderDataMatch = /\[ORDER_DATA:\s*(\{.*?\})\s*\]/s.exec(reply);
  if (orderDataMatch && orderDataMatch[1]) {
    try {
      const parsedOrder = JSON.parse(orderDataMatch[1]);
      reply = reply.replace(/\[ORDER_DATA:\s*\{.*?\}\s*\]/s, "").trim();
      const execResult = await validateAndExecuteOrderTool({
        productName: parsedOrder.productName || "Ordered Product",
        sku: parsedOrder.sku,
        quantity: Number(parsedOrder.quantity) || 1,
        unitPrice: Number(parsedOrder.unitPrice) || 0,
        customerName: parsedOrder.customerName || message.contactName || "WhatsApp Customer",
        deliveryAddress: parsedOrder.deliveryAddress || "Address via WhatsApp",
        phone: parsedOrder.phone || message.from,
        userConfirmation: parsedOrder.userConfirmation !== false,
      });
      console.log("ORDER_DATA fallback execution result:", execResult);
    } catch (err) {
      console.error("Failed to parse and insert ORDER_DATA into database", err);
    }
  }

  try {
    await sendWhatsAppText(message.from, reply, isEmulator);
  } catch (error) {
    if (!isEmulator) {
      await log.outboundReply({
        toPhone: message.from,
        replyText: reply,
        status: "failed",
        error: errorMessage(error),
      });
      await log.status("failed", errorMessage(error));
      throw error;
    }
  }

  console.log("WhatsApp reply sent to", message.from);
  await log.outboundReply({ toPhone: message.from, replyText: reply, status: "sent" });
  await log.status("completed");
}

/** @deprecated Use handleIncomingMessage */
export async function handleIncomingText(message: IncomingWhatsAppMessage): Promise<void> {
  return handleIncomingMessage(message);
}
