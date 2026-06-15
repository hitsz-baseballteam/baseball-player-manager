import { randomBytes } from "node:crypto";

import { createPasscodeHash } from "../src/lib/auth";

const passcode = process.argv[2];

if (!passcode) {
  console.error('Usage: npm run auth:env -- "<passcode>"');
  process.exit(1);
}

const authSecret = randomBytes(32).toString("base64url");

console.log(`APP_ADMIN_PASSCODE_HASH=${createPasscodeHash(passcode)}`);
console.log(`AUTH_SECRET=${authSecret}`);
