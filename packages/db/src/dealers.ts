import { fetchMariaDbOrders } from "./orders.ts";

export interface WcDealer {
  id: number;
  businessName: string;
  contactPerson: string;
  phone: string;
  address: string | null;
  status: string;
}

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
      });
    }
  }
  return Array.from(dealerMap.values());
}
