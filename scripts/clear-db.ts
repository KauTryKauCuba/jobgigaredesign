// Truncates every table in the schema (RESTART IDENTITY, CASCADE), leaving
// the schema itself intact. Does not use `@/lib/db` since that module
// imports `server-only`, which only resolves inside Next's build.
import { Pool } from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../src/lib/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const names = Object.values(schema)
    .map((v) => {
      try {
        return getTableConfig(v as Parameters<typeof getTableConfig>[0]).name;
      } catch {
        return null;
      }
    })
    .filter((n): n is string => !!n);

  if (names.length === 0) {
    throw new Error("No tables found in schema");
  }

  const quoted = names.map((n) => `"${n}"`).join(", ");
  console.log(`Truncating: ${names.join(", ")}`);
  await pool.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
