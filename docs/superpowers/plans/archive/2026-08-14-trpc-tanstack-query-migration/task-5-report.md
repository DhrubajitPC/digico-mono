# Task 5 Report — Component migration (tRPC + TanStack Query)

**Status:** DONE (one deviation from the brief's file list, required for the brief's own code to compile — see "Concerns").
**Commit:** `70baa4c` — `feat(trpc): migrate components off api.js` (15 files, +110/-75).

## What I implemented

- **Step 1** — Created `apps/website/src/emulator-api.ts` verbatim from the brief: `getJson`/`sendJson` helpers, `getEmulatorChat(phone)` and `sendEmulatorMessage(data)` typed from `@digico/contracts` (`EmulatorChatMessage`).
- **Step 2** — `MessageLogView.tsx`: replaced `listMessages` + hand-rolled `fetchMessages` state with `trpc.messages.list.useQuery()`, a `useMemo` filter over `messagesQuery.data?.items` (phone + status filters kept), and `fetchMessages = () => void utils.messages.list.invalidate()` (`const utils = trpc.useUtils()`). Deleted the old `useCallback`/`useEffect` block, the `setMessages` state, and the `isLoading` state (`isLoading` → `messagesQuery.isFetching` on the Refresh button). `selectedMessage`/filters kept. Imports pruned to `useMemo, useState`.
- **Step 3** — `WhatsAppEmulator.tsx`: imports now `trpc`, `../emulator-api.js` (getEmulatorChat/sendEmulatorMessage), and `Dealer`/`EmulatorChatMessage` from `@digico/contracts`. The `listDealers()` mount effect replaced with `trpc.dealers.list.useQuery()` + sync effect (fallback to presets preserved when the query has no data). Chat/send call sites unchanged.
- **Step 4** — `CreateOrderModal.tsx`: imports now `trpc` + contract types. Mount effect replaced with `trpc.dealers.list.useQuery()`, `trpc.products.list.useQuery()`, `trpc.orders.create.useMutation({ onSuccess: [reset calls incl. setItems/setSelectedSku/setAddQty/setAddPrice/setNotes/setSelectedDealerId, then onSuccess(), onClose()] })`, plus two data-sync effects (brief's code verbatim). Submit handler uses `createMutation.mutateAsync({ dealerId, origin: "manual_sales", notes, items })` with the same `setIsSubmitting` try/finally.
- **Step 5** — All 8 type-only swaps per the brief's table. `OrdersTable.tsx` now does `import type { RouterOutputs } from "@digico/api"` + a local `type ListOrdersResult = RouterOutputs["orders"]["list"];` (type-only — verified `RouterOutputs` is exported by `@digico/api` root; the website never value-imports from `@digico/api`).

## Verification

- **Grep gate**: the literal `grep -rn "api.js" apps/website/src` yields exactly 2 lines, both benign substring matches:
  1. `apps/website/src/api.ts:12` — a doc comment _inside_ api.ts itself (that file is deleted in Task 6).
  2. `apps/website/src/components/WhatsAppEmulator.tsx:4` — the new plan-mandated `import ... from "../emulator-api.js"` (substring of "emulator-api.js").
     Precise grep for the old module's import paths (`from "../api.js"` / `from "../../api.js"`) returns **zero** component references — the gate's intent (nothing imports the old REST module) holds.
- **`vp check`** — green (144 files formatted, no lint/type errors).
- **`vp run -r build`** — green (utils pack + website tsc + website build; all 3 tasks pass).
- **`vp test`** — green: 9 files, 43 passed, 1 skipped (ran because I touched `packages/api` and `packages/db`).
- **Step 7 smoke** — real-browser Playwright smoke (headless Chromium from the repo's `node_modules/playwright`), against `vp run whatsapp-webhook#dev` (8787) + `vp run website#dev` (5173), after stopping the stale Docker containers (restarted afterwards; `digico-mariadb` left running as the dev DB). **15/16 checks passed**:
  - Dashboard loads orders table (200 rows).
  - Emulator: dealer dropdown populated from `/trpc` (**185 options** — DB dealers, not presets); chat history renders; send hits `/api/emulator/send` and the sent message appears in the chat (bubbles 22 → 24).
  - Message Log: loads 11 rows; phone filter narrows; Refresh works.
  - Create Order modal: dealer dropdown **186 options** and product dropdown **200 options** (both from `/trpc`); line item added; submit enabled; modal closes; **top table row changes after refetch** (new order lands at top — verified by row-content change, not just count; list is paginated at 200 so a count check alone would false-pass).
  - Network evidence: the page issued batched `/trpc` calls (`orders.list`, `dealers.list`, `products.list`, `messages.list`) and `orders.create`.
  - The 1 "failed" check is a **pre-existing dev-mode React warning** ("two children with the same key") from the emulator chat — attributed to `ChatWindow`'s `key={msg.id}` where `getEmulatorChatHistory` (packages/db, untouched) generates user-bubble ids (msg ids) and assistant-bubble ids (outbound reply ids) that share a counter (duplicates 2–10 in dev data). Only `ChatWindow`'s import line changed in this task. Out of scope; noted for a follow-up.
- Smoke wrote plan-mandated test data to the dev DB: 1 emulator message + 3 manual-sales orders.

## Files changed

- `apps/website/src/emulator-api.ts` (new)
- `apps/website/src/components/MessageLogView.tsx`
- `apps/website/src/components/WhatsAppEmulator.tsx`
- `apps/website/src/components/CreateOrderModal.tsx`
- `apps/website/src/components/shared/LineItemsEditor.tsx`
- `apps/website/src/components/dashboard/OrdersTable.tsx`
- `apps/website/src/components/order-review/WhatsAppPreviewBox.tsx`, `OrderContextPane.tsx`, `OrderDrawerActionBar.tsx`
- `apps/website/src/components/emulator/DealerSelector.tsx`, `ChatWindow.tsx`, `ChatBubble.tsx`
- **Beyond the brief's file list (required to compile — see Concerns):**
  - `packages/db/src/logs.ts` — typed `listMariaDbMessages`'s mapped rows as `LogMessage[]` and added `rawPayload: null` (raw payloads are not persisted in `joy_whatsapp_messages`).
  - `packages/contracts/src/index.ts` — `LogMessage.rawPayload: unknown` → `rawPayload?: unknown` (matches reality: never persisted, never returned; same convention as `EmulatorChatMessage.rawPayload?`).
  - `packages/api/src/routers/messages.ts` — `messages.list` input schema made `.optional()` so the brief's 0-arg `useQuery()` compiles (matches old REST `listMessages()` semantics).

## Self-review findings

- All brief Steps 1–5 implemented; component code matches the brief verbatim (with one formatter-driven exception, below).
- No dead code: old fetch blocks, `setMessages`/`isLoading` states, and unused React imports removed from the migrated components.
- oxfmt stripped the redundant `void` in the Refresh button's `onClick` (`() => fetchMessages()` — `fetchMessages` returns undefined, behavior identical); formatting is stable across repeated `vp check` runs.
- Behavior deltas vs the old REST code, both direct consequences of the brief's verbatim code (documented, not "fixed"):
  - `CreateOrderModal` no longer preselects the first product's SKU/price when the modal opens, and its queries now run on mount rather than on each open.
  - `MessageLogView` fetch error logging (`console.error`) is gone with the fetch block (tRPC queries surface errors through the query state).

## Concerns

1. **Deviation from the brief's file list / commit staging**: the brief's Step 2 code (`trpc.messages.list.useQuery()` with no input) and the `setSelectedMessage(m)` wiring cannot compile against the live `messages.list` router as it existed. Three pre-existing defects in the Task 3/4 tRPC layer blocked it, and each was fixed at its source with the minimal change (rather than casting in the component, which would have papered over the boundary with a lie):
   - `listMariaDbMessages` mapped raw `mysql.RowDataPacket` rows (all-`any` fields, no `rawPayload`) into the tRPC output — any-leak + structurally incompatible with `LogMessage`.
   - The `messages.list` input schema was required, so `useQuery()` with no args was a type error.
   - tRPC v11's `Serialize` makes `unknown`-typed output fields optional (`rawPayload?: unknown`), so the contract's required `rawPayload: unknown` could never be satisfied by any router output.
     These three files are staged in the same single commit (message kept exact) because the branch otherwise fails `vp check`.
2. **Residual**: `getMariaDbMessageDetail` (messages.get) still maps untyped rows (no `rawPayload`) — nothing in the website consumes `trpc.messages.get`, so I left it; Task 6 or a follow-up should type it the same way for consistency.
3. **Pre-existing duplicate-key warning** in the emulator chat (see Verification) — data-level, dev-mode only.
4. Smoke created 3 test orders + 1 emulator message in the dev DB (plan-mandated, expected).
5. `OPENAI_API_KEY` is not set in this environment, so the emulator's DeepSeek AI reply fails server-side; inbound message recording and chat reload work (verified).
