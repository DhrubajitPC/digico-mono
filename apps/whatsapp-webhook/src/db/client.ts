import type mysql from "mysql2/promise";
import { getMariaDbPool } from "./mariadb.ts";

/** Primary database connector handle: satisfied by MariaDB pool */
export type Db = mysql.Pool;

export function getDb(): Db {
  return getMariaDbPool();
}
