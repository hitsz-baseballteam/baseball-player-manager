import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { createPasscodeHash, createUnlockCookieValue } from "@/lib/auth";
import { PANEL_ROUTES } from "@/lib/routes";
import { proxy } from "@/proxy";

describe("proxy", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.APP_ADMIN_PASSCODE_HASH = createPasscodeHash("test-passcode");
    delete process.env.APP_ADMIN_PASSCODE;
  });

  it("redirects unauthenticated panel requests to login", () => {
    const response = proxy(new NextRequest("http://localhost/panel/roster"));
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      `http://localhost${PANEL_ROUTES.login}?next=%2Fpanel%2Froster`,
    );
  });

  it("allows the login page without an auth cookie", () => {
    const response = proxy(new NextRequest("http://localhost/panel/login"));
    assert.equal(response.status, 200);
  });

  it("returns 401 for unauthenticated workspace api requests", () => {
    const response = proxy(new NextRequest("http://localhost/api/workspace"));
    assert.equal(response.status, 401);
  });

  it("allows authenticated panel and workspace requests", () => {
    const cookie = `${"baseball_manager_unlock"}=${createUnlockCookieValue()}`;
    const panelResponse = proxy(
      new NextRequest("http://localhost/panel", {
        headers: { cookie },
      }),
    );
    const apiResponse = proxy(
      new NextRequest("http://localhost/api/workspace", {
        headers: { cookie },
      }),
    );

    assert.equal(panelResponse.status, 200);
    assert.equal(apiResponse.status, 200);
  });
});
