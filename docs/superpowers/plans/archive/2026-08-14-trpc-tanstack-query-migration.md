# tRPC + TanStack Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled REST fetch layer (`apps/website/src/api.ts` + custom hooks) with typed tRPC v11 procedures served by the existing Fastify app, paired with TanStack Query v5, without changing observable UI behavior.

**Architecture:** A new `packages/api` package owns the tRPC router (procedures + zod input schemas) and is mounted onto the existing Fastify app at `/trpc` via `@trpc/server/adapters/fastify`. The React client gets typed hooks through `createTRPCReact` + `httpBatchLink`, wired at `main.tsx` with a shared `QueryClient`. The webhook endpoint (`/webhook`) and the emulator ingress endpoints (`/api/emulator/*`) stay plain Fastify REST — `emulator/send` feeds the webhook AI pipeline, which lives in the app and cannot be imported from a package without a service extraction that is out of scope (spec §2.4, §7). The REST orders/products/dealers/messages routes are deleted once the client has fully migrated (Task 6).

**Tech Stack:** tRPC v11 (`@trpc/server`, `@trpc/client`, `@trpc/react-query`), TanStack Query v5 (`@tanstack/react-query`), zod v4, Fastify 5, React 19, Vite+ (`vp`) with pnpm catalog.

**Spec:** [docs/superpowers/specs/2026-08-14-trpc-tanstack-query-migration.md](../specs/2026-08-14-trpc-tanstack-query-migration.md)

## Global Constraints

- **Verification:** every task ends with `vp check` (format/lint/type-check), `vp run -r test`, and where noted `vp run -r build` — all must pass before commit. Server must be running (`vp run whatsapp-webhook#dev`) for smoke steps.
- **Layering:** apps depend on packages; packages never depend on apps. `packages/api` may import `@digico/contracts`, `@digico/db`, `@trpc/*`, `zod` — never anything from `apps/*`.
- **Browser bundle safety:** `apps/website` may only ever `import type { AppRouter, RouterInputs, RouterOutputs } from "@digico/api"` — never value imports (the router transitively pulls `@digico/db`/`mysql2`, which must never enter the client bundle). This holds for the lifetime of the codebase.
- **Lint rules (enforced):** no explicit `any`; named imports only (`import/no-namespace`); barrel imports only — `@digico/api`, never `@digico/api/src/...` (`no-restricted-imports`).
- **Node type-stripping:** relative imports in server + packages must use explicit `.ts` extensions (`./trpc.ts`); no `enum`/`namespace` syntax anywhere (zod `z.enum` is runtime JS and fine).
- **Deps:** shared versions go in the pnpm catalog (`pnpm-workspace.yaml`); run `vp install` after editing it.
- **Behavior preservation:** procedure outputs keep today's exact shapes, including quirks — `orders.get` returns `history: []`; `orders.create` hardcodes phone/customer and reads only `items`/`notes`; `orders.list` accepts but ignores `origin`. Intentional hardening (status enum validation, int `limit`/`offset`) is listed in spec §5.
- **Workflow:** work on branch `feat/trpc-migration`, one commit per task (messages below), single PR at the end (diff ~15 files, <1000 lines).

---

### Task 1: Tooling & `packages/api` scaffold

**Files:**

- Modify: `pnpm-workspace.yaml` (catalog entries)
- Modify: `apps/whatsapp-webhook/package.json` (deps)
- Modify: `apps/website/package.json` (deps)
- Modify: `apps/website/tsconfig.json` (strict)
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vite.config.ts`
- Create: `packages/api/src/trpc.ts`
- Create: `packages/api/src/context.ts`
- Create: `packages/api/src/routers/health.ts`
- Create: `packages/api/src/router.ts`
- Create: `packages/api/src/index.ts`

**Interfaces:**

- Consumes: nothing yet (the workspace glob `packages/*` already covers the new package).
- Produces (all later tasks depend on these exact exports):
  - `@digico/api` → `appRouter: Router`, `createContext(): TrpcContext`, `type AppRouter = typeof appRouter` (plus `RouterInputs`/`RouterOutputs` added in Task 3)
  - `packages/api/src/trpc.ts` → `t`, `router`, `publicProcedure` (used by every router file)

- [ ] **Step 1: Add catalog entries to `pnpm-workspace.yaml`**

Insert into the `catalog:` block (alphabetical position):

```yaml
"@tanstack/react-query": ^5.62.0
"@trpc/client": ^11.0.0
"@trpc/react-query": ^11.0.0
"@trpc/server": ^11.0.0
zod: ^4.0.0
```

- [ ] **Step 2: Create `packages/api/package.json`**

```json
{
  "name": "@digico/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "vp check",
    "test": "vp test"
  },
  "dependencies": {
    "@digico/contracts": "workspace:*",
    "@digico/db": "workspace:*",
    "@trpc/server": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

- [ ] **Step 3: Create `packages/api/tsconfig.json`** (mirrors `apps/whatsapp-webhook/tsconfig.json`; tRPC requires strict)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `packages/api/vite.config.ts`** (copy of `packages/utils/vite.config.ts`)

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
```

- [ ] **Step 5: Create the tRPC instance and context**

`packages/api/src/trpc.ts`:

```ts
import { initTRPC } from "@trpc/server";
import type { TrpcContext } from "./context.ts";

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

`packages/api/src/context.ts`:

```ts
/** Empty for now — auth middleware slots in here later (spec §7). */
export interface TrpcContext {}

export function createContext(): TrpcContext {
  return {};
}
```

- [ ] **Step 6: Create the first router + the root router + the barrel**

`packages/api/src/routers/health.ts`:

```ts
import { publicProcedure, router } from "../trpc.ts";

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true as const })),
});
```

`packages/api/src/router.ts`:

```ts
import { router } from "./trpc.ts";
import { healthRouter } from "./routers/health.ts";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
```

`packages/api/src/index.ts`:

```ts
export { createContext } from "./context.ts";
export type { TrpcContext } from "./context.ts";
export { appRouter } from "./router.ts";
export type { AppRouter } from "./router.ts";
```

- [ ] **Step 7: Add `@digico/api` + tRPC deps to the apps**

`apps/whatsapp-webhook/package.json` `dependencies` — add:

```json
"@digico/api": "workspace:*",
"@trpc/server": "catalog:",
```

`apps/website/package.json` `dependencies` — add:

```json
"@digico/api": "workspace:*",
"@tanstack/react-query": "catalog:",
"@trpc/client": "catalog:",
"@trpc/react-query": "catalog:",
```

- [ ] **Step 8: Enable `strict` in `apps/website/tsconfig.json`**

Add to `compilerOptions`:

```json
"strict": true,
```

Run `vp check` and fix any latent nullability errors this surfaces (expected: 0–2, e.g. a `possibly null` access — fix with `??`/optional chaining, no runtime change).

- [ ] **Step 9: Install, check, commit**

Run: `vp install && vp check && vp run -r test`
Expected: all green (no tests reference the new package yet).

```bash
git add pnpm-workspace.yaml packages/api apps/whatsapp-webhook/package.json apps/website/package.json apps/website/tsconfig.json
git commit -m "feat(trpc): scaffold @digico/api package and catalog deps"
```

### Task 2: Orders procedures + tests

**Files:**

- Create: `packages/api/src/schemas.ts`
- Create: `packages/api/src/routers/orders.ts`
- Create: `packages/api/tests/orders-router.test.ts`
- Modify: `packages/api/src/router.ts` (register `ordersRouter`)

**Interfaces:**

- Consumes: `@digico/db` — `fetchMariaDbOrders({status?, search?})`, `fetchMariaDbOrderById(id)`, `createMariaDbOrder({phone, customerName, productName, quantity, unitPrice, totalAmount, notes})`, `updateMariaDbOrder(id, {notes?, proposedMessage?, items?})`, `updateMariaDbOrderStatus(id, status, reason?, proposedMessage?)`, `MariaDbError`. Types `Order`, `OrderStatusType` from `@digico/contracts`.
- Produces (Task 4/5 depend on these exact signatures):
  - `orders.list({status?: "all"|OrderStatusType, origin?: OrderOriginType, search?: string}) → {items: Order[], total: number, counts: {all, pending_review, confirmed, on_hold, processing, completed, cancelled}}`
  - `orders.get({id: int>0}) → Order & {history: []}` — `TRPCError NOT_FOUND` when missing
  - `orders.create({dealerId?, origin?, notes?, items: [{productId?, sku, productName, quantity, unitPrice}]}) → Order` (dealerId/origin accepted, dropped — spec §3)
  - `orders.update({id, notes?, proposedMessage?, items?}) → Order` — `NOT_FOUND` when missing
  - `orders.setStatus({id, status: OrderStatusType, reason?, proposedMessage?}) → Order` — `NOT_FOUND` when missing
  - `orders.bulkSetStatus({orderIds: int[]>0, status: OrderStatusType, reason?}) → {success: true, count}`

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/orders-router.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { Order } from "@digico/contracts";

const db = vi.hoisted(() => ({
  fetchMariaDbOrders: vi.fn(),
  fetchMariaDbOrderById: vi.fn(),
  createMariaDbOrder: vi.fn(),
  updateMariaDbOrder: vi.fn(),
  updateMariaDbOrderStatus: vi.fn(),
}));

vi.mock("@digico/db", () => db);

import { ordersRouter } from "../src/routers/orders.ts";

const orderFixture: Order = {
  id: 1,
  orderNumber: "ORD-1001",
  dealer: {
    id: 1,
    businessName: "Acme Trading",
    phone: "+8801711000001",
    contactPerson: "Acme Person",
  },
  status: "pending_review",
  origin: "whatsapp_ai",
  totalAmount: 1200,
  notes: null,
  proposedMessage: null,
  approvedBy: null,
  createdAt: "2026-08-14T10:00:00.000Z",
  updatedAt: "2026-08-14T10:00:00.000Z",
  items: [],
};

describe("ordersRouter", () => {
  const caller = ordersRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns items, total, and per-status counts", async () => {
    db.fetchMariaDbOrders.mockResolvedValue([orderFixture]);
    const result = await caller.list({ status: "all" });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([orderFixture]);
    expect(result.counts).toMatchObject({ all: 1, pending_review: 1, confirmed: 0 });
    expect(db.fetchMariaDbOrders).toHaveBeenCalledTimes(2);
    expect(db.fetchMariaDbOrders).toHaveBeenCalledWith({ status: null, search: null });
  });

  it("list forwards status and search filters", async () => {
    db.fetchMariaDbOrders.mockResolvedValue([]);
    await caller.list({ status: "processing", search: "Acme" });
    expect(db.fetchMariaDbOrders).toHaveBeenCalledWith({ status: "processing", search: "Acme" });
  });

  it("get returns the order with an empty history array", async () => {
    db.fetchMariaDbOrderById.mockResolvedValue(orderFixture);
    const result = await caller.get({ id: 1 });
    expect(result.id).toBe(1);
    expect(result.history).toEqual([]);
  });

  it("get throws NOT_FOUND for a missing order", async () => {
    db.fetchMariaDbOrderById.mockResolvedValue(null);
    await expect(caller.get({ id: 999 })).rejects.toThrow(TRPCError);
    await expect(caller.get({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("create computes the order total from line items", async () => {
    db.createMariaDbOrder.mockResolvedValue(orderFixture);
    await caller.create({
      items: [{ productName: "Lenovo ThinkPad", quantity: 2, unitPrice: 600, sku: "LN-TP" }],
    });
    expect(db.createMariaDbOrder).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 1200, productName: "Lenovo ThinkPad", quantity: 2 }),
    );
  });

  it("setStatus rejects status values outside the enum", async () => {
    await expect(caller.setStatus({ id: 1, status: "bogus" } as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("create rejects line items with a negative quantity", async () => {
    await expect(
      caller.create({
        items: [{ productName: "P", quantity: -1, unitPrice: 5, sku: "S" }],
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp run -r test --filter @digico/api` (or `cd packages/api && vp test`)
Expected: FAIL — `ordersRouter` not found (module `../src/routers/orders.ts` doesn't exist yet).

- [ ] **Step 3: Create the input schemas**

`packages/api/src/schemas.ts`:

```ts
import { z } from "zod";

export const orderStatusSchema = z.enum([
  "draft",
  "pending_review",
  "confirmed",
  "on_hold",
  "processing",
  "completed",
  "cancelled",
]);

export const orderOriginSchema = z.enum(["whatsapp_ai", "manual_sales"]);

export const orderItemInputSchema = z.object({
  productId: z.number().int().positive().optional(),
  sku: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const listOrdersInputSchema = z.object({
  status: orderStatusSchema.or(z.literal("all")).optional(),
  origin: orderOriginSchema.optional(),
  search: z.string().optional(),
});

export const createOrderInputSchema = z.object({
  dealerId: z.number().int().positive().optional(),
  origin: orderOriginSchema.optional(),
  notes: z.string().nullable().optional(),
  items: z.array(orderItemInputSchema).default([]),
});

export const updateOrderInputSchema = z.object({
  id: z.number().int().positive(),
  notes: z.string().optional(),
  proposedMessage: z.string().optional(),
  items: z.array(orderItemInputSchema).optional(),
});

export const setOrderStatusInputSchema = z.object({
  id: z.number().int().positive(),
  status: orderStatusSchema,
  reason: z.string().optional(),
  proposedMessage: z.string().optional(),
});

export const bulkSetOrderStatusInputSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1),
  status: orderStatusSchema,
  reason: z.string().optional(),
});
```

- [ ] **Step 4: Create the orders router**

`packages/api/src/routers/orders.ts` (complete file):

```ts
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  MariaDbError,
  createMariaDbOrder,
  fetchMariaDbOrderById,
  fetchMariaDbOrders,
  updateMariaDbOrder,
  updateMariaDbOrderStatus,
} from "@digico/db";
import type { OrderHistoryItem } from "@digico/contracts";
import { publicProcedure, router } from "../trpc.ts";
import {
  bulkSetOrderStatusInputSchema,
  createOrderInputSchema,
  listOrdersInputSchema,
  setOrderStatusInputSchema,
  updateOrderInputSchema,
} from "../schemas.ts";

const EMPTY_HISTORY: OrderHistoryItem[] = [];

/** Error mapping mirrors the old REST routes: MariaDbError → 500, not-found → 404. */
function dbErrorToTrpc(err: unknown): never {
  if (err instanceof MariaDbError) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
  }
  throw err;
}

export const ordersRouter = router({
  list: publicProcedure.input(listOrdersInputSchema).query(async ({ input }) => {
    // "all" is sent by the dashboard tabs; the old route dropped it before fetching.
    const status = input.status && input.status !== "all" ? input.status : null;
    const search = input.search ?? null;

    const items = await fetchMariaDbOrders({ status, search });
    const allOrders = await fetchMariaDbOrders();

    const counts = {
      all: allOrders.length,
      pending_review: allOrders.filter((e) => e.status === "pending_review").length,
      confirmed: allOrders.filter((e) => e.status === "confirmed").length,
      on_hold: allOrders.filter((e) => e.status === "on_hold").length,
      processing: allOrders.filter((e) => e.status === "processing").length,
      completed: allOrders.filter((e) => e.status === "completed").length,
      cancelled: allOrders.filter((e) => e.status === "cancelled").length,
    };

    return { items, total: items.length, counts };
  }),

  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const order = await fetchMariaDbOrderById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return { ...order, history: EMPTY_HISTORY };
    }),

  create: publicProcedure.input(createOrderInputSchema).mutation(async ({ input }) => {
    const items = input.items;
    const firstItem = items[0];
    const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    try {
      return await createMariaDbOrder({
        phone: "+8801700000000",
        customerName: "Manual Sales Dealer",
        productName: firstItem?.productName || "Product",
        quantity: firstItem?.quantity || 1,
        unitPrice: firstItem?.unitPrice || total,
        totalAmount: total,
        notes: input.notes ?? null,
      });
    } catch (err) {
      return dbErrorToTrpc(err);
    }
  }),

  update: publicProcedure.input(updateOrderInputSchema).mutation(async ({ input }) => {
    const { id, ...body } = input;
    try {
      const updated = await updateMariaDbOrder(id, body);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return updated;
    } catch (err) {
      return dbErrorToTrpc(err);
    }
  }),

  setStatus: publicProcedure.input(setOrderStatusInputSchema).mutation(async ({ input }) => {
    try {
      const updated = await updateMariaDbOrderStatus(
        input.id,
        input.status,
        input.reason,
        input.proposedMessage,
      );
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return updated;
    } catch (err) {
      return dbErrorToTrpc(err);
    }
  }),

  bulkSetStatus: publicProcedure
    .input(bulkSetOrderStatusInputSchema)
    .mutation(async ({ input }) => {
      try {
        for (const id of input.orderIds) {
          await updateMariaDbOrderStatus(id, input.status, input.reason);
        }
      } catch (err) {
        return dbErrorToTrpc(err);
      }
      return { success: true as const, count: input.orderIds.length };
    }),
});
```

- [ ] **Step 5: Register the router**

`packages/api/src/router.ts` — replace the body with:

```ts
import { router } from "./trpc.ts";
import { healthRouter } from "./routers/health.ts";
import { ordersRouter } from "./routers/orders.ts";

export const appRouter = router({
  health: healthRouter,
  orders: ordersRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `vp run -r test --filter @digico/api`
Expected: 7 tests pass.

- [ ] **Step 7: Check + commit**

Run: `vp check`
Expected: green (type-aware lint on `packages/api`).

```bash
git add packages/api/src/schemas.ts packages/api/src/routers/orders.ts packages/api/tests/orders-router.test.ts packages/api/src/router.ts
git commit -m "feat(trpc): add orders procedures with zod validation and unit tests"
```

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

### Task 4: Client foundation + hooks migration

**Files:**

- Create: `apps/website/src/trpc.ts`
- Modify: `apps/website/src/main.tsx`
- Rewrite: `apps/website/src/hooks/useOrders.ts`
- Rewrite: `apps/website/src/hooks/useOrderReview.ts`

**Interfaces:**

- Consumes: `trpc` client instance (this task), `trpc.orders.list/get/update/setStatus/bulkSetStatus/create`, `trpc.products.list` (from Task 2/3), `@digico/contracts` types.
- Produces: the same return surfaces `useOrders`/`useOrderReview` expose today — `OrdersDashboard.tsx` and `OrderReviewDrawer.tsx` are **not** touched in this task.

- [ ] **Step 1: Create the tRPC client**

`apps/website/src/trpc.ts`:

```ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@digico/api";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/trpc" })],
});
```

- [ ] **Step 2: Wire the providers in `main.tsx`**

Replace `apps/website/src/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import { trpc, trpcClient } from "./trpc.js";
import "./theme.css";
import "./style.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
```

- [ ] **Step 3: Rewrite `useOrders`**

Replace `apps/website/src/hooks/useOrders.ts` with:

```ts
import { useState, type ChangeEvent } from "react";
import { trpc } from "../trpc.js";
import type { Order } from "@digico/contracts";

const BULK_ACTION_STATUS: Record<string, Order["status"] | null> = {
  processing: "processing",
  on_hold: "on_hold",
  completed: "completed",
  cancelled: "cancelled",
};

/** Fetch state, tab/search/origin filters, row selection, and bulk actions for the orders dashboard. */
export function useOrders() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const ordersQuery = trpc.orders.list.useQuery({
    status: activeTab,
    origin: originFilter || undefined,
    search: searchQuery || undefined,
  });

  const bulkStatusMutation = trpc.orders.bulkSetStatus.useMutation({
    onSuccess: () => void utils.orders.list.invalidate(),
  });

  const fetchOrders = () => {
    void utils.orders.list.invalidate();
  };

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && ordersQuery.data) {
      setSelectedOrderIds(ordersQuery.data.items.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleApplyBulkAction = async () => {
    if (!bulkAction || selectedOrderIds.length === 0) return;
    const targetStatus = BULK_ACTION_STATUS[bulkAction];
    if (!targetStatus) return;
    await bulkStatusMutation.mutateAsync({
      orderIds: selectedOrderIds,
      status: targetStatus,
      reason: `Bulk action: ${bulkAction}`,
    });
    setSelectedOrderIds([]);
    setBulkAction("");
  };

  return {
    ordersData: ordersQuery.data ?? null,
    activeTab,
    searchQuery,
    originFilter,
    selectedOrderIds,
    bulkAction,
    isLoading: ordersQuery.isFetching,
    reviewOrderId,
    showCreateModal,
    setActiveTab,
    setSearchQuery,
    setOriginFilter,
    setBulkAction,
    setSelectedOrderIds,
    setReviewOrderId,
    setShowCreateModal,
    fetchOrders,
    handleSelectAll,
    handleToggleSelectOrder,
    handleApplyBulkAction,
    counts: ordersQuery.data?.counts ?? {},
  };
}
```

Notes: `isLoading: ordersQuery.isFetching` matches today's spinner-on-every-fetch semantics; `fetchOrders` is now a query-key invalidation (the dashboard's refresh button + drawer `onRefresh` both still call it unchanged).

- [ ] **Step 4: Rewrite `useOrderReview`**

Replace `apps/website/src/hooks/useOrderReview.ts` with:

```ts
import { useEffect, useState } from "react";
import { trpc } from "../trpc.js";
import type { Order, OrderItem } from "@digico/contracts";
import { formatCurrency } from "@digico/utils";

/** Order + product loading, editable line items, message/notes, and the five mutation handlers. */
export function useOrderReview(
  orderId: number | null,
  options: { onRefresh: () => void; onClose: () => void },
) {
  const utils = trpc.useUtils();
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const [proposedMsg, setProposedMsg] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");

  const orderQuery = trpc.orders.get.useQuery({ id: orderId ?? 0 }, { enabled: orderId !== null });
  const productsQuery = trpc.products.list.useQuery();
  const order = orderQuery.data ?? null;
  const productsList = productsQuery.data ?? [];

  // Sync local editable state whenever the order (re)loads — same behavior as the old loadData().
  useEffect(() => {
    if (!order) return;
    setEditableItems(order.items.map((i) => ({ ...i })));
    setProposedMsg(
      order.proposedMessage ??
        `Dear ${order.dealer.businessName}, your order ${order.orderNumber} for total ${formatCurrency(order.totalAmount)} has been confirmed.`,
    );
    setNotes(order.notes ?? "");
  }, [order]);

  useEffect(() => {
    const first = productsList[0];
    if (first) setSelectedSku(first.sku);
  }, [productsList]);

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate();
      void utils.products.list.invalidate();
      options.onRefresh();
    },
  });
  const statusMutation = trpc.orders.setStatus.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate();
      options.onRefresh();
    },
  });

  const calculatedTotal = editableItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const handleItemQtyChange = (idx: number, qty: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          quantity: Math.max(1, qty),
          lineTotal: Math.max(1, qty) * next[idx].unitPrice,
        };
      }
      return next;
    });
  };

  const handleItemPriceChange = (idx: number, price: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          unitPrice: Math.max(0, price),
          lineTotal: next[idx].quantity * Math.max(0, price),
        };
      }
      return next;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProduct = () => {
    if (!order) return;
    const prod = productsList.find((p) => p.sku === selectedSku);
    if (!prod) return;

    setEditableItems((prev) => [
      ...prev,
      {
        id: Math.floor(Math.random() * 10000),
        orderId: order.id,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: 1,
        unitPrice: prod.unitPrice,
        lineTotal: prod.unitPrice,
      },
    ]);
  };

  const buildItemsPayload = () =>
    editableItems.map((i) => ({
      productId: i.productId ?? undefined,
      sku: i.sku,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

  const handleSaveEdits = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      await updateMutation.mutateAsync({
        id: order.id,
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
    } catch (err) {
      console.error("Failed to update order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndSend = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      await updateMutation.mutateAsync({
        id: order.id,
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
      await statusMutation.mutateAsync({
        id: order.id,
        status: "confirmed",
        reason: "Approved by Sales Admin",
        proposedMessage: proposedMsg,
      });
      options.onClose();
    } catch (err) {
      console.error("Failed to approve order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetStatus = async (status: Order["status"], reason?: string) => {
    if (!order) return;
    try {
      setIsSaving(true);
      await statusMutation.mutateAsync({ id: order.id, status, reason });
      options.onClose();
    } catch (err) {
      console.error("Failed to change order status", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      const isModified =
        JSON.stringify(editableItems) !== JSON.stringify(order.items) ||
        proposedMsg !== (order.proposedMessage ?? "");
      if (isModified) {
        await updateMutation.mutateAsync({
          id: order.id,
          notes,
          proposedMessage: proposedMsg,
          items: buildItemsPayload(),
        });
      }
      await statusMutation.mutateAsync({
        id: order.id,
        status: "completed",
        reason: "Marked as completed by Sales Admin",
      });
      options.onClose();
    } catch (err) {
      console.error("Failed to complete order", err);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    order,
    productsList,
    editableItems,
    proposedMsg,
    notes,
    isSaving,
    selectedSku,
    calculatedTotal,
    setProposedMsg,
    setNotes,
    setSelectedSku,
    handleItemQtyChange,
    handleItemPriceChange,
    handleRemoveItem,
    handleAddProduct,
    handleSaveEdits,
    handleApproveAndSend,
    handleSetStatus,
    handleMarkCompleted,
  };
}
```

Behavior notes: `options.onRefresh()` now fires via mutation `onSuccess` (the old code called it explicitly after each `await` — same observable effect); the post-save `await loadData()` is replaced by `utils.orders.get.invalidate()`.

- [ ] **Step 5: Check + build**

Run: `vp check && vp run -r build`
Expected: green. (`tsc` catches any mismatch between the hook return surface and the two consuming components.)

- [ ] **Step 6: Manual smoke — orders dashboard + review drawer**

With server + website dev running (`vp run whatsapp-webhook#dev`, `vp run website#dev`):

- Dashboard tabs switch and refetch; counts render.
- Search box filters; Refresh button re-fetches.
- Row selection + bulk status action updates and refreshes the list.
- Open order drawer: line items editable; Save, Approve & Send, Set Status, Mark Completed all work and the dashboard list refreshes afterwards.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/trpc.ts apps/website/src/main.tsx apps/website/src/hooks/useOrders.ts apps/website/src/hooks/useOrderReview.ts
git commit -m "feat(trpc): wire client providers and migrate useOrders/useOrderReview"
```

### Task 5: Component migration

**Files:**

- Create: `apps/website/src/emulator-api.ts`
- Modify: `apps/website/src/components/MessageLogView.tsx`
- Modify: `apps/website/src/components/WhatsAppEmulator.tsx`
- Modify: `apps/website/src/components/CreateOrderModal.tsx`
- Modify (type-only import swaps): `apps/website/src/components/shared/LineItemsEditor.tsx`, `apps/website/src/components/dashboard/OrdersTable.tsx`, `apps/website/src/components/order-review/WhatsAppPreviewBox.tsx`, `apps/website/src/components/order-review/OrderContextPane.tsx`, `apps/website/src/components/order-review/OrderDrawerActionBar.tsx`, `apps/website/src/components/emulator/DealerSelector.tsx`, `apps/website/src/components/emulator/ChatWindow.tsx`, `apps/website/src/components/emulator/ChatBubble.tsx`

**Interfaces:**

- Consumes: `trpc` client, `@digico/contracts` types, and the two REST helpers in `emulator-api.ts`.
- Produces: zero references to `../api.js` anywhere in `apps/website/src` (verified by grep at the end).

- [ ] **Step 1: Create the emulator REST helper** (copied from `api.ts`, typed from `@digico/contracts`)

`apps/website/src/emulator-api.ts`:

```ts
import type { EmulatorChatMessage } from "@digico/contracts";

// The emulator endpoints feed the webhook AI pipeline and stay REST (spec §2.4).

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function sendJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getEmulatorChat(
  phone: string,
): Promise<{ fromPhone: string; messages: EmulatorChatMessage[] }> {
  const params = new URLSearchParams({ phone });
  return getJson<{ fromPhone: string; messages: EmulatorChatMessage[] }>(
    `/api/emulator/chat?${params.toString()}`,
  );
}

export function sendEmulatorMessage(data: {
  fromPhone: string;
  contactName?: string;
  text: string;
}): Promise<{ success: boolean; messageId: string; metaPayload: unknown }> {
  return sendJson<{ success: boolean; messageId: string; metaPayload: unknown }>(
    "/api/emulator/send",
    data,
  );
}
```

- [ ] **Step 2: Migrate `MessageLogView.tsx`**

Replace the import:

```ts
// before
import { listMessages, type LogMessage } from "../api.js";
// after
import { trpc } from "../trpc.js";
import type { LogMessage } from "@digico/contracts";
```

Replace the hand-rolled `fetchMessages` state with a typed query. Keep `phoneFilter`/`statusFilter` client-side filtering and the `selectedMessage` state exactly as they are. The new data wiring:

```ts
const messagesQuery = trpc.messages.list.useQuery();

const messages = useMemo(() => {
  let filtered = messagesQuery.data?.items ?? [];
  if (phoneFilter) filtered = filtered.filter((m) => m.fromPhone.includes(phoneFilter));
  if (statusFilter) filtered = filtered.filter((m) => m.status === statusFilter);
  return filtered;
}, [messagesQuery.data, phoneFilter, statusFilter]);

const fetchMessages = () => {
  void utils.messages.list.invalidate();
};
```

where `const utils = trpc.useUtils();` and `isLoading` becomes `messagesQuery.isFetching` (the Refresh button keeps its `onClick={() => void fetchMessages()}`). Delete the old `useCallback`/`useEffect` fetch block and the now-unused `setMessages` state.

- [ ] **Step 3: Migrate `WhatsAppEmulator.tsx`**

Replace the import block:

```ts
// before
import {
  getEmulatorChat,
  listDealers,
  sendEmulatorMessage,
  type Dealer,
  type EmulatorChatMessage,
} from "../api.js";
// after
import { trpc } from "../trpc.js";
import { getEmulatorChat, sendEmulatorMessage } from "../emulator-api.js";
import type { Dealer, EmulatorChatMessage } from "@digico/contracts";
```

Replace the dealers-mount effect (currently `void listDealers().then(...)` around line 58) with a sync from a typed query:

```ts
const dealersQuery = trpc.dealers.list.useQuery();

useEffect(() => {
  if (dealersQuery.data && dealersQuery.data.length > 0) {
    setDealers(dealersQuery.data);
  }
}, [dealersQuery.data]);
```

`getEmulatorChat` (line ~72) and `sendEmulatorMessage` (line ~102) call sites stay as-is — the imports now come from `../emulator-api.js`.

- [ ] **Step 4: Migrate `CreateOrderModal.tsx`**

Replace the import:

```ts
// before
import { createOrder, listDealers, listProducts, type Dealer, type Product } from "../api.js";
// after
import { trpc } from "../trpc.js";
import type { Dealer, Product } from "@digico/contracts";
```

Replace the mount effect that calls `listDealers`/`listProducts` with typed queries:

```ts
const dealersQuery = trpc.dealers.list.useQuery();
const productsQuery = trpc.products.list.useQuery();
const createMutation = trpc.orders.create.useMutation({
  onSuccess: () => {
    setItems([]);
    setSelectedSku("");
    setAddQty(1);
    setAddPrice("");
    setNotes("");
    setSelectedDealerId("");
    onSuccess();
    onClose();
  },
});

useEffect(() => {
  if (dealersQuery.data) setDealersList(dealersQuery.data);
}, [dealersQuery.data]);
useEffect(() => {
  if (productsQuery.data) setProductsList(productsQuery.data);
}, [productsQuery.data]);
```

Replace the submit handler's `await createOrder({...})` with `await createMutation.mutateAsync({...})`, keeping the same payload keys (`dealerId`, `origin`, `notes`, `items`) and the same `setIsSubmitting` try/finally. Inspect the existing success block in the component and port its reset calls into the mutation `onSuccess` above verbatim.

- [ ] **Step 5: Swap the type-only imports (8 files, mechanical)**

`../api.js` (or `../../api.js`) → `@digico/contracts`, same member names:

| File                                    | Old import                                                | New import                                                                                                   |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `shared/LineItemsEditor.tsx`            | `import type { Product } from "../../api.js"`             | `import type { Product } from "@digico/contracts"`                                                           |
| `dashboard/OrdersTable.tsx`             | `import type { ListOrdersResult } from "../../api.js"`    | `import type { RouterOutputs } from "@digico/api"; type ListOrdersResult = RouterOutputs["orders"]["list"];` |
| `order-review/WhatsAppPreviewBox.tsx`   | `import type { Order } from "../../api.js"`               | `import type { Order } from "@digico/contracts"`                                                             |
| `order-review/OrderContextPane.tsx`     | `import type { Order } from "../../api.js"`               | `import type { Order } from "@digico/contracts"`                                                             |
| `order-review/OrderDrawerActionBar.tsx` | `import type { Order } from "../../api.js"`               | `import type { Order } from "@digico/contracts"`                                                             |
| `emulator/DealerSelector.tsx`           | `import type { Dealer } from "../../api.js"`              | `import type { Dealer } from "@digico/contracts"`                                                            |
| `emulator/ChatWindow.tsx`               | `import type { EmulatorChatMessage } from "../../api.js"` | `import type { EmulatorChatMessage } from "@digico/contracts"`                                               |
| `emulator/ChatBubble.tsx`               | `import type { EmulatorChatMessage } from "../../api.js"` | `import type { EmulatorChatMessage } from "@digico/contracts"`                                               |

For `OrdersTable.tsx`, the component's props keep the name `ListOrdersResult`; only the definition site changes (from an `api.ts` interface to the tRPC-inferred type).

- [ ] **Step 6: Verify no `api.js` references remain + check + build**

Run: `grep -rn "api.js" apps/website/src` → no output (the two hooks were migrated in Task 4).
Run: `vp check && vp run -r build`
Expected: green.

- [ ] **Step 7: Manual smoke — emulator, message log, create-order modal**

- Emulator: dealer dropdown loads from `/trpc`; chat history loads; sending a message still works (via `/api/emulator/send`).
- Message Log: loads rows, filters, refresh.
- Create Order modal: dealer + product dropdowns populate; creating an order shows in the dashboard after close.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src
git commit -m "feat(trpc): migrate components off api.js"
```

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
