# Task 3 Report: Remaining procedures + Fastify integration

**Status:** DONE_WITH_CONCERNS
**Commit:** `9071e1a` feat(trpc): mount router on Fastify at /trpc with remaining procedures

## What I implemented

- `packages/api/src/routers/products.ts` — `products.list` (verbatim from brief)
- `packages/api/src/routers/dealers.ts` — `dealers.list` (verbatim)
- `packages/api/src/routers/messages.ts` — `messages.list` (filter passthrough) + `messages.get` (NOT_FOUND when missing) (verbatim)
- `packages/api/tests/read-routers.test.ts` — 5 tests, brief content with the sanctioned `vite-plus/test` import adaptation
- `packages/api/src/router.ts` — registers all 5 routers + `RouterInputs`/`RouterOutputs` exports (brief content, one required fix, see Deviations)
- `packages/api/src/index.ts` — appended `export type { RouterInputs, RouterOutputs }`
- `apps/whatsapp-webhook/src/server.ts` — mounted `fastifyTRPCPlugin` at `/trpc` per brief diff (REST routes still registered; removed in Task 6)
- `apps/website/vite.config.ts` — added `"/trpc": "http://localhost:8787"` to `server.proxy`

## Tests (TDD evidence)

- Step 3 (RED): **Not demonstrable.** Ran `vp run --filter @digico/api test` → 12/12 passed immediately. Cause: brief's own ordering creates routers (Step 1) before tests (Step 2), and the tests import `../src/routers/*.ts` directly with `@digico/db` mocked — they never depend on `appRouter` registration. This is a brief-internal inconsistency, not a code issue.
- Step 5 (GREEN): 12/12 pass (7 orders + 5 read), output pristine; `vp check` green — 142 files formatted, 87 files lint/type clean (repo-wide, ran after all edits).
- Re-ran both after the type-import fix: 12/12 and `vp check` still green.

## Smoke test (Step 8)

Server started on port 8790 (see Concerns — 8787 is occupied by a stale Docker instance of the old app). MariaDB was reachable.

1. `GET /trpc/health.ping` → `{"result":{"data":{"ok":true}}}` — **exact brief match**.
2. `POST /trpc/orders.list` → 405 error envelope `METHOD_NOT_SUPPORTED` — tRPC v11 default: queries are GET-only. GET form `/trpc/orders.list?input={"json":{}}` → `{"result":{"data":{"items":[...],"total":N,"counts":{...}}}}` with live DB data.
3. `POST /trpc/orders.setStatus` with bogus status → error envelope, zod validation errors, `data.code: "BAD_REQUEST"`, httpStatus 400 — **brief expectation met**.
4. `GET /api/orders` → real order data — REST untouched, still works.

## Files changed (all committed)

- Added: `packages/api/src/routers/products.ts`, `dealers.ts`, `messages.ts`, `packages/api/tests/read-routers.test.ts`
- Modified: `packages/api/src/router.ts`, `packages/api/src/index.ts`, `apps/whatsapp-webhook/src/server.ts`, `apps/website/vite.config.ts` (8 files, +126/-0)

## Deviations from brief

1. Test import `vite-plus/test` (sanctioned, as in Task 2).
2. Test command `vp run --filter @digico/api test` (sanctioned — `-r` and `--filter` are mutually exclusive).
3. **Required code fix in `router.ts`**: `import { inferRouterInputs, inferRouterOutputs }` → `import { type inferRouterInputs, type inferRouterOutputs }`. Both are type-only exports; the plain named import crashes the whatsapp-webhook runtime under Node `--experimental-strip-types` ("does not provide an export named 'inferRouterInputs'"). Bundlers (vitest/rolldown) handle it either way — hence the brief content passed tests but killed the live server. The `type` modifier is the repo lint's sanctioned form and is behavior-neutral.
4. Smoke test ran on PORT 8790 because a **stale Docker instance of the old app** already listens on 8787 (Docker Desktop process, PID 5131). It served the pre-migration REST API and answered the first curls with 404s for `/trpc/*`. Killing the user's Docker container was out of scope; the tRPC mount evidence is port-independent. This also explains "SERVER_UP after 1s" — a pre-existing listener.

## Self-review findings

- Complete against every step; nothing extra staged; commit staged exactly the brief's file list; test output pristine.
- No `pnpm` peer-dependency warning appeared (`vp install` clean) — fastify's peer is optional and the consumer already depends on fastify; no `pnpm-workspace.yaml` change needed.

## Concerns / deferred notes

- **DEFERRED (controller ruling):** hand-rolled `POST` mutation bodies send `{"json":{...}}` and zod reports `path: ["id"] received undefined` even though `id` was sent (status field parses fine; NOT_FOUND path works via the same schema in GETs). Treated as a wire-format question for raw curls; Task 4's real `httpBatchLink` client (same tRPC 11.18.0 both sides) sends the parser's expected format by construction, and Task 4's browser smoke is the authoritative check. No code changed.
- **Plan inaccuracy:** brief's Step 3 RED expectation and the `POST /trpc/orders.list` smoke expectation (should be GET for queries in tRPC v11) don't hold as written; both confirmed non-blocking.
- Docker's stale 8787 instance should be reconciled before Task 6 (it answers `/api/*` with the OLD REST code, which may mask or conflict with later smoke tests).
