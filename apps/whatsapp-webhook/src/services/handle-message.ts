import {
  fetchMariaDbOrders,
  getMariaDbRecentConversationHistory,
  markMariaDbMessageStatus,
  recordMariaDbAiCall,
  recordMariaDbInboundMessage,
  recordMariaDbOutboundReply,
  searchMariaDbProducts,
  setMariaDbResolvedText,
  type WcDealer,
  type WcProduct,
} from "@digico/db";
import type { DeepSeekReplyResult } from "./deepseek.ts";
import { buildChatMessages, deepSeekModel, replyWithDeepSeekFull } from "./deepseek.ts";
import { routeIntent } from "./intent-router.ts";

import type { IncomingWhatsAppMessage } from "./parse-webhook.ts";
import { isEmulatorMessage } from "./parse-webhook.ts";
import { transcribeAudio } from "./transcribe.ts";
import { downloadWhatsAppMedia } from "./whatsapp-media.ts";
import { sendWhatsAppText } from "./whatsapp-send.ts";
import { parseDraftOrderPayload, validateAndExecuteOrderTool } from "./order-tools.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

  const log = await PipelineLog.open(message);
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
  const routeResult = await routeIntent(userText, message.from);
  if (routeResult.handled && routeResult.replyText) {
    console.log("[Intent Router] Intercepted deterministically without LLM call:", userText);
    await sendWhatsAppText(message.from, routeResult.replyText, isEmulatorMessage(message));
    await log.outboundReply({
      toPhone: message.from,
      replyText: routeResult.replyText,
      status: "sent",
    });
    await log.status("completed");
    return;
  }

  // Step 2: RAG Catalog Search (Retrieve top candidate products for compressed LLM prompt)
  let productsList: WcProduct[] = [];
  let dealerInfo: WcDealer | null = null;

  try {
    productsList = await searchMariaDbProducts(userText, 10);
    const mariaOrders = await fetchMariaDbOrders();
    const matchOrder = mariaOrders.find((o) => o.dealer.phone === message.from);
    if (matchOrder) {
      dealerInfo = matchOrder.dealer;
    }
  } catch (err) {
    console.error("Failed to fetch database context for DeepSeek prompt", err);
  }

  // Step 3: DeepSeek Completion with Tool Calling & Multi-Turn History
  const isEmulator = isEmulatorMessage(message);
  const chatHistory = await getMariaDbRecentConversationHistory(message.from, 8);
  const promptContext = { products: productsList, dealer: dealerInfo };
  const requestMessages = buildChatMessages(userText, promptContext, chatHistory);
  const startedAt = Date.now();

  let deepseekResult: DeepSeekReplyResult;
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
        const payload = parseDraftOrderPayload(call.function.arguments);
        if (!payload) {
          console.warn("Skipping malformed draft_order tool call", call.function.arguments);
          continue;
        }
        try {
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
    const payload = parseDraftOrderPayload(orderDataMatch[1]);
    if (!payload) {
      console.warn("Skipping malformed [ORDER_DATA] tag", orderDataMatch[1]);
    } else {
      try {
        await validateAndExecuteOrderTool(payload);
        reply = reply.replace(/\[ORDER_DATA:\s*\{.*?\}\s*\]/s, "").trim();
      } catch (err) {
        console.error("Failed to execute fallback [ORDER_DATA] order", err);
      }
    }
  }

  // Step 5: Send final formatted WhatsApp reply
  if (reply.trim().length > 0) {
    await sendWhatsAppText(message.from, reply, isEmulator);
    await log.outboundReply({ toPhone: message.from, replyText: reply, status: "sent" });
  }

  await log.status("completed");
}
