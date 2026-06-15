import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildPoolConfig } from "./db.ts";

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
