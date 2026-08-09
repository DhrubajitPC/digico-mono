import { fetchMariaDbOrderById, getMariaDbPool } from "@digico/db";

export interface IntentRouteResult {
  handled: boolean;
  replyText?: string;
}

/** Intercepts deterministic commands (e.g. status #ORD-123, cancel #ORD-123) with 0 LLM call cost */
export async function routeIntent(
  userText: string,
  _fromPhone: string,
): Promise<IntentRouteResult> {
  const text = userText.trim();

  // Pattern 1: Check Order Status (#ORD-12345 or status 12345)
  const statusMatch = /^(?:status\s+)?#?(?:ORD-)?(\d+)$/i.exec(text);
  if (statusMatch && statusMatch[1]) {
    const orderId = Number(statusMatch[1]);
    const order = await fetchMariaDbOrderById(orderId);
    if (order) {
      const itemSummary =
        order.items && order.items.length > 0
          ? order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")
          : "Items";
      return {
        handled: true,
        replyText: `[Auto-Status] Order #${order.orderNumber} Status: ${order.status.toUpperCase()}\n- Total: ৳${order.totalAmount.toLocaleString()}\n- Items: ${itemSummary}\n- Customer: ${order.dealer.contactPerson}`,
      };
    }
  }

  // Pattern 2: Cancel Order (cancel #ORD-12345)
  const cancelMatch = /^cancel\s+#?(?:ORD-)?(\d+)$/i.exec(text);
  if (cancelMatch && cancelMatch[1]) {
    const orderId = Number(cancelMatch[1]);
    try {
      const pool = getMariaDbPool();
      await pool.query("UPDATE joy_posts SET post_status = 'wc-cancelled' WHERE ID = ?", [orderId]);
      return {
        handled: true,
        replyText: `Order #ORD-${orderId} has been successfully cancelled in MariaDB.`,
      };
    } catch (err) {
      console.error("Failed to cancel MariaDB order", err);
    }
  }

  return { handled: false };
}
