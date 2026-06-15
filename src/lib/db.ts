import { Pool, type Pool as PgPool, type PoolConfig } from "pg";

let pool: PgPool | null = null;

const SUPABASE_ROOT_CA_2021 = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

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

function getConfiguredDatabaseCa() {
  const rawValue = process.env.DATABASE_CA_CERT?.trim();

  if (!rawValue) {
    return null;
  }

  return rawValue.replace(/\\n/g, "\n");
}

function getSslConfig(supabaseConnection: boolean) {
  const configuredCa = getConfiguredDatabaseCa();

  if (supabaseConnection) {
    return {
      rejectUnauthorized: true,
      ca: configuredCa ?? SUPABASE_ROOT_CA_2021,
    };
  }

  if (!configuredCa) {
    return undefined;
  }

  return {
    rejectUnauthorized: true,
    ca: configuredCa,
  };
}

export function buildPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  const supabaseConnection = isSupabaseHost(url.hostname);
  const ssl = getSslConfig(supabaseConnection);

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
    ...(ssl ? { ssl } : {}),
  };
}

export function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig(getRequiredDatabaseUrl()));
  }

  return pool;
}
