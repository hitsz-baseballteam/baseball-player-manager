# CI Test Compatibility — Execution Plan

## Problem Statement

GitHub Actions CI is failing at `npm test` before the build step. The failure appears on documentation-only commits as well as feature commits, so it is independent of the latest product changes.

Representative failing runs:

- `27592638449` — `docs: add local development guide to README`
- `27592184736` — `docs: split README into English and Chinese`
- `27561271042` — `Add QR-only join entry on public homepage`

## Root Cause

The old test command combined Node's built-in test runner, experimental module mocks, a CJS `--require` setup file, and `--import tsx`:

```json
"test": "node --experimental-test-module-mocks --require ./src/lib/test-setup.cjs --import tsx --test ..."
```

On GitHub Actions Node `22.22.3`, that path fails before test execution with:

```text
Error [ERR_METHOD_NOT_IMPLEMENTED]: The resolveSync() method is not implemented
```

The failure comes from the CJS `--require` path interacting with the ESM loader registered by `tsx`.

During verification, a second CI configuration issue was found: `push.branches: ["*"]` does not match branch names containing `/`, such as the repository's standard `codex/*` agent branches. The workflow now uses `["**"]` so pushed feature branches also trigger CI.

## Fix

Replace the CJS setup entrypoint with an ESM setup file and let `tsx` own the test runner invocation:

```json
"test": "tsx --experimental-test-module-mocks --import ./src/lib/test-setup.mjs --test ..."
```

The ESM setup also defines JSDOM globals with `Object.defineProperty`, because newer Node versions expose some browser-like globals such as `navigator` as getter-only properties.

## Verification

- [x] Reproduced original failure locally with Node 22
- [x] Verified the new test command with Node 22
- [x] Verified the new test command with Node 24
- [x] Ran `npm test`
- [x] Ran `npm run lint`
- [x] Ran `npm run build`
- [ ] Confirmed GitHub Actions runs on `codex/*` branch push

## Follow-Up

Move this plan to `docs/exec-plans/completed/` after the fix lands and CI passes on GitHub Actions.
