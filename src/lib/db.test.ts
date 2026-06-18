import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildPoolConfig } from "./db.ts";

const SUPABASE_POOLER_URL =
  "postgresql://postgres.proj@aws-0-region.pooler.supabase.com:6543/postgres";
const SUPABASE_DIRECT_URL =
  "postgresql://postgres.proj@db.xxxx.supabase.co:5432/postgres";
const LOCAL_PG_URL = "postgresql://user:pass@localhost:5432/mydb";
const SUPABASE_SESSION_URL =
  "postgresql://postgres.proj@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true";

describe("buildPoolConfig", () => {
  afterEach(() => {
    delete process.env.DATABASE_CA_CERT;
  });

  it("uses strict TLS with the bundled Supabase root CA", () => {
    const config = buildPoolConfig(
      "postgres://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    );

    assert.equal(config.max, 1);
    assert.equal(config.connectionString?.includes("sslmode="), false);
    assert.deepEqual(config.ssl && typeof config.ssl !== "boolean", true);
    assert.equal(config.ssl && typeof config.ssl !== "boolean" ? config.ssl.rejectUnauthorized : false, true);
    assert.match(
      config.ssl && typeof config.ssl !== "boolean" ? String(config.ssl.ca) : "",
      /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/,
    );
  });

  it("prefers an explicit CA certificate when configured", () => {
    process.env.DATABASE_CA_CERT = "line-one\\nline-two";
    const config = buildPoolConfig("postgres://user:pass@db.example.com:5432/app");

    assert.equal(config.max, 5);
    assert.equal(config.ssl && typeof config.ssl !== "boolean" ? config.ssl.rejectUnauthorized : false, true);
    assert.equal(config.ssl && typeof config.ssl !== "boolean" ? config.ssl.ca : null, "line-one\nline-two");
  });

  it("leaves non-TLS local connections untouched by default", () => {
    const config = buildPoolConfig("postgres://user:pass@127.0.0.1:5432/app");

    assert.equal(config.max, 5);
    assert.equal(config.ssl, undefined);
  });
});

describe("resolvePoolMax", () => {
  const ORIGINAL_DB_POOL_MAX = process.env.DB_POOL_MAX;

  afterEach(() => {
    delete process.env.DB_POOL_MAX;
    if (ORIGINAL_DB_POOL_MAX !== undefined) {
      process.env.DB_POOL_MAX = ORIGINAL_DB_POOL_MAX;
    }
  });

  it("returns 1 for Supabase transaction pooler at port 6543", async () => {
    const { resolvePoolMax } = await import("./db.ts");
    assert.equal(resolvePoolMax(SUPABASE_POOLER_URL, process.env), 1);
  });

  it("returns 5 for Supabase direct connection at port 5432", async () => {
    const { resolvePoolMax } = await import("./db.ts");
    assert.equal(resolvePoolMax(SUPABASE_DIRECT_URL, process.env), 5);
  });

  it("returns 5 for non-Supabase Postgres URLs", async () => {
    const { resolvePoolMax } = await import("./db.ts");
    assert.equal(resolvePoolMax(LOCAL_PG_URL, process.env), 5);
  });

  it("uses DB_POOL_MAX env override over URL inference", async () => {
    process.env.DB_POOL_MAX = "10";
    const { resolvePoolMax } = await import("./db.ts");
    assert.equal(resolvePoolMax(SUPABASE_POOLER_URL, process.env), 10);
  });

  it("returns a safe default for malformed URLs instead of throwing", async () => {
    const { resolvePoolMax } = await import("./db.ts");
    // The function should not crash on a malformed URL
    const result = resolvePoolMax("not-a-valid-url", process.env);
    assert.equal(typeof result, "number");
    assert.ok(result >= 1);
  });

  it("returns 5 for Supabase session-mode pooler (?pgbouncer=true)", async () => {
    const { resolvePoolMax } = await import("./db.ts");
    assert.equal(resolvePoolMax(SUPABASE_SESSION_URL, process.env), 5);
  });
});
