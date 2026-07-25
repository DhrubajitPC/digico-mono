export type MessageStatus = "received" | "completed" | "failed";
export type MessageKind = "text" | "audio";
export type ReplyStatus = "sent" | "failed";

export interface LogMessage {
  id: number;
  messageId: string;
  fromPhone: string;
  contactName: string | null;
  kind: MessageKind;
  rawPayload: unknown;
  inboundText: string | null;
  transcript: string | null;
  resolvedText: string | null;
  status: MessageStatus;
  error: string | null;
  receivedAt: string;
  completedAt: string | null;
}

export interface AiCall {
  id: number;
  messageId: number;
  provider: string;
  model: string;
  requestMessages: unknown;
  responseText: string | null;
  error: string | null;
  latencyMs: number;
  createdAt: string;
}

export interface OutboundReply {
  id: number;
  messageId: number;
  toPhone: string;
  replyText: string;
  status: ReplyStatus;
  error: string | null;
  sentAt: string;
}

export interface MessageDetail {
  message: LogMessage;
  aiCalls: AiCall[];
  outboundReplies: OutboundReply[];
}

export interface ListMessagesResult {
  items: LogMessage[];
  total: number;
}

export interface ListFilters {
  phone?: string;
  status?: MessageStatus;
  limit?: number;
  offset?: number;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function listMessages(filters: ListFilters = {}): Promise<ListMessagesResult> {
  const params = new URLSearchParams();
  if (filters.phone) params.set("phone", filters.phone);
  if (filters.status) params.set("status", filters.status);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  const query = params.toString();
  return getJson<ListMessagesResult>(`/api/messages${query ? `?${query}` : ""}`);
}

export function getMessageDetail(id: number): Promise<MessageDetail> {
  return getJson<MessageDetail>(`/api/messages/${id}`);
}
