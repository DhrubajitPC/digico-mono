import type { Dealer } from "@digico/contracts";
import { fetchMariaDbOrders } from "./orders.ts";

/** Canonical dealer shape lives in @digico/contracts; kept as an alias for existing call sites. */
export type WcDealer = Dealer;

/** Fetch Dealers list from MariaDB */
export async function fetchMariaDbDealers(): Promise<WcDealer[]> {
  const orders = await fetchMariaDbOrders();
  const dealerMap = new Map<number, WcDealer>();
  for (const o of orders) {
    if (!dealerMap.has(o.dealer.id)) {
      dealerMap.set(o.dealer.id, {
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
