import type { Db } from "./db/client.ts";
import {
  dealers,
  orderHistory,
  orderItems,
  orders,
  products,
  type OrderOrigin,
  type OrderStatus,
} from "./db/schema.ts";
import { eq, desc } from "drizzle-orm";
import {
  isMariaDbAvailable,
  fetchMariaDbOrders,
  fetchMariaDbOrderById,
  fetchMariaDbProducts,
  fetchMariaDbDealers,
  createMariaDbOrder,
  updateMariaDbOrder,
  updateMariaDbOrderStatus,
} from "./db/mariadb.ts";

export const CURRENCY_SYMBOL = "৳";

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString()}`;
}

export interface OrderItemInput {
  productId?: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  dealerId: number;
  origin?: OrderOrigin;
  notes?: string;
  items: OrderItemInput[];
}

export interface UpdateOrderInput {
  notes?: string;
  proposedMessage?: string;
  items?: OrderItemInput[];
}

// Seed Initial Data if database is empty
export async function seedInitialOrdersData(db: Db) {
  try {
    const existingOrders = await db.select().from(orders).limit(1);
    if (existingOrders.length > 0) {
      return;
    }
  } catch {
    // If tables are not ready or empty, continue with seeding
  }

  console.log("Seeding initial products, dealers, and orders...");

  // Seed Dealers
  const insertedDealers = await db
    .insert(dealers)
    .values([
      {
        businessName: "Souhardo Ahmed",
        phone: "+8801711000001",
        contactPerson: "Souhardo Ahmed",
      },
      { businessName: "BD Soft Inc.", phone: "+8801819000002", contactPerson: "Rafiqul Islam" },
      {
        businessName: "Mahaz Chowdhury",
        phone: "+8801912000003",
        contactPerson: "Mahaz Chowdhury",
      },
      {
        businessName: "TechLand Bangladesh",
        phone: "+8801755000004",
        contactPerson: "Tanvir Hasan",
      },
      { businessName: "Star Tech Dealers", phone: "+8801833000005", contactPerson: "Kazi Nabil" },
    ])
    .returning();

  // Seed Products
  const insertedProducts = await db
    .insert(products)
    .values([
      {
        sku: "HP-15S-I5",
        brand: "HP",
        name: "HP 15s Core i5 / 8GB / 512GB SSD",
        category: "Laptops",
        model: "15s-fq5000",
        specifications: "15.6 FHD, i5 12th Gen, 8GB RAM, 512GB NVMe",
        unitPrice: 68500,
        stockQuantity: 24,
        aliases: ["HP 15s", "HP i5", "15s i5"],
      },
      {
        sku: "LEN-IP3-I5",
        brand: "Lenovo",
        name: "Lenovo IdeaPad 3 Core i5 / 16GB / 512GB",
        category: "Laptops",
        model: "IdeaPad 3 15ITL6",
        specifications: "15.6 FHD, i5 11th Gen, 16GB RAM, 512GB SSD",
        unitPrice: 64200,
        stockQuantity: 15,
        aliases: ["Lenovo i5", "IdeaPad 3"],
      },
      {
        sku: "SAM-24F-IPS",
        brand: "Samsung",
        name: 'Samsung 24" IPS Borderless Monitor',
        category: "Monitors",
        model: "LF24T350FHWXXL",
        specifications: "24 inch 75Hz Full HD IPS",
        unitPrice: 13590,
        stockQuantity: 40,
        aliases: ["Samsung 24 inch", "Samsung monitor 24"],
      },
      {
        sku: "LOG-MX2-MST",
        brand: "Logitech",
        name: "Logitech MX Master 3S Wireless Mouse",
        category: "Accessories",
        model: "MX Master 3S",
        specifications: "8K DPI Quiet Clicks, Bluetooth & USB",
        unitPrice: 11200,
        stockQuantity: 50,
        aliases: ["Logitech mouse", "MX Master 3S"],
      },
      {
        sku: "DELL-P2722H",
        brand: "Dell",
        name: 'Dell P2722H 27" FHD Monitor',
        category: "Monitors",
        model: "P2722H",
        specifications: "27 inch IPS Ergonomic Stand",
        unitPrice: 28500,
        stockQuantity: 18,
        aliases: ["Dell 27 monitor", "P2722H"],
      },
    ])
    .returning();

  // Seed Sample Orders matching reference screenshot
  const sampleOrders = [
    {
      orderNumber: "#ORD-7585",
      dealerId: insertedDealers[0]!.id,
      status: "pending_review" as OrderStatus,
      origin: "whatsapp_ai" as OrderOrigin,
      totalAmount: 253880,
      notes: "Dealer requested 3x HP 15s + 4x Samsung 24 Monitor",
      proposedMessage: `Dear Souhardo Ahmed, your order #ORD-7585 for 3x HP 15s i5 & 4x Samsung 24" Monitor (Total: ${formatCurrency(253880)}) has been confirmed. Dispatch in progress.`,
      createdAt: new Date("2026-07-20T10:15:00Z"),
      items: [
        {
          productId: insertedProducts[0]!.id,
          sku: "HP-15S-I5",
          productName: "HP 15s Core i5 / 8GB / 512GB SSD",
          quantity: 3,
          unitPrice: 68500,
          lineTotal: 205500,
        },
        {
          productId: insertedProducts[2]!.id,
          sku: "SAM-24F-IPS",
          productName: 'Samsung 24" IPS Borderless Monitor',
          quantity: 4,
          unitPrice: 12095,
          lineTotal: 48380,
        },
      ],
    },
    {
      orderNumber: "#ORD-7583",
      dealerId: insertedDealers[0]!.id,
      status: "pending_review" as OrderStatus,
      origin: "whatsapp_ai" as OrderOrigin,
      totalAmount: 1590,
      notes: "Accessories small test order",
      proposedMessage: `Dear Souhardo Ahmed, your order #ORD-7583 (Total: ${formatCurrency(1590)}) has been confirmed.`,
      createdAt: new Date("2026-07-20T09:30:00Z"),
      items: [
        {
          productId: insertedProducts[3]!.id,
          sku: "LOG-MX2-MST",
          productName: "Logitech MX Master 3S Wireless Mouse",
          quantity: 1,
          unitPrice: 1590,
          lineTotal: 1590,
        },
      ],
    },
    {
      orderNumber: "#ORD-7507",
      dealerId: insertedDealers[1]!.id,
      status: "cancelled" as OrderStatus,
      origin: "whatsapp_ai" as OrderOrigin,
      totalAmount: 137190,
      notes: "Dealer cancelled due to project delay",
      proposedMessage: "Dear BD Soft Inc., order #ORD-7507 has been cancelled as requested.",
      createdAt: new Date("2026-07-19T16:20:00Z"),
      items: [
        {
          productId: insertedProducts[1]!.id,
          sku: "LEN-IP3-I5",
          productName: "Lenovo IdeaPad 3 Core i5 / 16GB / 512GB",
          quantity: 2,
          unitPrice: 64200,
          lineTotal: 128400,
        },
        {
          productId: insertedProducts[3]!.id,
          sku: "LOG-MX2-MST",
          productName: "Logitech MX Master 3S Wireless Mouse",
          quantity: 1,
          unitPrice: 8790,
          lineTotal: 8790,
        },
      ],
    },
    {
      orderNumber: "#ORD-7506",
      dealerId: insertedDealers[1]!.id,
      status: "on_hold" as OrderStatus,
      origin: "manual_sales" as OrderOrigin,
      totalAmount: 585992,
      notes: "On hold waiting for bank wire confirmation",
      proposedMessage:
        "Dear BD Soft Inc., your order #ORD-7506 is on hold pending payment verification.",
      createdAt: new Date("2026-07-19T14:10:00Z"),
      items: [
        {
          productId: insertedProducts[0]!.id,
          sku: "HP-15S-I5",
          productName: "HP 15s Core i5 / 8GB / 512GB SSD",
          quantity: 8,
          unitPrice: 68500,
          lineTotal: 548000,
        },
        {
          productId: insertedProducts[2]!.id,
          sku: "SAM-24F-IPS",
          productName: 'Samsung 24" IPS Borderless Monitor',
          quantity: 3,
          unitPrice: 12664,
          lineTotal: 37992,
        },
      ],
    },
    {
      orderNumber: "#ORD-7505",
      dealerId: insertedDealers[1]!.id,
      status: "confirmed" as OrderStatus,
      origin: "whatsapp_ai" as OrderOrigin,
      totalAmount: 67932,
      notes: "Confirmed by sales rep",
      proposedMessage: "Dear BD Soft Inc., order #ORD-7505 for 5x Samsung 24 Monitor is confirmed.",
      createdAt: new Date("2026-07-19T11:05:00Z"),
      items: [
        {
          productId: insertedProducts[2]!.id,
          sku: "SAM-24F-IPS",
          productName: 'Samsung 24" IPS Borderless Monitor',
          quantity: 5,
          unitPrice: 13586,
          lineTotal: 67932,
        },
      ],
    },
    {
      orderNumber: "#ORD-7485",
      dealerId: insertedDealers[2]!.id,
      status: "processing" as OrderStatus,
      origin: "whatsapp_ai" as OrderOrigin,
      totalAmount: 45290,
      notes: "Warehouse processing for dispatch",
      proposedMessage:
        "Dear Mahaz Chowdhury, order #ORD-7485 is currently being packed for delivery.",
      createdAt: new Date("2026-07-17T15:45:00Z"),
      items: [
        {
          productId: insertedProducts[4]!.id,
          sku: "DELL-P2722H",
          productName: 'Dell P2722H 27" FHD Monitor',
          quantity: 1,
          unitPrice: 28500,
          lineTotal: 28500,
        },
        {
          productId: insertedProducts[2]!.id,
          sku: "SAM-24F-IPS",
          productName: 'Samsung 24" IPS Borderless Monitor',
          quantity: 1,
          unitPrice: 16790,
          lineTotal: 16790,
        },
      ],
    },
    {
      orderNumber: "#ORD-6954",
      dealerId: insertedDealers[2]!.id,
      status: "completed" as OrderStatus,
      origin: "whatsapp_ai" as OrderOrigin,
      totalAmount: 48928,
      notes: "Delivered & paid",
      proposedMessage:
        "Dear Mahaz Chowdhury, order #ORD-6954 has been successfully completed. Thank you!",
      createdAt: new Date("2026-07-14T12:00:00Z"),
      items: [
        {
          productId: insertedProducts[0]!.id,
          sku: "HP-15S-I5",
          productName: "HP 15s Core i5 / 8GB / 512GB SSD",
          quantity: 1,
          unitPrice: 48928,
          lineTotal: 48928,
        },
      ],
    },
  ];

  for (const o of sampleOrders) {
    const [insertedOrder] = await db
      .insert(orders)
      .values({
        orderNumber: o.orderNumber,
        dealerId: o.dealerId,
        status: o.status,
        origin: o.origin,
        totalAmount: o.totalAmount,
        notes: o.notes,
        proposedMessage: o.proposedMessage,
        createdAt: o.createdAt,
      })
      .returning();

    if (insertedOrder) {
      for (const item of o.items) {
        await db.insert(orderItems).values({
          orderId: insertedOrder.id,
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        });
      }
    }
  }
}

// GET /api/orders
export async function listOrdersForApi(db: Db, params: URLSearchParams) {
  if (await isMariaDbAvailable()) {
    const status = params.get("status");
    const search = params.get("search");
    const mariaOrders = await fetchMariaDbOrders({ status, search });
    const allMariaOrders = await fetchMariaDbOrders();
    const counts = {
      all: allMariaOrders.length,
      pending_review: allMariaOrders.filter((e) => e.status === "pending_review").length,
      confirmed: allMariaOrders.filter((e) => e.status === "confirmed").length,
      on_hold: allMariaOrders.filter((e) => e.status === "on_hold").length,
      processing: allMariaOrders.filter((e) => e.status === "processing").length,
      completed: allMariaOrders.filter((e) => e.status === "completed").length,
      cancelled: allMariaOrders.filter((e) => e.status === "cancelled").length,
    };

    return {
      items: mariaOrders,
      total: mariaOrders.length,
      counts,
    };
  }

  await seedInitialOrdersData(db);

  const status = params.get("status") as OrderStatus | null;
  const origin = params.get("origin") as OrderOrigin | null;
  const search = params.get("search");

  const allOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      origin: orders.origin,
      totalAmount: orders.totalAmount,
      notes: orders.notes,
      proposedMessage: orders.proposedMessage,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      dealer: {
        id: dealers.id,
        businessName: dealers.businessName,
        phone: dealers.phone,
        contactPerson: dealers.contactPerson,
      },
    })
    .from(orders)
    .innerJoin(dealers, eq(orders.dealerId, dealers.id))
    .orderBy(desc(orders.createdAt));

  // Get line items for all orders
  const allItems = await db.select().from(orderItems);
  const itemsByOrderId = new Map<number, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByOrderId.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrderId.set(item.orderId, list);
  }

  const enriched = allOrders.map((o) => ({
    ...o,
    items: itemsByOrderId.get(o.id) ?? [],
  }));

  // Filter in memory for robust multi-field search & status tabs
  const filtered = enriched.filter((o) => {
    if (status && status !== ("all" as any) && o.status !== status) return false;
    if (origin && o.origin !== origin) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchDealer =
        o.dealer.businessName.toLowerCase().includes(q) || o.dealer.phone.includes(q);
      const matchItems = o.items.some(
        (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q),
      );
      if (!matchNum && !matchDealer && !matchItems) return false;
    }
    return true;
  });

  return {
    items: filtered,
    total: filtered.length,
    counts: {
      all: enriched.length,
      pending_review: enriched.filter((e) => e.status === "pending_review").length,
      confirmed: enriched.filter((e) => e.status === "confirmed").length,
      on_hold: enriched.filter((e) => e.status === "on_hold").length,
      processing: enriched.filter((e) => e.status === "processing").length,
      completed: enriched.filter((e) => e.status === "completed").length,
      cancelled: enriched.filter((e) => e.status === "cancelled").length,
    },
  };
}

// GET /api/orders/:id
export async function getOrderForApi(db: Db, id: number) {
  if (await isMariaDbAvailable()) {
    const mariaOrder = await fetchMariaDbOrderById(id);
    if (mariaOrder) {
      return {
        ...mariaOrder,
        history: [],
      };
    }
  }

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      origin: orders.origin,
      totalAmount: orders.totalAmount,
      notes: orders.notes,
      proposedMessage: orders.proposedMessage,
      approvedBy: orders.approvedBy,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      dealer: {
        id: dealers.id,
        businessName: dealers.businessName,
        phone: dealers.phone,
        contactPerson: dealers.contactPerson,
        address: dealers.address,
      },
    })
    .from(orders)
    .innerJoin(dealers, eq(orders.dealerId, dealers.id))
    .where(eq(orders.id, id));

  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const history = await db
    .select()
    .from(orderHistory)
    .where(eq(orderHistory.orderId, id))
    .orderBy(desc(orderHistory.createdAt));

  return {
    ...order,
    items,
    history,
  };
}

// POST /api/orders (Create Manual Order)
export async function createOrderForApi(db: Db, body: CreateOrderInput) {
  if (await isMariaDbAvailable()) {
    const firstItem = body.items[0];
    const total = body.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const mariaRes = await createMariaDbOrder({
      phone: "+8801700000000",
      customerName: "Manual Sales Dealer",
      productName: firstItem?.productName || "Product",
      quantity: firstItem?.quantity || 1,
      unitPrice: firstItem?.unitPrice || total,
      totalAmount: total,
      notes: body.notes,
    });
    if (mariaRes) return mariaRes;
  }

  const orderNum = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const total = body.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const [newOrder] = await db
    .insert(orders)
    .values({
      orderNumber: orderNum,
      dealerId: body.dealerId,
      status: "pending_review",
      origin: body.origin ?? "manual_sales",
      totalAmount: total,
      notes: body.notes ?? null,
      proposedMessage: `Dear Dealer, order ${orderNum} for total ${formatCurrency(total)} is created.`,
    })
    .returning();

  if (newOrder) {
    for (const item of body.items) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        productId: item.productId ?? null,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      });
    }

    await db.insert(orderHistory).values({
      orderId: newOrder.id,
      previousStatus: null,
      newStatus: "pending_review",
      changedBy: "Sales Admin",
      reason: "Manual Order Created",
    });
  }

  return getOrderForApi(db, newOrder!.id);
}

// PATCH /api/orders/:id (Edit Order)
export async function updateOrderForApi(db: Db, id: number, body: UpdateOrderInput) {
  if (await isMariaDbAvailable()) {
    const updatedMaria = await updateMariaDbOrder(id, body);
    if (updatedMaria) return updatedMaria;
  }

  const order = await getOrderForApi(db, id);
  if (!order) return null;

  let totalAmount = order.totalAmount;

  if (body.items) {
    // Delete existing items and insert updated ones
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    totalAmount = 0;

    for (const item of body.items) {
      const lineTotal = item.quantity * item.unitPrice;
      totalAmount += lineTotal;
      await db.insert(orderItems).values({
        orderId: id,
        productId: item.productId ?? null,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      });
    }
  }

  await db
    .update(orders)
    .set({
      totalAmount,
      notes: body.notes !== undefined ? body.notes : order.notes,
      proposedMessage:
        body.proposedMessage !== undefined ? body.proposedMessage : order.proposedMessage,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  return getOrderForApi(db, id);
}

// POST /api/orders/:id/status (Change Status)
export async function updateOrderStatusForApi(
  db: Db,
  id: number,
  newStatus: OrderStatus,
  reason?: string,
  approvedMessage?: string,
) {
  if (await isMariaDbAvailable()) {
    const updatedMaria = await updateMariaDbOrderStatus(id, newStatus, reason, approvedMessage);
    if (updatedMaria) return updatedMaria;
  }

  const order = await getOrderForApi(db, id);
  if (!order) return null;

  const prevStatus = order.status as OrderStatus;

  await db
    .update(orders)
    .set({
      status: newStatus,
      proposedMessage: approvedMessage ?? order.proposedMessage,
      approvedBy: newStatus === "confirmed" ? "Sales Admin" : order.approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  await db.insert(orderHistory).values({
    orderId: id,
    previousStatus: prevStatus,
    newStatus: newStatus,
    changedBy: "Sales Admin",
    reason: reason ?? `Status changed to ${newStatus}`,
  });

  return getOrderForApi(db, id);
}

// POST /api/orders/bulk-status
export async function bulkUpdateOrderStatusForApi(
  db: Db,
  orderIds: number[],
  newStatus: OrderStatus,
  reason?: string,
) {
  for (const id of orderIds) {
    await updateOrderStatusForApi(db, id, newStatus, reason ?? "Bulk Action");
  }
  return { success: true, count: orderIds.length };
}

// GET /api/products
export async function listProductsForApi(db: Db) {
  if (await isMariaDbAvailable()) {
    return fetchMariaDbProducts();
  }
  await seedInitialOrdersData(db);
  return db.select().from(products);
}

// GET /api/dealers
export async function listDealersForApi(db: Db) {
  if (await isMariaDbAvailable()) {
    return fetchMariaDbDealers();
  }
  await seedInitialOrdersData(db);
  return db.select().from(dealers);
}
