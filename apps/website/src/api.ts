import type {
  Dealer,
  EmulatorChatMessage,
  LogMessage,
  Order,
  OrderOriginType,
  OrderStatusType,
  Product,
} from "@digico/contracts";

// Canonical domain types live in @digico/contracts; re-exported here so existing
// `import ... from "../api.js"` call sites keep compiling.
export type {
  Dealer,
  EmulatorChatMessage,
  LogMessage,
  Order,
  OrderHistoryItem,
  OrderItem,
  OrderOriginType,
  OrderStatusType,
  Product,
} from "@digico/contracts";

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

export function sendEmulatorMessage(data: {
  fromPhone: string;
  contactName?: string;
  text: string;
}): Promise<{ success: boolean; messageId: string; metaPayload: unknown }> {
  return sendJson<{ success: boolean; messageId: string; metaPayload: unknown }>(
    "/api/emulator/send",
    "POST",
    data,
  );
}

export function getEmulatorChat(
  phone: string,
): Promise<{ fromPhone: string; messages: EmulatorChatMessage[] }> {
  const params = new URLSearchParams({ phone });
  return getJson<{ fromPhone: string; messages: EmulatorChatMessage[] }>(
    `/api/emulator/chat?${params.toString()}`,
  );
}
