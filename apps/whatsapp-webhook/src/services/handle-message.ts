import {
  fetchMariaDbOrders,
  getMariaDbRecentConversationHistory,
  markMariaDbMessageStatus,
  normalizePhone,
  recordMariaDbAiCall,
  recordMariaDbInboundMessage,
  recordMariaDbOutboundReply,
  searchMariaDbProducts,
  setMariaDbResolvedText,
  type WcDealer,
  type WcOrder,
  type WcProduct,
} from "@digico/db";
import type { DeepSeekPromptContext, DeepSeekReplyResult, DeepSeekToolCall } from "./deepseek.ts";
import { buildChatMessages, deepSeekModel, replyWithDeepSeekFull } from "./deepseek.ts";
import { routeIntent } from "./intent-router.ts";

import type { IncomingAudioPayload, IncomingWhatsAppMessage } from "./parse-webhook.ts";
import { isEmulatorMessage } from "./parse-webhook.ts";
import { transcribeAudio } from "./transcribe.ts";
import type { DownloadedMedia } from "./whatsapp-media.ts";
import { downloadWhatsAppMedia } from "./whatsapp-media.ts";
import { sendWhatsAppText } from "./whatsapp-send.ts";
import { parseDraftOrderPayload, validateAndExecuteOrderTool } from "./order-tools.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fallback dealer confirmation used when DeepSeek returns a pure `draft_order`
 * tool call with an empty `content` field, so `reply` ends up blank. The order
 * was recorded, but the dealer would otherwise see nothing — which the emulator
 * surfaces as "No response generated." Keep it short; the model's own prose (in
 * the dealer's language) remains the preferred copy.
 */
export function buildOrderConfirmationMessage(order: WcOrder): string {
  const items = (order.items ?? [])
    .map((i) => `${i.quantity}× ${i.productName} — ৳${i.unitPrice.toLocaleString("en-US")}`)
    .join("\n");
  return [
    "✅ Order recorded & sent for review:",
    items,
    `Total: ৳${order.totalAmount.toLocaleString("en-US")}`,
    `Order: ${order.orderNumber}`,
  ]
    .filter(Boolean)
    .join("\n");
}

class PipelineLog {
  private id: number | undefined;

  private constructor(id: number | undefined) {
    this.id = id;
  }

  static async open(message: IncomingWhatsAppMessage): Promise<PipelineLog | "duplicate"> {
    try {
      const result = await recordMariaDbInboundMessage({
        messageId: message.messageId,
        fromPhone: message.from,
        contactName: message.contactName,
        kind: message.kind,
        rawPayload: message,
        inboundText: message.text,
      });
      if (result.outcome === "duplicate") return "duplicate";
      return new PipelineLog(result.message.id);
    } catch (error) {
      console.error("Failed to record inbound message", error);
      return new PipelineLog(undefined);
    }
  }

  async resolvedText(resolvedText: string, transcript?: string): Promise<void> {
    if (this.id === undefined) return;
    try {
      await setMariaDbResolvedText(this.id, { resolvedText, transcript });
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
      await recordMariaDbAiCall({
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
    status: string;
    error?: string;
  }): Promise<void> {
    if (this.id === undefined) return;
    try {
      await recordMariaDbOutboundReply({ messageId: this.id, ...input });
    } catch (error) {
      console.error("Failed to record outbound reply", error);
    }
  }

  async status(status: string, error?: string): Promise<void> {
    if (this.id === undefined) return;
    try {
      await markMariaDbMessageStatus(this.id, status, error);
    } catch (err) {
      console.error("Failed to record final status", err);
    }
  }
}

/**
 * Gets the audio bytes ready to transcribe.
 *
 * The emulator supplies them inline, because its mediaId is synthetic and there
 * is nothing for the Meta CDN to serve. Real webhook audio is downloaded.
 */
export async function resolveAudioMedia(audio: IncomingAudioPayload): Promise<DownloadedMedia> {
  if (audio.inlineBytes) {
    console.log("Using inline audio", { bytes: audio.inlineBytes.byteLength });
    return { bytes: audio.inlineBytes, mimeType: audio.mimeType };
  }

  console.log("Downloading audio media", audio.mediaId);
  return downloadWhatsAppMedia(audio.mediaId);
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
    const media = await resolveAudioMedia(message.audio);
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

export type ChatHistoryEntry = { role: "user" | "assistant"; content: string };

export interface BuildPromptContextResult {
  products: WcProduct[];
  dealer: WcDealer | null;
}

/** RAG catalog search + dealer lookup for the compressed LLM prompt. */
export async function buildPromptContext(
  userText: string,
  fromPhone: string,
): Promise<BuildPromptContextResult> {
  let products: WcProduct[] = [];
  let dealer: WcDealer | null = null;

  try {
    products = await searchMariaDbProducts(userText, 10);
    const mariaOrders = await fetchMariaDbOrders();
    const normalizedFromPhone = normalizePhone(fromPhone);
    const matchOrder = mariaOrders.find((o) => o.dealer.phone === normalizedFromPhone);
    if (matchOrder) {
      dealer = matchOrder.dealer;
    }
  } catch (err) {
    console.error("Failed to fetch database context for DeepSeek prompt", err);
  }

  return { products, dealer };
}

/** DeepSeek completion with tool calling; records the AI call (or its failure) in the pipeline log. */
export async function generateReply(
  log: PipelineLog,
  userText: string,
  context: DeepSeekPromptContext,
  chatHistory: ChatHistoryEntry[],
): Promise<DeepSeekReplyResult> {
  const requestMessages = buildChatMessages(userText, context, chatHistory);
  const startedAt = Date.now();

  let deepseekResult: DeepSeekReplyResult;
  try {
    deepseekResult = await replyWithDeepSeekFull(userText, context, chatHistory);
  } catch (error) {
    await log.aiCall({
      requestMessages,
      error: errorMessage(error),
      latencyMs: Date.now() - startedAt,
    });
    await log.status("failed", errorMessage(error));
    throw error;
  }

  await log.aiCall({
    requestMessages,
    responseText: deepseekResult.text,
    latencyMs: Date.now() - startedAt,
  });
  console.log("DeepSeek reply:", deepseekResult.text);
  return deepseekResult;
}

export interface OrderPayloadExtractionResult {
  /** Reply with any [ORDER_DATA] tag stripped. */
  reply: string;
  /** True when at least one order was validated and created. */
  executed: boolean;
  /** The last successfully created order, when any. */
  order: WcOrder | null;
  /** Non-fatal warnings (malformed payloads, tool failures). */
  warnings: string[];
}

/**
 * Unified order extraction: processes draft_order tool calls and the
 * [ORDER_DATA: ...] tag fallback through parseDraftOrderPayload, and strips
 * the tag from the reply text.
 */
export async function extractOrderPayload(
  reply: string,
  toolCalls?: DeepSeekToolCall[],
): Promise<OrderPayloadExtractionResult> {
  let order: WcOrder | null = null;
  let executed = false;
  const warnings: string[] = [];

  /** Runs one payload; returns true when the payload was valid and execution finished without throwing. */
  async function runOrder(
    payload: ReturnType<typeof parseDraftOrderPayload>,
    source: string,
  ): Promise<boolean> {
    if (!payload) {
      warnings.push(`Skipping malformed ${source}`);
      return false;
    }
    try {
      const execResult = await validateAndExecuteOrderTool(payload);
      console.log("Tool execution result:", execResult);
      if (execResult.success && execResult.order) {
        executed = true;
        order = execResult.order;
      }
      return true;
    } catch (err) {
      warnings.push(`Failed to execute ${source}: ${errorMessage(err)}`);
      return false;
    }
  }

  // Path A: draft_order tool calls
  for (const call of toolCalls ?? []) {
    if (call.function?.name === "draft_order") {
      await runOrder(parseDraftOrderPayload(call.function.arguments), "draft_order tool call");
    }
  }

  // Path B: [ORDER_DATA: ...] tag fallback
  const orderDataMatch = /\[ORDER_DATA:\s*(\{.*?\})\s*\]/s.exec(reply);
  if (orderDataMatch && orderDataMatch[1]) {
    const consumed = await runOrder(parseDraftOrderPayload(orderDataMatch[1]), "[ORDER_DATA] tag");
    // Strip the tag whenever it was consumed (valid payload, no execution throw)
    // so raw JSON never leaks into the reply sent to the dealer.
    if (consumed) {
      reply = reply.replace(/\[ORDER_DATA:\s*\{.*?\}\s*\]/s, "").trim();
    }
  }

  return { reply, executed, order, warnings };
}

/** WhatsApp send + outbound-reply logging + final completed status. */
export async function sendReply(
  log: PipelineLog,
  message: IncomingWhatsAppMessage,
  reply: string,
): Promise<void> {
  if (reply.trim().length > 0) {
    await sendWhatsAppText(message.from, reply, isEmulatorMessage(message));
    await log.outboundReply({ toPhone: message.from, replyText: reply, status: "sent" });
  }
  await log.status("completed");
}

/** Process one inbound message: (transcribe) → LLM → WhatsApp reply. */
export async function handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<void> {
  console.log("Incoming WhatsApp message:", JSON.stringify(message, null, 2));

  const log = await PipelineLog.open(message);
  if (log === "duplicate") {
    console.log("Skipping duplicate message", message.messageId);
    return;
  }

  // Stage 1: Resolve user text (passthrough or audio transcription)
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

  // Stage 2: Rule-Based Intent Interceptor (0 LLM Token Cost & 10ms Latency)
  const routeResult = await routeIntent(userText, message.from);
  if (routeResult.handled && routeResult.replyText) {
    console.log("[Intent Router] Intercepted deterministically without LLM call:", userText);
    await sendReply(log, message, routeResult.replyText);
    return;
  }

  // Stage 3: RAG catalog search + dealer lookup
  const context = await buildPromptContext(userText, message.from);

  // Stage 4: DeepSeek completion with tool calling & multi-turn history
  const chatHistory = await getMariaDbRecentConversationHistory(message.from, 8);
  const deepseekResult = await generateReply(log, userText, context, chatHistory);

  // Stage 5: Unified order extraction (tool calls + [ORDER_DATA] tag)
  const { reply, executed, order } = await extractOrderPayload(
    deepseekResult.text,
    deepseekResult.toolCalls,
  );

  // Stage 6: Send final WhatsApp reply.
  // DeepSeek sometimes returns a pure draft_order tool call with an empty
  // content field, which leaves `reply` blank even though the order was created.
  // Never drop the dealer silently: confirm the order we just recorded, or —
  // for a benign no-op turn ("thanks", "ok") — send a neutral follow-up instead
  // of an error, so a human never sees "No response generated."
  let finalReply = reply.trim();
  if (finalReply.length === 0) {
    finalReply =
      executed && order
        ? buildOrderConfirmationMessage(order)
        : "Got it. Is there anything else I can help you with?";
  }
  await sendReply(log, message, finalReply);
}
