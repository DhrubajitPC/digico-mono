import { beforeEach, expect, test, vi } from "vite-plus/test";
import { MariaDbError, createMariaDbOrder, fetchMariaDbProducts } from "@digico/db";
import { extractOrderPayload } from "../src/services/handle-message.ts";

vi.mock("@digico/db", () => ({
  MariaDbError: class MariaDbError extends Error {},
  createMariaDbOrder: vi.fn(),
  fetchMariaDbProducts: vi.fn(),
  fetchMariaDbOrders: vi.fn(),
  getMariaDbRecentConversationHistory: vi.fn(),
  markMariaDbMessageStatus: vi.fn(),
  recordMariaDbAiCall: vi.fn(),
  recordMariaDbInboundMessage: vi.fn(),
  recordMariaDbOutboundReply: vi.fn(),
  searchMariaDbProducts: vi.fn(),
  setMariaDbResolvedText: vi.fn(),
}));

const catalog = [{ id: 1, name: "HP 15s", sku: "HP15S", unitPrice: 68500, stockQuantity: 10 }];
const createdOrder = { id: 42, orderNumber: "#ORD-42" };

beforeEach(() => {
  vi.clearAllMocks();
});

function mockOrderCreation() {
  vi.mocked(fetchMariaDbProducts).mockResolvedValue(catalog as never);
  vi.mocked(createMariaDbOrder).mockResolvedValue(createdOrder as never);
}

test("creates an order from a draft_order tool call", async () => {
  mockOrderCreation();
  const result = await extractOrderPayload("Your order is confirmed.", [
    {
      id: "call_1",
      type: "function",
      function: {
        name: "draft_order",
        arguments: '{"productName":"HP 15s","quantity":2,"unitPrice":68500,"totalAmount":137000}',
      },
    },
  ]);

  expect(result.executed).toBe(true);
  expect(result.order).toEqual(createdOrder);
  expect(createMariaDbOrder).toHaveBeenCalledTimes(1);
});

test("creates an order from the [ORDER_DATA] tag and strips it from the reply", async () => {
  mockOrderCreation();
  const reply =
    'Here is your order summary [ORDER_DATA: {"productName":"HP 15s","quantity":1,"unitPrice":68500,"totalAmount":68500}]';
  const result = await extractOrderPayload(reply);

  expect(result.executed).toBe(true);
  expect(result.reply).toBe("Here is your order summary");
  expect(createMariaDbOrder).toHaveBeenCalledTimes(1);
});

test("ignores non-draft_order tool calls", async () => {
  mockOrderCreation();
  const result = await extractOrderPayload("ok", [
    {
      id: "call_1",
      type: "function",
      function: { name: "search_catalog", arguments: "{}" },
    },
  ]);

  expect(result.executed).toBe(false);
  expect(createMariaDbOrder).not.toHaveBeenCalled();
});

test("malformed tool-call JSON is skipped with a warning", async () => {
  mockOrderCreation();
  const result = await extractOrderPayload("ok", [
    {
      id: "call_1",
      type: "function",
      function: { name: "draft_order", arguments: "{broken" },
    },
  ]);

  expect(result.executed).toBe(false);
  expect(result.warnings[0]).toContain("malformed");
  expect(createMariaDbOrder).not.toHaveBeenCalled();
});

test("malformed [ORDER_DATA] tag is left in the reply and warned about", async () => {
  mockOrderCreation();
  const reply = "summary [ORDER_DATA: {not json}]";
  const result = await extractOrderPayload(reply);

  expect(result.executed).toBe(false);
  expect(result.reply).toBe(reply);
  expect(result.warnings[0]).toContain("malformed [ORDER_DATA] tag");
});

test("db failure still strips the [ORDER_DATA] tag (execution swallowed into success: false)", async () => {
  vi.mocked(fetchMariaDbProducts).mockResolvedValue(catalog as never);
  vi.mocked(createMariaDbOrder).mockRejectedValue(new MariaDbError("db down"));

  const reply =
    '[ORDER_DATA: {"productName":"HP 15s","quantity":1,"unitPrice":68500,"totalAmount":68500}]';
  const result = await extractOrderPayload(reply);

  // validateAndExecuteOrderTool converts db errors into { success: false } without
  // throwing, so the tag is consumed and stripped — raw JSON never leaks to the dealer.
  expect(result.executed).toBe(false);
  expect(result.reply).toBe("");
});
