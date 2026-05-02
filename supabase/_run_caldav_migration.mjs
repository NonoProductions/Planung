import pg from "pg";
import dns from "dns";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const PROJECT_REF = "ifflxvdjgkgxozyftcpe";
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
  console.error("Usage: node _run_caldav_migration.mjs <db-password>");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlContents = readFileSync(join(__dirname, "create_caldav_sync_tables.sql"), "utf8");

const candidates = [
  {
    label: "direct db.<ref>.supabase.co",
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
  },
  {
    label: "pooler eu-central-1 (session)",
    host: "aws-0-eu-central-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
  {
    label: "pooler eu-west-1 (session)",
    host: "aws-0-eu-west-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
  {
    label: "pooler eu-west-2 (session)",
    host: "aws-0-eu-west-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
  {
    label: "pooler us-east-1 (session)",
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
  {
    label: "pooler us-east-2 (session)",
    host: "aws-0-us-east-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
  {
    label: "pooler us-west-1 (session)",
    host: "aws-0-us-west-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
  {
    label: "pooler ap-southeast-1 (session)",
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
  },
];

async function tryConnect(c) {
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    database: "postgres",
    user: c.user,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function run() {
  let client = null;
  let used = null;
  for (const c of candidates) {
    process.stdout.write(`Probing ${c.label}... `);
    try {
      client = await tryConnect(c);
      used = c;
      console.log("OK");
      break;
    } catch (err) {
      console.log(`fail (${err.code ?? err.message?.split("\n")[0]})`);
    }
  }

  if (!client || !used) {
    console.error("\nKein Host hat funktioniert.");
    process.exit(1);
  }

  console.log(`\nConnected via: ${used.label}\nApplying migration...`);
  await client.query(sqlContents);
  console.log("Migration applied.\n");

  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('CalDavSync', 'CalDavProcessedEvent')
    ORDER BY tablename
  `);
  console.log("Tables present:");
  rows.forEach((r) => console.log(`  - ${r.tablename}`));

  await client.end();
}

run().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
