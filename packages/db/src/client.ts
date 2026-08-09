import mysql from "mysql2/promise";

const DEFAULT_MARIADB_URL = "mysql://wp:wp@127.0.0.1:3307/woocommerce_local";

let pool: mysql.Pool | null = null;

export function getMariaDbPool(): mysql.Pool {
  if (!pool) {
    const connectionUrl = process.env.MARIADB_URL || DEFAULT_MARIADB_URL;
    pool = mysql.createPool({
      uri: connectionUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export type Db = mysql.Pool;

export function getDb(): Db {
  return getMariaDbPool();
}
