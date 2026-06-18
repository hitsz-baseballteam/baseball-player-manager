// Unit tests for sanitizeReviewOutput() in pr-review.mjs.
//
// Run with: node --test .github/scripts/pr-review.test.mjs
//
// The function is extracted via `new Function(...)` rather than `import`
// because pr-review.mjs runs `main()` at module top level and would fail
// without PR_* env vars. Extracting keeps the test focused on the pure
// sanitizer logic.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("./pr-review.mjs", import.meta.url),
  "utf8",
);
const start = src.indexOf("function sanitizeReviewOutput");
const end = src.indexOf("\n}\n", start) + 2;
if (start < 0 || end < 2) {
  throw new Error("could not locate sanitizeReviewOutput in pr-review.mjs");
}
const fnSrc = src.slice(start, end);
const sanitizeReviewOutput = new Function(fnSrc + "; return sanitizeReviewOutput;")();

const CLEAN = `## Summary
- Adds X
## Blockers
- None.
## Suggestions
- Improve Y.
## Positives
- Good Z.
## Files of concern
- src/foo.ts:1`;

test("clean 5-section review: passes through unchanged, 5/5 inOrder", () => {
  const r = sanitizeReviewOutput(CLEAN);
  assert.equal(r.completeSections, 5);
  assert.equal(r.totalSections, 5);
  assert.equal(r.inOrder, true);
  assert.equal(r.text, CLEAN.trim());
});

test("strips <think>...</think> blocks and preserves review", () => {
  const input = `<think>
Let me think carefully about this PR.

Actually wait, the user said something else.
</think>
${CLEAN}`;
  const r = sanitizeReviewOutput(input);
  assert.equal(r.completeSections, 5);
  assert.equal(r.inOrder, true);
  assert.equal(r.text.includes("<think>"), false);
  assert.equal(r.text.includes("Let me think"), false);
  assert.equal(r.text.includes("## Summary"), true);
});

test("slices from LAST ## Summary (ignores stub headings)", () => {
  // Real-world pattern from PR #13 v1: the model emitted `## Summary...`
  // three times, with only the last one having actual review content.
  const input = `## Summary...
[stub thinking content]

## Summary
## Blockers
- ...

## Summary
- Real review summary.
${CLEAN.split("\n").slice(2).join("\n")}`;
  const r = sanitizeReviewOutput(input);
  assert.equal(r.completeSections, 5);
  assert.equal(r.inOrder, true);
  assert.equal(r.text.startsWith("## Summary"), true);
  assert.equal(r.text.includes("stub thinking content"), false);
  assert.equal(r.text.includes("[stub"), false);
});

test("preserves legitimate code blocks inside Suggestions", () => {
  // A real review might say "fix is:" and then include a code snippet.
  // The sanitizer must not strip it.
  const input = `## Summary
- Adds X
## Blockers
- Bug in foo.ts
## Suggestions
- Try this fix:

\`\`\`ts
// fixed version
const x = 1;
\`\`\`

## Positives
- Good
## Files of concern
- src/foo.ts:1`;
  const r = sanitizeReviewOutput(input);
  assert.equal(r.completeSections, 5);
  assert.equal(r.inOrder, true);
  assert.equal(r.text.includes("```ts"), true);
  assert.equal(r.text.includes("// fixed version"), true);
  assert.equal(r.text.includes("const x = 1;"), true);
});

test("strips code fences only as fallback when no ## Summary exists", () => {
  // If the model wraps its think in code fences AND never emits a real
  // `## Summary`, the fallback should strip them so we at least see the
  // tail of the response.
  const input = `\`\`\`
thinking wrapped in code fence
\`\`\`
## Summary
- X
## Blockers
## Suggestions
## Positives
## Files of concern`;
  const r = sanitizeReviewOutput(input);
  assert.equal(r.text.includes("thinking wrapped"), false);
  assert.equal(r.completeSections, 5);
});

test("flags out-of-order sections", () => {
  // Blockers appears after Suggestions — wrong order.
  const input = `## Summary
- X
## Suggestions
- Y
## Blockers
- Z
## Positives
- A
## Files of concern
- src/foo.ts:1`;
  const r = sanitizeReviewOutput(input);
  assert.equal(r.completeSections, 5);
  assert.equal(r.inOrder, false);
});

test("partial review (2/5) returns correct counts", () => {
  const input = `## Summary
- Adds X
## Blockers
- None.`;
  const r = sanitizeReviewOutput(input);
  assert.equal(r.completeSections, 2);
  assert.equal(r.totalSections, 5);
  assert.equal(r.inOrder, true);
});

test("empty / null / undefined input returns safe defaults", () => {
  for (const v of ["", null, undefined]) {
    const r = sanitizeReviewOutput(v);
    assert.equal(r.completeSections, 0);
    assert.equal(r.totalSections, 5);
    assert.equal(r.text, "");
    assert.equal(r.rawLength, 0);
  }
});

test("does not confuse Files of concern with Positives (regex anchoring)", () => {
  // 'Positives' must not match a '## Files of concern' substring and
  // vice versa. Anchored `^##\s*Heading\b` regex guards against this.
  const input = `## Summary
- X
## Files of concern
- src/foo.ts:1`;
  const r = sanitizeReviewOutput(input);
  // Only Files of concern and Summary are present (3/5 sections missing).
  // Positives must not be matched by the 'Files' line.
  assert.equal(r.completeSections, 2);
});