import { Pool } from "pg";

let pool: Pool | null = null;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return url;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }

  return pool;
}
