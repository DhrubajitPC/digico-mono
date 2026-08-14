import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
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
