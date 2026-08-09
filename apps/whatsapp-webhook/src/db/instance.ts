import type { Db } from "./client.ts";
import { getMariaDbPool, ensureMariaDbLogTables } from "./mariadb.ts";

/** Lazily-created singleton DB connection for MariaDB. */
export async function getDb(): Promise<Db> {
  const pool = getMariaDbPool();
  await ensureMariaDbLogTables();
  return pool;
}
