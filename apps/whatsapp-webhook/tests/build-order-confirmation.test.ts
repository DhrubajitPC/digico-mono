import { describe, expect, test } from "vite-plus/test";
import { buildOrderConfirmationMessage } from "../src/services/handle-message.ts";

import type { WcOrder } from "@digico/db";

describe("buildOrderConfirmationMessage", () => {
  test("renders items, total, and order number", () => {
    const order = {
      orderNumber: "#ORD-42",
      totalAmount: 1200,
      items: [
        { quantity: 2, productName: "Conion Toaster CT 801", unitPrice: 600 },
        { quantity: 1, productName: "Conion Sandwich Maker", unitPrice: 800 },
      ],
    } as unknown as WcOrder;

    const msg = buildOrderConfirmationMessage(order);

    expect(msg).toContain("2× Conion Toaster CT 801 — ৳600");
    expect(msg).toContain("1× Conion Sandwich Maker — ৳800");
    expect(msg).toContain("Total: ৳1,200");
    expect(msg).toContain("#ORD-42");
  });

  test("still produces a confirmation for an order with no items", () => {
    const order = { orderNumber: "#ORD-7", totalAmount: 0, items: [] } as unknown as WcOrder;

    const msg = buildOrderConfirmationMessage(order);

    expect(msg).toContain("Order recorded & sent for review");
    expect(msg).toContain("Total: ৳0");
  });
});
