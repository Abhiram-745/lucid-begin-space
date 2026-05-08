import { defineConfig } from "drizzle-kit";
import path from "path";

try {
  if (!process.env.DATABASE_DIRECT_URL && !process.env.DATABASE_URL) {
    process.loadEnvFile(".env");
  }
} catch {
  // .env is optional in deployed environments.
}

const databaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_DIRECT_URL or DATABASE_URL must be set. Ensure the Supabase database is provisioned.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
