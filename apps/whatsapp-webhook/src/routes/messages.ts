import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getMariaDbMessageDetail, listMariaDbMessages } from "@digico/db";

export async function registerMessageRoutes(app: FastifyInstance) {
  // GET /api/messages
  app.get("/api/messages", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string>;
    const limit = query.limit ? Number(query.limit) : undefined;
    const offset = query.offset ? Number(query.offset) : undefined;

    const result = await listMariaDbMessages({
      phone: query.phone || undefined,
      status: query.status || undefined,
      limit,
      offset,
    });

    return reply.send(result);
  });

  // GET /api/messages/:id
  app.get(
    "/api/messages/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: "Invalid message ID" });

      const detail = await getMariaDbMessageDetail(id);
      if (!detail) return reply.code(404).send({ error: "Message detail not found" });

      return reply.send(detail);
    },
  );
}
