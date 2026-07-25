import "./theme.css";
import "./style.css";
import type { ListFilters, MessageStatus } from "./api.ts";
import { getMessageDetail, listMessages } from "./api.ts";
import { renderDetail, renderDetailLoading, renderEmptyDetail, renderList } from "./render.ts";

const REFRESH_INTERVAL_MS = 10_000;
const PAGE_SIZE = 50;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="min-h-screen bg-surface-alt">
    <header class="border-b border-gray-300 bg-surface px-6 py-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-h4 text-gray-800">Digico — Message Log</h1>
          <p class="text-small text-gray-500">Inbound WhatsApp → AI call → outbound reply</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            id="phone-filter"
            type="text"
            placeholder="Filter by phone"
            class="rounded-sm border border-gray-300 bg-surface px-3 py-1.5 text-caption text-gray-800 placeholder-gray-400 focus:border-primary focus:outline-none"
          />
          <select
            id="status-filter"
            class="rounded-sm border border-gray-300 bg-surface px-3 py-1.5 text-caption text-gray-800 focus:border-primary focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="received">Received</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <button
            id="refresh-btn"
            type="button"
            class="rounded-sm bg-primary px-4 py-1.5 text-caption font-medium text-white hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>
    </header>
    <main class="flex flex-col gap-4 p-6 lg:flex-row">
      <section class="min-w-0 flex-1 overflow-hidden rounded-sm border border-gray-300 bg-surface shadow-sm">
        <div id="message-list"></div>
      </section>
      <aside class="w-full shrink-0 overflow-hidden rounded-sm border border-gray-300 bg-surface p-6 shadow-sm lg:w-[420px]">
        <div id="message-detail">${renderEmptyDetail()}</div>
      </aside>
    </main>
  </div>
`;

const listEl = document.querySelector<HTMLDivElement>("#message-list")!;
const detailEl = document.querySelector<HTMLDivElement>("#message-detail")!;
const phoneFilterEl = document.querySelector<HTMLInputElement>("#phone-filter")!;
const statusFilterEl = document.querySelector<HTMLSelectElement>("#status-filter")!;
const refreshBtnEl = document.querySelector<HTMLButtonElement>("#refresh-btn")!;

let selectedId: number | null = null;
let phoneDebounce: ReturnType<typeof setTimeout> | undefined;

function currentFilters(): ListFilters {
  const phone = phoneFilterEl.value.trim();
  const status = statusFilterEl.value as MessageStatus | "";
  return {
    phone: phone || undefined,
    status: status || undefined,
    limit: PAGE_SIZE,
  };
}

async function refreshList(): Promise<void> {
  const { items } = await listMessages(currentFilters());
  listEl.innerHTML = renderList(items, selectedId);
}

async function selectMessage(id: number): Promise<void> {
  selectedId = id;
  listEl.innerHTML = renderList((await listMessages(currentFilters())).items, selectedId);
  detailEl.innerHTML = renderDetailLoading();
  const detail = await getMessageDetail(id);
  detailEl.innerHTML = renderDetail(detail);
}

listEl.addEventListener("click", (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>("tr[data-id]");
  if (!row) return;
  const id = Number(row.dataset.id);
  if (Number.isInteger(id)) void selectMessage(id);
});

refreshBtnEl.addEventListener("click", () => void refreshList());

statusFilterEl.addEventListener("change", () => void refreshList());

phoneFilterEl.addEventListener("input", () => {
  clearTimeout(phoneDebounce);
  phoneDebounce = setTimeout(() => void refreshList(), 300);
});

void refreshList();
setInterval(() => void refreshList(), REFRESH_INTERVAL_MS);
