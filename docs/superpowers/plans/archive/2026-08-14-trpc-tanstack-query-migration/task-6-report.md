# Task 6 Report — Delete REST layer & `api.ts`

**Status:** DONE
**Commit:** `0b2e107` — `refactor(trpc): remove REST API routes and api.js` (6 files changed, +4/−392)

## What I implemented

- **Step 1 — server.ts trim** (`apps/whatsapp-webhook/src/server.ts`): removed the four REST route imports and `await register*Routes(app)` calls (orders/products/dealers/messages); kept `registerWebhookRoutes` + `registerEmulatorRoutes`, the `/health` route, the tRPC plugin registration, the `checkEnv` calls, and the console.log lines. The file matches the brief's Step 1 final shape **verbatim** (diff confirmed against the brief's code block).
- **Step 2 — file deletions** (exact brief list):
  - `apps/website/src/api.ts`
  - `apps/whatsapp-webhook/src/routes/orders.ts`
  - `apps/whatsapp-webhook/src/routes/products.ts`
  - `apps/whatsapp-webhook/src/routes/dealers.ts`
  - `apps/whatsapp-webhook/src/routes/messages.ts`
- **Step 5 — commit** with the exact message; staged `git add -A apps/website apps/whatsapp-webhook` only.

After this task Fastify serves only `/webhook`, `/health`, `/api/emulator/*`, and `/trpc` (confirmed by curl + network evidence).

## Verification

### 1. `vp check && vp run -r test && vp run -r build` — GREEN

- `vp check`: 139 files formatted, no lint/type errors in 84 files.
- `vp test`: 9 files — **43 passed / 1 skipped** (the skip is the pre-existing `parse-webhook.test.ts` voice-note test, unrelated).
- `vp run -r build`: utils pack + website `tsc` + website `vite build` all pass. (whatsapp-webhook has no build script — it runs via node type-stripping; its type-check ran under `vp check` with the deleted-route imports already gone.)

### 2. Curl smoke (brief Step 4) — 4/4 PASS

- `GET /trpc/health.ping` → `{"result":{"data":{"ok":true}}}`
- `GET /api/orders` → **404** (REST orders removed)
- `GET /api/emulator/chat?phone=%2B8801711000001` → works, returns chat history
- `GET /webhook` → verify-token flow unchanged (`{"error":"Forbidden: verify token mismatch"}`)

### 3. Browser smoke (real headless Chromium via repo `node_modules/playwright`, against 8787 + 5173) — **21/21 PASS**

Method: stale Docker `digico-frontend`/`digico-backend` stopped, `digico-mariadb` kept as dev DB; servers booted (`node --experimental-strip-types src/server.ts` with root `.env`, `vite --port 5173 --strictPort`); containers restarted afterwards (all healthy, mariadb still up). Smoke script was scratch tooling in the repo root, deleted after the run — nothing committed beyond the brief.

| Check                                                                                                                                                                             | Result          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Dashboard loads orders table                                                                                                                                                      | PASS — 200 rows |
| All 6 status tabs click (All/Pending Review/On-Hold/Confirmed/Processing/Completed)                                                                                               | PASS            |
| Sales channel filter (WhatsApp AI), search input                                                                                                                                  | PASS            |
| Refresh button                                                                                                                                                                    | PASS            |
| Bulk action: select row → "Change status to processing" → Apply                                                                                                                   | PASS            |
| Drawer: **Save Edits** (orders.update)                                                                                                                                            | PASS            |
| Drawer: **Approve & Confirm to WhatsApp** (update + setStatus chain, drawer auto-closes on success = success path)                                                                | PASS            |
| Drawer: **Hold Order** (orders.setStatus) + persisted — order visible under On-Hold tab                                                                                           | PASS            |
| Drawer: **Mark as Completed** on a processing order                                                                                                                               | PASS            |
| Create-order modal: dealer dropdown **186 options**, product **200 options** (tRPC data, not presets); line item added; order created; modal closed                               | PASS            |
| Emulator: dealer dropdown **185 options** (DB, not presets); message sent → appears in chat (POST `/api/emulator/send`)                                                           | PASS            |
| Message log: rows load; phone filter; Refresh                                                                                                                                     | PASS            |
| Network evidence: tRPC calls observed — orders.list, orders.get, orders.update, orders.setStatus, orders.bulkSetStatus, orders.create, dealers.list, products.list, messages.list | PASS            |
| **No non-emulator `/api` REST calls** on the wire (the REST layer is truly gone from the app)                                                                                     | PASS            |
| No unexpected console/page errors                                                                                                                                                 | PASS            |

Notes on flows: the "Move to Processing" button renders **only for status `confirmed`** (`OrderDrawerActionBar.tsx` line 62), and no order in this DB ever reads back as `confirmed` — the pre-existing `mapDigicoStatusToWc("confirmed") → "wc-completed"` mapping (`packages/db/src/orders.ts`) means approved orders surface under **Completed**. This is pre-existing data-layer behavior (shared by the old REST API and tRPC; untouched in this migration), not a Task 6 regression. The `orders.setStatus` mutation path was exercised end-to-end via **Hold Order** (same handler); the Confirmed tab is legitimately empty for this dataset. OPENAI_API_KEY unset → emulator AI reply fails server-side (known, non-regression); inbound recording + reload verified. The mutation flows that were deferred from Task 4 (approve/status/mark-completed) were exercised in the browser for the first time here.

## Files changed

- Deleted: `apps/website/src/api.ts`, `apps/whatsapp-webhook/src/routes/{orders,products,dealers,messages}.ts`
- Modified: `apps/whatsapp-webhook/src/server.ts` (+4/−12, brief-verbatim)

## Self-review findings

- Completeness: all 5 files deleted; server.ts exactly the brief's shape; final repo-wide grep for `routes/orders|products|dealers|messages` and `src/api.ts`/`"../api"` imports → **zero matches**.
- No dead imports, no `any`, no barrel violations introduced (check+type ran clean over the workspace).
- No overbuilding: nothing committed beyond the brief; smoke scratch script removed.

## Issues / concerns

1. **Pre-existing, surfaced during smoke (not a regression):** digico status `confirmed` cannot round-trip through the WooCommerce `joy_posts` mapping (`wc-completed`), so the "Confirmed" tab and the drawer's "Move to Processing" button are unreachable in this dataset. Worth a follow-up (mapping or tab semantics), but out of scope for the REST deletion and identical to old-API behavior.
2. Smoke wrote plan-mandated test data to the dev DB (status changes on ~8 orders across runs, 1 emulator message, 1 manual order).
3. Docker state restored to pre-task (frontend/backend restarted healthy; mariadb untouched).
