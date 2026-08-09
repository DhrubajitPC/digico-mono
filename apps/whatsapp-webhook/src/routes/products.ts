import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fetchMariaDbProducts } from "@digico/db";

export async function registerProductRoutes(app: FastifyInstance) {
  // GET /api/products
  app.get("/api/products", async (_req: FastifyRequest, reply: FastifyReply) => {
    const products = await fetchMariaDbProducts();
    return reply.send(products);
  });
}
