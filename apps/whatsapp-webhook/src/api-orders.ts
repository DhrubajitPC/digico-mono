import type { Db } from "./db/client.ts";
import {
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
  origin?: string;
  notes?: string;
  items: OrderItemInput[];
}

export interface UpdateOrderInput {
  notes?: string;
  proposedMessage?: string;
  items?: OrderItemInput[];
}

// GET /api/orders
export async function listOrdersForApi(_db: Db, params: URLSearchParams) {
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

// GET /api/orders/:id
export async function getOrderForApi(_db: Db, id: number) {
  const mariaOrder = await fetchMariaDbOrderById(id);
  if (mariaOrder) {
    return {
      ...mariaOrder,
      history: [],
    };
  }
  return null;
}

// POST /api/orders (Create Manual Order)
export async function createOrderForApi(_db: Db, body: CreateOrderInput) {
  const firstItem = body.items[0];
  const total = body.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  return await createMariaDbOrder({
    phone: "+8801700000000",
    customerName: "Manual Sales Dealer",
    productName: firstItem?.productName || "Product",
    quantity: firstItem?.quantity || 1,
    unitPrice: firstItem?.unitPrice || total,
    totalAmount: total,
    notes: body.notes,
  });
}

// PATCH /api/orders/:id (Edit Order)
export async function updateOrderForApi(_db: Db, id: number, body: UpdateOrderInput) {
  return await updateMariaDbOrder(id, body);
}

// POST /api/orders/:id/status (Change Status)
export async function updateOrderStatusForApi(
  _db: Db,
  id: number,
  newStatus: string,
  reason?: string,
  approvedMessage?: string,
) {
  return await updateMariaDbOrderStatus(id, newStatus, reason, approvedMessage);
}

// POST /api/orders/bulk-status
export async function bulkUpdateOrderStatusForApi(
  db: Db,
  orderIds: number[],
  newStatus: string,
  reason?: string,
) {
  for (const id of orderIds) {
    await updateOrderStatusForApi(db, id, newStatus, reason ?? "Bulk Action");
  }
  return { success: true, count: orderIds.length };
}

// GET /api/products
export async function listProductsForApi(_db: Db) {
  return await fetchMariaDbProducts();
}

// GET /api/dealers
export async function listDealersForApi(_db: Db) {
  return await fetchMariaDbDealers();
}
