import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { handleIncomingMessage } from "../services/handle-message.ts";
import { parseIncomingMessages } from "../services/parse-webhook.ts";

export async function registerWebhookRoutes(app: FastifyInstance) {
  // GET /webhook (Meta Cloud API Verify Token Challenge)
  app.get(
    "/webhook",
    async (
      req: FastifyRequest<{
        Querystring: {
          "hub.mode"?: string;
          "hub.verify_token"?: string;
          "hub.challenge"?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "digico_secret_verify_token_12345";

      if (mode === "subscribe" && token === expectedToken) {
        console.log("Webhook verified successfully with Meta");
        return reply.code(200).type("text/plain").send(challenge);
      }

      console.warn("Webhook verification failed: token mismatch");
      return reply.code(403).send({ error: "Forbidden: verify token mismatch" });
    },
  );

  // POST /webhook (Meta Cloud API Message Ingress)
  app.post("/webhook", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.code(200).send({ status: "ok" });

    const messages = parseIncomingMessages(req.body);
    for (const msg of messages) {
      handleIncomingMessage(msg).catch((err) => {
        console.error("Unhandled error processing message", msg.messageId, err);
      });
    }
  });
}
