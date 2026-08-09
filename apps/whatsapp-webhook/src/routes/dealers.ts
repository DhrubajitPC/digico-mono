import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fetchMariaDbDealers } from "@digico/db";

export async function registerDealerRoutes(app: FastifyInstance) {
  // GET /api/dealers
  app.get("/api/dealers", async (_req: FastifyRequest, reply: FastifyReply) => {
    const dealers = await fetchMariaDbDealers();
    return reply.send(dealers);
  });
}
