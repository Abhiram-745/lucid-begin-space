import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

try {
  if (!process.env.DATABASE_URL) {
    process.loadEnvFile(".env");
  }
} catch {
  // .env is optional in deployed environments.
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const shouldUseSsl =
  databaseUrl.searchParams.get("sslmode") === "require" ||
  databaseUrl.hostname.endsWith(".supabase.co") ||
  databaseUrl.hostname.endsWith(".pooler.supabase.com");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
