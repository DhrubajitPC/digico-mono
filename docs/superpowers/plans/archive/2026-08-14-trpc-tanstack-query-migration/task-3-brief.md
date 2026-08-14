### Task 3: Remaining procedures + Fastify integration

**Files:**

- Create: `packages/api/src/routers/products.ts`
- Create: `packages/api/src/routers/dealers.ts`
- Create: `packages/api/src/routers/messages.ts`
- Create: `packages/api/tests/read-routers.test.ts`
- Modify: `packages/api/src/router.ts` (register the three routers + `RouterInputs`/`RouterOutputs`)
- Modify: `packages/api/src/index.ts` (export the new types)
- Modify: `apps/whatsapp-webhook/src/server.ts` (mount tRPC at `/trpc`)
- Modify: `apps/website/vite.config.ts` (proxy `/trpc`)

**Interfaces:**

- Consumes: `@digico/db` — `fetchMariaDbProducts()`, `fetchMariaDbDealers()`, `listMariaDbMessages({phone?, status?, limit?, offset?})`, `getMariaDbMessageDetail(id)`.
- Produces:
  - `products.list() → Product[]`, `dealers.list() → Dealer[]`
  - `messages.list({phone?, status?, limit?, offset?}) → {items, total}`, `messages.get({id}) → detail` (`NOT_FOUND` when missing)
  - `@digico/api` additionally exports `type RouterInputs = inferRouterInputs<typeof appRouter>` and `type RouterOutputs = inferRouterOutputs<typeof appRouter>` (used by `OrdersTable` in Task 5)

- [ ] **Step 1: Create the three read routers**

`packages/api/src/routers/products.ts`:

```ts
import { fetchMariaDbProducts } from "@digico/db";
import { publicProcedure, router } from "../trpc.ts";

export const productsRouter = router({
  list: publicProcedure.query(() => fetchMariaDbProducts()),
});
```

`packages/api/src/routers/dealers.ts`:

```ts
import { fetchMariaDbDealers } from "@digico/db";
import { publicProcedure, router } from "../trpc.ts";

export const dealersRouter = router({
  list: publicProcedure.query(() => fetchMariaDbDealers()),
});
```

`packages/api/src/routers/messages.ts`:

```ts
import { TRPCError } from "@trpc/server";
import { getMariaDbMessageDetail, listMariaDbMessages } from "@digico/db";
import { z } from "zod";
import { publicProcedure, router } from "../trpc.ts";

const listMessagesInputSchema = z.object({
  phone: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const messagesRouter = router({
  list: publicProcedure
    .input(listMessagesInputSchema)
    .query(({ input }) => listMariaDbMessages(input)),
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const detail = await getMariaDbMessageDetail(input.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Message detail not found" });
      return detail;
    }),
});
```

- [ ] **Step 2: Write the failing tests**

`packages/api/tests/read-routers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dealer, Product } from "@digico/contracts";

const db = vi.hoisted(() => ({
  fetchMariaDbProducts: vi.fn(),
  fetchMariaDbDealers: vi.fn(),
  listMariaDbMessages: vi.fn(),
  getMariaDbMessageDetail: vi.fn(),
}));

vi.mock("@digico/db", () => db);

import { dealersRouter } from "../src/routers/dealers.ts";
import { messagesRouter } from "../src/routers/messages.ts";
import { productsRouter } from "../src/routers/products.ts";

const productFixture: Product = {
  id: 1,
  sku: "LN-TP",
  brand: "Lenovo",
  name: "ThinkPad T14",
  category: "Laptop",
  model: "T14",
  specifications: null,
  unitPrice: 600,
  stockQuantity: 10,
  aliases: [],
};

const dealerFixture: Dealer = {
  id: 1,
  businessName: "Acme Trading",
  phone: "+8801711000001",
  contactPerson: "Acme Person",
};

describe("read routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("products.list returns the product list", async () => {
    db.fetchMariaDbProducts.mockResolvedValue([productFixture]);
    await expect(productsRouter.createCaller({}).list()).resolves.toEqual([productFixture]);
  });

  it("dealers.list returns the dealer list", async () => {
    db.fetchMariaDbDealers.mockResolvedValue([dealerFixture]);
    await expect(dealersRouter.createCaller({}).list()).resolves.toEqual([dealerFixture]);
  });

  it("messages.list passes filters through to the db", async () => {
    db.listMariaDbMessages.mockResolvedValue({ items: [], total: 0 });
    const caller = messagesRouter.createCaller({});
    await caller.list({ phone: "+8801", limit: 25, offset: 0 });
    expect(db.listMariaDbMessages).toHaveBeenCalledWith({ phone: "+8801", limit: 25, offset: 0 });
  });

  it("messages.list rejects a NaN limit", async () => {
    await expect(
      messagesRouter.createCaller({}).list({ limit: NaN } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("messages.get throws NOT_FOUND for a missing message", async () => {
    db.getMariaDbMessageDetail.mockResolvedValue(null);
    await expect(messagesRouter.createCaller({}).get({ id: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `vp run -r test --filter @digico/api`
Expected: FAIL — routers not found.

- [ ] **Step 4: Register the routers + export inference types**

`packages/api/src/router.ts` — replace with:

```ts
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./trpc.ts";
import { dealersRouter } from "./routers/dealers.ts";
import { healthRouter } from "./routers/health.ts";
import { messagesRouter } from "./routers/messages.ts";
import { ordersRouter } from "./routers/orders.ts";
import { productsRouter } from "./routers/products.ts";

export const appRouter = router({
  health: healthRouter,
  orders: ordersRouter,
  products: productsRouter,
  dealers: dealersRouter,
  messages: messagesRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<typeof appRouter>;
export type RouterOutputs = inferRouterOutputs<typeof appRouter>;
```

`packages/api/src/index.ts` — append:

```ts
export type { RouterInputs, RouterOutputs } from "./router.ts";
```

- [ ] **Step 5: Run tests to verify they pass + check**

Run: `vp run -r test --filter @digico/api && vp check`
Expected: all 12 tests pass; lint/type-check green.

- [ ] **Step 6: Mount tRPC on Fastify**

`apps/whatsapp-webhook/src/server.ts` — add imports and the plugin registration. Final diff shape (REST route registrations are still present — they get removed in Task 6):

```ts
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

  // ...checkEnv() and app.listen() unchanged
}
```

If `pnpm` reports a peer-dependency warning for `@trpc/server` ↔ fastify, add `fastify` to the `peerDependencyRules.allowAny` list in `pnpm-workspace.yaml` and re-run `vp install`.

- [ ] **Step 7: Add the dev proxy**

`apps/website/vite.config.ts` — extend the existing `server.proxy`:

```ts
proxy: {
  "/api": "http://localhost:8787",
  "/trpc": "http://localhost:8787",
},
```

- [ ] **Step 8: Smoke test the live server**

Run: `vp run whatsapp-webhook#dev` (in another terminal), then:

```bash
curl -s http://localhost:8787/trpc/health.ping
# Expected: {"result":{"data":{"ok":true}}}

curl -s -X POST http://localhost:8787/trpc/orders.list \
  -H "content-type: application/json" -d '{"json":{}}'
# Expected: {"result":{"data":{"items":[...],"total":N,"counts":{...}}}}

curl -s -X POST http://localhost:8787/trpc/orders.setStatus \
  -H "content-type: application/json" -d '{"json":{"id":1,"status":"bogus"}}'
# Expected: error envelope with "code":"BAD_REQUEST"

curl -s http://localhost:8787/api/orders
# Expected: still works (REST untouched for now)
```

- [ ] **Step 9: Commit**

```bash
git add packages/api apps/whatsapp-webhook/src/server.ts apps/website/vite.config.ts
git commit -m "feat(trpc): mount router on Fastify at /trpc with remaining procedures"
```
