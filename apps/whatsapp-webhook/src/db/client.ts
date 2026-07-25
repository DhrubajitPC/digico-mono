import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.ts";

/** Driver-agnostic handle: satisfied by node-postgres (prod) and PGlite (dev/tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(connectionString: string): Db {
  // HKT generics differ per driver; runtime query API is identical.
  return drizzle(connectionString, { schema }) as unknown as Db;
}
