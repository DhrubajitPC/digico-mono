export type MessageKind = "text" | "audio" | "unsupported";

export interface IncomingTextPayload {
  body: string;
}

export interface IncomingAudioPayload {
  mediaId: string;
  mimeType: string;
}

export interface IncomingWhatsAppMessage {
  messageId: string;
  from: string;
  timestamp: string;
  contactName: string | null;
  phoneNumberId: string | null;
  kind: MessageKind;
  text: string | null;
  audio: IncomingAudioPayload | null;
}

function extractContactName(value: any, waId: string): string | null {
  const contacts = value?.contacts;
  if (!Array.isArray(contacts)) return null;
  const match = contacts.find((c) => c.wa_id === waId);
  return match?.profile?.name ?? null;
}

/** Parses Meta WhatsApp Cloud API Webhook payload into array of clean message objects */
export function parseIncomingMessages(rawPayload: unknown): IncomingWhatsAppMessage[] {
  const results: IncomingWhatsAppMessage[] = [];

  const entry = (rawPayload as any)?.entry;
  if (!Array.isArray(entry)) return results;

  for (const item of entry) {
    const changes = item?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const val = change?.value;
      const phoneNumberId = val?.metadata?.phone_number_id ?? null;
      const msgs = val?.messages;
      if (!Array.isArray(msgs)) continue;

      for (const m of msgs) {
        if (!m.id || !m.from) continue;

        const waId = m.from;
        const contactName = extractContactName(val, waId);
        const type = m.type;

        if (type === "text" && m.text?.body) {
          results.push({
            messageId: m.id,
            from: m.from,
            timestamp: String(m.timestamp ?? Date.now()),
            contactName,
            phoneNumberId,
            kind: "text",
            text: m.text.body,
            audio: null,
          });
        } else if (type === "audio" && m.audio?.id) {
          results.push({
            messageId: m.id,
            from: m.from,
            timestamp: String(m.timestamp ?? Date.now()),
            contactName,
            phoneNumberId,
            kind: "audio",
            text: null,
            audio: {
              mediaId: m.audio.id,
              mimeType: m.audio.mime_type ?? "audio/ogg",
            },
          });
        }
      }
    }
  }

  return results;
}
