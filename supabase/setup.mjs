/**
 * Supabase Security Setup Script
 *
 * Executes all DDL changes:
 *  1. Enables RLS on User table
 *  2. Creates RLS policies on User table
 *  3. Adds userId column to TimeEntry (if missing)
 *  4. Backfills TimeEntry.userId from Task
 *  5. Creates RLS policies on all data tables
 *
 * Usage:
 *   node supabase/setup.mjs <database-password>
 *
 *   Find the password in: Supabase Dashboard → Project Settings → Database → Connection string
 */

import pg from "pg";
import dns from "dns";

// Use Google DNS to resolve Supabase hosts (local DNS may not work)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const PROJECT_REF = "ifflxvdjgkgxozyftcpe";
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
  console.error(
    "\n  Usage: node supabase/setup.mjs <database-password>\n\n" +
    "  Find the password in:\n" +
    "  Supabase Dashboard → Project Settings → Database → Connection string\n"
  );
  process.exit(1);
}

// Try pooler first (session mode), fall back to direct
const client = new pg.Client({
  host: `aws-0-eu-central-1.pooler.supabase.com`,
  port: 5432,
  database: "postgres",
  user: `postgres.${PROJECT_REF}`,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const SQL_STATEMENTS = [
  // ─── 1. RLS on User table ───────────────────────────────
  `ALTER TABLE "User" ENABLE ROW LEVEL SECURITY`,

  `ALTER TABLE "User" FORCE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "Users can view own profile" ON "User"`,
  `DROP POLICY IF EXISTS "Users can update own profile" ON "User"`,
  `DROP POLICY IF EXISTS "Anon can insert new users" ON "User"`,
  `DROP POLICY IF EXISTS "Service role full access users" ON "User"`,

  // Allow service_role full access (our app backend)
  `CREATE POLICY "Service role full access users" ON "User"
     FOR ALL USING (current_setting('role') = 'service_role')
     WITH CHECK (current_setting('role') = 'service_role')`,

  // ─── 2. Add userId to TimeEntry (if missing) ───────────
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'TimeEntry' AND column_name = 'userId'
     ) THEN
       ALTER TABLE "TimeEntry" ADD COLUMN "userId" text;
     END IF;
   END $$`,

  // Backfill userId from Task
  `UPDATE "TimeEntry" te
     SET "userId" = t."userId"
     FROM "Task" t
     WHERE te."taskId" = t."id"
       AND te."userId" IS NULL`,

  // ─── 3. RLS policies on all data tables ─────────────────
  // Task
  ...tablePolicies("Task"),
  // Channel
  ...tablePolicies("Channel"),
  // Objective
  ...tablePolicies("Objective"),
  // CalendarEvent
  ...tablePolicies("CalendarEvent"),
  // CalendarCategory
  ...tablePolicies("CalendarCategory"),
  // Reflection
  ...tablePolicies("Reflection"),
  // TimeEntry
  ...tablePolicies("TimeEntry"),
];

function tablePolicies(table) {
  const label = table.replace(/([A-Z])/g, " $1").trim().toLowerCase();
  const policyPrefix = `Users own ${label}`;
  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "${policyPrefix} select" ON "${table}"`,
    `DROP POLICY IF EXISTS "${policyPrefix} insert" ON "${table}"`,
    `DROP POLICY IF EXISTS "${policyPrefix} update" ON "${table}"`,
    `DROP POLICY IF EXISTS "${policyPrefix} delete" ON "${table}"`,
    `DROP POLICY IF EXISTS "Service role full access ${label}" ON "${table}"`,

    `CREATE POLICY "Service role full access ${label}" ON "${table}"
       FOR ALL USING (current_setting('role') = 'service_role')
       WITH CHECK (current_setting('role') = 'service_role')`,

    `CREATE POLICY "${policyPrefix} select" ON "${table}"
       FOR SELECT USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub')`,

    `CREATE POLICY "${policyPrefix} insert" ON "${table}"
       FOR INSERT WITH CHECK ("userId" = current_setting('request.jwt.claims', true)::json->>'sub')`,

    `CREATE POLICY "${policyPrefix} update" ON "${table}"
       FOR UPDATE USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub')`,

    `CREATE POLICY "${policyPrefix} delete" ON "${table}"
       FOR DELETE USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub')`,
  ];
}

async function run() {
  console.log("Connecting to Supabase database...");
  await client.connect();
  console.log("Connected.\n");

  let ok = 0;
  let skipped = 0;

  for (const sql of SQL_STATEMENTS) {
    const short = sql.replace(/\s+/g, " ").slice(0, 80);
    try {
      await client.query(sql);
      ok++;
      console.log(`  OK  ${short}`);
    } catch (err) {
      if (err.message?.includes("already exists")) {
        skipped++;
        console.log(` SKIP ${short} (already exists)`);
      } else {
        console.error(` FAIL ${short}`);
        console.error(`      ${err.message}`);
      }
    }
  }

  // Verify: check anon access to User table
  const { rows } = await client.query(`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'User'
  `);
  console.log(`\nUser table policies: ${rows.length}`);
  rows.forEach((r) => console.log(`  - ${r.policyname}`));

  // Check TimeEntry.userId
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'TimeEntry' AND column_name = 'userId'
  `);
  console.log(`\nTimeEntry.userId column: ${cols.length > 0 ? "EXISTS" : "MISSING"}`);

  // Check for null userId in TimeEntry
  const { rows: nullRows } = await client.query(`
    SELECT count(*) as cnt FROM "TimeEntry" WHERE "userId" IS NULL
  `);
  console.log(`TimeEntry rows with NULL userId: ${nullRows[0].cnt}`);

  console.log(`\nDone: ${ok} applied, ${skipped} skipped.`);
  await client.end();
}

run().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
