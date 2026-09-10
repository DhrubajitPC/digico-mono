import type mysql from "mysql2/promise";
import type { Dealer } from "@digico/contracts";
import { getMariaDbPool } from "./client.ts";
import {
  fetchMariaDbOrderById,
  fetchMariaDbOrders,
  normalizePhone,
  UNKNOWN_PHONE_PLACEHOLDER,
} from "./orders.ts";

/** Canonical dealer shape lives in @digico/contracts; kept as an alias for existing call sites. */
export type WcDealer = Dealer;

export type CreateMariaDbDealerInput = {
  businessName: string;
  contactPerson?: string | null;
  phone: string;
  address?: string | null;
};

const UNKNOWN_PHONE = normalizePhone(UNKNOWN_PHONE_PLACEHOLDER);

/** Fetch Dealers list from MariaDB */
// export async function fetchMariaDbDealers(): Promise<WcDealer[]> {
//   const orders = await fetchMariaDbOrders();
//   const dealerMap = new Map<string, WcDealer>();
//   for (const o of orders) {
//     // No real phone to attribute this order to — every order that hit this
//     // fallback looks identical, so treating it as a dealer would merge
//     // unrelated customers into one bogus entry instead of surfacing none.
//     if (o.dealer.phone === UNKNOWN_PHONE) continue;

//     // Keyed by phone, not o.dealer.id: every WhatsApp/manual order is a guest
//     // checkout with no WooCommerce login, so _customer_user is absent or "0" and
//     // o.dealer.id falls back to that order's own row ID — a fresh "dealer" per
//     // order for the same real person. Phone is the only identity that's actually
//     // stable across a dealer's orders in this schema.
//     if (!dealerMap.has(o.dealer.phone)) {
//       dealerMap.set(o.dealer.phone, {
//         id: o.dealer.id,
//         businessName: o.dealer.businessName,
//         contactPerson: o.dealer.contactPerson,
//         phone: o.dealer.phone,
//         address: o.dealer.address || null,
//         status: "active",
//       } as WcDealer);
//     }
//   }
//   return Array.from(dealerMap.values());
// }
export async function fetchMariaDbDealers(): Promise<WcDealer[]> {
  const orders = await fetchMariaDbOrders();
  const dealerMap = new Map<string, WcDealer>();

  // Keep existing WooCommerce-order-derived dealers for backward compatibility.
  for (const o of orders) {
    if (o.dealer.phone === UNKNOWN_PHONE) continue;
    if (!dealerMap.has(o.dealer.phone)) {
      dealerMap.set(o.dealer.phone, {
        id: o.dealer.id,
        businessName: o.dealer.businessName,
        contactPerson: o.dealer.contactPerson,
        phone: o.dealer.phone,
        address: o.dealer.address || null,
      } as WcDealer);
    }
  }

  // Registered Digico dealers supplement the legacy order-derived list.
  const registeredDealers = await fetchRegisteredMariaDbDealers();

  for (const dealer of registeredDealers) {
    if (dealer.phone === UNKNOWN_PHONE) continue;

    // Registered dealer data is authoritative.
    dealerMap.set(dealer.phone, dealer);
  }

  // Dealers created from Add Dealer
  // try {
  //   const registeredDealers = await fetchRegisteredMariaDbDealers();

  //   for (const dealer of registeredDealers) {
  //     if (dealer.phone === UNKNOWN_PHONE) continue;

  //     dealerMap.set(dealer.phone, dealer);
  //   }
  // } catch (error) {
  //   console.error("Failed to load registered dealers:", error);
  // }

  return Array.from(dealerMap.values());
}

/**
 * Look up a single dealer by phone, without fetchMariaDbOrders' 200-row cap
 * and without materializing the full dealers list. Used by order-create flows
 * where dealer.id is meaningless (see fetchMariaDbDealers' comment) — phone is
 * the identity that's actually stable, so this is what those flows should key
 * on instead.
 */
export async function fetchMariaDbDealerByPhone(phone: string): Promise<WcDealer | null> {
  const target = normalizePhone(phone);
  if (target === UNKNOWN_PHONE) return null;

  const p = getMariaDbPool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(`
    SELECT pm.post_id as id, pm.meta_value as phone, p.post_date as created_at
    FROM joy_postmeta pm
    JOIN joy_posts p ON p.ID = pm.post_id
    WHERE pm.meta_key = '_billing_phone' AND p.post_type = 'shop_order'
  `);

  const matches = rows.filter((r) => normalizePhone(r.phone) === target);
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const byDate = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return byDate !== 0 ? byDate : b.id - a.id;
  });

  const order = await fetchMariaDbOrderById(matches[0]!.id);
  return order?.dealer ?? null;
}

async function fetchRegisteredMariaDbDealers(): Promise<WcDealer[]> {
  const p = getMariaDbPool();

  const [rows] = await p.query<mysql.RowDataPacket[]>(`
    SELECT
      id,
      business_name,
      contact_person,
      phone,
      address
    FROM digico_dealers
    WHERE status = 'active'
    ORDER BY business_name ASC, id ASC
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    businessName: String(row.business_name),
    contactPerson: row.contact_person ? String(row.contact_person) : null,
    phone: normalizePhone(String(row.phone)),
    address: row.address ? String(row.address) : null,
  }));
}

export async function createMariaDbDealer(input: CreateMariaDbDealerInput): Promise<WcDealer> {
  const p = getMariaDbPool();

  const businessName = input.businessName.trim();
  const contactPerson = input.contactPerson?.trim() || null;
  const phone = normalizePhone(input.phone);
  const address = input.address?.trim() || null;

  if (!businessName) {
    throw new Error("Business name is required");
  }

  if (!phone || phone === UNKNOWN_PHONE) {
    throw new Error("Valid phone number is required");
  }

  const [existingRows] = await p.query<mysql.RowDataPacket[]>(
    `
      SELECT
        id,
        business_name,
        contact_person,
        phone,
        address
      FROM digico_dealers
      WHERE phone = ?
      LIMIT 1
    `,
    [phone],
  );

  if (existingRows.length > 0) {
    throw new Error("Dealer with this phone number already exists");
  }

  const [result] = await p.query<mysql.ResultSetHeader>(
    `
      INSERT INTO digico_dealers (
        business_name,
        contact_person,
        phone,
        address,
        status
      )
      VALUES (?, ?, ?, ?, 'active')
    `,
    [businessName, contactPerson, phone, address],
  );

  return {
    id: Number(result.insertId),
    businessName,
    contactPerson,
    phone,
    address,
  };
}
