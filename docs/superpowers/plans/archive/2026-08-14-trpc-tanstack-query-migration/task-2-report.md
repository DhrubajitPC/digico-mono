# Task 2 Report: Orders procedures + tests

**Status:** DONE_WITH_CONCERNS (two documented deviations from the brief's literal commands/content — see Issues)

## What I implemented

1. `packages/api/tests/orders-router.test.ts` — 7 TDD tests for the orders router (list/counts, list filters, get + history, get NOT_FOUND, create total computation, setStatus zod rejection, create negative-quantity rejection), mocking `@digico/db` with the 5 functions via `vi.hoisted`.
2. `packages/api/src/schemas.ts` — zod input schemas: `orderStatusSchema`, `orderOriginSchema`, `orderItemInputSchema`, `listOrdersInputSchema`, `createOrderInputSchema`, `updateOrderInputSchema`, `setOrderStatusInputSchema`, `bulkSetOrderStatusInputSchema`.
3. `packages/api/src/routers/orders.ts` — `ordersRouter` with `list`, `get`, `create`, `update`, `setStatus`, `bulkSetStatus`; `dbErrorToTrpc` maps `MariaDbError` → 500; not-found → `TRPCError NOT_FOUND`.
4. `packages/api/src/router.ts` — registered `ordersRouter` alongside `healthRouter`.

All file contents verbatim from the brief except one line (see Issue 2).

## What I tested and results

- **RED:** `vp run --filter @digico/api test` (before implementation) → 1 failed suite: `Error: Cannot find module '../src/routers/orders.ts' imported from packages/api/tests/orders-router.test.ts` (tests/orders-router.test.ts:15). Expected: module doesn't exist yet.
- **GREEN:** `vp run --filter @digico/api test` (after implementation) → `Test Files 1 passed (1)`, `Tests 7 passed (7)`, duration ~160ms, output pristine (no warnings).
- **`vp check`:** `pass` — All 138 files correctly formatted; "Found no warnings, lint errors, or type errors in 83 files".
- **Baseline verification:** `vp check` on HEAD (Task 1 commit e09b93f) is green, confirming my change introduced no new issues (final state green).

## TDD Evidence

**RED** — command and relevant output:

```
$ vp run --filter @digico/api test
 ❯ tests/orders-router.test.ts (0 test)

 FAIL  tests/orders-router.test.ts [ tests/orders-router.test.ts ]
Error: Cannot find module '../src/routers/orders.ts' imported from
/Users/dhch/projects/digico/packages/api/tests/orders-router.test.ts
 ...
     15| import { ordersRouter } from "../src/routers/orders.ts";
 Test Files  1 failed (1)
      Tests  no tests
```

Failure expected: `packages/api/src/routers/orders.ts` did not exist yet (test-first).

**GREEN** — command and relevant output:

```
$ vp run --filter @digico/api test
 ✓ tests/orders-router.test.ts (7 tests) 4ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  03:35:36
   Duration  159ms (transform 22ms, setup 0ms, import 87ms, tests 4ms, environment 0ms)
```

## Files changed

- Added: `packages/api/src/schemas.ts` (54 lines)
- Added: `packages/api/src/routers/orders.ts` (118 lines)
- Added: `packages/api/tests/orders-router.test.ts` (96 lines)
- Modified: `packages/api/src/router.ts` (+2 lines: import + registration)
- Commit: `93fe298 feat(trpc): add orders procedures with zod validation and unit tests` (4 files, 270 insertions, exact files from the brief's Step 7 `git add` list)

## Self-review findings

- Diff contains nothing beyond the brief's 4 files; router.ts matches Step 5 verbatim.
- Mocked `MariaDbError` is `undefined` under the `vi.mock` (as anticipated) — no test path reaches `dbErrorToTrpc`, and per instructions I did not alter the mock.
- Test output and check output pristine; working tree clean after commit.

## Issues and concerns

1. **Brief's test command is broken as written.** `vp run -r test --filter @digico/api` fails two ways: (a) `--filter` after the task specifier is forwarded to the task (vitest errors `CACError: Unknown option '--filter'`); (b) with the flag in the correct position, `--filter` and `--recursive` are mutually exclusive (`error: --filter and --recursive cannot be used together`). Working invocation: `vp run --filter @digico/api test` (used for both RED and GREEN runs). No `-r` needed since `--filter @digico/api` selects the package. Follow-up tasks using this command should adopt the corrected form.

2. **One-line deviation from the brief's verbatim test content (required for Step 7 green).** The brief's test imports `beforeEach, describe, expect, it, vi` from `"vitest"`, but the repo's committed lint rule `prefer-vite-plus-imports` rejects `vitest` imports, and `vitest` is not resolvable as a module from `packages/api` (no devDependency; `TS2307: Cannot find module 'vitest'`). With the verbatim import, `vp check` failed (2 errors) — contradicting Step 7's "Expected: green". Baseline `vp check` at HEAD is green, so this was introduced solely by the import choice. Fix: import from `"vite-plus/test"` instead — the repo-sanctioned vitest re-export already used by `packages/api`'s sibling (`packages/utils/tests/index.test.ts`). I verified `vite-plus/test` exports all five names (`vi`, `beforeEach`, `describe`, `expect`, `it`). Semantics identical; tests still pass; check green. This is the only non-verbatim line in any file.

3. **Minor:** `orders.update`'s `update` path uses `body` (which may contain `items`) and `setStatus`/`bulkSetStatus` — none of the `update`/`bulkSetStatus` happy paths are covered by the brief's 7 tests; only exercised schemas are `list`, `get`, `create`, and `setStatus` (rejection). Not a defect — matches the brief exactly; flagging for awareness only.
