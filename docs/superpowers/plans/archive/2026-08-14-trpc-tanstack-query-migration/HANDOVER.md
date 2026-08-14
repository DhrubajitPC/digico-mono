# Handover — tRPC + TanStack Query Migration (2026-08-14)

## State: DONE, awaiting PR review

- **PR #15**: https://github.com/DhrubajitPC/digico-mono/pull/15 (branch `feat/trpc-migration`, 7 commits, base `main`)
- All 6 plan tasks complete, final whole-branch review clean after one fix wave
- Ledger (authoritative record): `./progress.md` in this directory — 15 rulings, deferred minors, env notes

## What was built

- `packages/api` (`@digico/api`): tRPC v11 router (health/orders/products/dealers/messages) + zod schemas, 12 `createCaller` seam tests
- Fastify mounts router at `/trpc`; webhook + `/api/emulator/*` stay REST (spec §2.4)
- Client: `createTRPCReact` + `httpBatchLink` + shared `QueryClient` (`apps/website/src/trpc.ts`, `main.tsx`); all hooks + components migrated; REST routes + `api.ts` deleted

## Key decisions (see ledger for full rulings)

- Website may only `import type` from `@digico/api` (browser bundle safety — lifetime constraint)
- `messages.list` input is `.optional()` (zero-arg `useQuery()`); `LogMessage.rawPayload?` optional; `listMariaDbMessages` returns typed `LogMessage[]`
- website tsconfig `types: ["vite/client", "node"]` + `@types/node` devDep (db sources enter website tsc program via type-only import)
- Hook state narrowed (`"all" | Order["status"]`, `OrderOriginType | ""`); DashboardTabs/DashboardToolbar props retyped type-only
- Final fix (dbff932): `QueryCache({ onError })` in main.tsx restores query-error console logging

## Env quirks

- Stale Docker instance of the OLD app occupies port 8787 — **now handled automatically**: `make dev` runs `docker compose stop backend frontend` and depends on `mariadb-up`, so local dev always wins (containers still auto-restart on Docker Desktop start; re-run `make dev` or manually `docker compose stop backend frontend`)
- `OPENAI_API_KEY` unset in this env → emulator AI reply fails server-side (recording works)
- Dev DB has test data (~186 dealers, ~200 products, 200+ orders incl. smoke rows)

## Open follow-ups (from final review; all non-blocking)

1. Mechanically enforce the type-only `@digico/api` import rule (lint `no-restricted-imports` + `allowImportTypeOnly`)
2. Type `getMariaDbMessageDetail` rows like the `list` fix (logs.ts ~236-264, unguarded `JSON.parse(c.request_messages)`)
3. CreateOrderModal first-product preselect (restore via effect over `productsQuery.data`)
4. Rename `fetchOrders` → invalidate name; comment on `types: ["vite/client", "node"]`; amend spec §4 re: onError gap
5. Pre-existing (untouched): emulator chat duplicate-key dev warning; `mapDigicoStatusToWc("confirmed")`→`wc-completed` quirk; `origin: "woocommerce"` rows outside the union

## Next-session pointers

- Resuming this plan: `superpowers:subagent-driven-development` + `progress.md` ledger
- PR feedback: fix on this branch in-place (normal repo, no worktree), one scoped re-review
- Test/check: `vp check && vp run -r test && vp run -r build` (43 passed / 1 pre-existing skip)
