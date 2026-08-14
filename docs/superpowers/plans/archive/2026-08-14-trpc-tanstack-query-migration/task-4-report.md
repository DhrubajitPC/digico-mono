# Task 4 report — Client foundation + hooks migration

**Status: BLOCKED** (gate cannot be green within the task's file scope; two rulings needed)

## What I implemented

All four files written per the brief, with Ruling 1 applied verbatim:

- **`apps/website/src/trpc.ts` (new)** — `createTRPCReact<AppRouter>()` + `httpBatchLink({ url: "/trpc" })`. Type-only import of `AppRouter` from `@digico/api` (no value imports — browser bundle safety respected).
- **`apps/website/src/main.tsx`** — replaced with the brief's provider wiring (`trpc.Provider` wrapping `QueryClientProvider`, shared `QueryClient`).
- **`apps/website/src/hooks/useOrders.ts`** — rewritten to `trpc.orders.list.useQuery` + `bulkSetStatus` mutation + `utils.orders.list.invalidate()`. Ruling applied exactly: `useState<"all" | Order["status"]>("all")` for `activeTab`, `useState<OrderOriginType | "">("")` for `originFilter` (type imported from `@digico/contracts`). Everything else verbatim from the brief.
- **`apps/website/src/hooks/useOrderReview.ts`** — rewritten verbatim from the brief (`orders.get`/`products.list` queries, `update`/`setStatus` mutations with `onSuccess` invalidations, all five mutation handlers).

Return surfaces of both hooks are key-for-key identical to the old implementations (verified by diffing the return statements; `OrdersDashboard.tsx`/`OrderReviewDrawer.tsx` untouched).

## Verification results

### `vp check` (current 4-file state) — FAIL

```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'SetStateAction<"all" | OrderStatusType>'.
  OrdersDashboard.tsx:64  setActiveTab(tabId)
error TS2322: Type 'Dispatch<SetStateAction<"" | OrderOriginType>>' is not assignable to type '(origin: string) => void'.
  OrdersDashboard.tsx:77  onOriginFilterChange={setOriginFilter}
warning no-meaningless-void-operator: OrdersDashboard.tsx:54  void fetchOrders()
```

### `vp run -r build` (current 4-file state) — FAIL

45 tsc errors: 43 in `packages/db` + 2 in `OrdersDashboard.tsx` (same two as above).
`packages/db`: logs.ts 21, orders.ts 17, client.ts 3, products.ts 2 (TS2307 `node:fs`, TS2591 `process`, TS2339 `query` on `Pool`, TS7006 implicit-any params).

### Baselines / root causes (verified empirically)

- **Build was GREEN at HEAD** (trpc.ts removed → `vp run -r build` passes). The db errors are pre-existing debt, not introduced by any task — but the brief's mandated `import type { AppRouter } from "@digico/api"` is the FIRST website import that drags `packages/db` sources into the website's tsc program. Website tsconfig `"types": ["vite/client"]` excludes node types, so the node-dependent db sources (mysql2 types, `node:fs`, `process`) fail under website's strict tsc. No task in the plan touches `packages/db`, and Task 3's report ran only `vp check` — the `vp run -r build` gate was never green post-Task 3.
- **Ruling 1's narrowing** breaks `OrdersDashboard.tsx` because `DashboardTabs.onTabChange` is typed `(tabId: string) => void` and `DashboardToolbar.onOriginFilterChange` is `(origin: string) => void`. These two components are not in any task's file list (Task 5 touches neither; the brief forbids touching the consumers).

### Experiment (temporary, verified, then reverted)

Typed `DashboardTabs`/`DashboardToolbar` props with the contract types (`"all" | OrderStatusType` / `OrderOriginType | ""`, with a cast-free select narrowing in DashboardToolbar): **`vp check` fully green, zero warnings** (the `--fix` pass also auto-removed the now-meaningless `void` before `fetchOrders()`). The build still failed on the 43 db errors. The 3 experiment files were reverted; working tree contains only the 4 task files.

### Smoke (Step 6) — partial, honestly recorded

- Server booted on 8790 by running `node --experimental-strip-types src/server.ts` directly. (`vp run whatsapp-webhook#dev` could not be made to honor PORT=8790: root `.env` has `PORT=8787`, which collides with the stale Docker instance on 8787; the app's own `.env` also loads through vite-plus dev with the root value winning.)
- `GET /trpc/orders.list?input={...}` (the exact GET wire shape `httpBatchLink` sends) returned live order data; `/health` → ok. This exercises the server side of the client's data path but not the client wiring.
- Browser dashboard smoke (tabs refetch, search, bulk actions, drawer mutations) NOT run: no green committable state to smoke, and it requires the website dev server + browser + live DB. Not faked.
- Observation from smoke data: live rows include `origin: "woocommerce"`, which is outside the contracts `OrderOriginType` union — pre-existing data/contract drift, not caused by this task, but Task 5 should be aware.

## Files changed (unstaged — no commit made, gate is red)

- `apps/website/src/trpc.ts` (new)
- `apps/website/src/main.tsx`
- `apps/website/src/hooks/useOrders.ts`
- `apps/website/src/hooks/useOrderReview.ts`

## Self-review findings

- Ruling applied exactly; everything else verbatim from the brief. Return surfaces identical to the old hooks.
- No overbuilding, no extra files, no consumer files touched.
- No commit created: the required commit stages exactly 4 files, and the gate `vp check && vp run -r build` is red; committing a red state was not an option.

## Issues / concerns — rulings needed

1. **Ruling 1 ripple into out-of-scope consumers (2 tsc errors + 1 lint warning in OrdersDashboard.tsx).** No later task fixes these components.
   - Option A (verified green): type `DashboardTabs` + `DashboardToolbar` props with contract types (2 small files; commit list grows from 4 to 6). Recommended — preserves the ruling's static input safety.
   - Option B: keep the brief's verbatim `useState<string>` and cast at the query boundary in `useOrders.ts` (`activeTab as "all" | Order["status"]`, `(originFilter || undefined) as OrderOriginType | undefined`). Keeps the 4-file commit, loses static input safety.
2. **Build gate red on 43 pre-existing `packages/db` tsc errors**, exposed by the mandated `@digico/api` type import. Not fixable within the 4-file scope.
   - Option A: approve fixing the exposure (e.g. add `"node"` to website tsconfig `types` + `@types/node`, or fix db sources to be strict-clean — likely small mechanical changes).
   - Option B: redefine the gate (e.g. accept `vp check` + `vp build` without `tsc` — rolldown does not typecheck and type-only imports are erased, so the artifact is sound).
   - Option C: add a follow-up task for db typing debt.
3. The `no-meaningless-void-operator` warning at OrdersDashboard.tsx:54 is a side effect of the brief's `fetchOrders` now returning `void` (consumers call `void fetchOrders()`); auto-fixable (removes `void`), and resolved by the Option A path above. Cosmetic — does not fail the gate on its own.

---

## Fix report (post-ruling resume — Ruling 10 + Ruling 11)

### Status change: DONE (committed d01ac0b)

### Ruling 10 — consumer props (implemented, type-only)

- `apps/website/src/components/dashboard/DashboardTabs.tsx`: `import type { Order } from "@digico/contracts"`; `TabItem.id`, `activeTab`, `onTabChange` now `"all" | Order["status"]`; `counts` untouched.
- `apps/website/src/components/dashboard/DashboardToolbar.tsx`: `import type { OrderOriginType }`; `originFilter`/`onOriginFilterChange` now `OrderOriginType | ""`; the origin Select `onChange` narrows cast-free (`value === "whatsapp_ai" || value === "manual_sales" ? value : ""` — the select's only options are `""`, `whatsapp_ai`, `manual_sales`, so the guard is total); `bulkAction`/`onBulkActionChange` unchanged.
- `apps/website/src/components/OrdersDashboard.tsx`: only line 54 — dropped the now-meaningless `void` before `fetchOrders()` (1-line diff, nothing else).
- Hook-side narrowing from Ruling 1 unchanged. Zero runtime behavior change.

### Ruling 11 — build gate (implemented)

- `pnpm-workspace.yaml`: **no change needed** — the catalog already contains `"@types/node": "^24"` (line 15, the pattern packages/db established). Noted; nothing staged for it.
- `apps/website/package.json`: added `"@types/node": "catalog:"` devDep (alphabetical).
- `apps/website/tsconfig.json`: `"types": ["vite/client", "node"]`.
- Ran `vp install` (pnpm 11.14.0; lockfile updated — @types/node resolved 24.13.3; `pnpm-lock.yaml` staged as the necessary companion to the package.json change, omitted from the ruling's list but required for repo consistency).

### Gates — both fully green

- `vp check`: "All 143 files are correctly formatted" + "Found no warnings, lint errors, or type errors in 88 files". (One formatting pass was needed on DashboardToolbar's new onChange, applied via `vp check --fix`.)
- `vp run -r build`: 3/3 tasks pass — website `tsc` clean, rolldown bundle built (594.76 kB JS / 170.00 kB gzip; pre-existing chunk-size warning only). The 43 packages/db errors vanished exactly as predicted (TS2307/TS2591/TS2339/TS7006 were cascades of the missing node globals; no residual db debt → no STOP condition hit).

### Smoke (Step 6) — real browser smoke run and passed

Environment work: the stale Docker containers `digico-backend` (8787) and `digico-frontend` (5173) were stopped temporarily, the new server run directly (`node --experimental-strip-types src/server.ts`, .env at its original PORT=8787) and `vp dev` for the website on 5173; containers restarted afterwards, all temp files/processes cleaned up.

- Dashboard renders; Pending Review tab visible with counts.
- Tab switch refetches: table rows 200 (All) → 23 (Pending Review) via the tRPC GET through the vite `/trpc` proxy.
- Search box filters: "Anannya" → 1 row.
- Drawer opens on row click (`orders.get` + `products.list`); editable line items render; WhatsApp preview shows the formatted proposed message; product select and Save button present; close works.
- Zero page/console errors in both passes (Playwright chromium, headless).
- Not exercised: the five mutation flows (Save / Approve & Send / Set Status / Mark Completed / bulk action) — they persist to the live MariaDB and were intentionally left untouched; they share the mutation pattern proven by the read paths and the earlier curl POST smoke (tRPC HTTP wire, METHOD_NOT_SUPPORTED on wrong verb, etc.).

### Commit

- `d01ac0b feat(trpc): wire client providers and migrate useOrders/useOrderReview` (+ Co-Authored-By trailer, matching prior task commits) — 10 files staged: the 4 brief files, DashboardTabs.tsx, DashboardToolbar.tsx, OrdersDashboard.tsx, apps/website/package.json, apps/website/tsconfig.json, pnpm-lock.yaml. Working tree clean.
