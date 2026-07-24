import { replyWithDeepSeek } from "./deepseek.ts";
import type { IncomingWhatsAppMessage } from "./parse-webhook.ts";
import { transcribeAudio } from "./transcribe.ts";
import { downloadWhatsAppMedia } from "./whatsapp-media.ts";
import { sendWhatsAppText } from "./whatsapp-send.ts";

const seenMessageIds = new Set<string>();
const MAX_SEEN = 1000;

function remember(messageId: string): boolean {
  if (seenMessageIds.has(messageId)) return false;
  seenMessageIds.add(messageId);
  if (seenMessageIds.size > MAX_SEEN) {
    const first = seenMessageIds.values().next().value;
    if (first !== undefined) seenMessageIds.delete(first);
  }
  return true;
}

async function resolveUserText(message: IncomingWhatsAppMessage): Promise<string> {
  if (message.kind === "text" && message.text) {
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
    return transcript;
  }

  throw new Error(`Unsupported message kind: ${message.kind}`);
}

/** Process one inbound message: (transcribe) → LLM → WhatsApp reply. */
export async function handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<void> {
  if (!remember(message.messageId)) {
    console.log("Skipping duplicate message", message.messageId);
    return;
  }

  console.log("Incoming WhatsApp message:", JSON.stringify(message, null, 2));

  let userText: string;
  try {
    userText = await resolveUserText(message);
  } catch (error) {
    console.error("Failed to resolve user text", error);
    await sendWhatsAppText(
      message.from,
      "Sorry, I couldn't understand that voice note. Could you type it instead?",
    );
    return;
  }

  const reply = await replyWithDeepSeek(userText);
  console.log("DeepSeek reply:", reply);

  await sendWhatsAppText(message.from, reply);
  console.log("WhatsApp reply sent to", message.from);
}

/** @deprecated Use handleIncomingMessage */
export async function handleIncomingText(message: IncomingWhatsAppMessage): Promise<void> {
  return handleIncomingMessage(message);
}
