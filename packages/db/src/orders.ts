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
    case "confirmed":
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
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at || r.created_at).toISOString(),
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
  const p = getMariaDbPool();
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    const [res] = await p.query<mysql.ResultSetHeader>(
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

    const orderId = res.insertId;

    const metaValues = [
      [orderId, "_order_total", String(input.totalAmount)],
      [orderId, "_billing_first_name", input.customerName],
      [orderId, "_billing_phone", input.phone],
      [orderId, "_billing_address_1", input.deliveryAddress || ""],
      [orderId, "_order_currency", "BDT"],
    ];

    for (const [pId, k, v] of metaValues) {
      await p.query("INSERT INTO joy_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)", [
        pId,
        k,
        v,
      ]);
    }

    const [itemRes] = await p.query<mysql.ResultSetHeader>(
      `
      INSERT INTO joy_woocommerce_order_items (order_item_name, order_item_type, order_id)
      VALUES (?, 'line_item', ?)
    `,
      [input.productName, orderId],
    );

    const itemId = itemRes.insertId;

    const itemMetaValues = [
      [itemId, "_qty", String(input.quantity)],
      [itemId, "_line_total", String(input.totalAmount)],
      [itemId, "_product_id", String(input.productId || 1)],
    ];

    for (const [iId, k, v] of itemMetaValues) {
      await p.query(
        "INSERT INTO joy_woocommerce_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)",
        [iId, k, v],
      );
    }

    const orders = await fetchMariaDbOrders();
    return orders.find((o) => o.id === orderId) || null;
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
  const p = getMariaDbPool();
  const wcStatus = mapDigicoStatusToWc(newStatus);
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    await p.query(
      `UPDATE joy_posts SET post_status = ?, post_modified = ?, post_modified_gmt = ? WHERE ID = ? AND post_type = 'shop_order'`,
      [wcStatus, nowStr, nowStr, orderId],
    );

    if (proposedMessage) {
      await p.query(
        `INSERT INTO joy_postmeta (post_id, meta_key, meta_value) VALUES (?, '_proposed_message', ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
        [orderId, proposedMessage],
      );
    }

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
  const p = getMariaDbPool();
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    if (input.notes !== undefined) {
      await p.query(
        `
      UPDATE joy_posts
      SET post_excerpt = ?, post_modified = ?, post_modified_gmt = ?
      WHERE ID = ? AND post_type = 'shop_order'
      `,
        [input.notes, nowStr, nowStr, orderId],
      );
    }

    if (input.proposedMessage !== undefined) {
      await p.query(
        `
      INSERT INTO joy_postmeta (post_id, meta_key, meta_value)
      VALUES (?, '_proposed_message', ?)
      ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)
      `,
        [orderId, input.proposedMessage],
      );
    }

    if (input.items !== undefined) {
      const [existingItems] = await p.query<mysql.RowDataPacket[]>(
        `
      SELECT
        i.order_item_id,
        m1.meta_value AS qty,
        m2.meta_value AS line_total
      FROM joy_woocommerce_order_items i
      LEFT JOIN joy_woocommerce_order_itemmeta m1
        ON i.order_item_id = m1.order_item_id
        AND m1.meta_key = '_qty'
      LEFT JOIN joy_woocommerce_order_itemmeta m2
        ON i.order_item_id = m2.order_item_id
        AND m2.meta_key = '_line_total'
      WHERE i.order_id = ?
      AND i.order_item_type = 'line_item'
      ORDER BY i.order_item_id
      `,
        [orderId],
      );

      for (let index = 0; index < input.items.length; index++) {
        const item = input.items[index];
        const existingItem = existingItems[index];

        if (!existingItem) {
          continue;
        }

        const lineTotal = item.quantity * item.unitPrice;

        await p.query(
          `
        UPDATE joy_woocommerce_order_itemmeta
        SET meta_value = ?
        WHERE order_item_id = ?
        AND meta_key = '_qty'
        `,
          [String(item.quantity), existingItem.order_item_id],
        );

        await p.query(
          `
        UPDATE joy_woocommerce_order_itemmeta
        SET meta_value = ?
        WHERE order_item_id = ?
        AND meta_key = '_line_total'
        `,
          [String(lineTotal), existingItem.order_item_id],
        );
      }

      const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      await p.query(
        `
      INSERT INTO joy_postmeta (post_id, meta_key, meta_value)
      VALUES (?, '_order_total', ?)
      ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)
      `,
        [orderId, String(total)],
      );

      await p.query(
        `
      UPDATE joy_posts
      SET post_modified = ?, post_modified_gmt = ?
      WHERE ID = ? AND post_type = 'shop_order'
      `,
        [nowStr, nowStr, orderId],
      );
    }
    return await fetchMariaDbOrderById(orderId);
  } catch (err) {
    throw new MariaDbError("Failed to update MariaDB order", { cause: err });
  }
}
