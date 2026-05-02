/**
 * CalDAV sync setup script — creates CalDavSync + CalDavProcessedEvent tables
 * and applies RLS policies.
 *
 * Usage:
 *   node supabase/setup_caldav_sync.mjs <database-password>
 */

import pg from "pg";
import dns from "dns";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const PROJECT_REF = "ifflxvdjgkgxozyftcpe";
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
  console.error(
    "\n  Usage: node supabase/setup_caldav_sync.mjs <database-password>\n"
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "create_caldav_sync_tables.sql");
const sqlContents = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  host: "aws-0-eu-central-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: `postgres.${PROJECT_REF}`,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("Connecting to Supabase database...");
  await client.connect();
  console.log("Connected.\n");

  await client.query(sqlContents);
  console.log("CalDAV sync tables ready.\n");

  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('CalDavSync', 'CalDavProcessedEvent')
    ORDER BY tablename
  `);
  console.log("Created tables:");
  rows.forEach((r) => console.log(`  - ${r.tablename}`));

  await client.end();
}

run().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
