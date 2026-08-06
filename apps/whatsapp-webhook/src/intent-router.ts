import type { Db } from "./db/client.ts";
import { fetchMariaDbOrderById, isMariaDbAvailable, getMariaDbPool } from "./db/mariadb.ts";
import { getOrderForApi, updateOrderForApi } from "./api-orders.ts";

export interface IntentRouteResult {
  handled: boolean;
  replyText?: string;
}

/** Intercepts deterministic commands (e.g. status #ORD-123, cancel #ORD-123) with 0 LLM call cost */
export async function routeIntent(
  userText: string,
  fromPhone: string,
  db: Db,
): Promise<IntentRouteResult> {
  const text = userText.trim();

  // Pattern 1: Check Order Status (#ORD-12345 or status 12345)
  const statusMatch = /^(?:status\s+)?#?(?:ORD-)?(\d+)$/i.exec(text);
  if (statusMatch && statusMatch[1]) {
    const orderId = Number(statusMatch[1]);

    if (await isMariaDbAvailable()) {
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
    } else {
      const order = await getOrderForApi(db, orderId);
      if (order) {
        return {
          handled: true,
          replyText: `[Auto-Status] Order #${order.orderNumber} Status: ${order.status.toUpperCase()}\n- Total: ৳${order.totalAmount.toLocaleString()}\n- Customer: ${order.dealer.contactPerson}`,
        };
      }
    }
  }

  // Pattern 2: Cancel Order (cancel #ORD-12345)
  const cancelMatch = /^cancel\s+#?(?:ORD-)?(\d+)$/i.exec(text);
  if (cancelMatch && cancelMatch[1]) {
    const orderId = Number(cancelMatch[1]);
    if (await isMariaDbAvailable()) {
      try {
        const pool = getMariaDbPool();
        await pool.query("UPDATE joy_posts SET post_status = 'wc-cancelled' WHERE ID = ?", [
          orderId,
        ]);
        return {
          handled: true,
          replyText: `Order #ORD-${orderId} has been successfully cancelled in MariaDB.`,
        };
      } catch (err) {
        console.error("Failed to cancel MariaDB order", err);
      }
    } else {
      await updateOrderForApi(db, orderId, { notes: "Cancelled via WhatsApp" });
      return {
        handled: true,
        replyText: `Order #ORD-${orderId} has been successfully cancelled.`,
      };
    }
  }

  return { handled: false };
}
