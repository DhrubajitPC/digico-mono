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
