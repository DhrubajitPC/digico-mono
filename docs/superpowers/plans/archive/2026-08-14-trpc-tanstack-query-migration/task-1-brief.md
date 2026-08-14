### Task 1: Tooling & `packages/api` scaffold

**Files:**

- Modify: `pnpm-workspace.yaml` (catalog entries)
- Modify: `apps/whatsapp-webhook/package.json` (deps)
- Modify: `apps/website/package.json` (deps)
- Modify: `apps/website/tsconfig.json` (strict)
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vite.config.ts`
- Create: `packages/api/src/trpc.ts`
- Create: `packages/api/src/context.ts`
- Create: `packages/api/src/routers/health.ts`
- Create: `packages/api/src/router.ts`
- Create: `packages/api/src/index.ts`

**Interfaces:**

- Consumes: nothing yet (the workspace glob `packages/*` already covers the new package).
- Produces (all later tasks depend on these exact exports):
  - `@digico/api` → `appRouter: Router`, `createContext(): TrpcContext`, `type AppRouter = typeof appRouter` (plus `RouterInputs`/`RouterOutputs` added in Task 3)
  - `packages/api/src/trpc.ts` → `t`, `router`, `publicProcedure` (used by every router file)

- [ ] **Step 1: Add catalog entries to `pnpm-workspace.yaml`**

Insert into the `catalog:` block (alphabetical position):

```yaml
"@tanstack/react-query": ^5.62.0
"@trpc/client": ^11.0.0
"@trpc/react-query": ^11.0.0
"@trpc/server": ^11.0.0
zod: ^4.0.0
```

- [ ] **Step 2: Create `packages/api/package.json`**

```json
{
  "name": "@digico/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "vp check",
    "test": "vp test"
  },
  "dependencies": {
    "@digico/contracts": "workspace:*",
    "@digico/db": "workspace:*",
    "@trpc/server": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

- [ ] **Step 3: Create `packages/api/tsconfig.json`** (mirrors `apps/whatsapp-webhook/tsconfig.json`; tRPC requires strict)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `packages/api/vite.config.ts`** (copy of `packages/utils/vite.config.ts`)

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
```

- [ ] **Step 5: Create the tRPC instance and context**

`packages/api/src/trpc.ts`:

```ts
import { initTRPC } from "@trpc/server";
import type { TrpcContext } from "./context.ts";

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

`packages/api/src/context.ts`:

```ts
/** Empty for now — auth middleware slots in here later (spec §7). */
export interface TrpcContext {}

export function createContext(): TrpcContext {
  return {};
}
```

- [ ] **Step 6: Create the first router + the root router + the barrel**

`packages/api/src/routers/health.ts`:

```ts
import { publicProcedure, router } from "../trpc.ts";

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true as const })),
});
```

`packages/api/src/router.ts`:

```ts
import { router } from "./trpc.ts";
import { healthRouter } from "./routers/health.ts";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
```

`packages/api/src/index.ts`:

```ts
export { createContext } from "./context.ts";
export type { TrpcContext } from "./context.ts";
export { appRouter } from "./router.ts";
export type { AppRouter } from "./router.ts";
```

- [ ] **Step 7: Add `@digico/api` + tRPC deps to the apps**

`apps/whatsapp-webhook/package.json` `dependencies` — add:

```json
"@digico/api": "workspace:*",
"@trpc/server": "catalog:",
```

`apps/website/package.json` `dependencies` — add:

```json
"@digico/api": "workspace:*",
"@tanstack/react-query": "catalog:",
"@trpc/client": "catalog:",
"@trpc/react-query": "catalog:",
```

- [ ] **Step 8: Enable `strict` in `apps/website/tsconfig.json`**

Add to `compilerOptions`:

```json
"strict": true,
```

Run `vp check` and fix any latent nullability errors this surfaces (expected: 0–2, e.g. a `possibly null` access — fix with `??`/optional chaining, no runtime change).

- [ ] **Step 9: Install, check, commit**

Run: `vp install && vp check && vp run -r test`
Expected: all green (no tests reference the new package yet).

```bash
git add pnpm-workspace.yaml packages/api apps/whatsapp-webhook/package.json apps/website/package.json apps/website/tsconfig.json
git commit -m "feat(trpc): scaffold @digico/api package and catalog deps"
```
