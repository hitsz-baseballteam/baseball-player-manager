import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  // Append sslmode if not present (Supabase requires SSL)
  if (!url.includes("sslmode=") && !url.includes("?sslmode=")) {
    return url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
  }
  return url;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
      allowExitOnIdle: true,
    });
  }
  return pool;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
