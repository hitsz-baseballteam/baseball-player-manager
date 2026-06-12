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
    // Supabase dashboard URIs often include `sslmode=require`, but pg 8.21
    // interprets that as strict certificate verification and fails with
    // SELF_SIGNED_CERT_IN_CHAIN in Vercel/Node. Keep the connection encrypted,
    // but remove the query param and provide the TLS option explicitly.
    url.searchParams.delete("sslmode");
  }

  // On Supabase (PgBouncer in transaction mode), prepared statements cause
  // "prepared statement already exists" errors. A pool size of 1 avoids this
  // by serializing all queries through a single connection. This is safe for
  // the single-coach use case. If scaling to concurrent users, switch to
  // Supabase session mode (port 6543, ?pgbouncer=true) and raise max.
  //
  // rejectUnauthorized: false on Supabase avoids SELF_SIGNED_CERT_IN_CHAIN
  // errors from their TLS-terminating proxy. Traffic is still encrypted.
  // On Vercel and similar managed platforms, this is not a practical risk.
  // On self-hosted PostgreSQL, the flag is omitted entirely (strict TLS).
  return {
    connectionString: url.toString(),
    max: supabaseConnection ? 1 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    ...(supabaseConnection ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig(getRequiredDatabaseUrl()));
  }

  return pool;
}
