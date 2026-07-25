import { buildChatMessages, deepSeekModel, replyWithDeepSeek } from "./deepseek.ts";
import { getDb } from "./db/instance.ts";
import type { Db } from "./db/client.ts";
import {
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

  const requestMessages = buildChatMessages(userText);
  const startedAt = Date.now();
  let reply: string;
  try {
    reply = await replyWithDeepSeek(userText);
  } catch (error) {
    await log.aiCall({
      requestMessages,
      error: errorMessage(error),
      latencyMs: Date.now() - startedAt,
    });
    await log.status("failed", errorMessage(error));
    throw error;
  }
  await log.aiCall({ requestMessages, responseText: reply, latencyMs: Date.now() - startedAt });
  console.log("DeepSeek reply:", reply);

  try {
    await sendWhatsAppText(message.from, reply);
  } catch (error) {
    await log.outboundReply({
      toPhone: message.from,
      replyText: reply,
      status: "failed",
      error: errorMessage(error),
    });
    await log.status("failed", errorMessage(error));
    throw error;
  }

  console.log("WhatsApp reply sent to", message.from);
  await log.outboundReply({ toPhone: message.from, replyText: reply, status: "sent" });
  await log.status("completed");
}

/** @deprecated Use handleIncomingMessage */
export async function handleIncomingText(message: IncomingWhatsAppMessage): Promise<void> {
  return handleIncomingMessage(message);
}
