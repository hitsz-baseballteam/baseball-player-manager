import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  createUnlockCookieValue,
  isUnlockCookieValid,
  verifyPasscode,
} from "./auth.ts";

describe("auth helpers", () => {
  beforeEach(() => {
    process.env.APP_ADMIN_PASSCODE = "secret-passcode";
  });

  it("verifies the configured passcode", () => {
    assert.equal(verifyPasscode("secret-passcode"), true);
    assert.equal(verifyPasscode("wrong"), false);
  });

  it("creates and validates signed unlock cookies", () => {
    const cookie = createUnlockCookieValue();
    assert.equal(isUnlockCookieValid(cookie), true);
    assert.equal(isUnlockCookieValid(`${cookie}tampered`), false);
  });
});
