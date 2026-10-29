import { runSchemaMigration } from "./index.js";

async function main() {
  console.log("[DB] Executing PostgreSQL Schema & Seed Fixture Migration...");
  const result = await runSchemaMigration();
  console.log(
    `[DB] Migration complete (${result.mode}) — ${result.tablesInitialized} tables with RLS policies, ${result.seededRestaurants} restaurants, ${result.seededMenuItems} menu items seeded.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[DB] Migration failed:", err);
  process.exit(1);
});
