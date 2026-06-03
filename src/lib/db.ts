import { Pool, type Pool as PgPool } from "pg";

let pool: PgPool | null = null;

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is not configured");
  }

  return value;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getRequiredDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }

  return pool;
}
