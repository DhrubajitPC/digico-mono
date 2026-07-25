import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "./client.ts";
import * as schema from "./schema.ts";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Fresh in-memory Postgres with migrations applied. For tests. */
export async function createPgliteDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  // HKT generics differ per driver; runtime query API is identical.
  return db as unknown as Db;
}

/**
 * File-backed Postgres for local dev: no Docker/server required, but data
 * survives restarts. Swap for `createDb(DATABASE_URL)` when a real Postgres
 * server is available.
 */
export async function createFilePgliteDb(dataDir: string): Promise<Db> {
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Db;
}
