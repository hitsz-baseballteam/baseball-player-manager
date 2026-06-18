import assert from "node:assert/strict";
import { describe, it } from "node:test";

import nextConfig, { CONTENT_SECURITY_POLICY } from "../../next.config";

describe("next security headers", () => {
  it("disables the x-powered-by header", () => {
    assert.equal(nextConfig.poweredByHeader, false);
  });

  it("publishes the expected CSP and security headers", async () => {
    const headerGroups = await nextConfig.headers?.();
    assert.ok(headerGroups);

    const rootHeaders = headerGroups?.find((entry) => entry.source === "/:path*")?.headers ?? [];
    const panelHeaders = headerGroups?.find((entry) => entry.source === "/panel/:path*")?.headers ?? [];
    const apiHeaders = headerGroups?.find((entry) => entry.source === "/api/:path*")?.headers ?? [];

    assert.equal(
      rootHeaders.find((header) => header.key === "Content-Security-Policy")?.value,
      CONTENT_SECURITY_POLICY,
    );
    assert.equal(
      panelHeaders.find((header) => header.key === "Cache-Control")?.value,
      "private, no-store, max-age=0",
    );
    assert.equal(
      panelHeaders.find((header) => header.key === "X-Frame-Options")?.value,
      "DENY",
    );
    // API endpoints do not get a no-store Cache-Control by default;
    // individual route handlers (e.g. /api/workspace) own their
    // Cache-Control policy. This is required because next.config.ts
    // headers take precedence over route handler header overrides.
    assert.equal(
      apiHeaders.find((header) => header.key === "Cache-Control"),
      undefined,
      "/api/:path* must not set Cache-Control so route handlers can set their own",
    );
    assert.equal(
      apiHeaders.find((header) => header.key === "Cloudflare-CDN-Cache-Control"),
      undefined,
      "/api/:path* must not set Cloudflare-CDN-Cache-Control",
    );
    // Security headers still applied to API
    assert.equal(
      apiHeaders.find((header) => header.key === "X-Frame-Options")?.value,
      "DENY",
    );
  });

  it("caches versioned WebP assets as immutable", async () => {
    const headerGroups = await nextConfig.headers?.();
    const assetHeaders = headerGroups?.find(
      (entry) => entry.source === "/assets/:path*.webp",
    )?.headers ?? [];
    const teamHeaders = headerGroups?.find(
      (entry) => entry.source === "/team/:path*.webp",
    )?.headers ?? [];

    for (const headers of [assetHeaders, teamHeaders]) {
      assert.equal(
        headers.find((header) => header.key === "Cache-Control")?.value,
        "public, max-age=31536000, immutable",
      );
    }
  });
});
