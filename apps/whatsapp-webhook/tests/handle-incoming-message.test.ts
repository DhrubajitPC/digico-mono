import { beforeEach, expect, test, vi } from "vite-plus/test";
import {
  createMariaDbOrder,
  fetchMariaDbOrders,
  fetchMariaDbProducts,
  getMariaDbRecentConversationHistory,
  recordMariaDbInboundMessage,
  searchMariaDbProducts,
} from "@digico/db";
import { replyWithDeepSeekFull } from "../src/services/deepseek.ts";
import { sendWhatsAppText } from "../src/services/whatsapp-send.ts";
import { handleIncomingMessage } from "../src/services/handle-message.ts";

import type { IncomingWhatsAppMessage } from "../src/services/parse-webhook.ts";

vi.mock("@digico/db", () => ({
  MariaDbError: class MariaDbError extends Error {},
  cancelMariaDbOrder: vi.fn(),
  createMariaDbOrder: vi.fn(),
  fetchMariaDbOrderById: vi.fn(),
  fetchMariaDbOrders: vi.fn(),
  fetchMariaDbProducts: vi.fn(),
  getMariaDbRecentConversationHistory: vi.fn(),
  markMariaDbMessageStatus: vi.fn(),
  normalizePhone: (raw: string) => raw.replace(/\D/g, ""),
  recordMariaDbAiCall: vi.fn(),
  recordMariaDbInboundMessage: vi.fn(),
  recordMariaDbOutboundReply: vi.fn(),
  searchMariaDbProducts: vi.fn(),
  setMariaDbResolvedText: vi.fn(),
  UNKNOWN_PHONE_PLACEHOLDER: "+8801700000000",
}));

// Keep every real export (buildChatMessages, deepSeekModel, …), but stub the
// network call the pipeline would otherwise make.
vi.mock("../src/services/deepseek.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/deepseek.ts")>();
  return { ...actual, replyWithDeepSeekFull: vi.fn() };
});

vi.mock("../src/services/whatsapp-send.ts", () => ({ sendWhatsAppText: vi.fn() }));

const message: IncomingWhatsAppMessage = {
  messageId: "wamid.HBgL123EMULATOR",
  from: "8801777898395",
  timestamp: "1785000000",
  contactName: "MEHEDI HASAN",
  phoneNumberId: "EMULATOR",
  kind: "text",
  text: "add one more",
  audio: null,
};

const draftOrderToolCall = [
  {
    id: "call_1",
    type: "function",
    function: {
      name: "draft_order",
      arguments:
        '{"productName":"Conion Toaster CT 801","quantity":1,"unitPrice":600,"totalAmount":600}',
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(recordMariaDbInboundMessage).mockResolvedValue({
    outcome: "created",
    message: { id: 1, messageId: "wamid.HBgL123EMULATOR" },
  });
  vi.mocked(searchMariaDbProducts).mockResolvedValue([]);
  vi.mocked(fetchMariaDbOrders).mockResolvedValue([]);
  vi.mocked(getMariaDbRecentConversationHistory).mockResolvedValue([]);
  vi.mocked(fetchMariaDbProducts).mockResolvedValue([]);
});

test("empty reply that created an order sends an order confirmation", async () => {
  vi.mocked(createMariaDbOrder).mockResolvedValue({
    id: 42,
    orderNumber: "#ORD-42",
    totalAmount: 600,
    items: [{ quantity: 1, productName: "Conion Toaster CT 801", unitPrice: 600 }],
  } as never);
  vi.mocked(replyWithDeepSeekFull).mockResolvedValue({
    text: "",
    toolCalls: draftOrderToolCall,
  });

  await handleIncomingMessage(message);

  expect(sendWhatsAppText).toHaveBeenCalledTimes(1);
  const [phone, text, isEmulator] = vi.mocked(sendWhatsAppText).mock.calls[0];
  expect(phone).toBe("8801777898395");
  expect(text).toContain("Order recorded & sent for review");
  expect(text).toContain("1× Conion Toaster CT 801 — ৳600");
  expect(text).toContain("#ORD-42");
  expect(isEmulator).toBe(true);
});

test("empty reply with no order sends a neutral follow-up, not an error", async () => {
  vi.mocked(replyWithDeepSeekFull).mockResolvedValue({ text: "", toolCalls: [] });

  await handleIncomingMessage(message);

  expect(sendWhatsAppText).toHaveBeenCalledWith(
    "8801777898395",
    "Got it. Is there anything else I can help you with?",
    true,
  );
});

test("non-empty reply is passed through unchanged", async () => {
  vi.mocked(replyWithDeepSeekFull).mockResolvedValue({ text: "Your order is confirmed." });

  await handleIncomingMessage(message);

  expect(sendWhatsAppText).toHaveBeenCalledWith("8801777898395", "Your order is confirmed.", true);
});
