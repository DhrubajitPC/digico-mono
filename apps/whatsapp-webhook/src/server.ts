import Fastify from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createContext, auth } from "@digico/api";
import { registerEmulatorRoutes } from "./routes/emulator.ts";
import { registerWebhookRoutes } from "./routes/webhook.ts";

const PORT = Number(process.env.PORT ?? 8787);

async function startServer() {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Better Auth
  app.all("/api/auth/*", async (request, reply) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    const headers = new Headers();

    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }
    }

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : JSON.stringify(request.body);

    const response = await auth.handler(
      new Request(url, {
        method: request.method,
        headers,
        body,
      }),
    );

    reply.status(response.status);

    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });

    const responseBody = await response.text();

    return reply.send(responseBody);
  });

  // GET /health
  app.get("/health", async (_req, reply) => {
    return reply.send("ok");
  });

  // Webhook ingestion + emulator ingress stay REST (spec §2.4)
  await registerWebhookRoutes(app);
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

  /**
   * Optional features. Absence is a supported configuration, so this must not
   * reuse the warning above — text ordering keeps working, and crying wolf on
   * every default install teaches operators to ignore the line that is real.
   */
  function checkOptionalEnv(name: string, feature: string) {
    if (!process.env[name]) {
      console.info(`Note: ${name} is not set — ${feature} is disabled.`);
    }
  }

  checkEnv("DEEPSEEK_API_KEY");
  checkEnv("WHATSAPP_ACCESS_TOKEN");
  checkEnv("WHATSAPP_PHONE_NUMBER_ID");
  checkOptionalEnv("ELEVENLABS_API_KEY", "voice-note transcription");

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Digico Fastify API & Webhook listening on http://0.0.0.0:${PORT}`);
  console.log(`- tRPC:     /trpc`);
  console.log(`- Webhook:  GET/POST /webhook`);
  console.log(`- Emulator: GET/POST /api/emulator/*`);
}

startServer().catch((err) => {
  console.error("FATAL: Failed to start Fastify server", err);
  process.exit(1);
});
