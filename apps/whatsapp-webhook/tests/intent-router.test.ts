import { expect, test, vi } from "vite-plus/test";
import { cancelMariaDbOrder, fetchMariaDbOrderById } from "@digico/db";
import { routeIntent } from "../src/services/intent-router.ts";

vi.mock("@digico/db", () => ({
  cancelMariaDbOrder: vi.fn(),
  fetchMariaDbOrderById: vi.fn(),
}));

const sampleOrder = {
  id: 7585,
  orderNumber: "#ORD-7585",
  status: "processing",
  totalAmount: 48380,
  items: [{ quantity: 2, productName: "Monitor" }],
  dealer: { contactPerson: "Rahim" },
};

test("status pattern #ORD-123 returns the order summary", async () => {
  vi.mocked(fetchMariaDbOrderById).mockResolvedValue(sampleOrder as never);
  const result = await routeIntent("#ORD-7585", "+8801711000001");
  expect(result.handled).toBe(true);
  expect(result.replyText).toContain("PROCESSING");
  expect(result.replyText).toContain("2x Monitor");
});

test("status pattern without prefix ('status 7585') also matches", async () => {
  vi.mocked(fetchMariaDbOrderById).mockResolvedValue(sampleOrder as never);
  const result = await routeIntent("status 7585", "+8801711000001");
  expect(result.handled).toBe(true);
});

test("cancel pattern calls cancelMariaDbOrder", async () => {
  const result = await routeIntent("cancel #ORD-7585", "+8801711000001");
  expect(cancelMariaDbOrder).toHaveBeenCalledWith(7585);
  expect(result.handled).toBe(true);
  expect(result.replyText).toContain("successfully cancelled");
});

test("no pattern match returns handled: false", async () => {
  const result = await routeIntent("What is the price of HP laptop?", "+8801711000001");
  expect(result.handled).toBe(false);
});

test("unknown order id falls through to no match", async () => {
  vi.mocked(fetchMariaDbOrderById).mockResolvedValue(null as never);
  const result = await routeIntent("#ORD-99999", "+8801711000001");
  expect(result.handled).toBe(false);
});

test("cancel failure is swallowed and returns handled: false", async () => {
  vi.mocked(cancelMariaDbOrder).mockRejectedValue(new Error("db down"));
  const result = await routeIntent("cancel #ORD-1", "+8801711000001");
  expect(result.handled).toBe(false);
});
