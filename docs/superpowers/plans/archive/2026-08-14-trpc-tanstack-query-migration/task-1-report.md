# Task 1 Report — Tooling & `packages/api` scaffold

**Status: DONE_WITH_CONCERNS** (one concern: `vp run -r test` workspace exit code — see below; all committed content is verbatim per brief)

**Commit:** `e09b93f` — `feat(trpc): scaffold @digico/api package and catalog deps` (branch `feat/trpc-migration`, clean tree after commit)

## What was implemented

All 9 steps of the brief, with file contents used verbatim:

- **Step 1** — `pnpm-workspace.yaml`: added 5 catalog entries at alphabetical positions (`@tanstack/react-query ^5.62.0`, `@trpc/client ^11.0.0`, `@trpc/react-query ^11.0.0`, `@trpc/server ^11.0.0` between `@tailwindcss/vite` and `@types/node`; `zod ^4.0.0` after `vite-plus`). Workspace globs unchanged (`packages/*` already covers the new package).
- **Step 2** — `packages/api/package.json`: verbatim (deps `@digico/contracts`, `@digico/db` workspace:_; `@trpc/server`, `zod` catalog:_; devDeps `typescript`, `vite-plus` catalog:\*).
- **Step 3** — `packages/api/tsconfig.json`: verbatim (extends root, strict, skipLibCheck, noEmit; include src+tests).
- **Step 4** — `packages/api/vite.config.ts`: literal brief block, **without** utils' `pack: { dts: {} }` line (Ruling 3).
- **Step 5** — `packages/api/src/trpc.ts` (initTRPC with `TrpcContext`; exports `router`, `publicProcedure`) and `src/context.ts` (`TrpcContext` interface + `createContext()`). Named imports, explicit `.ts` extensions, no `any` — all lint rules respected.
- **Step 6** — `src/routers/health.ts` (`ping` procedure), `src/router.ts` (`appRouter` + `AppRouter` type), `src/index.ts` barrel (exports `createContext`, `TrpcContext`, `appRouter`, `AppRouter`).
- **Step 7** — `apps/whatsapp-webhook/package.json`: `@digico/api` workspace:_ and `@trpc/server` catalog:_; `apps/website/package.json`: `@digico/api` workspace:_, `@tanstack/react-query`, `@trpc/client`, `@trpc/react-query` catalog:_ — all inserted at alphabetical positions matching the repo's existing ordering.
- **Step 8** — `apps/website/tsconfig.json`: `"strict": true` added to compilerOptions.
- **Step 9** — `vp install && vp check && vp run -r test`; committed. `pnpm-lock.yaml` staged together with the 12 brief-listed files per the controller's ruling.

## Testing & results

- **`vp install`** — green. `Packages: +6`, Done in 3.7s. **No peer-dependency warnings** (catalog-only deps were clean; `@trpc/react-query`'s peer set resolved fully from the catalog). Lockfile diff is purely additive (114 insertions, 0 deletions).
- **`vp check`** — **green, pristine**: "All 135 files are correctly formatted", "Found no warnings, lint errors, or type errors in 80 files". The new package's `vite.config.ts` lint options (`typeAware`, `typeCheck`) exercised it; type-check includes `packages/api`.
- **Step 8 strict-mode check** — `strict: true` on the website surfaced **0 latent nullability errors** (expected 0–2). No fixes needed, no runtime change.
- **`vp run -r test`** — exits 1. **Investigated in depth (this is the concern):**
  - The failure is entirely attributable to `@digico/api` having zero test files: vitest 4 exits 1 on "No test files found". The brief anticipated "no tests reference the new package yet" but expected "all green" — vitest's no-tests exit code makes that expectation incorrect.
  - Cascade: the task runner fail-fasts on the first failure. In parallel mode it SIGKILLs in-flight sibling tasks (utils reported exit 137); in sequential mode (`--concurrency-limit 1`) it schedules only the failing api task and skips the rest. Verified `@digico/utils` is not actually broken: it passes standalone (1 file, 4 tests) and on the pre-change clean tree.
  - Proof that all real suites are green: `vp run -r test --passWithNoTests` → **exit 0**; totals: `@digico/utils` 4 passed; `whatsapp-webhook` 27 passed + 1 skipped (6 files); `@digico/api` 0 tests (expected). The webhook stderr line ("Failed to cancel MariaDB order Error: db down") is a pre-existing intentional test artifact — it appears identically on the clean-tree run.
  - **Not committed any workaround**: the only ways to make the plain command exit 0 (add a test file, add `passWithNoTests` config, or alter the `"test"` script) all deviate from the brief's verbatim content, which is authoritative. This is transient and self-resolving: progress.md records Task 2 as adding 7 tests to `@digico/api`, after which `vp run -r test` goes green naturally. Suggested follow-up for the controller: confirm Task 2's test additions land before the task's own `vp run -r test` verification, or consider whether the plan wants `passWithNoTests` in the api package's test config.
- **Clean-tree control** — stashed the full change set and re-ran `vp run -r test` on the pristine tree: exit 0 (utils + whatsapp-webhook). Confirms the exit-1 regression is solely the new empty test package, nothing else.

## Files changed (13, all staged in the single commit)

- `pnpm-workspace.yaml` (5 catalog lines)
- `pnpm-lock.yaml` (additive: catalog packages + `@digico/api` workspace link)
- `apps/whatsapp-webhook/package.json`, `apps/website/package.json`, `apps/website/tsconfig.json`
- `packages/api/package.json`, `packages/api/tsconfig.json`, `packages/api/vite.config.ts`
- `packages/api/src/trpc.ts`, `packages/api/src/context.ts`, `packages/api/src/routers/health.ts`, `packages/api/src/router.ts`, `packages/api/src/index.ts`

## Self-review findings

- Diff verified file-by-file against the brief: all 12 brief files verbatim; nothing extra committed beyond the mandated lockfile.
- Deps and catalog entries inserted at correct alphabetical positions (consistent with the repo's convention).
- Interfaces produced match the plan: `appRouter`, `createContext`, `AppRouter`, `t`/`router`/`publicProcedure` all exported from the exact files later tasks import from.
- Lint discipline: named imports, no `any`, barrel imports only, explicit `.ts` extensions in relative imports, no enum/namespace syntax.
- No test output anomalies beyond the documented concern; `vp check` output pristine.

## Issues / concerns

1. **`vp run -r test` exits 1 until Task 2** (detailed above). Root cause is inherent to the brief's verbatim content; committed state matches the brief exactly. Flagging so the controller can ensure Task 2's verification ordering accounts for it (Task 2 adds the tests that fix it).
