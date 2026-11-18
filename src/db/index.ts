import "server-only";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Database connection.
 *
 * - In production (Vercel) set DATABASE_URL (or POSTGRES_URL, which the Vercel
 *   Postgres / Neon integration sets automatically) to any PostgreSQL database.
 * - Locally, if no URL is configured, an embedded PostgreSQL (PGlite) stored in
 *   ./.data/pglite is used so the app runs with zero setup.
 *
 * Migrations in ./drizzle are applied automatically on the first query of each
 * server instance, so a fresh database is ready without any manual step.
 */

const globalForDb = globalThis as unknown as { __pharmacyDb?: Promise<DB> };

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function init(): Promise<DB> {
  const url = connectionString();

  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, {
      prepare: false, // compatible with pgBouncer / Neon / Supabase poolers
      max: process.env.VERCEL ? 1 : 10,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    });
    const db = drizzlePostgres(client, { schema });
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder });
    return db;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Add a PostgreSQL database (e.g. Neon from the Vercel Marketplace) and redeploy.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__pharmacyDb) {
    globalForDb.__pharmacyDb = init().catch((err) => {
      globalForDb.__pharmacyDb = undefined;
      throw err;
    });
  }
  return globalForDb.__pharmacyDb;
}

export { schema };
