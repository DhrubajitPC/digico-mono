import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MariaDbError } from "@digico/db";
import {
  fetchMariaDbOrders,
  fetchMariaDbOrderById,
  createMariaDbOrder,
  updateMariaDbOrder,
  updateMariaDbOrderStatus,
} from "@digico/db";

interface CreateOrderBody {
  items?: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string | null;
}

interface UpdateOrderBody {
  notes?: string;
  proposedMessage?: string;
  items?: unknown[];
}

interface BulkStatusBody {
  orderIds?: number[];
  status: string;
  reason?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function registerOrderRoutes(app: FastifyInstance) {
  // GET /api/orders
  app.get("/api/orders", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string>;
    const status = query.status || null;
    const search = query.search || null;

    const mariaOrders = await fetchMariaDbOrders({ status, search });
    const allMariaOrders = await fetchMariaDbOrders();

    const counts = {
      all: allMariaOrders.length,
      pending_review: allMariaOrders.filter((e) => e.status === "pending_review").length,
      confirmed: allMariaOrders.filter((e) => e.status === "confirmed").length,
      on_hold: allMariaOrders.filter((e) => e.status === "on_hold").length,
      processing: allMariaOrders.filter((e) => e.status === "processing").length,
      completed: allMariaOrders.filter((e) => e.status === "completed").length,
      cancelled: allMariaOrders.filter((e) => e.status === "cancelled").length,
    };

    return reply.send({
      items: mariaOrders,
      total: mariaOrders.length,
      counts,
    });
  });

  // GET /api/orders/:id
  app.get(
    "/api/orders/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: "Invalid order ID" });

      const order = await fetchMariaDbOrderById(id);
      if (!order) return reply.code(404).send({ error: "Order not found" });

      return reply.send({ ...order, history: [] });
    },
  );

  // POST /api/orders
  app.post("/api/orders", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as CreateOrderBody;
    const items = body.items || [];
    const firstItem = items[0];
    const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    let created;
    try {
      created = await createMariaDbOrder({
        phone: "+8801700000000",
        customerName: "Manual Sales Dealer",
        productName: firstItem?.productName || "Product",
        quantity: firstItem?.quantity || 1,
        unitPrice: firstItem?.unitPrice || total,
        totalAmount: total,
        notes: body.notes,
      });
    } catch (err) {
      return reply.code(500).send({ error: errorMessage(err) });
    }

    return reply.code(201).send(created);
  });

  // PATCH /api/orders/:id
  app.patch(
    "/api/orders/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: "Invalid order ID" });

      const body = (req.body ?? {}) as UpdateOrderBody;
      let updated;
      try {
        updated = await updateMariaDbOrder(id, body);
      } catch (err) {
        if (err instanceof MariaDbError) return reply.code(500).send({ error: errorMessage(err) });
        throw err;
      }
      if (!updated) return reply.code(404).send({ error: "Order not found" });

      return reply.send(updated);
    },
  );

  // POST /api/orders/:id/status
  app.post(
    "/api/orders/:id/status",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: "Invalid order ID" });

      const body = (req.body ?? {}) as {
        status: string;
        reason?: string;
        proposedMessage?: string;
      };
      let updated;
      try {
        updated = await updateMariaDbOrderStatus(
          id,
          body.status,
          body.reason,
          body.proposedMessage,
        );
      } catch (err) {
        if (err instanceof MariaDbError) return reply.code(500).send({ error: errorMessage(err) });
        throw err;
      }

      if (!updated) return reply.code(404).send({ error: "Order not found" });

      return reply.send(updated);
    },
  );

  // POST /api/orders/bulk-status
  app.post("/api/orders/bulk-status", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as BulkStatusBody;
    try {
      for (const id of body.orderIds || []) {
        await updateMariaDbOrderStatus(id, body.status, body.reason);
      }
    } catch (err) {
      if (err instanceof MariaDbError) return reply.code(500).send({ error: errorMessage(err) });
      throw err;
    }
    return reply.send({ success: true, count: body.orderIds?.length || 0 });
  });
}
