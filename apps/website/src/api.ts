import type { OrderStatusType } from "@digico/design-system";

export type OrderOriginType = "whatsapp_ai" | "manual_sales";

export interface Dealer {
  id: number;
  businessName: string;
  phone: string;
  contactPerson: string | null;
  address?: string | null;
}

export interface Product {
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

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderHistoryItem {
  id: number;
  orderId: number;
  previousStatus: OrderStatusType | null;
  newStatus: OrderStatusType;
  changedBy: string;
  reason: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  dealer: Dealer;
  status: OrderStatusType;
  origin: OrderOriginType;
  totalAmount: number;
  notes: string | null;
  proposedMessage: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history?: OrderHistoryItem[];
}

export interface ListOrdersResult {
  items: Order[];
  total: number;
  counts: Record<string, number>;
}

export interface ListOrdersParams {
  status?: string;
  origin?: string;
  search?: string;
}

// Log Messages Types (for Message Log tab)
export interface LogMessage {
  id: number;
  messageId: string;
  fromPhone: string;
  contactName: string | null;
  kind: "text" | "audio";
  rawPayload: unknown;
  inboundText: string | null;
  transcript: string | null;
  resolvedText: string | null;
  status: "received" | "completed" | "failed";
  error: string | null;
  receivedAt: string;
  completedAt: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// API functions
export function listOrders(params: ListOrdersParams = {}): Promise<ListOrdersResult> {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.origin) search.set("origin", params.origin);
  if (params.search) search.set("search", params.search);
  const query = search.toString();
  return getJson<ListOrdersResult>(`/api/orders${query ? `?${query}` : ""}`);
}

export function getOrder(id: number): Promise<Order> {
  return getJson<Order>(`/api/orders/${id}`);
}

export function createOrder(data: {
  dealerId: number;
  origin?: OrderOriginType;
  notes?: string;
  items: Array<{
    productId?: number;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}): Promise<Order> {
  return sendJson<Order>("/api/orders", "POST", data);
}

export function updateOrder(
  id: number,
  data: {
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
): Promise<Order> {
  return sendJson<Order>(`/api/orders/${id}`, "PATCH", data);
}

export function updateOrderStatus(
  id: number,
  status: OrderStatusType,
  reason?: string,
  proposedMessage?: string,
): Promise<Order> {
  return sendJson<Order>(`/api/orders/${id}/status`, "POST", { status, reason, proposedMessage });
}

export function bulkUpdateOrderStatus(
  orderIds: number[],
  status: OrderStatusType,
  reason?: string,
): Promise<{ success: boolean; count: number }> {
  return sendJson<{ success: boolean; count: number }>("/api/orders/bulk-status", "POST", {
    orderIds,
    status,
    reason,
  });
}

export function listProducts(): Promise<Product[]> {
  return getJson<Product[]>("/api/products");
}

export function listDealers(): Promise<Dealer[]> {
  return getJson<Dealer[]>("/api/dealers");
}

export function listMessages(): Promise<{ items: LogMessage[]; total: number }> {
  return getJson<{ items: LogMessage[]; total: number }>("/api/messages");
}
