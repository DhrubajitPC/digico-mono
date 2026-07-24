/**
 * Normalized inbound WhatsApp message (text or audio).
 * Audio is transcribed before anything is sent to the LLM.
 */
export type IncomingWhatsAppMessage = {
  messageId: string;
  from: string;
  timestamp: string;
  contactName: string | null;
  phoneNumberId: string | null;
  kind: "text" | "audio";
  /** Present for text messages. */
  text: string | null;
  /** Present for audio / voice notes. */
  audio: {
    mediaId: string;
    mimeType: string | null;
    voice: boolean;
  } | null;
};

/** @deprecated Use IncomingWhatsAppMessage */
export type IncomingWhatsAppText = IncomingWhatsAppMessage & {
  kind: "text";
  text: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

/**
 * Extract inbound text + audio messages from a Meta WhatsApp Cloud API webhook body.
 * Status updates and other types are ignored.
 */
export function parseIncomingMessages(body: unknown): IncomingWhatsAppMessage[] {
  if (!isRecord(body) || body.object !== "whatsapp_business_account") {
    return [];
  }

  const entry = Array.isArray(body.entry) ? body.entry : [];
  const messages: IncomingWhatsAppMessage[] = [];

  for (const item of entry) {
    if (!isRecord(item)) continue;
    const changes = Array.isArray(item.changes) ? item.changes : [];

    for (const change of changes) {
      if (!isRecord(change) || change.field !== "messages") continue;
      if (!isRecord(change.value)) continue;

      const value = change.value;
      const phoneNumberId = isRecord(value.metadata)
        ? asString(value.metadata.phone_number_id)
        : null;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactNameByWaId = new Map<string, string>();
      for (const contact of contacts) {
        if (!isRecord(contact)) continue;
        const waId = asString(contact.wa_id);
        const name = isRecord(contact.profile) && asString(contact.profile.name);
        if (waId && name) contactNameByWaId.set(waId, name);
      }

      const inbound = Array.isArray(value.messages) ? value.messages : [];
      for (const message of inbound) {
        if (!isRecord(message)) continue;

        const messageId = asString(message.id);
        const from = asString(message.from);
        const timestamp = asString(message.timestamp);
        if (!messageId || !from || !timestamp) continue;

        const base = {
          messageId,
          from,
          timestamp,
          contactName: contactNameByWaId.get(from) ?? null,
          phoneNumberId,
        };

        if (message.type === "text" && isRecord(message.text)) {
          const text = asString(message.text.body);
          if (!text) continue;
          messages.push({
            ...base,
            kind: "text",
            text,
            audio: null,
          });
          continue;
        }

        if (message.type === "audio" && isRecord(message.audio)) {
          const mediaId = asString(message.audio.id);
          if (!mediaId) continue;
          messages.push({
            ...base,
            kind: "audio",
            text: null,
            audio: {
              mediaId,
              mimeType: asString(message.audio.mime_type),
              voice: asBoolean(message.audio.voice),
            },
          });
        }
      }
    }
  }

  return messages;
}

/** @deprecated Use parseIncomingMessages */
export function parseIncomingTextMessages(body: unknown): IncomingWhatsAppMessage[] {
  return parseIncomingMessages(body).filter((m) => m.kind === "text");
}
