# tRPC + TanStack Query Migration — Spec

**Status:** Approved
**Date:** 2026-08-14
**Scope:** Replace the hand-rolled REST fetch layer (`apps/website/src/api.ts` + custom hooks) with
tRPC v11 procedures served by the existing Fastify app, paired with TanStack Query v5 on the React
client. Behavior-preserving except the explicit hardening list in §5.

---

## 1. Context

Current state after the code-structure refactor (see `docs/superpowers/plans/archive/2026-08-14-code-structure-plan.md`):

- **Server:** Fastify 5 REST API in `apps/whatsapp-webhook` — hand-written route handlers, no
  runtime input validation, response shapes typed only by inference.
- **Shared types:** `@digico/contracts` — types-only, imported by frontend, backend, and `@digico/db`.
- **Client:** React 19 + Vite. `apps/website/src/api.ts` is a hand-rolled `fetch` wrapper (~200
  lines) whose result interfaces (`ListOrdersResult`…) duplicate server response shapes.
  `useOrders`/`useOrderReview` hand-roll loading state, refetch, and post-mutation refresh.
- **No runtime validation anywhere** — the server casts `req.body as CreateOrderBody` and
  hand-checks `Number.isInteger(id)`.

This is the canonical tRPC profile: same monorepo, TS on both sides of the wire, shared contracts
package, internal-only API consumers. tRPC's React client is built on TanStack Query, so the
pairing is the standard setup, not an add-on.

## 2. Decision

1. **tRPC v11 + TanStack Query v5 + zod v4.** Procedures replace the REST routes; TanStack Query
   replaces the hand-rolled hook state; zod input schemas replace the cast-and-pray boundary.
2. **New package `packages/api` (`@digico/api`)** owns the router + input schemas. `apps/website`
   imports **only the `AppRouter` type** from it (`import type`) — the router imports `@digico/db`
   (mysql2), which must never enter the browser bundle.
3. **Router mounted on the existing Fastify app at `/trpc`** via `@trpc/server/adapters/fastify`.
   One process, same deploy unit, no infra change. Dev proxy adds `/trpc` next to `/api`.
4. **Webhook ingestion stays REST.** `/webhook` (Meta callbacks) is server-to-server — not tRPC's
   job. `/api/emulator/*` also stays REST: `emulator/send` feeds `handleIncomingMessage` (the
   webhook AI pipeline, which lives in the app). Moving that pipeline into a package so the
   procedure can call it is a service-extraction with its own layering questions — deferred (§7).
   The client keeps a 5-line helper for these two calls instead of `api.ts`.
5. **`@digico/contracts` stays** (db + webhook still use it); its API-shape types are superseded by
   tRPC-inferred types on the client, but nothing is deleted from it.

## 3. API surface mapping

| REST endpoint (today)              | tRPC procedure                            | Input (zod)                                     | Output                              |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| `GET /api/orders`                  | `orders.list`                             | `{status? ("all"\|enum), origin?, search?}`     | `{items, total, counts}` (7 keys)   |
| `GET /api/orders/:id`              | `orders.get`                              | `{id: int>0}`                                   | `Order & {history: []}`             |
| `POST /api/orders`                 | `orders.create`                           | `{dealerId?, origin?, notes?, items[]}`         | `Order`                             |
| `PATCH /api/orders/:id`            | `orders.update`                           | `{id, notes?, proposedMessage?, items?}`        | `Order`                             |
| `POST /api/orders/:id/status`      | `orders.setStatus`                        | `{id, status: enum, reason?, proposedMessage?}` | `Order`                             |
| `POST /api/orders/bulk-status`     | `orders.bulkSetStatus`                    | `{orderIds: int[]>0, status: enum, reason?}`    | `{success, count}`                  |
| `GET /api/products`                | `products.list`                           | —                                               | `Product[]`                         |
| `GET /api/dealers`                 | `dealers.list`                            | —                                               | `Dealer[]`                          |
| `GET /api/messages`                | `messages.list`                           | `{phone?, status?, limit?, offset?}`            | `{items, total}`                    |
| `GET /api/messages/:id`            | `messages.get`                            | `{id: int>0}`                                   | detail                              |
| `GET /api/emulator/chat`           | stays REST (helper `getEmulatorChat`)     | —                                               | `{fromPhone, messages}`             |
| `POST /api/emulator/send`          | stays REST (helper `sendEmulatorMessage`) | —                                               | `{success, messageId, metaPayload}` |
| `GET/POST /webhook`, `GET /health` | stays REST                                | —                                               | —                                   |

Procedure outputs must keep today's exact payload shapes, including quirks:

- `orders.get` returns `history: []` (always empty today).
- `orders.create` hardcodes phone/customer (`+8801700000000` / `"Manual Sales Dealer"`) and reads
  only `items` + `notes`; `dealerId`/`origin` are accepted in the schema and dropped — same as
  today's route. (Known issue, deferred — §7.)
- `orders.list` accepts `origin` and ignores it — same as today's route.

## 4. Error mapping

| Today (REST)                             | tRPC equivalent                                      |
| ---------------------------------------- | ---------------------------------------------------- |
| 400 `{error}` on bad id                  | `TRPCError BAD_REQUEST` (zod rejects non-int/≤0 ids) |
| 404 `{error: "Order not found"}`         | `TRPCError NOT_FOUND`                                |
| 500 `{error: message}` on `MariaDbError` | `TRPCError INTERNAL_SERVER_ERROR` with same message  |
| unhandled error → 500                    | rethrow (Fastify adapter → 500)                      |

The client only ever `console.error`s failures today (no error UI), so error-code mapping is
observable-behavior-neutral.

## 5. Intentional behavior changes (hardening)

The following are stricter-than-today on purpose; everything else is byte-for-byte preserved:

1. **Status values validated** against the `OrderStatusType` enum. Today `status: "garbage"` flows
   into SQL; now it fails at the boundary with `BAD_REQUEST`.
2. **`limit`/`offset` on `messages.list`** must be ints (today `Number("abc")` → `NaN` into SQL).
   The client never sends them.
3. **`GET /api/emulator/history` alias** is dropped (no client uses it); `chat` remains.

## 6. Risks

- **tRPC requires `strict: true`** — the website tsconfig is currently non-strict. Enable in Task 1;
  expect 0–2 latent nullability fixes, no runtime change.
- **Type-stripping runtime (Node 22 `--experimental-strip-types`):** tRPC/zod are plain runtime JS;
  no `enum`/`namespace` in new code; explicit `.ts` extensions in relative imports (already the
  repo rule).
- **`import type` discipline:** any future value import of `@digico/api` from the website would
  pull mysql2 into the client bundle. Guarded by convention + review; lint rule exists for barrel
  paths, not value-vs-type.
- **React Query caching semantics** differ slightly from today's refetch-on-mount: mutations
  invalidate queries explicitly; stale data may briefly show after an action. Equivalent UX to
  today's manual `fetchOrders()` calls.

## 7. Deferred (explicitly out of scope)

- Moving the webhook AI pipeline (`services/*`) into a package — prerequisite for converting
  `emulator/send` to tRPC; own plan.
- Auth layer (tRPC context stays empty; middleware slots in here later).
- Client-side test infrastructure (frontend verification = `vp check` + build + manual smoke).
- The dropped-`dealerId` manual-order observation (needs a product decision).
- Drizzle adoption, Fastify schema validation on the remaining REST routes.

## 8. Verification

Each task: `vp check` (lint/format/type-check), `vp test` (router unit tests via
`appRouter.createCaller` with `vi.mock("@digico/db")` — the "tests at the seams" pattern from the
code-structure refactor), and `vp run -r build` for the website. Manual smoke: dashboard tabs/
filters/refresh/bulk actions, order drawer (edit/save/approve/status/completed), create-order
modal, emulator chat. Final task: full-stack curl smoke against `/trpc` after REST removal.
