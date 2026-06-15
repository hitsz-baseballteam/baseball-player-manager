import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

let unlockAction: (formData: FormData) => Promise<void>;
let cookieSets: Array<Record<string, unknown>> = [];
let redirectUrls: string[] = [];
let mockHeadersObj: Headers;
let createPasscodeHash: (passcode: string) => string;

describe("unlockAction", () => {
  beforeEach(async () => {
    mockHeadersObj = new Headers();
    cookieSets = [];
    redirectUrls = [];

    mock.module("next/headers", {
      namedExports: {
        cookies() {
          return {
            get() {
              return undefined;
            },
            set(opts: Record<string, unknown>) {
              cookieSets.push(opts);
            },
          };
        },
        headers() {
          return mockHeadersObj;
        },
      },
    });

    mock.module("next/navigation", {
      namedExports: {
        redirect(url: string) {
          redirectUrls.push(url);
          throw new Error("NEXT_REDIRECT");
        },
      },
    });

    const auth = await import("@/lib/auth");
    createPasscodeHash = auth.createPasscodeHash;
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.APP_ADMIN_PASSCODE_HASH = createPasscodeHash("test-passcode");
    delete process.env.APP_ADMIN_PASSCODE;

    const { clearRateLimits } = await import("@/lib/rate-limiter");
    clearRateLimits();

    const mod = await import("./actions");
    unlockAction = mod.unlockAction;
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_ADMIN_PASSCODE_HASH;
    mock.reset();
  });

  it("redirects to destination and sets cookie on correct passcode", async () => {
    const formData = new FormData();
    formData.set("passcode", "test-passcode");
    formData.set("next", "/panel/stats");

    await assert.rejects(() => unlockAction(formData), /NEXT_REDIRECT/);

    assert.equal(redirectUrls.length, 1);
    assert.equal(redirectUrls[0], "/panel/stats");

    assert.equal(cookieSets.length, 1);
    const cookie = cookieSets[0] as Record<string, unknown>;
    assert.equal(cookie.name, "baseball_manager_unlock");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.path, "/");
    assert.equal(cookie.maxAge, 60 * 60 * 24 * 7);
    assert.equal(typeof cookie.value, "string");
    assert.ok((cookie.value as string).length > 0);
  });

  it("redirects to /panel/login?error=invalid_passcode on wrong passcode", async () => {
    const formData = new FormData();
    formData.set("passcode", "wrong");

    await assert.rejects(() => unlockAction(formData), /NEXT_REDIRECT/);

    assert.equal(redirectUrls.length, 1);
    assert.match(redirectUrls[0], /\/panel\/login\?error=invalid_passcode/);
    assert.equal(cookieSets.length, 0);
  });

  it("redirects to /panel/login?error=invalid_passcode on empty passcode", async () => {
    const formData = new FormData();

    await assert.rejects(() => unlockAction(formData), /NEXT_REDIRECT/);

    assert.equal(redirectUrls.length, 1);
    assert.match(redirectUrls[0], /\/panel\/login\?error=invalid_passcode/);
    assert.equal(cookieSets.length, 0);
  });

  it("redirects to /panel/login?error=rate_limited after exceeding limit", async () => {
    // Exhaust the rate limit with 5 requests using a specific IP
    mockHeadersObj.set("x-forwarded-for", "10.0.0.1");

    for (let i = 0; i < 5; i++) {
      const fd = new FormData();
      fd.set("passcode", "test-passcode");
      try {
        await unlockAction(fd);
      } catch {
        // redirect throws — expected
      }
    }

    cookieSets = [];
    redirectUrls = [];

    // 6th request should be rate-limited
    const formData = new FormData();
    formData.set("passcode", "test-passcode");

    await assert.rejects(() => unlockAction(formData), /NEXT_REDIRECT/);

    assert.equal(redirectUrls.length, 1);
    assert.match(redirectUrls[0], /\/panel\/login\?error=rate_limited/);
    assert.equal(cookieSets.length, 0);
  });

  it("normalizes external next paths to /panel", async () => {
    const formData = new FormData();
    formData.set("passcode", "test-passcode");
    formData.set("next", "https://example.com");

    await assert.rejects(() => unlockAction(formData), /NEXT_REDIRECT/);

    assert.equal(redirectUrls.length, 1);
    assert.equal(redirectUrls[0], "/panel");
  });
});
