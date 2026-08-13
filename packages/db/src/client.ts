import fs from "node:fs";
import mysql from "mysql2/promise";

const DEFAULT_MARIADB_URL = "mysql://wp:wp@127.0.0.1:3307/woocommerce_local";

let pool: mysql.Pool | null = null;

export function getMariaDbPool(): mysql.Pool {
  if (!pool) {
    let connectionUrl = process.env.MARIADB_URL || DEFAULT_MARIADB_URL;

    // Detect if running inside a Docker container
    const isInsideDocker = fs.existsSync("/.dockerenv") || process.env.NODE_ENV === "production";

    if (isInsideDocker) {
      if (connectionUrl.includes("127.0.0.1:3307") || connectionUrl.includes("localhost:3307")) {
        connectionUrl = connectionUrl
          .replace("127.0.0.1:3307", "mariadb:3306")
          .replace("localhost:3307", "mariadb:3306");
      }
    }

    pool = mysql.createPool({
      uri: connectionUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}
