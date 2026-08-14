import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getEmulatorChatHistory } from "@digico/db";
import type { EmulatorChatMessage } from "@digico/contracts";
import { handleIncomingMessage } from "../services/handle-message.ts";
import { parseIncomingMessages } from "../services/parse-webhook.ts";

export type { EmulatorChatMessage };

export interface EmulatorSendInput {
  fromPhone: string;
  contactName?: string;
  text: string;
}

async function fetchChatHistoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as Record<string, string>;
  const fromPhone = query.phone || "+8801711000001";

  const messages = await getEmulatorChatHistory(fromPhone);
  return reply.send({ fromPhone, messages });
}

export async function registerEmulatorRoutes(app: FastifyInstance) {
  // POST /api/emulator/send
  app.post("/api/emulator/send", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as EmulatorSendInput;
    const { fromPhone, contactName, text } = body;

    if (!fromPhone || !text) {
      return reply.code(400).send({ error: "fromPhone and text are required" });
    }

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
    for (const msg of parsed) {
      await handleIncomingMessage(msg);
    }

    return reply.send({ success: true, messageId, metaPayload });
  });

  // Support both GET /api/emulator/chat and GET /api/emulator/history
  app.get("/api/emulator/chat", fetchChatHistoryHandler);
  app.get("/api/emulator/history", fetchChatHistoryHandler);
}
