import mysql from "mysql2/promise";

const DEFAULT_MARIADB_URL = "mysql://wp:wp@127.0.0.1:3307/woocommerce_local";

let pool: mysql.Pool | null = null;

export function getMariaDbPool(): mysql.Pool {
  if (!pool) {
    const connectionUrl = process.env.MARIADB_URL || DEFAULT_MARIADB_URL;
    pool = mysql.createPool({
      uri: connectionUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export interface WcOrder {
  id: number;
  orderNumber: string;
  status: string;
  origin: string;
  totalAmount: number;
  notes: string | null;
  proposedMessage: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  dealer: {
    id: number;
    businessName: string;
    phone: string;
    contactPerson: string;
    address?: string | null;
  };
  items?: WcOrderItem[];
}

export interface WcOrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface WcProduct {
  id: number;
  sku: string;
  brand: string;
  name: string;
  category: string;
  model: string | null;
  specifications: string | null;
  unitPrice: number;
  stockQuantity: number;
  aliases: string[];
}

export interface WcDealer {
  id: number;
  businessName: string;
  contactPerson: string;
  phone: string;
  address: string | null;
  status: string;
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

/** Check if MariaDB has imported WooCommerce data */
export async function isMariaDbAvailable(): Promise<boolean> {
  try {
    const p = getMariaDbPool();
    const [rows] = await p.query<mysql.RowDataPacket[]>("SELECT 1 FROM joy_posts LIMIT 1");
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/** Fetch Orders from WooCommerce MariaDB schema */
export async function fetchMariaDbOrders(params?: {
  status?: string | null;
  search?: string | null;
}): Promise<WcOrder[]> {
  const p = getMariaDbPool();

  // Primary order fetch from joy_posts shop_order
  const [orderRows] = await p.query<mysql.RowDataPacket[]>(`
    SELECT 
      p.ID as id,
      p.post_date as created_at,
      p.post_modified as updated_at,
      p.post_status as status,
      p.post_excerpt as customer_note
    FROM joy_posts p
    WHERE p.post_type = 'shop_order'
    ORDER BY p.post_date DESC
    LIMIT 200
  `);

  if (!orderRows || orderRows.length === 0) {
    return [];
  }

  const orderIds = orderRows.map((r) => r.id);

  // Fetch postmeta for these orders in bulk
  const [metaRows] = await p.query<mysql.RowDataPacket[]>(
    `
    SELECT post_id, meta_key, meta_value
    FROM joy_postmeta
    WHERE post_id IN (?)
      AND meta_key IN (
        '_order_total', '_billing_first_name', '_billing_last_name',
        '_billing_company', '_billing_phone', '_billing_email',
        '_billing_address_1', '_billing_city', '_customer_user'
      )
  `,
    [orderIds],
  );

  const metaMap = new Map<number, Record<string, string>>();
  for (const row of metaRows) {
    const existing = metaMap.get(row.post_id) || {};
    existing[row.meta_key] = row.meta_value;
    metaMap.set(row.post_id, existing);
  }

  // Fetch order items for these orders
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

  const orders: WcOrder[] = [];

  for (const r of orderRows) {
    const meta = metaMap.get(r.id) || {};
    const firstName = meta["_billing_first_name"] || "";
    const lastName = meta["_billing_last_name"] || "";
    const company = meta["_billing_company"] || "";
    const phone = meta["_billing_phone"] || "+8801700000000";
    const address = [meta["_billing_address_1"], meta["_billing_city"]].filter(Boolean).join(", ");
    const customerId = parseInt(meta["_customer_user"] || "0", 10) || r.id;

    const contactName = [firstName, lastName].filter(Boolean).join(" ") || "WooCommerce Customer";
    const businessName = company || contactName;
    const totalAmount = Math.round(parseFloat(meta["_order_total"] || "0"));
    const items = itemsByOrder.get(r.id) || [];
    const digicoStatus = mapWcStatusToDigico(r.status);

    orders.push({
      id: r.id,
      orderNumber: `#ORD-${r.id}`,
      status: digicoStatus,
      origin: "woocommerce",
      totalAmount,
      notes: r.customer_note || null,
      proposedMessage: `Dear ${contactName}, your order #ORD-${r.id} total ৳${totalAmount.toLocaleString()} status is ${digicoStatus}.`,
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
    });
  }

  // Filter if params are set
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

/** Fetch single Order detail from MariaDB */
export async function fetchMariaDbOrderById(id: number): Promise<WcOrder | null> {
  const orders = await fetchMariaDbOrders();
  return orders.find((o) => o.id === id) || null;
}

/** Fetch Products list from MariaDB */
export async function fetchMariaDbProducts(): Promise<WcProduct[]> {
  const p = getMariaDbPool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(`
    SELECT 
      p.ID as id,
      p.post_title as name,
      m1.meta_value as sku,
      m2.meta_value as price,
      m3.meta_value as stock
    FROM joy_posts p
    LEFT JOIN joy_postmeta m1 ON p.ID = m1.post_id AND m1.meta_key = '_sku'
    LEFT JOIN joy_postmeta m2 ON p.ID = m2.post_id AND m2.meta_key = '_price'
    LEFT JOIN joy_postmeta m3 ON p.ID = m3.post_id AND m3.meta_key = '_stock'
    WHERE p.post_type = 'product' AND p.post_status = 'publish'
    LIMIT 200
  `);

  return (rows || []).map((r) => ({
    id: r.id,
    sku: r.sku || `SKU-${r.id}`,
    brand: "WooCommerce",
    name: r.name,
    category: "Products",
    model: null,
    specifications: null,
    unitPrice: Math.round(parseFloat(r.price || "0")),
    stockQuantity: parseInt(r.stock || "10", 10),
    aliases: [r.name],
  }));
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
