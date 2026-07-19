# Core Backend Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/core` — the authoritative business domain for Digico's WhatsApp ordering MVP: Postgres schema, dealer/product/price/inventory/order logic, CSV import, and the seven AI-facing tool functions.

**Architecture:** A single workspace package (`core`) exposing plain async functions over a Drizzle ORM database handle. Production uses PostgreSQL (`pg`); all tests run against in-memory PGlite so `vp test` needs no external services. The AI layer (Plan 2), WhatsApp channel (Plan 3), and admin app (Plan 4) consume this package in-process; the AI sees only the `createTools()` facade, never the database.

**Tech Stack:** TypeScript (strict, nodenext, no build step — Node ≥22.18 type-stripping), Drizzle ORM + drizzle-kit migrations, PGlite (tests) / node-postgres (production), Zod v4 (row validation), csv-parse (CSV), Vitest via `vp test`.

**Plan sequence (from spec):** This is Plan 1 of 4 for PRD Phase 1 (`docs/prd/prd.md`, decision record `docs/superpowers/specs/2026-07-20-prd-mvp-scope-design.md`). The **Conversation** entity (PRD §11) is intentionally deferred to Plan 2 (AI orchestration) — it stores AI interpretations and tool calls, which don't exist until that layer does.

## Global Constraints

- Node `>=22.18.0` (repo `engines`); the package ships TypeScript source directly — no build step, exports point at `./src/*.ts`.
- TypeScript strict mode, `verbatimModuleSyntax` (use `import type` for types), imports use explicit `.ts` extensions (tsconfig has `allowImportingTsExtensions`).
- Erasable TS syntax only (no `enum`, no `namespace`, no constructor parameter properties) — the package ships raw `.ts` that Node runs via type-stripping.
- Tests import from `"vite-plus/test"`, never `"vitest"` (root lint rule `vite-plus/prefer-vite-plus-imports` is `error`).
- Tests must be self-contained: in-memory PGlite only — no Docker, no external Postgres, no network.
- Money is stored as **whole BDT taka integers** (`amountTaka`, `unitPriceTaka`) — no decimals (PRD: tech distribution prices are whole taka).
- **Single price list** — no dealer pricing tiers, no credit fields anywhere in the schema (PRD §5, §11).
- The AI layer may only ever touch `createTools()` — "AI interprets, backend decides" (PRD §8, §12). Admin/ops operations (approve/reject/import) are separate domain functions, NOT in the tools facade.
- Order status flow (PRD §11): `draft → pending_review → approved/rejected`, `approved → confirmed → fulfilled`, cancellation allowed except from terminal states. Approval reserves stock; cancelling an approved/confirmed order releases it.
- All commands run through `vp`: `vp install`, `vp test`, `vp check`, `vp run <script>`. Run `vp install` once before starting (CLAUDE.md checklist).
- Commit after every green test cycle. The pre-commit hook runs `vp check --fix` on staged files — if it reformats, the commit still lands; don't fight the formatter.
- In-memory scoring/search loads all products (600 SKUs — fine at this scale; documented assumption, revisit past ~10k SKUs).

## File Structure

```
packages/core/
├── package.json              # name "core", private, deps + scripts
├── tsconfig.json             # copy of packages/utils/tsconfig.json
├── vite.config.ts            # lint/fmt config (mirrors utils, no pack)
├── drizzle.config.ts         # drizzle-kit: schema → ./drizzle migrations
├── drizzle/                  # generated SQL migrations (committed)
├── src/
│   ├── index.ts              # public exports (facade for plans 2–4)
│   ├── errors.ts             # CoreError + ErrorCode
│   ├── db/
│   │   ├── schema.ts         # all tables + inferred row types
│   │   ├── client.ts         # Db type + createDb(connectionString) [pg]
│   │   └── pglite.ts         # createPgliteDb() [tests/dev, subpath export]
│   ├── dealers/dealers.ts    # upsertDealer, findDealerByPhone, setDealerStatus
│   ├── products/
│   │   ├── products.ts       # upsertProduct, getProductBySku
│   │   └── search.ts         # normalize, scoreProduct, searchProducts
│   ├── prices/prices.ts      # setPrice, getPrice (validity windows)
│   ├── inventory/inventory.ts# setInventory, getInventory, reserveStock, releaseStock
│   ├── orders/orders.ts      # draft lifecycle + review transitions
│   ├── import/
│   │   ├── csv.ts            # parseCsv + ImportReport type
│   │   └── importers.ts      # importProducts/Dealers/Inventory/Prices
│   └── tools/tools.ts        # createTools(db) — the 7 AI-facing tools
└── tests/
    ├── setup.test.ts         # PGlite boots under vp test
    ├── schema.test.ts        # migrations apply, defaults work
    ├── dealers.test.ts
    ├── products.test.ts
    ├── prices.test.ts
    ├── inventory.test.ts
    ├── orders.test.ts
    ├── import.test.ts
    └── tools.test.ts         # envelope + end-to-end dealer flow
```

---

### Task 1: Scaffold `packages/core`

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vite.config.ts`
- Create: `packages/core/.gitignore`
- Test: `packages/core/tests/setup.test.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces: a workspace package named `core` where `vp test` and `vp check` pass; dependencies installed for every later task.

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/setup.test.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "vite-plus/test";

test("pglite boots in-memory and answers a query", async () => {
  const client = new PGlite();
  const result = await client.query("select 1 as one");
  expect(result.rows).toEqual([{ one: 1 }]);
  await client.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test`
Expected: FAIL — package/deps don't exist yet (cannot resolve `@electric-sql/pglite`).

- [ ] **Step 3: Create the package files**

Create `packages/core/package.json`:

```json
{
  "name": "core",
  "version": "0.0.0",
  "private": true,
  "description": "Digico business domain: catalog, pricing, inventory, orders, CSV import, AI tool facade.",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./pglite": "./src/db/pglite.ts",
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vp test",
    "check": "vp check",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@electric-sql/pglite": "^0.3.3",
    "csv-parse": "^6.0.0",
    "drizzle-orm": "^0.44.2",
    "pg": "^8.16.0",
    "zod": "^4.0.5"
  },
  "devDependencies": {
    "@types/node": "^24",
    "@types/pg": "^8.15.4",
    "drizzle-kit": "^0.31.1",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

Create `packages/core/tsconfig.json` (identical to `packages/utils/tsconfig.json`):

```json
{
  "compilerOptions": {
    "target": "esnext",
    "lib": ["es2023"],
    "moduleDetection": "force",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolveJsonModule": true,
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "declaration": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

Create `packages/core/vite.config.ts`:

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

Create `packages/core/.gitignore`:

```
node_modules
```

Then install: run from repo root: `vp install`
Expected: lockfile updated, `packages/core/node_modules` linked, no errors. (If dependency resolution fails on a pinned range, check the registry for the nearest published version and adjust the caret range — do not switch libraries. If toolchain behavior looks wrong, run `vp env doctor`.)

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test`
Expected: PASS — 1 test file, 1 test green.

- [ ] **Step 5: Run checks and commit**

Run from `packages/core/`: `vp check`
Expected: format/lint/type-check clean (fix anything it reports).

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): scaffold core domain package with pglite test setup"
```

---

### Task 2: Database schema and migrations

**Files:**

- Create: `packages/core/src/db/schema.ts`
- Create: `packages/core/src/db/client.ts`
- Create: `packages/core/src/db/pglite.ts`
- Create: `packages/core/drizzle.config.ts`
- Create: `packages/core/drizzle/` (generated by drizzle-kit)
- Test: `packages/core/tests/schema.test.ts`

**Interfaces:**

- Consumes: package from Task 1.
- Produces:
  - `type Db` (from `src/db/client.ts`) — the database handle every domain function takes as its first parameter.
  - `createDb(connectionString: string): Db` — production Postgres connection.
  - `createPgliteDb(): Promise<Db>` — fresh in-memory DB with migrations applied; used by every test in this plan and by Plans 2–4.
  - Tables: `dealers`, `products`, `inventory`, `prices`, `orders`, `orderItems`; enums `dealerStatus` (`active|suspended`), `orderStatus` (`draft|pending_review|approved|rejected|confirmed|fulfilled|cancelled`).
  - Row types: `Dealer`, `Product`, `InventoryRow`, `Price`, `Order`, `OrderItem`, `OrderStatus`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/schema.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import { dealers, products } from "../src/db/schema.ts";

test("migrations apply and column defaults work", async () => {
  const db = await createPgliteDb();

  const [product] = await db
    .insert(products)
    .values({ sku: "HP-15S-FQ5", brand: "HP", category: "Laptop", name: "HP 15s-fq5786TU" })
    .returning();
  expect(product!.aliases).toEqual([]);
  expect(product!.active).toBe(true);
  expect(product!.id).toBe(1);

  const [dealer] = await db
    .insert(dealers)
    .values({ phone: "+8801700000001", businessName: "Rahim Traders" })
    .returning();
  expect(dealer!.status).toBe("active");
});

test("sku is unique", async () => {
  const db = await createPgliteDb();
  const row = { sku: "X-1", brand: "X", category: "C", name: "X One" };
  await db.insert(products).values(row);
  await expect(db.insert(products).values(row)).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/schema.test.ts`
Expected: FAIL — `../src/db/pglite.ts` does not exist.

- [ ] **Step 3: Write the schema**

Create `packages/core/src/db/schema.ts`:

```ts
import { sql } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const dealerStatus = pgEnum("dealer_status", ["active", "suspended"]);

export const orderStatus = pgEnum("order_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "confirmed",
  "fulfilled",
  "cancelled",
]);

export const dealers = pgTable("dealers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  phone: text("phone").notNull().unique(), // WhatsApp identity, E.164 e.g. +8801XXXXXXXXX
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  status: dealerStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sku: text("sku").notNull().unique(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  model: text("model"),
  specs: text("specs"), // free-text spec summary, e.g. "i5-1235U 8GB 512GB"
  aliases: text("aliases")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventory = pgTable("inventory", {
  sku: text("sku")
    .primaryKey()
    .references(() => products.sku),
  available: integer("available").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prices = pgTable("prices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sku: text("sku")
    .notNull()
    .references(() => products.sku),
  amountTaka: integer("amount_taka").notNull(), // whole BDT
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }), // null = open-ended
});

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  status: orderStatus("status").notNull().default("draft"),
  reviewer: text("reviewer"), // ops user who approved/rejected
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  sku: text("sku")
    .notNull()
    .references(() => products.sku),
  quantity: integer("quantity").notNull(),
  unitPriceTaka: integer("unit_price_taka").notNull(), // snapshot at draft time
});

export type Dealer = typeof dealers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InventoryRow = typeof inventory.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
```

Create `packages/core/src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.ts";

/** Driver-agnostic handle: satisfied by node-postgres (prod) and PGlite (tests/dev). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(connectionString: string): Db {
  // HKT generics differ per driver; runtime query API is identical.
  return drizzle(connectionString, { schema }) as unknown as Db;
}
```

Create `packages/core/src/db/pglite.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client.ts";
import * as schema from "./schema.ts";

/** Fresh in-memory Postgres with all migrations applied. For tests and local dev. */
export async function createPgliteDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  // HKT generics differ per driver; runtime query API is identical.
  return db as unknown as Db;
}
```

Create `packages/core/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
```

Generate the migration — run from `packages/core/`: `vp run db:generate`
Expected: creates `packages/core/drizzle/0000_<adjective>_<noun>.sql` plus `drizzle/meta/` journal. Open the SQL file and confirm it contains `CREATE TABLE` for all six tables and both enums.

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/schema.test.ts`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): postgres schema, migrations, db clients (pg + pglite)"
```

---

### Task 3: Domain errors and dealers

**Files:**

- Create: `packages/core/src/errors.ts`
- Create: `packages/core/src/dealers/dealers.ts`
- Test: `packages/core/tests/dealers.test.ts`

**Interfaces:**

- Consumes: `Db`, `createPgliteDb`, `dealers` table, `Dealer` type (Task 2).
- Produces:
  - `class CoreError extends Error { code: ErrorCode }` with `type ErrorCode = "NOT_FOUND" | "VALIDATION" | "INVALID_STATE" | "INSUFFICIENT_STOCK" | "NO_PRICE" | "DEALER_INACTIVE"` — every expected domain failure in later tasks throws this.
  - `upsertDealer(db: Db, input: DealerInput): Promise<Dealer>` where `DealerInput = { phone: string; businessName: string; contactPerson?: string | null; status?: "active" | "suspended" }` (upsert key: `phone`).
  - `findDealerByPhone(db: Db, phone: string): Promise<Dealer | undefined>`
  - `setDealerStatus(db: Db, phone: string, status: "active" | "suspended"): Promise<Dealer>` (throws `NOT_FOUND`).

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/dealers.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { findDealerByPhone, setDealerStatus, upsertDealer } from "../src/dealers/dealers.ts";
import { createPgliteDb } from "../src/db/pglite.ts";
import { CoreError } from "../src/errors.ts";

const PHONE = "+8801700000001";

test("upsertDealer inserts then updates by phone", async () => {
  const db = await createPgliteDb();
  const created = await upsertDealer(db, { phone: PHONE, businessName: "Rahim Traders" });
  expect(created.status).toBe("active");

  const updated = await upsertDealer(db, {
    phone: PHONE,
    businessName: "Rahim Traders & Sons",
    contactPerson: "Rahim",
  });
  expect(updated.id).toBe(created.id);
  expect(updated.businessName).toBe("Rahim Traders & Sons");
  expect(updated.contactPerson).toBe("Rahim");
});

test("findDealerByPhone returns undefined for unknown phone", async () => {
  const db = await createPgliteDb();
  expect(await findDealerByPhone(db, "+8801799999999")).toBeUndefined();
});

test("setDealerStatus suspends and throws NOT_FOUND for unknown dealer", async () => {
  const db = await createPgliteDb();
  await upsertDealer(db, { phone: PHONE, businessName: "Rahim Traders" });
  const suspended = await setDealerStatus(db, PHONE, "suspended");
  expect(suspended.status).toBe("suspended");

  await expect(setDealerStatus(db, "+8801799999999", "suspended")).rejects.toThrow(CoreError);
  await expect(setDealerStatus(db, "+8801799999999", "suspended")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/dealers.test.ts`
Expected: FAIL — modules `../src/dealers/dealers.ts` and `../src/errors.ts` do not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/errors.ts`:

```ts
export type ErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_STATE"
  | "INSUFFICIENT_STOCK"
  | "NO_PRICE"
  | "DEALER_INACTIVE";

/**
 * Expected domain failure. The tools facade maps these to safe error envelopes.
 * No constructor parameter properties: the package ships raw .ts run under Node
 * type-stripping, which allows erasable syntax only.
 */
export class CoreError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "CoreError";
    this.code = code;
  }
}
```

Create `packages/core/src/dealers/dealers.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dealers } from "../db/schema.ts";
import type { Dealer } from "../db/schema.ts";
import { CoreError } from "../errors.ts";

export interface DealerInput {
  phone: string;
  businessName: string;
  contactPerson?: string | null;
  status?: "active" | "suspended";
}

export async function upsertDealer(db: Db, input: DealerInput): Promise<Dealer> {
  const values = {
    phone: input.phone,
    businessName: input.businessName,
    contactPerson: input.contactPerson ?? null,
    status: input.status ?? ("active" as const),
  };
  const [row] = await db
    .insert(dealers)
    .values(values)
    .onConflictDoUpdate({ target: dealers.phone, set: values })
    .returning();
  return row!;
}

export async function findDealerByPhone(db: Db, phone: string): Promise<Dealer | undefined> {
  const [row] = await db.select().from(dealers).where(eq(dealers.phone, phone));
  return row;
}

export async function setDealerStatus(
  db: Db,
  phone: string,
  status: "active" | "suspended",
): Promise<Dealer> {
  const [row] = await db
    .update(dealers)
    .set({ status })
    .where(eq(dealers.phone, phone))
    .returning();
  if (!row) throw new CoreError("NOT_FOUND", `No dealer with phone ${phone}`);
  return row;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/dealers.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/errors.ts packages/core/src/dealers packages/core/tests/dealers.test.ts
git commit -m "feat(core): domain errors and dealer repository"
```

---

### Task 4: Products and search

**Files:**

- Create: `packages/core/src/products/products.ts`
- Create: `packages/core/src/products/search.ts`
- Test: `packages/core/tests/products.test.ts`

**Interfaces:**

- Consumes: `Db`, `products` table, `Product` type (Task 2).
- Produces:
  - `upsertProduct(db: Db, input: ProductInput): Promise<Product>` where `ProductInput = { sku: string; brand: string; category: string; name: string; model?: string | null; specs?: string | null; aliases?: string[]; active?: boolean }` (upsert key: `sku`).
  - `getProductBySku(db: Db, sku: string): Promise<Product | undefined>`
  - `normalize(text: string): string` — lowercase, strip punctuation (keeps Latin, digits, Bengali script), collapse whitespace.
  - `scoreProduct(product: Product, query: string): number` — 100 exact SKU, 90 exact alias, ≤60 token coverage, 0 no match.
  - `searchProducts(db: Db, query: string, limit?: number): Promise<ScoredProduct[]>` where `ScoredProduct = { product: Product; score: number }`, sorted by score descending, active products only, default limit 5. **This scoring is the confidence signal the AI layer (Plan 2) uses for its clarify-vs-proceed threshold (PRD §9).**

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/products.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import { getProductBySku, upsertProduct } from "../src/products/products.ts";
import { normalize, searchProducts } from "../src/products/search.ts";

async function seedCatalog(db: Awaited<ReturnType<typeof createPgliteDb>>) {
  await upsertProduct(db, {
    sku: "HP-15S-FQ5",
    brand: "HP",
    category: "Laptop",
    name: "HP 15s-fq5786TU",
    model: "15s-fq5786TU",
    specs: "i5-1235U 8GB 512GB SSD",
    aliases: ["hp 15s", "hp i5 8/512"],
  });
  await upsertProduct(db, {
    sku: "LEN-IP3-I5",
    brand: "Lenovo",
    category: "Laptop",
    name: "Lenovo IdeaPad Slim 3",
    model: "82RK00WMIN",
    specs: "i5-1235U 16GB 512GB SSD",
    aliases: ["ideapad 3", "lenovo i5 16gb"],
  });
  await upsertProduct(db, {
    sku: "SAM-M24-FHD",
    brand: "Samsung",
    category: "Monitor",
    name: "Samsung LF24T350 24-inch Monitor",
    model: "LF24T350FHWXXL",
    specs: "24 inch FHD IPS 75Hz",
    aliases: ["samsung 24 monitor"],
  });
}

test("upsertProduct inserts then updates by sku", async () => {
  const db = await createPgliteDb();
  await seedCatalog(db);
  const updated = await upsertProduct(db, {
    sku: "HP-15S-FQ5",
    brand: "HP",
    category: "Laptop",
    name: "HP 15s-fq5786TU (2024)",
    aliases: ["hp 15s"],
  });
  expect(updated.name).toBe("HP 15s-fq5786TU (2024)");
  expect((await getProductBySku(db, "HP-15S-FQ5"))!.name).toBe("HP 15s-fq5786TU (2024)");
});

test("normalize strips punctuation and case", () => {
  expect(normalize("HP i5 8/512 ta!")).toBe("hp i5 8 512 ta");
});

test("exact sku match scores 100", async () => {
  const db = await createPgliteDb();
  await seedCatalog(db);
  const results = await searchProducts(db, "HP-15S-FQ5");
  expect(results[0]!.product.sku).toBe("HP-15S-FQ5");
  expect(results[0]!.score).toBe(100);
});

test("exact alias match scores 90 — dealer shorthand 'HP i5 8/512'", async () => {
  const db = await createPgliteDb();
  await seedCatalog(db);
  const results = await searchProducts(db, "HP i5 8/512");
  expect(results[0]!.product.sku).toBe("HP-15S-FQ5");
  expect(results[0]!.score).toBe(90);
});

test("token search ranks by coverage and returns multiple candidates", async () => {
  const db = await createPgliteDb();
  await seedCatalog(db);
  const results = await searchProducts(db, "lenovo i5 laptop");
  expect(results[0]!.product.sku).toBe("LEN-IP3-I5");
  const skus = results.map((r) => r.product.sku);
  expect(skus).toContain("HP-15S-FQ5"); // shares "i5" and "laptop" tokens
});

test("no match returns empty; inactive products excluded", async () => {
  const db = await createPgliteDb();
  await seedCatalog(db);
  expect(await searchProducts(db, "printer toner")).toEqual([]);

  await upsertProduct(db, {
    sku: "SAM-M24-FHD",
    brand: "Samsung",
    category: "Monitor",
    name: "Samsung LF24T350 24-inch Monitor",
    active: false,
  });
  const results = await searchProducts(db, "samsung monitor");
  expect(results).toEqual([]);
});

test("limit caps results", async () => {
  const db = await createPgliteDb();
  await seedCatalog(db);
  const results = await searchProducts(db, "laptop i5", 1);
  expect(results).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/products.test.ts`
Expected: FAIL — product modules do not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/products/products.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { products } from "../db/schema.ts";
import type { Product } from "../db/schema.ts";

export interface ProductInput {
  sku: string;
  brand: string;
  category: string;
  name: string;
  model?: string | null;
  specs?: string | null;
  aliases?: string[];
  active?: boolean;
}

export async function upsertProduct(db: Db, input: ProductInput): Promise<Product> {
  const values = {
    sku: input.sku,
    brand: input.brand,
    category: input.category,
    name: input.name,
    model: input.model ?? null,
    specs: input.specs ?? null,
    aliases: input.aliases ?? [],
    active: input.active ?? true,
  };
  const [row] = await db
    .insert(products)
    .values(values)
    .onConflictDoUpdate({ target: products.sku, set: values })
    .returning();
  return row!;
}

export async function getProductBySku(db: Db, sku: string): Promise<Product | undefined> {
  const [row] = await db.select().from(products).where(eq(products.sku, sku));
  return row;
}
```

Create `packages/core/src/products/search.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { products } from "../db/schema.ts";
import type { Product } from "../db/schema.ts";

/** Lowercase; strip everything except Latin letters, digits, and Bengali script; collapse spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface ScoredProduct {
  product: Product;
  score: number;
}

/**
 * 100 = exact SKU. 90 = exact alias (dealer shorthand). ≤60 = token coverage:
 * fraction of query tokens found in the product's text (prefix matches count half).
 * Score is the AI layer's confidence signal for clarify-vs-proceed (PRD §9).
 */
export function scoreProduct(product: Product, query: string): number {
  const q = normalize(query);
  if (q === "") return 0;
  if (q === normalize(product.sku)) return 100;

  const aliases = product.aliases.map(normalize);
  if (aliases.includes(q)) return 90;

  const haystack = [
    normalize(product.sku),
    normalize(product.name),
    normalize(product.brand),
    normalize(product.model ?? ""),
    normalize(product.category),
    normalize(product.specs ?? ""),
    ...aliases,
  ].join(" ");
  const hayTokens = new Set(haystack.split(" ").filter(Boolean));

  const queryTokens = q.split(" ");
  let matched = 0;
  for (const token of queryTokens) {
    if (hayTokens.has(token)) {
      matched += 1;
    } else if (token.length >= 3 && [...hayTokens].some((h) => h.startsWith(token))) {
      matched += 0.5;
    }
  }
  if (matched === 0) return 0;
  return Math.round((matched / queryTokens.length) * 60);
}

/** Loads all active products and scores in memory — fine for a 600-SKU catalog. */
export async function searchProducts(db: Db, query: string, limit = 5): Promise<ScoredProduct[]> {
  const all = await db.select().from(products).where(eq(products.active, true));
  return all
    .map((product) => ({ product, score: scoreProduct(product, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/products.test.ts`
Expected: PASS — 7 tests green. If the coverage test ranks unexpectedly, print the scores — the fix belongs in the test's seed data expectations only if the ranking is genuinely correct (Lenovo must outrank HP for "lenovo i5 laptop").

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/products packages/core/tests/products.test.ts
git commit -m "feat(core): product repository and scored catalog search"
```

---

### Task 5: Pricing with validity windows

**Files:**

- Create: `packages/core/src/prices/prices.ts`
- Test: `packages/core/tests/prices.test.ts`

**Interfaces:**

- Consumes: `Db`, `prices` table, `Price` type (Task 2); `CoreError` (Task 3); `upsertProduct` (Task 4, test seeding).
- Produces:
  - `setPrice(db: Db, input: { sku: string; amountTaka: number; validFrom?: Date }): Promise<Price>` — closes any open price row (sets its `validTo`), inserts the new one. Throws `VALIDATION` for non-positive/non-integer amounts.
  - `getPrice(db: Db, sku: string, now?: Date): Promise<Price | undefined>` — the price whose `[validFrom, validTo)` window contains `now`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/prices.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import { getPrice, setPrice } from "../src/prices/prices.ts";
import { upsertProduct } from "../src/products/products.ts";

async function seed(db: Awaited<ReturnType<typeof createPgliteDb>>) {
  await upsertProduct(db, { sku: "HP-15S-FQ5", brand: "HP", category: "Laptop", name: "HP 15s" });
}

test("no price rows means undefined", async () => {
  const db = await createPgliteDb();
  await seed(db);
  expect(await getPrice(db, "HP-15S-FQ5")).toBeUndefined();
});

test("setPrice then getPrice returns current amount", async () => {
  const db = await createPgliteDb();
  await seed(db);
  await setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 72500 });
  expect((await getPrice(db, "HP-15S-FQ5"))!.amountTaka).toBe(72500);
});

test("a new price closes the previous one", async () => {
  const db = await createPgliteDb();
  await seed(db);
  const t1 = new Date("2026-07-01T00:00:00Z");
  const t2 = new Date("2026-07-15T00:00:00Z");
  await setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 72500, validFrom: t1 });
  await setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 71000, validFrom: t2 });

  const before = new Date("2026-07-10T00:00:00Z");
  const after = new Date("2026-07-20T00:00:00Z");
  expect((await getPrice(db, "HP-15S-FQ5", before))!.amountTaka).toBe(72500);
  expect((await getPrice(db, "HP-15S-FQ5", after))!.amountTaka).toBe(71000);
});

test("rejects non-positive or fractional amounts", async () => {
  const db = await createPgliteDb();
  await seed(db);
  await expect(setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 0 })).rejects.toMatchObject({
    code: "VALIDATION",
  });
  await expect(setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 99.5 })).rejects.toMatchObject({
    code: "VALIDATION",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/prices.test.ts`
Expected: FAIL — `../src/prices/prices.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/prices/prices.ts`:

```ts
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { prices } from "../db/schema.ts";
import type { Price } from "../db/schema.ts";
import { CoreError } from "../errors.ts";

export async function setPrice(
  db: Db,
  input: { sku: string; amountTaka: number; validFrom?: Date },
): Promise<Price> {
  if (!Number.isInteger(input.amountTaka) || input.amountTaka <= 0) {
    throw new CoreError(
      "VALIDATION",
      `Price must be a positive whole taka amount, got ${input.amountTaka}`,
    );
  }
  const validFrom = input.validFrom ?? new Date();
  await db
    .update(prices)
    .set({ validTo: validFrom })
    .where(and(eq(prices.sku, input.sku), isNull(prices.validTo)));
  const [row] = await db
    .insert(prices)
    .values({ sku: input.sku, amountTaka: input.amountTaka, validFrom })
    .returning();
  return row!;
}

export async function getPrice(db: Db, sku: string, now = new Date()): Promise<Price | undefined> {
  const [row] = await db
    .select()
    .from(prices)
    .where(
      and(
        eq(prices.sku, sku),
        lte(prices.validFrom, now),
        or(isNull(prices.validTo), gt(prices.validTo, now)),
      ),
    )
    .orderBy(desc(prices.validFrom))
    .limit(1);
  return row;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/prices.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/prices packages/core/tests/prices.test.ts
git commit -m "feat(core): price list with validity windows"
```

---

### Task 6: Inventory

**Files:**

- Create: `packages/core/src/inventory/inventory.ts`
- Test: `packages/core/tests/inventory.test.ts`

**Interfaces:**

- Consumes: `Db`, `inventory` table, `InventoryRow` type (Task 2); `CoreError` (Task 3); `upsertProduct` (Task 4, test seeding).
- Produces:
  - `setInventory(db: Db, input: { sku: string; available: number }): Promise<InventoryRow>` — upsert by `sku`; never touches `reserved`. Throws `VALIDATION` on negative/fractional.
  - `getInventory(db: Db, sku: string): Promise<InventoryRow | undefined>`
  - `reserveStock(db: Db, sku: string, quantity: number): Promise<void>` — moves `quantity` from `available` to `reserved`; throws `INSUFFICIENT_STOCK` if `available < quantity`. Called inside the order-approval transaction (Task 7).
  - `releaseStock(db: Db, sku: string, quantity: number): Promise<void>` — reverse of reserve (cancellations).

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/inventory.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import {
  getInventory,
  releaseStock,
  reserveStock,
  setInventory,
} from "../src/inventory/inventory.ts";
import { upsertProduct } from "../src/products/products.ts";

const SKU = "HP-15S-FQ5";

async function seed(db: Awaited<ReturnType<typeof createPgliteDb>>) {
  await upsertProduct(db, { sku: SKU, brand: "HP", category: "Laptop", name: "HP 15s" });
}

test("getInventory is undefined until set; setInventory upserts", async () => {
  const db = await createPgliteDb();
  await seed(db);
  expect(await getInventory(db, SKU)).toBeUndefined();

  await setInventory(db, { sku: SKU, available: 12 });
  expect((await getInventory(db, SKU))!.available).toBe(12);

  await setInventory(db, { sku: SKU, available: 8 });
  expect((await getInventory(db, SKU))!.available).toBe(8);
});

test("setInventory preserves reserved quantity", async () => {
  const db = await createPgliteDb();
  await seed(db);
  await setInventory(db, { sku: SKU, available: 10 });
  await reserveStock(db, SKU, 4);
  await setInventory(db, { sku: SKU, available: 20 });
  const row = (await getInventory(db, SKU))!;
  expect(row.available).toBe(20);
  expect(row.reserved).toBe(4);
});

test("reserveStock moves stock and guards against overdraw", async () => {
  const db = await createPgliteDb();
  await seed(db);
  await setInventory(db, { sku: SKU, available: 8 });

  await reserveStock(db, SKU, 5);
  let row = (await getInventory(db, SKU))!;
  expect(row.available).toBe(3);
  expect(row.reserved).toBe(5);

  await expect(reserveStock(db, SKU, 4)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

  await releaseStock(db, SKU, 5);
  row = (await getInventory(db, SKU))!;
  expect(row.available).toBe(8);
  expect(row.reserved).toBe(0);
});

test("validation on negative and fractional values", async () => {
  const db = await createPgliteDb();
  await seed(db);
  await expect(setInventory(db, { sku: SKU, available: -1 })).rejects.toMatchObject({
    code: "VALIDATION",
  });
  await expect(setInventory(db, { sku: SKU, available: 2.5 })).rejects.toMatchObject({
    code: "VALIDATION",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/inventory.test.ts`
Expected: FAIL — `../src/inventory/inventory.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/inventory/inventory.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { inventory } from "../db/schema.ts";
import type { InventoryRow } from "../db/schema.ts";
import { CoreError } from "../errors.ts";

export async function setInventory(
  db: Db,
  input: { sku: string; available: number },
): Promise<InventoryRow> {
  if (!Number.isInteger(input.available) || input.available < 0) {
    throw new CoreError(
      "VALIDATION",
      `Available quantity must be a non-negative integer, got ${input.available}`,
    );
  }
  const [row] = await db
    .insert(inventory)
    .values({ sku: input.sku, available: input.available, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: inventory.sku,
      set: { available: input.available, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getInventory(db: Db, sku: string): Promise<InventoryRow | undefined> {
  const [row] = await db.select().from(inventory).where(eq(inventory.sku, sku));
  return row;
}

/** MVP scale: single-process ops approval; no row locking needed yet. */
export async function reserveStock(db: Db, sku: string, quantity: number): Promise<void> {
  const row = await getInventory(db, sku);
  if (!row || row.available < quantity) {
    throw new CoreError(
      "INSUFFICIENT_STOCK",
      `Only ${row?.available ?? 0} unit(s) of ${sku} available, requested ${quantity}`,
    );
  }
  await db
    .update(inventory)
    .set({
      available: row.available - quantity,
      reserved: row.reserved + quantity,
      updatedAt: new Date(),
    })
    .where(eq(inventory.sku, sku));
}

export async function releaseStock(db: Db, sku: string, quantity: number): Promise<void> {
  const row = await getInventory(db, sku);
  if (!row) throw new CoreError("NOT_FOUND", `No inventory row for ${sku}`);
  await db
    .update(inventory)
    .set({
      available: row.available + quantity,
      reserved: Math.max(0, row.reserved - quantity),
      updatedAt: new Date(),
    })
    .where(eq(inventory.sku, sku));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/inventory.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/inventory packages/core/tests/inventory.test.ts
git commit -m "feat(core): inventory with reserve/release stock movements"
```

---

### Task 7: Order lifecycle

**Files:**

- Create: `packages/core/src/orders/orders.ts`
- Test: `packages/core/tests/orders.test.ts`

**Interfaces:**

- Consumes: `Db`, tables + `Order`/`OrderItem`/`OrderStatus` types (Task 2); `CoreError` (Task 3); `getProductBySku` (Task 4); `getPrice` (Task 5); `reserveStock`/`releaseStock` (Task 6).
- Produces (all throw `CoreError` on expected failures):
  - `type DraftItemInput = { sku: string; quantity: number }`
  - `type OrderWithItems = Order & { items: OrderItem[] }`
  - `createDraftOrder(db, input: { dealerId: number; items: DraftItemInput[] }): Promise<OrderWithItems>` — validates dealer active (`NOT_FOUND`/`DEALER_INACTIVE`), product exists+active (`NOT_FOUND`), quantity positive integer (`VALIDATION`), current price exists (`NO_PRICE`); snapshots `unitPriceTaka`.
  - `modifyDraftOrder(db, input: { orderId: number; items: DraftItemInput[] }): Promise<OrderWithItems>` — replaces items with fresh price snapshots; only while status is `draft` (`INVALID_STATE`).
  - `submitForReview(db, orderId: number): Promise<OrderWithItems>` — `draft → pending_review`.
  - `approveOrder(db, input: { orderId: number; reviewer: string; note?: string }): Promise<OrderWithItems>` — `pending_review → approved`; reserves stock for every item in one transaction (`INSUFFICIENT_STOCK` rolls everything back).
  - `rejectOrder(db, input: { orderId: number; reviewer: string; note?: string }): Promise<OrderWithItems>` — `pending_review → rejected`.
  - `confirmOrder(db, orderId: number): Promise<OrderWithItems>` — `approved → confirmed` (Plan 3 calls this after the WhatsApp confirmation sends).
  - `cancelOrder(db, orderId: number): Promise<OrderWithItems>` — allowed from `draft`, `pending_review`, `approved`, `confirmed`; releases reserved stock when cancelling from `approved`/`confirmed`.
  - `getOrder(db, input: { dealerId: number; orderId?: number }): Promise<OrderWithItems | undefined>` — specific order (must belong to the dealer) or the dealer's most recent order.

- [ ] **Step 1: Write the failing tests for draft creation and modification**

Create `packages/core/tests/orders.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { upsertDealer } from "../src/dealers/dealers.ts";
import { createPgliteDb } from "../src/db/pglite.ts";
import { getInventory, setInventory } from "../src/inventory/inventory.ts";
import {
  approveOrder,
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  getOrder,
  modifyDraftOrder,
  rejectOrder,
  submitForReview,
} from "../src/orders/orders.ts";
import { setPrice } from "../src/prices/prices.ts";
import { upsertProduct } from "../src/products/products.ts";

type TestDb = Awaited<ReturnType<typeof createPgliteDb>>;

async function seed(db: TestDb) {
  const dealer = await upsertDealer(db, { phone: "+8801700000001", businessName: "Rahim Traders" });
  await upsertProduct(db, { sku: "HP-15S-FQ5", brand: "HP", category: "Laptop", name: "HP 15s" });
  await upsertProduct(db, {
    sku: "LEN-IP3-I5",
    brand: "Lenovo",
    category: "Laptop",
    name: "IdeaPad 3",
  });
  await setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 72500 });
  await setPrice(db, { sku: "LEN-IP3-I5", amountTaka: 68000 });
  await setInventory(db, { sku: "HP-15S-FQ5", available: 8 });
  await setInventory(db, { sku: "LEN-IP3-I5", available: 20 });
  return dealer;
}

test("createDraftOrder snapshots the current price", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const order = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "HP-15S-FQ5", quantity: 10 }],
  });
  expect(order.status).toBe("draft");
  expect(order.items).toHaveLength(1);
  expect(order.items[0]!.unitPriceTaka).toBe(72500);

  await setPrice(db, { sku: "HP-15S-FQ5", amountTaka: 70000 });
  const unchanged = await getOrder(db, { dealerId: dealer.id, orderId: order.id });
  expect(unchanged!.items[0]!.unitPriceTaka).toBe(72500);
});

test("createDraftOrder validation failures", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);

  await expect(
    createDraftOrder(db, { dealerId: 999, items: [{ sku: "HP-15S-FQ5", quantity: 1 }] }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });

  await expect(
    createDraftOrder(db, { dealerId: dealer.id, items: [{ sku: "NOPE", quantity: 1 }] }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });

  await expect(
    createDraftOrder(db, { dealerId: dealer.id, items: [{ sku: "HP-15S-FQ5", quantity: 0 }] }),
  ).rejects.toMatchObject({ code: "VALIDATION" });

  await expect(createDraftOrder(db, { dealerId: dealer.id, items: [] })).rejects.toMatchObject({
    code: "VALIDATION",
  });

  await upsertProduct(db, { sku: "NO-PRICE", brand: "X", category: "C", name: "Unpriced" });
  await expect(
    createDraftOrder(db, { dealerId: dealer.id, items: [{ sku: "NO-PRICE", quantity: 1 }] }),
  ).rejects.toMatchObject({ code: "NO_PRICE" });
});

test("modifyDraftOrder replaces items while draft only", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const order = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "HP-15S-FQ5", quantity: 10 }],
  });

  const modified = await modifyDraftOrder(db, {
    orderId: order.id,
    items: [{ sku: "HP-15S-FQ5", quantity: 15 }],
  });
  expect(modified.items[0]!.quantity).toBe(15);

  await submitForReview(db, order.id);
  await expect(
    modifyDraftOrder(db, { orderId: order.id, items: [{ sku: "HP-15S-FQ5", quantity: 5 }] }),
  ).rejects.toMatchObject({ code: "INVALID_STATE" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/orders.test.ts`
Expected: FAIL — `../src/orders/orders.ts` does not exist.

- [ ] **Step 3: Write the order module**

Create `packages/core/src/orders/orders.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dealers, orderItems, orders, products } from "../db/schema.ts";
import type { Order, OrderItem, OrderStatus } from "../db/schema.ts";
import { CoreError } from "../errors.ts";
import { releaseStock, reserveStock } from "../inventory/inventory.ts";
import { getPrice } from "../prices/prices.ts";

export interface DraftItemInput {
  sku: string;
  quantity: number;
}

export type OrderWithItems = Order & { items: OrderItem[] };

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["approved", "rejected", "cancelled"],
  approved: ["confirmed", "cancelled"],
  confirmed: ["fulfilled", "cancelled"],
  rejected: [],
  fulfilled: [],
  cancelled: [],
};

function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new CoreError("INVALID_STATE", `Cannot move order from '${from}' to '${to}'`);
  }
}

async function requireOrder(db: Db, orderId: number): Promise<Order> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new CoreError("NOT_FOUND", `No order #${orderId}`);
  return order;
}

async function loadItems(db: Db, orderId: number): Promise<OrderItem[]> {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

/** Validates SKUs/quantities and snapshots current prices. */
async function buildItemRows(
  db: Db,
  items: DraftItemInput[],
): Promise<{ sku: string; quantity: number; unitPriceTaka: number }[]> {
  if (items.length === 0) throw new CoreError("VALIDATION", "An order needs at least one item");
  const rows = [];
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new CoreError("VALIDATION", `Quantity for ${item.sku} must be a positive integer`);
    }
    const [product] = await db.select().from(products).where(eq(products.sku, item.sku));
    if (!product || !product.active) {
      throw new CoreError("NOT_FOUND", `Unknown or inactive product: ${item.sku}`);
    }
    const price = await getPrice(db, item.sku);
    if (!price) throw new CoreError("NO_PRICE", `No current price for ${item.sku}`);
    rows.push({ sku: item.sku, quantity: item.quantity, unitPriceTaka: price.amountTaka });
  }
  return rows;
}

export async function createDraftOrder(
  db: Db,
  input: { dealerId: number; items: DraftItemInput[] },
): Promise<OrderWithItems> {
  const [dealer] = await db.select().from(dealers).where(eq(dealers.id, input.dealerId));
  if (!dealer) throw new CoreError("NOT_FOUND", `No dealer #${input.dealerId}`);
  if (dealer.status !== "active") {
    throw new CoreError("DEALER_INACTIVE", `Dealer ${dealer.businessName} is suspended`);
  }
  const rows = await buildItemRows(db, input.items);
  return db.transaction(async (tx) => {
    const [order] = await tx.insert(orders).values({ dealerId: input.dealerId }).returning();
    const items = await tx
      .insert(orderItems)
      .values(rows.map((row) => ({ ...row, orderId: order!.id })))
      .returning();
    return { ...order!, items };
  });
}

export async function modifyDraftOrder(
  db: Db,
  input: { orderId: number; items: DraftItemInput[] },
): Promise<OrderWithItems> {
  const order = await requireOrder(db, input.orderId);
  if (order.status !== "draft") {
    throw new CoreError(
      "INVALID_STATE",
      `Only draft orders can be modified (order is '${order.status}')`,
    );
  }
  const rows = await buildItemRows(db, input.items);
  return db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
    const items = await tx
      .insert(orderItems)
      .values(rows.map((row) => ({ ...row, orderId: order.id })))
      .returning();
    const [updated] = await tx
      .update(orders)
      .set({ updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    return { ...updated!, items };
  });
}

async function setStatus(
  db: Db,
  orderId: number,
  to: OrderStatus,
  extra: Partial<{ reviewer: string; reviewNote: string }> = {},
): Promise<OrderWithItems> {
  const order = await requireOrder(db, orderId);
  assertTransition(order.status, to);
  const [updated] = await db
    .update(orders)
    .set({ status: to, updatedAt: new Date(), ...extra })
    .where(eq(orders.id, orderId))
    .returning();
  return { ...updated!, items: await loadItems(db, orderId) };
}

export async function submitForReview(db: Db, orderId: number): Promise<OrderWithItems> {
  return setStatus(db, orderId, "pending_review");
}

export async function approveOrder(
  db: Db,
  input: { orderId: number; reviewer: string; note?: string },
): Promise<OrderWithItems> {
  return db.transaction(async (tx) => {
    const order = await requireOrder(tx, input.orderId);
    assertTransition(order.status, "approved");
    const items = await loadItems(tx, input.orderId);
    for (const item of items) {
      await reserveStock(tx, item.sku, item.quantity);
    }
    const [updated] = await tx
      .update(orders)
      .set({
        status: "approved",
        reviewer: input.reviewer,
        reviewNote: input.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, input.orderId))
      .returning();
    return { ...updated!, items };
  });
}

export async function rejectOrder(
  db: Db,
  input: { orderId: number; reviewer: string; note?: string },
): Promise<OrderWithItems> {
  return setStatus(db, input.orderId, "rejected", {
    reviewer: input.reviewer,
    ...(input.note ? { reviewNote: input.note } : {}),
  });
}

export async function confirmOrder(db: Db, orderId: number): Promise<OrderWithItems> {
  return setStatus(db, orderId, "confirmed");
}

export async function cancelOrder(db: Db, orderId: number): Promise<OrderWithItems> {
  return db.transaction(async (tx) => {
    const order = await requireOrder(tx, orderId);
    assertTransition(order.status, "cancelled");
    if (order.status === "approved" || order.status === "confirmed") {
      const items = await loadItems(tx, orderId);
      for (const item of items) {
        await releaseStock(tx, item.sku, item.quantity);
      }
    }
    const [updated] = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return { ...updated!, items: await loadItems(tx, orderId) };
  });
}

export async function getOrder(
  db: Db,
  input: { dealerId: number; orderId?: number },
): Promise<OrderWithItems | undefined> {
  const rows =
    input.orderId === undefined
      ? await db
          .select()
          .from(orders)
          .where(eq(orders.dealerId, input.dealerId))
          .orderBy(desc(orders.createdAt), desc(orders.id))
          .limit(1)
      : await db.select().from(orders).where(eq(orders.id, input.orderId));
  const order = rows[0];
  if (!order || order.dealerId !== input.dealerId) return undefined;
  return { ...order, items: await loadItems(db, order.id) };
}
```

Note: `db.transaction` passes a transaction handle that satisfies `Db`, so `reserveStock(tx, …)` composes into the approval transaction — an `INSUFFICIENT_STOCK` throw rolls back the whole approval.

- [ ] **Step 4: Run the draft tests to verify they pass**

Run from `packages/core/`: `vp test tests/orders.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit the draft lifecycle**

```bash
git add packages/core/src/orders packages/core/tests/orders.test.ts
git commit -m "feat(core): draft order creation and modification with price snapshots"
```

- [ ] **Step 6: Write the failing tests for review transitions and stock effects**

Append to `packages/core/tests/orders.test.ts`:

```ts
test("approve reserves stock; insufficient stock rolls back the approval", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const order = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "HP-15S-FQ5", quantity: 10 }], // only 8 available
  });
  await submitForReview(db, order.id);

  await expect(approveOrder(db, { orderId: order.id, reviewer: "ops1" })).rejects.toMatchObject({
    code: "INSUFFICIENT_STOCK",
  });
  const after = await getOrder(db, { dealerId: dealer.id, orderId: order.id });
  expect(after!.status).toBe("pending_review"); // rolled back
  expect((await getInventory(db, "HP-15S-FQ5"))!.available).toBe(8);

  const ok = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "HP-15S-FQ5", quantity: 8 }],
  });
  await submitForReview(db, ok.id);
  const approved = await approveOrder(db, { orderId: ok.id, reviewer: "ops1" });
  expect(approved.status).toBe("approved");
  expect(approved.reviewer).toBe("ops1");
  const inv = (await getInventory(db, "HP-15S-FQ5"))!;
  expect(inv.available).toBe(0);
  expect(inv.reserved).toBe(8);
});

test("reject and confirm transitions", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const order = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "LEN-IP3-I5", quantity: 2 }],
  });
  await submitForReview(db, order.id);
  const rejected = await rejectOrder(db, {
    orderId: order.id,
    reviewer: "ops1",
    note: "duplicate",
  });
  expect(rejected.status).toBe("rejected");
  expect(rejected.reviewNote).toBe("duplicate");

  const order2 = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "LEN-IP3-I5", quantity: 2 }],
  });
  await submitForReview(db, order2.id);
  await approveOrder(db, { orderId: order2.id, reviewer: "ops1" });
  const confirmed = await confirmOrder(db, order2.id);
  expect(confirmed.status).toBe("confirmed");
});

test("cancelling an approved order releases reserved stock", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const order = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "LEN-IP3-I5", quantity: 5 }],
  });
  await submitForReview(db, order.id);
  await approveOrder(db, { orderId: order.id, reviewer: "ops1" });

  const cancelled = await cancelOrder(db, order.id);
  expect(cancelled.status).toBe("cancelled");
  const inv = (await getInventory(db, "LEN-IP3-I5"))!;
  expect(inv.available).toBe(20);
  expect(inv.reserved).toBe(0);
});

test("invalid transitions throw INVALID_STATE", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const order = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "LEN-IP3-I5", quantity: 1 }],
  });
  await expect(approveOrder(db, { orderId: order.id, reviewer: "ops1" })).rejects.toMatchObject({
    code: "INVALID_STATE", // draft cannot jump to approved
  });
  await expect(confirmOrder(db, order.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
});

test("getOrder scopes to the dealer and finds the latest order", async () => {
  const db = await createPgliteDb();
  const dealer = await seed(db);
  const other = await upsertDealer(db, { phone: "+8801700000002", businessName: "Karim Store" });

  const first = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "HP-15S-FQ5", quantity: 1 }],
  });
  const second = await createDraftOrder(db, {
    dealerId: dealer.id,
    items: [{ sku: "LEN-IP3-I5", quantity: 2 }],
  });

  expect((await getOrder(db, { dealerId: dealer.id }))!.id).toBe(second.id);
  expect(await getOrder(db, { dealerId: other.id, orderId: first.id })).toBeUndefined();
  expect(await getOrder(db, { dealerId: other.id })).toBeUndefined();
});
```

- [ ] **Step 7: Run test to verify everything passes**

Run from `packages/core/`: `vp test tests/orders.test.ts`
Expected: PASS — 8 tests green (implementation was completed in Step 3; if any of these fail, fix `src/orders/orders.ts`, not the tests).

- [ ] **Step 8: Commit**

```bash
git add packages/core/tests/orders.test.ts packages/core/src/orders
git commit -m "feat(core): order review transitions with stock reservation"
```

---

### Task 8: CSV importers

**Files:**

- Create: `packages/core/src/import/csv.ts`
- Create: `packages/core/src/import/importers.ts`
- Test: `packages/core/tests/import.test.ts`

**Interfaces:**

- Consumes: `upsertDealer` (Task 3), `upsertProduct` (Task 4), `setPrice`/`getPrice` (Task 5), `setInventory`/`getInventory` (Task 6), `Db` (Task 2).
- Produces (each returns the same report shape; **these are the ops-facing functions the admin app (Plan 4) wires to its upload UI**):
  - `type ImportReport = { total: number; inserted: number; updated: number; skipped: number; errors: { row: number; message: string }[] }` (`row` is the 1-based CSV line number, header = row 1).
  - `parseCsv(content: string): Record<string, string>[]`
  - `importProducts(db, csvContent: string): Promise<ImportReport>` — columns `sku,brand,category,name,model,specs,aliases,active`; `aliases` pipe-separated (`hp 15s|hp i5 8/512`); `active` is `true`/`false`, default `true`.
  - `importDealers(db, csvContent: string): Promise<ImportReport>` — columns `phone,business_name,contact_person,status`; upsert by `phone`.
  - `importInventory(db, csvContent: string): Promise<ImportReport>` — columns `sku,available`; unknown SKU → error row.
  - `importPrices(db, csvContent: string): Promise<ImportReport>` — columns `sku,amount_taka`; unknown SKU → error row; unchanged amount → `skipped`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/import.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { findDealerByPhone } from "../src/dealers/dealers.ts";
import { createPgliteDb } from "../src/db/pglite.ts";
import {
  importDealers,
  importInventory,
  importPrices,
  importProducts,
} from "../src/import/importers.ts";
import { getInventory } from "../src/inventory/inventory.ts";
import { getPrice } from "../src/prices/prices.ts";
import { getProductBySku } from "../src/products/products.ts";

const PRODUCTS_CSV = `sku,brand,category,name,model,specs,aliases,active
HP-15S-FQ5,HP,Laptop,"HP 15s-fq5786TU",15s-fq5786TU,"i5-1235U 8GB 512GB","hp 15s|hp i5 8/512",true
LEN-IP3-I5,Lenovo,Laptop,"Lenovo IdeaPad Slim 3",82RK00WMIN,"i5 16GB 512GB","ideapad 3",true
,MissingBrand,Laptop,"Broken row",,,,true`;

test("importProducts inserts, updates, splits aliases, reports bad rows", async () => {
  const db = await createPgliteDb();
  const first = await importProducts(db, PRODUCTS_CSV);
  expect(first.total).toBe(3);
  expect(first.inserted).toBe(2);
  expect(first.updated).toBe(0);
  expect(first.errors).toHaveLength(1);
  expect(first.errors[0]!.row).toBe(4); // header is row 1

  const product = (await getProductBySku(db, "HP-15S-FQ5"))!;
  expect(product.aliases).toEqual(["hp 15s", "hp i5 8/512"]);

  const second = await importProducts(db, PRODUCTS_CSV);
  expect(second.inserted).toBe(0);
  expect(second.updated).toBe(2);
});

test("importDealers upserts by phone", async () => {
  const db = await createPgliteDb();
  const csv = `phone,business_name,contact_person,status
+8801700000001,Rahim Traders,Rahim,active
+8801700000002,Karim Store,,active`;
  const report = await importDealers(db, csv);
  expect(report.inserted).toBe(2);
  expect((await findDealerByPhone(db, "+8801700000001"))!.businessName).toBe("Rahim Traders");
});

test("importInventory updates known SKUs and reports unknown ones", async () => {
  const db = await createPgliteDb();
  await importProducts(db, PRODUCTS_CSV);
  const csv = `sku,available
HP-15S-FQ5,8
UNKNOWN-SKU,5`;
  const report = await importInventory(db, csv);
  expect(report.updated + report.inserted).toBe(1);
  expect(report.errors).toHaveLength(1);
  expect((await getInventory(db, "HP-15S-FQ5"))!.available).toBe(8);
});

test("importPrices sets new prices and skips unchanged ones", async () => {
  const db = await createPgliteDb();
  await importProducts(db, PRODUCTS_CSV);
  const csv = `sku,amount_taka
HP-15S-FQ5,72500
LEN-IP3-I5,68000`;
  const first = await importPrices(db, csv);
  expect(first.inserted).toBe(2);

  const again = await importPrices(db, csv);
  expect(again.skipped).toBe(2);
  expect(again.inserted).toBe(0);

  const changed = await importPrices(db, `sku,amount_taka\nHP-15S-FQ5,71000`);
  expect(changed.inserted).toBe(1);
  expect((await getPrice(db, "HP-15S-FQ5"))!.amountTaka).toBe(71000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/import.test.ts`
Expected: FAIL — import modules do not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/import/csv.ts`:

```ts
import { parse } from "csv-parse/sync";

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export function emptyReport(total: number): ImportReport {
  return { total, inserted: 0, updated: 0, skipped: 0, errors: [] };
}

export function parseCsv(content: string): Record<string, string>[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];
}
```

Create `packages/core/src/import/importers.ts`:

```ts
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { dealers, products } from "../db/schema.ts";
import { upsertDealer } from "../dealers/dealers.ts";
import { getInventory, setInventory } from "../inventory/inventory.ts";
import { getPrice, setPrice } from "../prices/prices.ts";
import { upsertProduct } from "../products/products.ts";
import { emptyReport, parseCsv } from "./csv.ts";
import type { ImportReport } from "./csv.ts";

function issueText(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

/** Runs `handle` per parsed row, collecting zod/domain failures as error rows. */
async function runImport<T>(
  csvContent: string,
  schema: z.ZodType<T>,
  handle: (row: T, report: ImportReport) => Promise<void>,
): Promise<ImportReport> {
  const rows = parseCsv(csvContent);
  const report = emptyReport(rows.length);
  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2; // 1-based; header is row 1
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      report.errors.push({ row: rowNumber, message: issueText(parsed.error) });
      continue;
    }
    try {
      await handle(parsed.data, report);
    } catch (error) {
      report.errors.push({ row: rowNumber, message: (error as Error).message });
    }
  }
  return report;
}

const productRow = z.object({
  sku: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  category: z.string().trim().min(1),
  name: z.string().trim().min(1),
  model: z.string().trim().optional().default(""),
  specs: z.string().trim().optional().default(""),
  aliases: z.string().trim().optional().default(""),
  active: z.enum(["true", "false"]).optional().default("true"),
});

export async function importProducts(db: Db, csvContent: string): Promise<ImportReport> {
  const existing = new Set(
    (await db.select({ sku: products.sku }).from(products)).map((r) => r.sku),
  );
  return runImport(csvContent, productRow, async (row, report) => {
    await upsertProduct(db, {
      sku: row.sku,
      brand: row.brand,
      category: row.category,
      name: row.name,
      model: row.model || null,
      specs: row.specs || null,
      aliases: row.aliases
        ? row.aliases
            .split("|")
            .map((alias) => alias.trim())
            .filter(Boolean)
        : [],
      active: row.active === "true",
    });
    if (existing.has(row.sku)) {
      report.updated += 1;
    } else {
      report.inserted += 1;
      existing.add(row.sku);
    }
  });
}

const dealerRow = z.object({
  phone: z.string().trim().min(1),
  business_name: z.string().trim().min(1),
  contact_person: z.string().trim().optional().default(""),
  status: z.enum(["active", "suspended"]).optional().default("active"),
});

export async function importDealers(db: Db, csvContent: string): Promise<ImportReport> {
  const existing = new Set(
    (await db.select({ phone: dealers.phone }).from(dealers)).map((r) => r.phone),
  );
  return runImport(csvContent, dealerRow, async (row, report) => {
    await upsertDealer(db, {
      phone: row.phone,
      businessName: row.business_name,
      contactPerson: row.contact_person || null,
      status: row.status,
    });
    if (existing.has(row.phone)) {
      report.updated += 1;
    } else {
      report.inserted += 1;
      existing.add(row.phone);
    }
  });
}

const inventoryRow = z.object({
  sku: z.string().trim().min(1),
  available: z.coerce.number().int().min(0),
});

export async function importInventory(db: Db, csvContent: string): Promise<ImportReport> {
  const known = new Set((await db.select({ sku: products.sku }).from(products)).map((r) => r.sku));
  return runImport(csvContent, inventoryRow, async (row, report) => {
    if (!known.has(row.sku)) throw new Error(`Unknown SKU: ${row.sku}`);
    const before = await getInventory(db, row.sku);
    await setInventory(db, { sku: row.sku, available: row.available });
    if (before) {
      report.updated += 1;
    } else {
      report.inserted += 1;
    }
  });
}

const priceRow = z.object({
  sku: z.string().trim().min(1),
  amount_taka: z.coerce.number().int().positive(),
});

export async function importPrices(db: Db, csvContent: string): Promise<ImportReport> {
  const known = new Set((await db.select({ sku: products.sku }).from(products)).map((r) => r.sku));
  return runImport(csvContent, priceRow, async (row, report) => {
    if (!known.has(row.sku)) throw new Error(`Unknown SKU: ${row.sku}`);
    const current = await getPrice(db, row.sku);
    if (current && current.amountTaka === row.amount_taka) {
      report.skipped += 1;
      return;
    }
    await setPrice(db, { sku: row.sku, amountTaka: row.amount_taka });
    report.inserted += 1;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/import.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/import packages/core/tests/import.test.ts
git commit -m "feat(core): csv importers for products, dealers, inventory, prices"
```

---

### Task 9: AI tools facade, public exports, and end-to-end flow

**Files:**

- Create: `packages/core/src/tools/tools.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/README.md`
- Test: `packages/core/tests/tools.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 3–8.
- Produces — **the contract Plans 2 (AI), 3 (WhatsApp), and 4 (admin) build against:**
  - `type ToolResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }` — expected domain failures (`CoreError`) become `ok: false`; unexpected errors still throw.
  - `createTools(db: Db): Tools` — the ONLY surface the AI layer may call (PRD §12). `Tools` methods:
    - `searchProducts(query: string, limit?: number): Promise<ToolResult<ScoredProduct[]>>`
    - `getProductDetails(sku: string): Promise<ToolResult<{ product: Product; priceTaka: number | null; available: number }>>`
    - `getPrice(sku: string): Promise<ToolResult<{ sku: string; amountTaka: number }>>` (`NO_PRICE` error if none)
    - `checkInventory(sku: string): Promise<ToolResult<{ sku: string; available: number }>>` (dealer-facing: never exposes `reserved`)
    - `createDraftOrder(dealerPhone: string, items: DraftItemInput[]): Promise<ToolResult<OrderWithItems>>` (resolves dealer by WhatsApp phone)
    - `modifyDraftOrder(orderId: number, items: DraftItemInput[]): Promise<ToolResult<OrderWithItems>>`
    - `getOrderStatus(dealerPhone: string, orderId?: number): Promise<ToolResult<OrderWithItems>>` (`NOT_FOUND` if the dealer has no orders)
  - `src/index.ts` re-exports: schema tables + row types, `CoreError`/`ErrorCode`, `createDb`/`Db`, all dealer/product/price/inventory/order functions, all importers + `ImportReport`, `createTools`/`Tools`/`ToolResult`. (`createPgliteDb` stays on the `core/pglite` subpath.)

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/tools.test.ts`:

```ts
import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import {
  approveOrder,
  createTools,
  importDealers,
  importInventory,
  importPrices,
  importProducts,
  submitForReview,
} from "../src/index.ts";

const PHONE = "+8801700000001";

async function seededTools() {
  const db = await createPgliteDb();
  await importProducts(
    db,
    `sku,brand,category,name,model,specs,aliases,active
HP-15S-FQ5,HP,Laptop,"HP 15s-fq5786TU",15s-fq5786TU,"i5-1235U 8GB 512GB","hp 15s|hp i5 8/512",true
LEN-IP3-I5,Lenovo,Laptop,"Lenovo IdeaPad Slim 3",82RK00WMIN,"i5 16GB 512GB","ideapad 3",true`,
  );
  await importDealers(
    db,
    `phone,business_name,contact_person,status\n${PHONE},Rahim Traders,Rahim,active`,
  );
  await importInventory(db, `sku,available\nHP-15S-FQ5,8\nLEN-IP3-I5,20`);
  await importPrices(db, `sku,amount_taka\nHP-15S-FQ5,72500\nLEN-IP3-I5,68000`);
  return { db, tools: createTools(db) };
}

test("expected domain failures come back as error envelopes, not throws", async () => {
  const { tools } = await seededTools();

  const noDealer = await tools.createDraftOrder("+8801799999999", [
    { sku: "HP-15S-FQ5", quantity: 1 },
  ]);
  expect(noDealer).toEqual({
    ok: false,
    error: { code: "NOT_FOUND", message: expect.any(String) },
  });

  const noPrice = await tools.getPrice("UNKNOWN");
  expect(noPrice.ok).toBe(false);
});

test("checkInventory exposes available stock only", async () => {
  const { tools } = await seededTools();
  const result = await tools.checkInventory("HP-15S-FQ5");
  expect(result).toEqual({ ok: true, data: { sku: "HP-15S-FQ5", available: 8 } });
});

test("end-to-end dealer flow: search → details → draft → modify → approve → status", async () => {
  const { db, tools } = await seededTools();

  // "Bhai, Lenovo i5 laptop ta koto?" — AI searches
  const search = await tools.searchProducts("lenovo i5 laptop");
  expect(search.ok).toBe(true);
  if (!search.ok) return;
  const sku = search.data[0]!.product.sku;
  expect(sku).toBe("LEN-IP3-I5");

  const details = await tools.getProductDetails(sku);
  expect(details.ok).toBe(true);
  if (!details.ok) return;
  expect(details.data.priceTaka).toBe(68000);
  expect(details.data.available).toBe(20);

  // "10 ta lagbe" — AI drafts
  const draft = await tools.createDraftOrder(PHONE, [{ sku, quantity: 10 }]);
  expect(draft.ok).toBe(true);
  if (!draft.ok) return;

  // "10 na, 15 ta koren" — AI modifies
  const modified = await tools.modifyDraftOrder(draft.data.id, [{ sku, quantity: 15 }]);
  expect(modified.ok).toBe(true);
  if (!modified.ok) return;
  expect(modified.data.items[0]!.quantity).toBe(15);

  // Ops approves (admin path — NOT a tool)
  await submitForReview(db, draft.data.id);
  await approveOrder(db, { orderId: draft.data.id, reviewer: "ops1" });

  // "Amar order ta kothay?" — AI checks status
  const status = await tools.getOrderStatus(PHONE);
  expect(status.ok).toBe(true);
  if (!status.ok) return;
  expect(status.data.id).toBe(draft.data.id);
  expect(status.data.status).toBe("approved");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/core/`: `vp test tests/tools.test.ts`
Expected: FAIL — `../src/index.ts` and `../src/tools/tools.ts` do not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/tools/tools.ts`:

```ts
import type { Db } from "../db/client.ts";
import type { Product } from "../db/schema.ts";
import { findDealerByPhone } from "../dealers/dealers.ts";
import { CoreError } from "../errors.ts";
import { getInventory } from "../inventory/inventory.ts";
import { createDraftOrder, getOrder, modifyDraftOrder } from "../orders/orders.ts";
import type { DraftItemInput, OrderWithItems } from "../orders/orders.ts";
import { getPrice } from "../prices/prices.ts";
import { getProductBySku } from "../products/products.ts";
import { searchProducts } from "../products/search.ts";
import type { ScoredProduct } from "../products/search.ts";

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/** Expected domain failures become safe envelopes the AI can relay; bugs still throw. */
async function run<T>(fn: () => Promise<T>): Promise<ToolResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof CoreError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}

async function requireDealer(db: Db, phone: string) {
  const dealer = await findDealerByPhone(db, phone);
  if (!dealer) throw new CoreError("NOT_FOUND", `No dealer registered for ${phone}`);
  return dealer;
}

/**
 * The ONLY surface exposed to the AI layer (PRD §12: "AI interprets. Backend decides.").
 * Admin/ops operations (approve, reject, imports) are deliberately absent.
 */
export function createTools(db: Db) {
  return {
    searchProducts(query: string, limit?: number): Promise<ToolResult<ScoredProduct[]>> {
      return run(() => searchProducts(db, query, limit));
    },

    getProductDetails(
      sku: string,
    ): Promise<ToolResult<{ product: Product; priceTaka: number | null; available: number }>> {
      return run(async () => {
        const product = await getProductBySku(db, sku);
        if (!product || !product.active) {
          throw new CoreError("NOT_FOUND", `Unknown or inactive product: ${sku}`);
        }
        const price = await getPrice(db, sku);
        const stock = await getInventory(db, sku);
        return {
          product,
          priceTaka: price?.amountTaka ?? null,
          available: stock?.available ?? 0,
        };
      });
    },

    getPrice(sku: string): Promise<ToolResult<{ sku: string; amountTaka: number }>> {
      return run(async () => {
        const price = await getPrice(db, sku);
        if (!price) throw new CoreError("NO_PRICE", `No current price for ${sku}`);
        return { sku, amountTaka: price.amountTaka };
      });
    },

    checkInventory(sku: string): Promise<ToolResult<{ sku: string; available: number }>> {
      return run(async () => {
        const stock = await getInventory(db, sku);
        return { sku, available: stock?.available ?? 0 };
      });
    },

    createDraftOrder(
      dealerPhone: string,
      items: DraftItemInput[],
    ): Promise<ToolResult<OrderWithItems>> {
      return run(async () => {
        const dealer = await requireDealer(db, dealerPhone);
        return createDraftOrder(db, { dealerId: dealer.id, items });
      });
    },

    modifyDraftOrder(
      orderId: number,
      items: DraftItemInput[],
    ): Promise<ToolResult<OrderWithItems>> {
      return run(() => modifyDraftOrder(db, { orderId, items }));
    },

    getOrderStatus(dealerPhone: string, orderId?: number): Promise<ToolResult<OrderWithItems>> {
      return run(async () => {
        const dealer = await requireDealer(db, dealerPhone);
        const order = await getOrder(db, { dealerId: dealer.id, orderId });
        if (!order) throw new CoreError("NOT_FOUND", "No matching order found");
        return order;
      });
    },
  };
}

export type Tools = ReturnType<typeof createTools>;
```

Create `packages/core/src/index.ts`:

```ts
export { createDb } from "./db/client.ts";
export type { Db } from "./db/client.ts";
export * from "./db/schema.ts";
export { findDealerByPhone, setDealerStatus, upsertDealer } from "./dealers/dealers.ts";
export type { DealerInput } from "./dealers/dealers.ts";
export { CoreError } from "./errors.ts";
export type { ErrorCode } from "./errors.ts";
export type { ImportError, ImportReport } from "./import/csv.ts";
export {
  importDealers,
  importInventory,
  importPrices,
  importProducts,
} from "./import/importers.ts";
export { getInventory, releaseStock, reserveStock, setInventory } from "./inventory/inventory.ts";
export {
  approveOrder,
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  getOrder,
  modifyDraftOrder,
  rejectOrder,
  submitForReview,
} from "./orders/orders.ts";
export type { DraftItemInput, OrderWithItems } from "./orders/orders.ts";
export { getPrice, setPrice } from "./prices/prices.ts";
export { getProductBySku, upsertProduct } from "./products/products.ts";
export type { ProductInput } from "./products/products.ts";
export { normalize, scoreProduct, searchProducts } from "./products/search.ts";
export type { ScoredProduct } from "./products/search.ts";
export { createTools } from "./tools/tools.ts";
export type { Tools, ToolResult } from "./tools/tools.ts";
```

Create `packages/core/README.md`:

```markdown
# core

Digico business domain for the WhatsApp ordering MVP (PRD: `docs/prd/prd.md`).

- **Source of truth** for dealers, products, prices (single list, whole-taka), inventory, and orders.
- **AI access**: the AI layer may only call `createTools(db)` — never the database or domain functions directly.
- **Admin/ops access**: `import*` functions (CSV), `submitForReview`/`approveOrder`/`rejectOrder`/`confirmOrder`/`cancelOrder`.
- **Databases**: `createDb(connectionString)` for Postgres; `import { createPgliteDb } from "core/pglite"` for in-memory tests/dev (migrations in `./drizzle`, regenerate with `vp run db:generate`).

Deferred by design (see PRD §5): dealer price tiers, credit, multi-warehouse, Conversation entity (Plan 2).
```

- [ ] **Step 4: Run test to verify it passes**

Run from `packages/core/`: `vp test tests/tools.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Run the full suite and checks, then commit**

Run from `packages/core/`: `vp test`
Expected: PASS — all 9 test files green.

Run from repo root: `vp check` then `vp run -r test`
Expected: format/lint/type-check clean across the workspace; all workspace tests pass (website + utils + core).

```bash
git add packages/core
git commit -m "feat(core): AI tools facade, public exports, end-to-end order flow"
```

---

## Self-Review Notes (completed during planning)

- **Spec coverage:** PRD §5 business capabilities → Tasks 4–7 + 9 (all seven tools); §9 product matching → Task 4 (score = confidence signal); §10 CSV import → Task 8; §11 data model → Task 2 (minus Conversation, explicitly deferred to Plan 2); §12 tool interface → Task 9. Admin UI, AI layer, WhatsApp are Plans 2–4 by the approved split.
- **Type consistency:** `Db` is the first parameter everywhere; `DraftItemInput`/`OrderWithItems` defined once in Task 7 and reused in Task 9; `ImportReport` defined once in Task 8; tool names in Task 9 match PRD §12's list.
- **Known simplifications (deliberate, documented in code):** in-memory search over 600 SKUs; no row-level locking on inventory (single-process ops approval at MVP scale); `getOrderStatus` returns the latest order when no ID given.

## Execution Handoff

Plan complete. Execute with superpowers:subagent-driven-development (fresh subagent per task, review between tasks) or superpowers:executing-plans (inline batch execution with checkpoints).
