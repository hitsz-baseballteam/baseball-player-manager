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
  });
});
