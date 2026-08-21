import type mysql from "mysql2/promise";
import type { Order, OrderItem, OrderOriginType, OrderStatusType } from "@digico/contracts";
import { getMariaDbPool } from "./client.ts";
import { MariaDbError } from "./errors.ts";

/** Canonical order shape lives in @digico/contracts; kept as an alias for existing call sites. */
export type WcOrder = Order;
export type WcOrderItem = OrderItem;

/**
 * Written whenever an order's real phone can't be determined (see
 * createMariaDbOrder's WhatsApp-AI caller). Orders sharing this value have no
 * real dealer identity, so dealer-lookup code must exclude it rather than
 * treating every order that carries it as the same person.
 */
export const UNKNOWN_PHONE_PLACEHOLDER = "+8801700000000";

/**
 * Collapses the phone shapes actually seen across this codebase — local
 * "01711000001", "+8801711000001", and WhatsApp's own "8801711000001" wa_id
 * format — to the digit-only 880-prefixed form, so the same real dealer keys
 * to one value regardless of which code path wrote or is comparing it.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `880${digits.slice(1)}`;
  return digits;
}

export function mapWcStatusToDigico(wcStatus: string): string {
  const status = wcStatus.replace(/^wc-/, "");
  switch (status) {
    case "pending":
      return "pending_review";
    case "processing":
      return "processing";
    case "on-hold":
      return "on_hold";
    case "completed":
      return "completed";
    case "confirmed":
      return "confirmed";
    case "cancelled":
    case "failed":
    case "refunded":
      return "cancelled";
    default:
      return status || "pending_review";
  }
}

export function mapDigicoStatusToWc(digicoStatus: string): string {
  switch (digicoStatus) {
    case "pending_review":
      return "wc-pending";
    // Not a native WooCommerce status. Digico's confirmed (sales approved,
    // not yet fulfilled) must not share wc-completed or it reads back as completed.
    case "confirmed":
      return "wc-confirmed";
    case "completed":
      return "wc-completed";
    case "on_hold":
      return "wc-on-hold";
    case "processing":
      return "wc-processing";
    case "cancelled":
      return "wc-cancelled";
    default:
      return `wc-${digicoStatus}`;
  }
}

function toIsoDateString(val: unknown): string {
  if (!val) return new Date().toISOString();
  const d = new Date(val as string | number | Date);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function buildMetaMap(metaRows: mysql.RowDataPacket[]): Map<number, Record<string, string>> {
  const metaMap = new Map<number, Record<string, string>>();
  for (const row of metaRows) {
    const existing = metaMap.get(row.post_id) || {};
    existing[row.meta_key] = row.meta_value;
    metaMap.set(row.post_id, existing);
  }
  return metaMap;
}

function buildItemsByOrder(itemRows: mysql.RowDataPacket[]): Map<number, WcOrderItem[]> {
  const itemsByOrder = new Map<number, WcOrderItem[]>();
  for (const row of itemRows) {
    const list = itemsByOrder.get(row.order_id) || [];
    const qty = parseInt(row.qty || "1", 10);
    const total = parseFloat(row.line_total || "0");
    const unitPrice = qty > 0 ? Math.round(total / qty) : 0;
    list.push({
      id: row.order_item_id,
      orderId: row.order_id,
      productId: row.product_id ? parseInt(row.product_id, 10) : null,
      sku: `PROD-${row.product_id || row.order_item_id}`,
      productName: row.order_item_name || "Product",
      quantity: qty,
      unitPrice,
      lineTotal: Math.round(total),
    });
    itemsByOrder.set(row.order_id, list);
  }
  return itemsByOrder;
}

function mapOrderRow(
  r: mysql.RowDataPacket,
  metaMap: Map<number, Record<string, string>>,
  itemsByOrder: Map<number, WcOrderItem[]>,
): WcOrder {
  const meta = metaMap.get(r.id) || {};
  const firstName = meta["_billing_first_name"] || "";
  const lastName = meta["_billing_last_name"] || "";
  const company = meta["_billing_company"] || "";
  const phone = normalizePhone(meta["_billing_phone"] || UNKNOWN_PHONE_PLACEHOLDER);
  const address = [meta["_billing_address_1"], meta["_billing_city"]].filter(Boolean).join(", ");
  const customerId = parseInt(meta["_customer_user"] || "0", 10) || r.id;

  const contactName = [firstName, lastName].filter(Boolean).join(" ") || "WooCommerce Customer";
  const businessName = company || contactName;
  const totalAmount = Math.round(parseFloat(meta["_order_total"] || "0"));
  const items = itemsByOrder.get(r.id) || [];
  const digicoStatus = mapWcStatusToDigico(r.status);
  const proposedMessage =
    meta["_proposed_message"] ||
    `Dear ${contactName}, your order #ORD-${r.id} total ৳${totalAmount.toLocaleString()} status is ${digicoStatus}.`;

  return {
    id: r.id,
    orderNumber: `#ORD-${r.id}`,
    // Runtime values from the WooCommerce schema that fall outside the canonical unions.
    status: digicoStatus as OrderStatusType,
    origin: "woocommerce" as string as OrderOriginType,
    totalAmount,
    notes: r.customer_note || null,
    proposedMessage,
    approvedBy:
      digicoStatus === "confirmed" || digicoStatus === "completed" ? "System Admin" : null,
    createdAt: toIsoDateString(r.created_at),
    updatedAt: toIsoDateString(r.updated_at || r.created_at),
    dealer: {
      id: customerId,
      businessName,
      phone,
      contactPerson: contactName,
      address: address || null,
    },
    items,
  };
}

type SqlConn = mysql.Pool | mysql.PoolConnection;

/**
 * WordPress postmeta has no unique key on (post_id, meta_key) — only
 * AUTO_INCREMENT meta_id — so ON DUPLICATE KEY UPDATE always inserts a
 * second row. Duplicate keys already exist in this catalog (see
 * fetchMariaDbProducts). Update by meta_id, or insert if none.
 */
async function upsertPostMeta(
  conn: SqlConn,
  postId: number,
  key: string,
  value: string,
): Promise<void> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT meta_id FROM joy_postmeta WHERE post_id = ? AND meta_key = ? LIMIT 1`,
    [postId, key],
  );
  const existingId = rows[0]?.meta_id;
  if (existingId) {
    await conn.query(`UPDATE joy_postmeta SET meta_value = ? WHERE meta_id = ?`, [
      value,
      existingId,
    ]);
    return;
  }
  await conn.query(`INSERT INTO joy_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
    postId,
    key,
    value,
  ]);
}

async function insertLineItem(
  conn: SqlConn,
  orderId: number,
  item: {
    productName: string;
    quantity: number;
    lineTotal: number;
    productId?: number | null;
  },
): Promise<void> {
  const [itemRes] = await conn.query<mysql.ResultSetHeader>(
    `
    INSERT INTO joy_woocommerce_order_items (order_item_name, order_item_type, order_id)
    VALUES (?, 'line_item', ?)
    `,
    [item.productName, orderId],
  );
  const itemId = itemRes.insertId;
  const itemMetaValues = [
    [itemId, "_qty", String(item.quantity)],
    [itemId, "_line_total", String(item.lineTotal)],
    [itemId, "_product_id", String(item.productId || 1)],
  ];
  for (const [iId, k, v] of itemMetaValues) {
    await conn.query(
      "INSERT INTO joy_woocommerce_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)",
      [iId, k, v],
    );
  }
}

/** Replace every line_item on the order with `items` — add, remove, and qty/price all persist. */
async function replaceOrderLineItems(
  conn: SqlConn,
  orderId: number,
  items: Array<{
    productId?: number;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>,
): Promise<number> {
  await conn.query(
    `
    DELETE m FROM joy_woocommerce_order_itemmeta m
    INNER JOIN joy_woocommerce_order_items i ON i.order_item_id = m.order_item_id
    WHERE i.order_id = ? AND i.order_item_type = 'line_item'
    `,
    [orderId],
  );
  await conn.query(
    `DELETE FROM joy_woocommerce_order_items WHERE order_id = ? AND order_item_type = 'line_item'`,
    [orderId],
  );

  let total = 0;
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    total += lineTotal;
    await insertLineItem(conn, orderId, {
      productName: item.productName,
      quantity: item.quantity,
      lineTotal,
      productId: item.productId,
    });
  }
  return total;
}

async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getMariaDbPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Fetch Orders from WooCommerce MariaDB schema */
export async function fetchMariaDbOrders(params?: {
  status?: string | null;
  search?: string | null;
}): Promise<WcOrder[]> {
  const p = getMariaDbPool();

  const [orderRows] = await p.query<mysql.RowDataPacket[]>(`
    SELECT 
      p.ID as id,
      p.post_date as created_at,
      p.post_modified as updated_at,
      p.post_status as status,
      p.post_excerpt as customer_note
    FROM joy_posts p
    WHERE p.post_type = 'shop_order'
    ORDER BY p.post_date DESC, p.ID DESC
    LIMIT 200
  `);

  if (!orderRows || orderRows.length === 0) {
    return [];
  }

  const orderIds = orderRows.map((r) => r.id);

  const [metaRows] = await p.query<mysql.RowDataPacket[]>(
    `
    SELECT post_id, meta_key, meta_value
    FROM joy_postmeta
    WHERE post_id IN (?)
      AND meta_key IN (
        '_order_total', '_billing_first_name', '_billing_last_name',
        '_billing_company', '_billing_phone', '_billing_email',
        '_billing_address_1', '_billing_city', '_customer_user',
        '_proposed_message'
      )
  `,
    [orderIds],
  );

  const metaMap = buildMetaMap(metaRows);

  const [itemRows] = await p.query<mysql.RowDataPacket[]>(
    `
    SELECT 
      i.order_item_id,
      i.order_id,
      i.order_item_name,
      m1.meta_value as qty,
      m2.meta_value as line_total,
      m3.meta_value as product_id
    FROM joy_woocommerce_order_items i
    LEFT JOIN joy_woocommerce_order_itemmeta m1 ON i.order_item_id = m1.order_item_id AND m1.meta_key = '_qty'
    LEFT JOIN joy_woocommerce_order_itemmeta m2 ON i.order_item_id = m2.order_item_id AND m2.meta_key = '_line_total'
    LEFT JOIN joy_woocommerce_order_itemmeta m3 ON i.order_item_id = m3.order_item_id AND m3.meta_key = '_product_id'
    WHERE i.order_id IN (?) AND i.order_item_type = 'line_item'
  `,
    [orderIds],
  );

  const itemsByOrder = buildItemsByOrder(itemRows);

  const orders = orderRows.map((r) => mapOrderRow(r, metaMap, itemsByOrder));

  return orders.filter((o) => {
    if (params?.status && params.status !== "all" && o.status !== params.status) return false;
    if (params?.search) {
      const q = params.search.toLowerCase();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchDealer =
        o.dealer.businessName.toLowerCase().includes(q) || o.dealer.phone.includes(q);
      const matchItems = o.items?.some(
        (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q),
      );
      if (!matchNum && !matchDealer && !matchItems) return false;
    }
    return true;
  });
}

/** Fetch single Order detail from MariaDB (single-row query) */
export async function fetchMariaDbOrderById(id: number): Promise<WcOrder | null> {
  const p = getMariaDbPool();

  const [orderRows] = await p.query<mysql.RowDataPacket[]>(
    `
    SELECT
      p.ID as id,
      p.post_date as created_at,
      p.post_modified as updated_at,
      p.post_status as status,
      p.post_excerpt as customer_note
    FROM joy_posts p
    WHERE p.ID = ? AND p.post_type = 'shop_order'
  `,
    [id],
  );

  const row = orderRows?.[0];
  if (!row) return null;

  const [metaRows] = await p.query<mysql.RowDataPacket[]>(
    `
    SELECT post_id, meta_key, meta_value
    FROM joy_postmeta
    WHERE post_id = ?
      AND meta_key IN (
        '_order_total', '_billing_first_name', '_billing_last_name',
        '_billing_company', '_billing_phone', '_billing_email',
        '_billing_address_1', '_billing_city', '_customer_user',
        '_proposed_message'
      )
  `,
    [id],
  );

  const [itemRows] = await p.query<mysql.RowDataPacket[]>(
    `
    SELECT
      i.order_item_id,
      i.order_id,
      i.order_item_name,
      m1.meta_value as qty,
      m2.meta_value as line_total,
      m3.meta_value as product_id
    FROM joy_woocommerce_order_items i
    LEFT JOIN joy_woocommerce_order_itemmeta m1 ON i.order_item_id = m1.order_item_id AND m1.meta_key = '_qty'
    LEFT JOIN joy_woocommerce_order_itemmeta m2 ON i.order_item_id = m2.order_item_id AND m2.meta_key = '_line_total'
    LEFT JOIN joy_woocommerce_order_itemmeta m3 ON i.order_item_id = m3.order_item_id AND m3.meta_key = '_product_id'
    WHERE i.order_id = ? AND i.order_item_type = 'line_item'
  `,
    [id],
  );

  const metaMap = buildMetaMap(metaRows);
  const itemsByOrder = buildItemsByOrder(itemRows);
  return mapOrderRow(row, metaMap, itemsByOrder);
}

/** Cancel an order in MariaDB joy_posts (sets post_status to wc-cancelled) */
export async function cancelMariaDbOrder(
  orderId: number,
  reason?: string,
): Promise<WcOrder | null> {
  return updateMariaDbOrderStatus(orderId, "cancelled", reason);
}

export interface CreateMariaDbOrderInput {
  phone: string;
  customerName: string;
  deliveryAddress?: string | null;
  productName: string;
  sku?: string | null;
  productId?: number | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes?: string | null;
}

/** Insert a new WhatsApp AI confirmed order into MariaDB WooCommerce tables */
export async function createMariaDbOrder(input: CreateMariaDbOrderInput): Promise<WcOrder | null> {
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    const orderId = await withTransaction(async (conn) => {
      const [res] = await conn.query<mysql.ResultSetHeader>(
        `
        INSERT INTO joy_posts (
          post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
          post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt,
          post_type, to_ping, pinged, post_content_filtered
        )
        VALUES (
          1, ?, ?, '', 'Order', ?,
          'wc-pending', 'closed', 'closed', ?, ?, ?,
          'shop_order', '', '', ''
        )
      `,
        [nowStr, nowStr, input.notes || "WhatsApp AI Order", `order-${Date.now()}`, nowStr, nowStr],
      );

      const newOrderId = res.insertId;
      const metaValues = [
        [newOrderId, "_order_total", String(input.totalAmount)],
        [newOrderId, "_billing_first_name", input.customerName],
        [newOrderId, "_billing_phone", normalizePhone(input.phone)],
        [newOrderId, "_billing_address_1", input.deliveryAddress || ""],
        [newOrderId, "_order_currency", "BDT"],
      ];

      for (const [pId, k, v] of metaValues) {
        await conn.query(
          "INSERT INTO joy_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)",
          [pId, k, v],
        );
      }

      await insertLineItem(conn, newOrderId, {
        productName: input.productName,
        quantity: input.quantity,
        lineTotal: input.totalAmount,
        productId: input.productId,
      });

      return newOrderId;
    });

    return await fetchMariaDbOrderById(orderId);
  } catch (err) {
    throw new MariaDbError("Failed to create MariaDB order", { cause: err });
  }
}

/** Update order status in MariaDB joy_posts */
export async function updateMariaDbOrderStatus(
  orderId: number,
  newStatus: string,
  _reason?: string,
  proposedMessage?: string,
): Promise<WcOrder | null> {
  const wcStatus = mapDigicoStatusToWc(newStatus);
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE joy_posts SET post_status = ?, post_modified = ?, post_modified_gmt = ? WHERE ID = ? AND post_type = 'shop_order'`,
        [wcStatus, nowStr, nowStr, orderId],
      );

      if (proposedMessage) {
        await upsertPostMeta(conn, orderId, "_proposed_message", proposedMessage);
      }
    });

    return await fetchMariaDbOrderById(orderId);
  } catch (err) {
    throw new MariaDbError("Failed to update MariaDB order status", {
      cause: err,
    });
  }
}

/** Update MariaDB order details */
export async function updateMariaDbOrder(
  orderId: number,
  input: {
    notes?: string;
    proposedMessage?: string;
    items?: Array<{
      productId?: number;
      sku: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
  },
): Promise<WcOrder | null> {
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    await withTransaction(async (conn) => {
      const [orderRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT ID FROM joy_posts WHERE ID = ? AND post_type = 'shop_order'`,
        [orderId],
      );
      if (!orderRows[0]) return;

      if (input.notes !== undefined) {
        await conn.query(
          `
          UPDATE joy_posts
          SET post_excerpt = ?, post_modified = ?, post_modified_gmt = ?
          WHERE ID = ? AND post_type = 'shop_order'
          `,
          [input.notes, nowStr, nowStr, orderId],
        );
      }

      if (input.proposedMessage !== undefined) {
        await upsertPostMeta(conn, orderId, "_proposed_message", input.proposedMessage);
      }

      if (input.items !== undefined) {
        const total = await replaceOrderLineItems(conn, orderId, input.items);
        await upsertPostMeta(conn, orderId, "_order_total", String(total));
        await conn.query(
          `
          UPDATE joy_posts
          SET post_modified = ?, post_modified_gmt = ?
          WHERE ID = ? AND post_type = 'shop_order'
          `,
          [nowStr, nowStr, orderId],
        );
      }
    });

    return await fetchMariaDbOrderById(orderId);
  } catch (err) {
    throw new MariaDbError("Failed to update MariaDB order", { cause: err });
  }
}
