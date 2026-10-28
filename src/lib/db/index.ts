import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Single pooled connection reused across hot reloads in dev — without the
 * global cache, each Fast Refresh would open a new pool and eventually
 * exhaust Postgres's connection limit.
 */
const globalForDb = globalThis as unknown as { pgPool?: Pool };

// pg's default of 10 connections is less than two concurrent visits to a
// page that runs several queries in parallel; Postgres allows 100.
const pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
