import { Pool, type Pool as PgPool, type PoolConfig } from "pg";

let pool: PgPool | null = null;

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is not configured");
  }

  return value;
}

function isSupabaseHost(hostname: string) {
  return hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");
}

function buildPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  const supabaseConnection = isSupabaseHost(url.hostname);

  if (supabaseConnection) {
    // Normalize the dashboard URI and let node-postgres enforce certificate
    // verification via the explicit SSL config below.
    url.searchParams.delete("sslmode");
  }

  // On Supabase (PgBouncer in transaction mode), prepared statements cause
  // "prepared statement already exists" errors. A pool size of 1 avoids this
  // by serializing all queries through a single connection. This is safe for
  // the single-coach use case. If scaling to concurrent users, switch to
  // Supabase session mode (port 6543, ?pgbouncer=true) and raise max.
  //
  return {
    connectionString: url.toString(),
    max: supabaseConnection ? 1 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    ...(supabaseConnection ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

export function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig(getRequiredDatabaseUrl()));
  }

  return pool;
}
