import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client.ts";
import { createFilePgliteDb } from "./pglite.ts";
import * as schema from "./schema.ts";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

async function connect(): Promise<Db> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const client = drizzle(connectionString, { schema });
    await migrate(client, { migrationsFolder: MIGRATIONS_FOLDER });
    // HKT generics differ per driver; runtime query API is identical.
    return client as unknown as Db;
  }
  // No Postgres server configured — file-backed PGlite needs no setup.
  return await createFilePgliteDb(process.env.DB_DATA_DIR ?? "./data/db");
}

let dbPromise: Promise<Db> | undefined;

/** Lazily-created singleton DB connection for this process. */
export async function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = connect().then(async (db) => {
      const { seedInitialOrdersData } = await import("../api-orders.ts");
      await seedInitialOrdersData(db);
      return db;
    });
  }
  return dbPromise;
}
