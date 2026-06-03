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
    // Supabase's dashboard URIs often include `sslmode=require`, but pg 8.21
    // interprets that as strict certificate verification and fails with
    // SELF_SIGNED_CERT_IN_CHAIN in Vercel/Node. Keep the connection encrypted,
    // but remove the query param and provide the TLS option explicitly.
    url.searchParams.delete("sslmode");
  }

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
