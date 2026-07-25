import type { AiCall, LogMessage, MessageDetail, MessageStatus, OutboundReply } from "./api.ts";
import { escapeHtml, formatTime, prettyJson, truncate } from "./format.ts";

const STATUS_BADGE_CLASS: Record<MessageStatus, string> = {
  received: "bg-gray-100 text-gray-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

function statusBadge(status: MessageStatus | "sent"): string {
  const cls = status === "sent" ? STATUS_BADGE_CLASS.completed : STATUS_BADGE_CLASS[status];
  return `<span class="inline-flex items-center rounded-pill px-3 py-1 text-small font-medium ${cls}">${status}</span>`;
}

export function renderRow(message: LogMessage, selectedId: number | null): string {
  const preview = escapeHtml(truncate(message.resolvedText ?? message.inboundText));
  const dealer = escapeHtml(message.contactName ?? message.fromPhone);
  const selectedClass = message.id === selectedId ? "bg-surface-alt" : "";
  return `
    <tr data-id="${message.id}" class="cursor-pointer border-b border-gray-100 hover:bg-surface-alt ${selectedClass}">
      <td class="px-4 py-3 text-small text-gray-500 whitespace-nowrap">${formatTime(message.receivedAt)}</td>
      <td class="px-4 py-3 text-caption">
        <div class="font-medium text-gray-800">${dealer}</div>
        <div class="text-small text-gray-500">${escapeHtml(message.fromPhone)}</div>
      </td>
      <td class="px-4 py-3 text-caption text-gray-700">${preview}</td>
      <td class="px-4 py-3 text-small text-gray-500 uppercase">${message.kind}</td>
      <td class="px-4 py-3">${statusBadge(message.status)}</td>
    </tr>`;
}

export function renderList(items: LogMessage[], selectedId: number | null): string {
  if (items.length === 0) {
    return `<div class="p-10 text-center text-caption text-gray-500">No messages logged yet — waiting for WhatsApp traffic.</div>`;
  }
  return `
    <table class="w-full border-collapse">
      <thead>
        <tr class="border-b border-gray-300 text-left text-small text-gray-500">
          <th class="px-4 py-2 font-medium">Time</th>
          <th class="px-4 py-2 font-medium">Dealer</th>
          <th class="px-4 py-2 font-medium">Message</th>
          <th class="px-4 py-2 font-medium">Kind</th>
          <th class="px-4 py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>${items.map((m) => renderRow(m, selectedId)).join("")}</tbody>
    </table>`;
}

function renderAiCall(call: AiCall): string {
  return `
    <div class="rounded-sm border border-gray-300 p-4">
      <div class="mb-2 flex items-center justify-between text-small text-gray-500">
        <span>${escapeHtml(call.provider)} · ${escapeHtml(call.model)}</span>
        <span>${call.latencyMs}ms</span>
      </div>
      <details class="mb-2">
        <summary class="cursor-pointer text-small text-gray-500">Request messages</summary>
        <pre class="mt-2 overflow-x-auto rounded-sm bg-surface-alt p-3 text-small">${prettyJson(call.requestMessages)}</pre>
      </details>
      ${
        call.error
          ? `<div class="rounded-sm bg-red-50 p-3 text-caption text-red-700">${escapeHtml(call.error)}</div>`
          : `<div class="rounded-sm bg-surface-alt p-3 text-caption text-gray-800">${escapeHtml(call.responseText ?? "—")}</div>`
      }
    </div>`;
}

function renderOutboundReply(reply: OutboundReply): string {
  return `
    <div class="rounded-sm border border-gray-300 p-4">
      <div class="mb-2 flex items-center justify-between text-small text-gray-500">
        <span>to ${escapeHtml(reply.toPhone)}</span>
        ${statusBadge(reply.status)}
      </div>
      <div class="rounded-sm bg-surface-alt p-3 text-caption text-gray-800">${escapeHtml(reply.replyText)}</div>
      ${reply.error ? `<div class="mt-2 rounded-sm bg-red-50 p-3 text-caption text-red-700">${escapeHtml(reply.error)}</div>` : ""}
    </div>`;
}

function section(title: string, body: string): string {
  return `
    <div>
      <h3 class="mb-2 text-small font-medium tracking-wide text-gray-500 uppercase">${title}</h3>
      ${body}
    </div>`;
}

export function renderEmptyDetail(): string {
  return `<div class="p-10 text-center text-caption text-gray-500">Select a message to see the full round trip.</div>`;
}

export function renderDetailLoading(): string {
  return `<div class="p-10 text-center text-caption text-gray-500">Loading…</div>`;
}

export function renderDetail(detail: MessageDetail): string {
  const { message, aiCalls, outboundReplies } = detail;

  const header = `
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <h2 class="text-h4">${escapeHtml(message.contactName ?? message.fromPhone)}</h2>
        ${statusBadge(message.status)}
      </div>
      <div class="mt-1 text-small text-gray-500">
        ${escapeHtml(message.fromPhone)} · ${escapeHtml(message.messageId)} · ${formatTime(message.receivedAt)}
      </div>
      ${
        message.error
          ? `<div class="mt-3 rounded-sm bg-red-50 p-3 text-caption text-red-700">${escapeHtml(message.error)}</div>`
          : ""
      }
    </div>`;

  const inbound = section(
    "Inbound",
    `<div class="rounded-sm bg-surface-alt p-3 text-caption text-gray-800">${escapeHtml(message.inboundText ?? message.transcript ?? "—")}</div>
     ${
       message.kind === "audio"
         ? `<div class="mt-2 text-small text-gray-500">Voice note — transcribed to: ${escapeHtml(message.transcript ?? "—")}</div>`
         : ""
     }`,
  );

  const ai = section(
    "AI calls",
    aiCalls.length > 0
      ? `<div class="flex flex-col gap-3">${aiCalls.map(renderAiCall).join("")}</div>`
      : `<div class="text-caption text-gray-500">No AI call recorded.</div>`,
  );

  const outbound = section(
    "Outbound reply",
    outboundReplies.length > 0
      ? `<div class="flex flex-col gap-3">${outboundReplies.map(renderOutboundReply).join("")}</div>`
      : `<div class="text-caption text-gray-500">No reply sent yet.</div>`,
  );

  const raw = `
    <details>
      <summary class="cursor-pointer text-small text-gray-500">Raw webhook payload</summary>
      <pre class="mt-2 overflow-x-auto rounded-sm bg-surface-alt p-3 text-small">${prettyJson(message.rawPayload)}</pre>
    </details>`;

  return `${header}<div class="flex flex-col gap-5">${inbound}${ai}${outbound}${raw}</div>`;
}
