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
