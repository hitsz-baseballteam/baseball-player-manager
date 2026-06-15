import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const UNLOCK_COOKIE_NAME = "baseball_manager_unlock";
export const UNLOCK_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type UnlockSession = {
  exp: number;
  iat: number;
  sid: string;
  v: 1;
};

const PASSCODE_HASH_PREFIX = "scrypt";
const PASSCODE_KEY_LENGTH = 32;

function readAuthConfig() {
  const authSecret = process.env.AUTH_SECRET;
  const passcodeHash = process.env.APP_ADMIN_PASSCODE_HASH;
  const legacyPasscode = process.env.APP_ADMIN_PASSCODE;

  if (authSecret && passcodeHash) {
    return { authSecret, passcodeHash };
  }

  if (legacyPasscode && !passcodeHash) {
    throw new Error(
      "APP_ADMIN_PASSCODE is no longer supported for runtime auth. Configure APP_ADMIN_PASSCODE_HASH and AUTH_SECRET instead.",
    );
  }

  const missing = [
    !authSecret ? "AUTH_SECRET" : null,
    !passcodeHash ? "APP_ADMIN_PASSCODE_HASH" : null,
  ].filter(Boolean);

  throw new Error(`${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not configured`);
}

function signPayload(payload: string) {
  return createHmac("sha256", readAuthConfig().authSecret)
    .update(payload)
    .digest("hex");
}

function derivePasscodeKey(passcode: string, salt: string) {
  return scryptSync(passcode, salt, PASSCODE_KEY_LENGTH);
}

function parseStoredPasscodeHash(value: string) {
  const [prefix, salt, hash] = value.split(":");
  if (
    prefix !== PASSCODE_HASH_PREFIX ||
    !salt ||
    !hash
  ) {
    throw new Error("APP_ADMIN_PASSCODE_HASH is malformed");
  }

  return {
    expectedKey: Buffer.from(hash, "base64url"),
    salt,
  };
}

function parseUnlockCookieValue(value: string | undefined): {
  payload: string;
  signature: string;
} | null {
  if (!value) {
    return null;
  }

  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return null;
  }

  return {
    payload: value.slice(0, separatorIndex),
    signature: value.slice(separatorIndex + 1),
  };
}

function decodeUnlockSession(payload: string): UnlockSession | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<UnlockSession>;
    const v = parsed?.v;
    const sid = parsed?.sid;
    const iat = parsed?.iat;
    const exp = parsed?.exp;
    const validIssuedAt =
      typeof iat === "number" && Number.isInteger(iat) ? iat : null;
    const validExpiresAt =
      typeof exp === "number" && Number.isInteger(exp) ? exp : null;

    if (
      v !== 1 ||
      typeof sid !== "string" ||
      sid.length < 16 ||
      validIssuedAt === null ||
      validExpiresAt === null ||
      validExpiresAt <= validIssuedAt
    ) {
      return null;
    }

    return { exp: validExpiresAt, iat: validIssuedAt, sid, v };
  } catch {
    return null;
  }
}

export function createPasscodeHash(passcode: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = derivePasscodeKey(passcode, salt).toString("base64url");
  return `${PASSCODE_HASH_PREFIX}:${salt}:${key}`;
}

export function verifyPasscode(passcode: string) {
  const { expectedKey, salt } = parseStoredPasscodeHash(
    readAuthConfig().passcodeHash,
  );
  const derivedKey = derivePasscodeKey(passcode, salt);

  return (
    expectedKey.length === derivedKey.length &&
    timingSafeEqual(expectedKey, derivedKey)
  );
}

export function createUnlockCookieValue(now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const session: UnlockSession = {
    exp: issuedAt + UNLOCK_SESSION_MAX_AGE_SECONDS,
    iat: issuedAt,
    sid: randomBytes(16).toString("hex"),
    v: 1,
  };
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${payload}.${signPayload(payload)}`;
}

export function readUnlockSession(value: string | undefined, now = Date.now()) {
  const parsed = parseUnlockCookieValue(value);
  if (!parsed) {
    return null;
  }

  const expectedSignature = signPayload(parsed.payload);
  const actual = Buffer.from(parsed.signature);
  const expected = Buffer.from(expectedSignature);

  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return null;
  }

  const session = decodeUnlockSession(parsed.payload);
  if (!session) {
    return null;
  }

  if (session.exp <= Math.floor(now / 1000)) {
    return null;
  }

  return session;
}

export function isUnlockCookieValid(value: string | undefined, now = Date.now()) {
  return readUnlockSession(value, now) !== null;
}

export function readCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return undefined;
  }

  const prefix = `${cookieName}=`;
  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return undefined;
}
