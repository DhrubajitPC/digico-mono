import type { EmulatorChatMessage } from "@digico/contracts";

// The emulator endpoints feed the webhook AI pipeline and stay REST (spec §2.4).

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function sendJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getEmulatorChat(
  phone: string,
): Promise<{ fromPhone: string; messages: EmulatorChatMessage[] }> {
  const params = new URLSearchParams({ phone });
  return getJson<{ fromPhone: string; messages: EmulatorChatMessage[] }>(
    `/api/emulator/chat?${params.toString()}`,
  );
}

export function sendEmulatorMessage(data: {
  fromPhone: string;
  contactName?: string;
  text: string;
}): Promise<{ success: boolean; messageId: string; metaPayload: unknown }> {
  return sendJson<{ success: boolean; messageId: string; metaPayload: unknown }>(
    "/api/emulator/send",
    data,
  );
}
