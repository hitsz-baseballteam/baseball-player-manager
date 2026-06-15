import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  createPasscodeHash,
  createUnlockCookieValue,
  isUnlockCookieValid,
  readCookieValue,
  readUnlockSession,
  verifyPasscode,
} from "./auth.ts";

describe("auth helpers", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.APP_ADMIN_PASSCODE_HASH = createPasscodeHash("secret-passcode");
    delete process.env.APP_ADMIN_PASSCODE;
  });

  it("verifies the configured passcode hash", () => {
    assert.equal(verifyPasscode("secret-passcode"), true);
    assert.equal(verifyPasscode("wrong"), false);
  });

  it("creates and validates signed unlock cookies", () => {
    const cookie = createUnlockCookieValue();
    assert.equal(isUnlockCookieValid(cookie), true);
    assert.ok(readUnlockSession(cookie)?.sid);
    assert.equal(isUnlockCookieValid(`${cookie}tampered`), false);
  });

  it("rejects expired cookies", () => {
    const cookie = createUnlockCookieValue(1_700_000_000_000);
    assert.equal(isUnlockCookieValid(cookie, 1_700_000_000_000), true);
    assert.equal(isUnlockCookieValid(cookie, 1_700_604_801_000), false);
  });

  it("extracts named cookies from a request header", () => {
    assert.equal(
      readCookieValue("a=1; baseball_manager_unlock=session; b=2", "baseball_manager_unlock"),
      "session",
    );
  });

  it("throws when only the legacy passcode variable is configured", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_ADMIN_PASSCODE_HASH;
    process.env.APP_ADMIN_PASSCODE = "legacy-only";
    assert.throws(
      () => verifyPasscode("legacy-only"),
      /APP_ADMIN_PASSCODE is no longer supported/,
    );
  });
});
