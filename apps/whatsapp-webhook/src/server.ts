import Fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createContext } from "@digico/api";
import { registerDealerRoutes } from "./routes/dealers.ts";
import { registerEmulatorRoutes } from "./routes/emulator.ts";
import { registerMessageRoutes } from "./routes/messages.ts";
import { registerOrderRoutes } from "./routes/orders.ts";
import { registerProductRoutes } from "./routes/products.ts";
import { registerWebhookRoutes } from "./routes/webhook.ts";

const PORT = Number(process.env.PORT ?? 8787);

async function startServer() {
  const app = Fastify({ logger: false });

  // GET /health
  app.get("/health", async (_req, reply) => {
    return reply.send("ok");
  });

  // Register Route Modules
  await registerWebhookRoutes(app);
  await registerOrderRoutes(app);
  await registerProductRoutes(app);
  await registerDealerRoutes(app);
  await registerMessageRoutes(app);
  await registerEmulatorRoutes(app);

  // tRPC router — all dashboard API procedures live here
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  function checkEnv(name: string) {
    if (!process.env[name]) {
      console.warn(`Warning: ${name} is not set — replies will fail until it is.`);
    }
  }

  checkEnv("DEEPSEEK_API_KEY");
  checkEnv("WHATSAPP_ACCESS_TOKEN");
  checkEnv("WHATSAPP_PHONE_NUMBER_ID");
  checkEnv("OPENAI_API_KEY");

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Digico Fastify REST API & Webhook listening on http://0.0.0.0:${PORT}`);
  console.log(`- Webhook:  GET/POST /webhook`);
  console.log(`- Health:   GET /health`);
  console.log(`- Orders:   GET/POST/PATCH /api/orders`);
}

startServer().catch((err) => {
  console.error("FATAL: Failed to start Fastify server", err);
  process.exit(1);
});
