import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
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
