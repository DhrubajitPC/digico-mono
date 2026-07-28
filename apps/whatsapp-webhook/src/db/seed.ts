import { getDb } from "./instance.ts";
import { seedInitialOrdersData } from "../api-orders.ts";

async function runSeed() {
  console.log("Initializing database connection and seeding data...");
  const db = await getDb();
  await seedInitialOrdersData(db);
  console.log("SUCCESS: Database successfully populated with initial seed data!");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("FATAL: Failed to seed database:", err);
  process.exit(1);
});
