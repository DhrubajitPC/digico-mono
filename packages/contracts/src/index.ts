// Canonical domain contracts — single source of truth shared by the frontend,
// backend, and db packages. No mirrored interfaces.

export type OrderStatusType =
  | "draft"
  | "pending_review"
  | "confirmed"
  | "on_hold"
  | "processing"
  | "completed"
  | "cancelled";

export type OrderOriginType = "whatsapp_ai" | "manual_sales";

export type MessageKind = "text" | "audio" | "unsupported";

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

export interface LogMessage {
  id: number;
  messageId: string;
  fromPhone: string;
  contactName: string | null;
  kind: "text" | "audio";
  // Raw webhook payloads are not persisted; absent on listed/loaded messages.
  rawPayload?: unknown;
  inboundText: string | null;
  transcript: string | null;
  resolvedText: string | null;
  status: "received" | "completed" | "failed";
  error: string | null;
  receivedAt: string;
  completedAt: string | null;
}

export interface EmulatorChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  model?: string;
  latencyMs?: number;
  status?: string;
  error?: string | null;
  rawPayload?: unknown;
}

export interface DraftOrderPayload {
  productName: string;
  sku?: string;
  productId?: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  customerName?: string;
  deliveryAddress?: string;
  phone?: string;
  userConfirmation?: boolean;
}
