# Digico Code Structure & Readability Plan

**Status:** Approved design — implementation happens later, one phase per PR.
**Date:** 2026-08-14
**Scope:** Behavior-preserving restructuring of the monorepo (no API shape changes, no visual changes).

---

## 1. Goal

Make the codebase more structured and readable by fixing layer violations, type duplication, god
functions/components, dead code, and inconsistent conventions — without changing any behavior.
Every phase lands as its own small PR, verified by `vp check`, `vp test`, and `vp run -r build`.

## 2. Target-State Rules

These rules are the "why" behind every phase. After the refactor, the codebase should obey them:

1. **Layering** — apps depend on packages; packages never depend on apps. Raw SQL lives only in
   `packages/db`; routes and services never touch `joy_*` tables directly.
2. **One source of truth for contracts** — a single shared types package (`@digico/contracts`)
   consumed by the frontend, backend, and db package. No mirrored interfaces.
3. **One mechanism per concern** — one pool accessor, one order-payload extraction path, one
   emulator history query path.
4. **Containers vs. presentational** — data fetching lives in hooks; components stay declarative.
   No file over ~250 lines without a strong reason.
5. **Tokens over literals** — brand/status colors come from `theme.css` tokens, not raw hex
   literals like `text-[#ec2839]`.
6. **No dead code, no disguised mock data** — nothing committed that isn't imported; placeholder
   content is explicitly labeled as such.

## 3. Audit Summary (current state)

| #   | Problem                                              | Evidence                                                                                                                                                                                                                       | Addressed in |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 1   | Raw SQL in routes/services instead of the db package | `intent-router.ts:38` updates `joy_posts` directly; `emulator.ts:31-58` re-implements chat-history queries that `listMariaDbMessages` / `getMariaDbMessageDetail` already do                                                   | Phase 2      |
| 2   | Frontend/backend type duplication with drift         | `Order`/`Product`/`Dealer` in both `packages/db` (`WcOrder`…) and `apps/website/src/api.ts`; `EmulatorChatMessage` defined twice (`routes/emulator.ts`, `api.ts`)                                                              | Phase 0      |
| 3   | God functions                                        | `handleIncomingMessage` (`handle-message.ts:127-237`): 110-line 5-step pipeline; `WhatsAppEmulator.tsx` (430 lines); `OrderReviewDrawer.tsx` (270 lines)                                                                       | Phases 4–5   |
| 4   | Unsafe typing                                        | `any[]` tool calls, `req.body as any`, untyped `JSON.parse` of tool-call args despite `DraftOrderPayload` existing                                                                                                             | Phase 3      |
| 5   | Duplication                                          | `isEmulator` computed twice; `getMariaDbPool()` and `getDb()` both exist; two parallel order-extraction mechanisms (tool-call vs `[ORDER_DATA]` tag); line-item UI duplicated in `CreateOrderModal` + `EditableLineItemsTable` | Phases 2–5   |
| 6   | Dead/stub code                                       | `packages/utils` is an unused placeholder (`fn()` → "Hello, tsdown!"); committed `drizzle/` migrations never imported; `design-system/tokens.*` explicitly disclaimed by DESIGN.md                                             | Phases 1, 7  |
| 7   | Mock data in production UI                           | `OrderContextPane.tsx:66-77`: hardcoded Bengali transcript + fake "Confidence 94%"                                                                                                                                             | Phase 7      |
| 8   | Theming inconsistency                                | `--color-primary` token exists in `theme.css` but components hardcode `text-[#ec2839]`                                                                                                                                         | Phase 6      |
| 9   | Thin test coverage                                   | 2 test files, frontend has zero                                                                                                                                                                                                | Phase 8      |

## 4. Phases

### Phase 0 — Shared contracts package

**Motivation:** every other phase needs a single source of truth for domain types.

- Create `packages/contracts` (`@digico/contracts`), modeled on `packages/ui`:
  - `package.json` with `main`/`exports` → `./src/index.ts`, added to the workspace via
    `pnpm-workspace.yaml` glob (`packages/*` already covers it).
  - `src/index.ts` exporting the canonical domain types:
    `Order`, `OrderItem`, `Dealer`, `Product`, `LogMessage`, `EmulatorChatMessage`,
    `DraftOrderPayload`, `OrderStatusType`, `OrderOriginType`, `MessageKind`.
- Reconcile the two existing `Order` shapes into one canonical type. Prefer the website
  `api.ts` shape where fields differ (it is the HTTP contract); keep db-only fields
  (`origin`, `notes`, `approvedBy`…) and default the rest. Let compiler errors surface drift.
- `packages/db` re-exports from `@digico/contracts` (keep `WcOrder` as a re-exported type alias so
  existing imports keep compiling; renaming `WcOrder` → `Order` at call sites is optional and can
  happen opportunistically).
- `apps/website/src/api.ts` imports from `@digico/contracts`; delete the local interface copies.

**Verify:** `vp check` passes across all packages; no runtime behavior change.

### Phase 1 — Utils consolidation

**Motivation:** `packages/utils` is a stub with placeholder code while the website carries a
duplicate `format.ts`.

- Rename package to `@digico/utils`; clean the boilerplate `package.json` (name, `private: true`,
  remove placeholder author/repository/license fields; align `exports` to `./src/index.ts` like
  the other packages).
- Move `CURRENCY_SYMBOL`, `formatCurrency`, `formatTime`, `truncate` from
  `apps/website/src/format.ts` into `packages/utils/src/`; delete `format.ts` and update the
  ~8 importing components.
- Delete the placeholder `fn()` and its test; add a test for the moved format functions.
- `packages/utils` becomes a dependency of `apps/website`.

**Verify:** `vp check` + `vp test` + website build.

### Phase 2 — Enforce layering (raw SQL → db package)

**Motivation:** routes and services bypass the db package, duplicating query logic.

- `packages/db/src/orders.ts`: add `cancelMariaDbOrder(orderId)` — a thin wrapper around
  `updateMariaDbOrderStatus(orderId, "cancelled", …)` (equivalent SQL: sets `post_status` to
  `wc-cancelled`).
- `intent-router.ts`: call `cancelMariaDbOrder` instead of the raw `UPDATE joy_posts …`;
  drop the `getMariaDbPool` import.
- `packages/db/src/logs.ts`: add `getEmulatorChatHistory(fromPhone)` — move the query + assembly
  logic (messages + ai_calls + outbound_replies → `EmulatorChatMessage[]`) out of
  `routes/emulator.ts`, reusing `listMariaDbMessages`/`getMariaDbMessageDetail` internals where
  possible.
- `routes/emulator.ts`: use the new db functions; remove the inline SQL, the `mysql2` import, and
  the duplicate `EmulatorChatMessage` interface (import from `@digico/contracts`).
- `packages/db/src/client.ts`: keep `getMariaDbPool()`; delete the `getDb()`/`Db` alias and update
  any references.
- Also in this phase: the `fetchMariaDbOrderById` O(N) → single-row fix (see §5).

**Verify:** `vp test`; manual curl smoke test of `GET /api/emulator/chat` and the cancel flow.

### Phase 3 — Type safety pass

**Motivation:** untyped boundaries hide bugs and make the pipeline hard to read.

- `order-tools.ts`: add `parseDraftOrderPayload(json: string | unknown): DraftOrderPayload | null`
  (validated parse: required `productName`/`quantity`/`unitPrice`/`totalAmount`).
- `deepseek.ts`: export the tool-call type (`DeepSeekToolCall`) instead of relying on inline
  structural types; use it in `DeepSeekReplyResult`.
- `handle-message.ts`: type `productsList: WcProduct[]`, `dealerInfo: WcDealer | null`,
  `deepseekResult.toolCalls` via `DeepSeekToolCall`; route tool-call args and the `[ORDER_DATA]`
  fallback through `parseDraftOrderPayload`.
- `parse-webhook.ts`: export `isEmulatorMessage(message: IncomingWhatsAppMessage)`; replace the
  two inline `isEmulator` computations in `handle-message.ts`.
- `routes/orders.ts`: replace `req.body as any` with typed body interfaces
  (`CreateOrderBody`, `UpdateOrderBody`, `BulkStatusBody`).
- Also in this phase: the error-strategy standardization (throw vs `null`, see §5).

**Verify:** `vp check` (type-aware lint) + tests.

### Phase 4 — Decompose `handleIncomingMessage`

**Motivation:** the 110-line pipeline monolith mixes transcription, routing, RAG, LLM, tool
execution, and reply sending — steps that should be individually testable.

Split `handle-message.ts` into a named pipeline, each stage a small typed function:

1. `resolveUserText(log, message)` — text passthrough or transcribe (exists; keep).
2. `routeIntent(userText, fromPhone)` — deterministic interceptor (exists; keep).
3. `buildPromptContext(message)` — RAG product search + dealer lookup (extracted from Step 2).
4. `generateReply(log, userText, context, chatHistory)` — DeepSeek call + ai-call logging
   (extracted from Step 3).
5. `extractOrderPayload(reply, toolCalls)` — **unified** order extraction: processes both
   `draft_order` tool calls and the `[ORDER_DATA: …]` tag through `parseDraftOrderPayload`
   (replaces the two duplicated blocks in Steps 4/5), also strips the tag from the reply.
6. `sendReply(log, message, reply)` — WhatsApp send + outbound-reply logging + final status.

`handleIncomingMessage` becomes a thin orchestrator calling the stages in order. `PipelineLog`
stays put (or moves to `pipeline/log.ts` — no behavioral change either way). Each stage is
unit-testable without a live DeepSeek/Meta connection.

**Verify:** existing webhook tests + new stage-level tests (Phase 8).

### Phase 5 — Decompose frontend containers

**Motivation:** three components mix data fetching, mutation state, and layout.

- `WhatsAppEmulator.tsx` (430 lines) → split into:
  - `components/emulator/DealerSelector.tsx` (dealer dropdown + phone/name inputs)
  - `components/emulator/QuickPresets.tsx`
  - `components/emulator/PayloadInspector.tsx`
  - `components/emulator/ChatWindow.tsx` with `ChatBubble.tsx` (message list, typing indicator,
    input bar)
  - `WhatsAppEmulator.tsx` keeps only state + coordination (~100 lines).
- `hooks/useOrderReview.ts` — extracts order + product loading, editable items, proposed message,
  notes, and the five mutation handlers (save / approve-and-send / set-status / mark-completed)
  from `OrderReviewDrawer.tsx`; the drawer becomes presentational.
- `hooks/useOrders.ts` — extracts fetch, tab/search/origin state, row selection, and bulk actions
  from `OrdersDashboard.tsx`.
- Shared `components/shared/LineItemsEditor.tsx` — one component used by both `CreateOrderModal`
  (add-only mode) and the order review drawer (editable qty/price mode), replacing the duplicated
  product-picker + items-table UI.
- Stretch (optional): same hook treatment for `MessageLogView`.

**Verify:** `vp check` + `vp run -r build`; manual spot-check of dashboard, drawer, emulator.

### Phase 6 — Theming consistency

**Motivation:** the brand token exists but components hardcode the hex.

- Replace `text-[#ec2839]` / `bg-[#ec2839]` / `focus:ring-[#ec2839]` / `border-[#ec2839]` with
  Tailwind theme tokens (`text-primary`, `bg-primary`, …) throughout `apps/website`.
- Extend `theme.css` `@theme` with tokens only where DESIGN.md defines a semantic color not already
  a Tailwind built-in (the DESIGN.md status palette maps to built-in `amber-500`/`emerald-500`/
  `blue-500`/`teal-600`/`rose-500` — those stay as built-in classes).
- Add `--color-primary-hover: #d41f30` for the button hover if needed by `packages/ui`.

**Verify:** zero visual change — screenshot-compare the dashboard/drawer/emulator before/after.

### Phase 7 — Dead code & placeholder cleanup

**Motivation:** committed artifacts that are unused or misleading.

- Delete `apps/whatsapp-webhook/drizzle/**` (verified: Drizzle is never imported anywhere).
- `OrderContextPane.tsx`: extract the hardcoded transcript and "Confidence 94%" into a single
  `MOCK_WHATSAPP_TRANSCRIPT` / `MOCK_AI_INTENT` constant at the top of the file with a loud
  comment — `// PLACEHOLDER: real data from joy_whatsapp_messages not yet wired into this drawer.`
  (decision: mark as placeholder, do not wire real data in this plan).
- `design-system/`: add a `README.md` stating that `tokens.json`/`tokens.css` are a storefront
  extraction kept for reference only; the implemented system's source of truth is
  `DESIGN.md` + `apps/website/src/theme.css`.

**Verify:** `vp check` + tests still green after deletions; grep confirms no dangling imports.

### Phase 8 — Tests at the seams

**Motivation:** the refactor creates clean seams; lock them in with tests so future work stays
structured.

- `packages/utils/tests`: format functions.
- `apps/whatsapp-webhook/tests`:
  - `extract-order-payload.test.ts` — tool-call args, `[ORDER_DATA]` tag, malformed JSON,
    tag-stripping.
  - `intent-router.test.ts` — status pattern (`#ORD-123`, `status 123`), cancel pattern, no-match.
  - `order-tools.test.ts` — price override against catalog, no-match warning path.
  - `parse-draft-order-payload.test.ts` — required-field validation.
- Use Vitest module mocking (`vi.mock("@digico/db")`) for db-dependent stages; no live DB needed.

**Verify:** `vp test` green; `vp check` green.

## 5. Bundled small fixes (behavior-preserving)

- `fetchMariaDbOrderById` is O(N) (loads all 200 orders then finds) → single-row query
  (`WHERE ID = ? AND post_type = 'shop_order'`), keeping the same return shape. (Phase 2)
- Error-strategy consistency: `createMariaDbOrder`/`updateMariaDbOrder*` currently swallow errors
  and return `null`, while fetch functions throw. Standardize on **throwing** with a typed
  `MariaDbError`, and let callers catch at the boundary — except where `null` is part of the
  contract (`fetchMariaDbOrderById` → `null` when not found). (Phase 3)

## 6. Observations (noted, not planned)

- `createOrder` in `api.ts` sends `dealerId`, but `POST /api/orders` ignores it and hardcodes
  phone/customer — the manual-order flow may be dropping dealer context. Worth a product
  decision later.
- `GET /api/orders` fetches the full order list twice (once filtered, once for counts).
- `GET /api/orders/:id` returns `history: []` — the field is always empty.

## 7. Deferred (future work, explicitly out of scope)

- **Drizzle ORM adoption** for `packages/db` — would replace the handwritten SQL/mapping layer
  (the committed `drizzle/` migrations were never wired in). High regression risk on the
  WooCommerce schema; revisit after this refactor.
- **Fastify schema validation** (typed request/response schemas) on all routes.
- **Broader route-level test coverage** (e.g. `routes/*` handlers with mocked db).

## 8. Execution workflow

For each phase:

1. Branch off `main`: `feat/code-structure-phase-N`.
2. Apply the changes listed for the phase only.
3. Run `vp check && vp test && vp run -r build`; fix until green.
4. Open a PR; the diff should be reviewable (< ~500 lines).

Phases are ordered by dependency: contracts → utils → layering → types → pipeline → UI →
theming → cleanup → tests. Phase 0 unlocks the rest; phases 2–5 are the structural core.

## 9. Risks

- **WooCommerce raw SQL is fragile.** Phase 2 must preserve exact SQL semantics; guard with the
  existing tests + manual curl smoke checks.
- **Type unification (Phase 0) may surface real drift** between the db and website `Order`
  shapes. Reconcile carefully — the website shape wins where they differ; do not "fix" drift by
  changing API responses (that's behavior change, out of scope).
- **No API response shapes change** — verified by keeping `api.ts` call signatures stable.
