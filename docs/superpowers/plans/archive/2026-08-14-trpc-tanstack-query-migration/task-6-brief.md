### Task 6: Delete REST layer & `api.ts`

**Files:**

- Delete: `apps/website/src/api.ts`
- Delete: `apps/whatsapp-webhook/src/routes/orders.ts`
- Delete: `apps/whatsapp-webhook/src/routes/products.ts`
- Delete: `apps/whatsapp-webhook/src/routes/dealers.ts`
- Delete: `apps/whatsapp-webhook/src/routes/messages.ts`
- Modify: `apps/whatsapp-webhook/src/server.ts` (drop the four route registrations; keep emulator + webhook + tRPC)

**Interfaces:**

- Consumes: everything already migrated in Tasks 1–5.
- Produces: Fastify serves only `/webhook`, `/health`, `/api/emulator/*`, and `/trpc`. The `/api` dev proxy stays (emulator still uses it).

- [ ] **Step 1: Remove the REST route registrations**

`apps/whatsapp-webhook/src/server.ts` — remove the four imports and `await register*Routes(app)` calls for orders/products/dealers/messages; keep `registerWebhookRoutes` and `registerEmulatorRoutes`. Resulting file:

```ts
import Fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createContext } from "@digico/api";
import { registerEmulatorRoutes } from "./routes/emulator.ts";
import { registerWebhookRoutes } from "./routes/webhook.ts";

const PORT = Number(process.env.PORT ?? 8787);

async function startServer() {
  const app = Fastify({ logger: false });

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

  checkEnv("DEEPSEEK_API_KEY");
  checkEnv("WHATSAPP_ACCESS_TOKEN");
  checkEnv("WHATSAPP_PHONE_NUMBER_ID");
  checkEnv("OPENAI_API_KEY");

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
```

- [ ] **Step 2: Delete the files**

Run:

```bash
rm apps/website/src/api.ts \
   apps/whatsapp-webhook/src/routes/orders.ts \
   apps/whatsapp-webhook/src/routes/products.ts \
   apps/whatsapp-webhook/src/routes/dealers.ts \
   apps/whatsapp-webhook/src/routes/messages.ts
```

- [ ] **Step 3: Full verification**

Run: `vp check && vp run -r test && vp run -r build`
Expected: green. (If `vp run -r build` includes the webhook app's own check, nothing in `apps/whatsapp-webhook` references the deleted routes.)

- [ ] **Step 4: Full-stack smoke**

With server running:

```bash
curl -s http://localhost:8787/trpc/health.ping            # → {"result":{"data":{"ok":true}}}
curl -s http://localhost:8787/api/orders                  # → 404 (REST orders removed)
curl -s http://localhost:8787/api/emulator/chat?phone=%2B8801711000001  # → still works
curl -s http://localhost:8787/webhook                     # → verify-token flow, unchanged
```

Then in the browser: dashboard tabs/filters/refresh/bulk actions, order drawer (edit/save/approve/status/mark-completed), create-order modal, emulator chat, message log — all three views fully functional.

- [ ] **Step 5: Commit**

```bash
git add -A apps/website apps/whatsapp-webhook
git commit -m "refactor(trpc): remove REST API routes and api.js"
```

---

## Risks (from spec §6)

- **`strict: true` on the website** (Task 1) may surface latent nullability errors — fix with `??`/optional chaining; no runtime change expected.
- **`import type` discipline** on `@digico/api` from the website: value imports would drag mysql2 into the browser bundle. Enforced by review; the tRPC client file is the only sanctioned runtime import.
- **Node type-stripping:** no `enum`/`namespace` in new code; explicit `.ts` extensions on relative imports (repo rule already).
- **React Query caching** briefly shows stale data after mutations until invalidations resolve — equivalent UX to today's manual `fetchOrders()`.
- **Input hardening (spec §5)** makes the boundary stricter than today (invalid statuses/`NaN` limits now reject). No client sends such values today; any 400s in the browser console after rollout are real bugs worth fixing, not regressions.
