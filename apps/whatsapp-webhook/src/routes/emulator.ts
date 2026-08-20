import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getEmulatorChatHistory } from "@digico/db";
import type { EmulatorChatMessage } from "@digico/contracts";
import { handleIncomingMessage } from "../services/handle-message.ts";
import { parseIncomingMessages } from "../services/parse-webhook.ts";

export type { EmulatorChatMessage };

export interface EmulatorSendInput {
  fromPhone: string;
  contactName?: string;
  /** Omitted when sending a voice note. */
  text?: string;
  /** A mic recording from the emulator, base64-encoded. */
  audio?: { data: string; mimeType: string };
}

/** WhatsApp's own voice-note ceiling; keeps a stray upload from exhausting memory. */
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

/**
 * Decodes a base64 recording into the shape transcribeAudio expects.
 *
 * Buffer.from silently skips characters outside the base64 alphabet, so the
 * payload is validated first — otherwise a truncated upload becomes a corrupt
 * blob and surfaces as an opaque provider error rather than a 400.
 */
function decodeAudio(data: string): { bytes: ArrayBuffer } | { error: string } {
  // Tolerate a data: URL, which is what FileReader hands the browser.
  const base64 = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;

  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { error: "audio.data must be base64" };
  }
  if (Math.floor((base64.length * 3) / 4) > MAX_AUDIO_BYTES) {
    return { error: `audio exceeds ${MAX_AUDIO_BYTES} bytes` };
  }

  const buf = Buffer.from(base64, "base64");
  if (buf.byteLength === 0) {
    return { error: "audio.data decoded to zero bytes" };
  }

  return { bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

async function fetchChatHistoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as Record<string, string>;
  const fromPhone = query.phone || "8801711000001";

  const messages = await getEmulatorChatHistory(fromPhone);
  return reply.send({ fromPhone, messages });
}

export async function registerEmulatorRoutes(app: FastifyInstance) {
  // POST /api/emulator/send
  app.post("/api/emulator/send", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as EmulatorSendInput;
    const { fromPhone, contactName, text, audio } = body;

    if (!fromPhone) {
      return reply.code(400).send({ error: "fromPhone is required" });
    }
    if (!text && !audio) {
      return reply.code(400).send({ error: "either text or audio is required" });
    }

    let inlineBytes: ArrayBuffer | undefined;
    if (audio) {
      const decoded = decodeAudio(audio.data);
      if ("error" in decoded) {
        return reply.code(400).send({ error: decoded.error });
      }
      inlineBytes = decoded.bytes;
    }

    const messageId = `wamid.HBgL${Date.now()}EMULATOR`;
    const timestamp = String(Math.floor(Date.now() / 1000));

    // Same Meta envelope either way, so the emulator exercises the real parser.
    // The audio variant carries a synthetic media id: the bytes travel out of band
    // on inlineBytes below, which also keeps them out of the payload inspector.
    const message = audio
      ? {
          from: fromPhone,
          id: messageId,
          timestamp,
          type: "audio",
          audio: { id: `${messageId}-media`, mime_type: audio.mimeType },
        }
      : {
          from: fromPhone,
          id: messageId,
          timestamp,
          type: "text",
          text: { body: text },
        };

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
                messages: [message],
              },
            },
          ],
        },
      ],
    };

    const parsed = parseIncomingMessages(metaPayload);
    for (const msg of parsed) {
      if (inlineBytes && msg.audio) {
        msg.audio.inlineBytes = inlineBytes;
      }
      await handleIncomingMessage(msg);
    }

    return reply.send({ success: true, messageId, metaPayload });
  });

  // Support both GET /api/emulator/chat and GET /api/emulator/history
  app.get("/api/emulator/chat", fetchChatHistoryHandler);
  app.get("/api/emulator/history", fetchChatHistoryHandler);
}
