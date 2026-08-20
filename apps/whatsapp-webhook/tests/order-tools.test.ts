import { expect, test, vi } from "vite-plus/test";
import { MariaDbError, createMariaDbOrder, fetchMariaDbProducts } from "@digico/db";
import { validateAndExecuteOrderTool } from "../src/services/order-tools.ts";

vi.mock("@digico/db", () => ({
  MariaDbError: class MariaDbError extends Error {},
  createMariaDbOrder: vi.fn(),
  fetchMariaDbProducts: vi.fn(),
  UNKNOWN_PHONE_PLACEHOLDER: "+8801700000000",
}));

const catalog = [{ id: 1, name: "HP 15s", sku: "HP15S", unitPrice: 68500, stockQuantity: 10 }];

const createdOrder = { id: 42, orderNumber: "#ORD-42", dealer: { phone: "+8801" } };

test("overrides LLM unitPrice with catalog price and warns", async () => {
  vi.mocked(fetchMariaDbProducts).mockResolvedValue(catalog as never);
  vi.mocked(createMariaDbOrder).mockResolvedValue(createdOrder as never);

  const result = await validateAndExecuteOrderTool({
    productName: "HP 15s",
    quantity: 2,
    unitPrice: 70000,
    totalAmount: 140000,
  });

  expect(result.success).toBe(true);
  expect(result.validationWarnings?.[0]).toContain("Overriding to DB price");
  expect(createMariaDbOrder).toHaveBeenCalledWith(
    expect.objectContaining({ unitPrice: 68500, totalAmount: 137000, productId: 1 }),
  );
});

test("no catalog match proceeds with LLM pricing and warns", async () => {
  vi.mocked(fetchMariaDbProducts).mockResolvedValue(catalog as never);
  vi.mocked(createMariaDbOrder).mockResolvedValue(createdOrder as never);

  const result = await validateAndExecuteOrderTool({
    productName: "Unknown Widget",
    quantity: 1,
    unitPrice: 999,
    totalAmount: 999,
  });

  expect(result.success).toBe(true);
  expect(result.validationWarnings?.[0]).toContain("not matched precisely");
  expect(createMariaDbOrder).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 999 }));
});

test("db failure surfaces as success: false with the error message", async () => {
  vi.mocked(fetchMariaDbProducts).mockResolvedValue(catalog as never);
  vi.mocked(createMariaDbOrder).mockRejectedValue(new MariaDbError("connection refused"));

  const result = await validateAndExecuteOrderTool({
    productName: "HP 15s",
    quantity: 1,
    unitPrice: 68500,
    totalAmount: 68500,
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("connection refused");
});
