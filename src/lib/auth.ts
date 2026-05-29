import { createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_COOKIE_NAME = "baseball_manager_unlock";
const UNLOCK_COOKIE_PAYLOAD = "v1:unlocked";

function getPasscode() {
  const passcode = process.env.APP_ADMIN_PASSCODE;
  if (!passcode) {
    throw new Error("APP_ADMIN_PASSCODE is not configured");
  }

  return passcode;
}

function signPayload(payload: string) {
  return createHmac("sha256", getPasscode()).update(payload).digest("hex");
}

export function verifyPasscode(passcode: string) {
  return passcode === getPasscode();
}

export function createUnlockCookieValue() {
  return `${UNLOCK_COOKIE_PAYLOAD}.${signPayload(UNLOCK_COOKIE_PAYLOAD)}`;
}

export function isUnlockCookieValid(value: string | undefined) {
  if (!value) {
    return false;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature || payload !== UNLOCK_COOKIE_PAYLOAD) {
    return false;
  }

  const expectedSignature = signPayload(payload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
