import type { Dealer } from "@digico/contracts";
import { fetchMariaDbOrders } from "./orders.ts";

/** Canonical dealer shape lives in @digico/contracts; kept as an alias for existing call sites. */
export type WcDealer = Dealer;

/** Fetch Dealers list from MariaDB */
export async function fetchMariaDbDealers(): Promise<WcDealer[]> {
  const orders = await fetchMariaDbOrders();
  const dealerMap = new Map<string, WcDealer>();
  for (const o of orders) {
    // Keyed by phone, not o.dealer.id: every WhatsApp/manual order is a guest
    // checkout with no WooCommerce login, so _customer_user is absent or "0" and
    // o.dealer.id falls back to that order's own row ID — a fresh "dealer" per
    // order for the same real person. Phone is the only identity that's actually
    // stable across a dealer's orders in this schema.
    if (!dealerMap.has(o.dealer.phone)) {
      dealerMap.set(o.dealer.phone, {
        id: o.dealer.id,
        businessName: o.dealer.businessName,
        contactPerson: o.dealer.contactPerson,
        phone: o.dealer.phone,
        address: o.dealer.address || null,
        status: "active",
      } as WcDealer);
    }
  }
  return Array.from(dealerMap.values());
}
