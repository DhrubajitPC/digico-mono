import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

async function runSeed() {
  console.log("Seeding MariaDB with WooCommerce export.sql...");

  const rootSqlPath = path.resolve(process.cwd(), "export.sql");
  const parentSqlPath = path.resolve(process.cwd(), "../../export.sql");
  const sqlPath = fs.existsSync(rootSqlPath)
    ? rootSqlPath
    : fs.existsSync(parentSqlPath)
      ? parentSqlPath
      : null;

  if (!sqlPath) {
    console.error("FATAL: export.sql file not found in repository root.");
    process.exit(1);
  }

  console.log(`Found SQL dump file at: ${sqlPath}`);

  try {
    console.log("Importing export.sql into MariaDB container...");
    execSync(
      `docker exec -i digico-mariadb mariadb -uwp -pwp --force woocommerce_local < "${sqlPath}"`,
      { stdio: "inherit" },
    );
    console.log("SUCCESS: MariaDB container successfully populated with export.sql!");
    process.exit(0);
  } catch {
    console.log("Docker container import unavailable. Trying local mariadb/mysql CLI client...");
    try {
      execSync(
        `mariadb -h 127.0.0.1 -P 3307 -u wp -pwp --force woocommerce_local < "${sqlPath}" || mysql -h 127.0.0.1 -P 3307 -u wp -pwp --force woocommerce_local < "${sqlPath}"`,
        { stdio: "inherit" },
      );
      console.log("SUCCESS: MariaDB host port 3307 successfully populated with export.sql!");
      process.exit(0);
    } catch (err) {
      console.error("FATAL: Failed to seed MariaDB database with export.sql", err);
      process.exit(1);
    }
  }
}

runSeed().catch((err) => {
  console.error("FATAL: Unhandled error in seed runner:", err);
  process.exit(1);
});
