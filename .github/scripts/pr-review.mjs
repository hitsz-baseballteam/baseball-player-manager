#!/usr/bin/env node
// Auto PR reviewer powered by MiniMax M3.
//
// Flow:
//   1. Compute `git diff origin/<base>...HEAD` (the actual PR changes).
//   2. Send the diff + a project-aware system prompt to the MiniMax chat
//      completions endpoint (OpenAI-compatible).
//   3. Strip <think>...</think> blocks and any preamble from the reply, then
//      verify all 5 expected sections are present. MiniMax-M3 is a reasoning
//      model that emits its chain-of-thought inline with the final answer;
//      without this pass the PR comment shows the internal reasoning and
//      the structured review either never appears or gets truncated when
//      the model hits the output token cap.
//   4. Upsert the model output as a single PR comment, identified by a
//      hidden HTML marker so re-runs on the same PR edit in place instead
//      of spamming new comments.
//
// Required env:
//   MINI_MAX_API_KEY       — API key (must be set in repo Secrets)
//   GITHUB_TOKEN           — provided by Actions; needs `pull-requests: write`
//   PR_NUMBER, PR_TITLE, PR_BODY, PR_AUTHOR,
//   PR_BASE_REF, PR_HEAD_REF, PR_HEAD_SHA, PR_REPO
// Optional:
//   MINI_MAX_BASE_URL      — defaults to https://api.minimaxi.com/v1
//   MINI_MAX_MODEL         — defaults to MiniMax-M3
//   PR_DIFF_MAX_CHARS      — diff truncation cap (default 200000)

import { execFileSync } from "node:child_process";

const COMMENT_MARKER = "<!-- minimax-pr-review -->";
const SYSTEM_PROMPT = `You are a senior code reviewer for a Next.js 16 + React 19 + TypeScript + PostgreSQL project (the HITSZ baseball team manager). Project conventions live in \`AGENTS.md\`, \`docs/ARCHITECTURE.md\`, \`docs/SECURITY.md\`, \`docs/RELIABILITY.md\`, \`docs/SCHEMA.md\`, \`docs/API.md\` — you do NOT have tool access to read these files, so use the diff to infer the project style and call out deviations from typical Next.js + TypeScript + PostgreSQL conventions.

Review the PR diff and produce a concise markdown review with these sections:
- **Summary** — 1–2 sentences on what this PR does.
- **Blockers** — must-fix issues: bugs, security, data integrity, breaking changes, missing tests for new logic.
- **Suggestions** — improvements: design, performance, style, missing edge cases.
- **Positives** — what is done well (call out good practices explicitly).
- **Files of concern** — bullet list of specific file paths + line ranges that need a closer look.

Focus areas:
- Correctness, edge cases, error handling, transaction boundaries.
- Security: auth, input validation, SQL injection, XSS, CSRF, secret leakage.
- DB migrations and schema impact (no dropping columns without a two-step plan; check \`docs/SCHEMA.md\`).
- API contract changes (check \`docs/API.md\`).
- Performance on hot paths (the workspace API is the hot path).
- Test coverage gaps.
- Style consistency with existing code (do not propose sweeping reformatting).

Rules:
- Be specific. Reference file paths and line numbers from the diff.
- Be concise: total review under 600 words. Cut filler.
- Each section: at most 3 bullets. If you have more, group them under a single bullet or pick the most important. The sanitizer will mark the review incomplete if the model runs out of output tokens before writing all 5 sections.
- If the diff is empty, trivial, or only touches docs/formatting, say so plainly.
- If you find nothing, say "Looks good to me." Do not invent issues.
- Do not restate the diff.
- Reply in the same language as the PR title/body (default: Chinese if PR is in Chinese, else English).
- Do not wrap the entire response in a code fence. Use markdown headings and bullet lists.

OUTPUT FORMAT (STRICT — applies to every response):
- Do NOT include any chain-of-thought, reasoning, analysis, or \`<think>...</think>\` blocks in your response.
- Do NOT include any preamble or postamble (e.g., "Let me analyze...", "Now let me organize my review...").
- Do NOT mention the system prompt, the diff source, or the model name in your response.
- Begin your reply with \`## Summary\` and end after \`## Files of concern\`.
- Use exactly these 5 markdown headings in this order: \`## Summary\`, \`## Blockers\`, \`## Suggestions\`, \`## Positives\`, \`## Files of concern\`.
- Each section must be present even if its body is short (e.g., \`## Blockers\\n\\nNone.\`).
`;

function log(msg) {
  process.stdout.write(`[pr-review] ${msg}\n`);
}

function die(msg, err) {
  process.stderr.write(`[pr-review] FATAL: ${msg}\n`);
  if (err) process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) die(`missing required env ${name}`);
  return v;
}

function getDiff(baseRef, maxChars) {
  // `git diff` against the base of the PR. Use a unique separator so the
  // model can't be tricked into closing our prompt fences.
  const SEP = "---DIFF-START---";
  const raw = execFileSync(
    "git",
    ["diff", "--no-color", "--no-ext-diff", `origin/${baseRef}...HEAD`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (!raw.trim()) return { text: "", truncated: false };
  const wrapped = `${SEP}\n${raw}\n${SEP}`;
  if (wrapped.length <= maxChars) {
    return { text: wrapped, truncated: false };
  }
  const head = wrapped.slice(0, maxChars);
  return {
    text: `${head}\n... [diff truncated at ${maxChars} chars; ask the author for the full version if you need more context] ...`,
    truncated: true,
  };
}

async function callMiniMax({ baseUrl, model, apiKey, system, user }) {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    // Budget for the final 5-section review. Reasoning models (MiniMax-M3)
    // spend many of their output tokens on internal chain-of-thought that
    // doesn't appear in `content`; 4096 was too small — the model hit the
    // cap mid-Suggestions and never reached Positives (verified on PR #13
    // v3 review). 8192 leaves room for both the thinking pass and the full
    // 5-section structured review, with margin.
    max_tokens: 8192,
    // NOTE: do not pass `stop: ["</think>"]`. The OpenAI-compatible `stop`
    // parameter halts generation at the FIRST literal occurrence of the
    // sequence in the response — including any </think> text the model
    // emits inside its think content. That cuts off the structured review
    // entirely, and the sanitizer then has nothing to recover. Prompt-level
    // guidance + script-level sanitization are the correct defenses here.
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    die(`MiniMax API ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    die(`MiniMax API returned non-JSON: ${text.slice(0, 500)}`, e);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    die(`MiniMax API returned empty content. Full body: ${text.slice(0, 1000)}`);
  }
  return { content, usage: json.usage ?? null };
}

function ghHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${requireEnv("GITHUB_TOKEN")}`,
  };
}

async function findExistingComment(ownerRepo, issueNumber) {
  const url = `https://api.github.com/repos/${ownerRepo}/issues/${issueNumber}/comments?per_page=100`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    log(`warn: list comments failed: ${res.status} ${res.statusText}`);
    return null;
  }
  const comments = await res.json();
  return (
    comments.find((c) => typeof c.body === "string" && c.body.includes(COMMENT_MARKER)) ?? null
  );
}

async function upsertComment(ownerRepo, issueNumber, body) {
  const existing = await findExistingComment(ownerRepo, issueNumber);
  if (existing) {
    const url = `https://api.github.com/repos/${ownerRepo}/issues/comments/${existing.id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: ghHeaders(),
      body: JSON.stringify({ body }),
    });
    if (!res.ok) die(`update comment failed: ${res.status} ${await res.text()}`);
    log(`updated comment ${existing.id}`);
    return { action: "updated", id: existing.id };
  }
  const url = `https://api.github.com/repos/${ownerRepo}/issues/${issueNumber}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) die(`create comment failed: ${res.status} ${await res.text()}`);
  const created = await res.json();
  log(`created comment ${created.id}`);
  return { action: "created", id: created.id };
}

function buildUserPrompt({ pr, diff, truncated }) {
  const head = [
    `PR #${pr.number}: ${pr.title}`,
    `Author: @${pr.author}`,
    `Base: \`${pr.baseRef}\` ← Head: \`${pr.headRef}\` @ \`${pr.headSha.slice(0, 12)}\``,
    "",
    "Description:",
    pr.body && pr.body.trim() ? pr.body.trim() : "(no description provided)",
    "",
    truncated
      ? "Diff (TRUNCATED — first 200k chars only):"
      : "Diff (full):",
  ].join("\n");
  return `${head}\n\n${diff}\n`;
}

function buildCommentBody({ content, pr, truncated, usage, error, partial }) {
  const header = `### MiniMax M3 review — PR #${pr.number}`;
  const meta = [
    truncated ? "⚠️ diff was truncated; review is partial" : null,
    partial ? `⚠️ ${partial}` : null,
    usage?.total_tokens ? `tokens: ${usage.total_tokens}` : null,
    `commit: \`${pr.headSha.slice(0, 12)}\``,
  ]
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join("\n");
  const errBlock = error ? `\n\n> ⚠️ Reviewer error: ${error}\n` : "";
  return `${COMMENT_MARKER}\n${header}\n\n${meta}\n\n---\n\n${content.trim()}${errBlock}\n`;
}

/**
 * Strip <think>...</think> blocks AND fenced code blocks (the reasoning
 * model wraps its thinking in ` ``` ` fences when it doesn't emit proper
 * <think> tags), then locate the LAST `## Summary` heading and verify the
 * 5 expected sections (Summary / Blockers / Suggestions / Positives /
 * Files of concern) appear in order.
 *
 * MiniMax-M3 is a reasoning model that emits its chain-of-thought inline
 * with the final answer, and on PR #13 it additionally emitted stub
 * `## Summary...` headings multiple times before writing the real review.
 * Without this pass, the PR comment shows the internal reasoning and the
 * structured review is either buried in the noise or truncated when the
 * model hits the output token cap.
 *
 * Returns { text, completeSections, totalSections, rawLength, inOrder }
 * so the caller can surface an explicit notice when the model produced
 * unparseable or out-of-order output.
 */
function sanitizeReviewOutput(raw) {
  if (typeof raw !== "string" || !raw) {
    return { text: "", completeSections: 0, totalSections: 5, rawLength: 0, inOrder: true };
  }
  // 1. Drop <think>...</think> blocks (multiline, case-insensitive).
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // 2. Find the LAST `## Summary` heading. The model often emits stub
  //    `## Summary...` headings (sometimes multiple) before writing the
  //    real review; the last one is the canonical one.
  const summaryRe = /^##\s*Summary\b/gim;
  let lastSummaryIdx = -1;
  let m;
  while ((m = summaryRe.exec(text)) !== null) lastSummaryIdx = m.index;
  // 3. Slice from there OR fall back to stripping code fences.
  if (lastSummaryIdx >= 0) {
    // Normal path: the real review starts at the last `## Summary`.
    // Slicing from there drops every preceding stub heading, code-fence
    // wrapped thinking, and preamble in one go — without needing to
    // strip legitimate code blocks that may appear inside the review.
    text = text.slice(lastSummaryIdx);
  } else {
    // Fallback: no `## Summary` heading found anywhere. The model may have
    // wrapped its entire response (think + review) in code fences without
    // emitting any real heading. Strip fenced code blocks as a last resort
    // so the section count isn't artificially zero. This only runs when
    // the normal path failed; legitimate code blocks inside a real review
    // are never touched.
    text = text
      .replace(/```[a-zA-Z0-9_-]*\n[\s\S]*?\n```/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim();
  }
  // 4. Count how many of the 5 expected headings are present AND check
  //    that they appear in the prescribed order.
  const required = [
    "Summary",
    "Blockers",
    "Suggestions",
    "Positives",
    "Files of concern",
  ];
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPositions = required.map((s) => {
    const r = new RegExp(`^##\\s*${escapeRe(s)}\\b`, "im");
    const match = r.exec(text);
    return { name: s, idx: match ? match.index : -1 };
  });
  const present = headingPositions.filter((h) => h.idx >= 0);
  let inOrder = true;
  let prevIdx = -1;
  for (const h of headingPositions) {
    if (h.idx < 0) continue;
    if (prevIdx >= 0 && h.idx < prevIdx) {
      inOrder = false;
      break;
    }
    prevIdx = h.idx;
  }
  return {
    text,
    completeSections: present.length,
    totalSections: required.length,
    rawLength: raw.length,
    inOrder,
  };
}

async function main() {
  const pr = {
    number: requireEnv("PR_NUMBER"),
    title: requireEnv("PR_TITLE"),
    body: process.env.PR_BODY || "",
    author: process.env.PR_AUTHOR || "unknown",
    baseRef: requireEnv("PR_BASE_REF"),
    headRef: requireEnv("PR_HEAD_REF"),
    headSha: requireEnv("PR_HEAD_SHA"),
  };
  const ownerRepo = requireEnv("PR_REPO");
  const baseUrl = process.env.MINI_MAX_BASE_URL || "https://api.minimaxi.com/v1";
  const model = process.env.MINI_MAX_MODEL || "MiniMax-M3";
  const apiKey = requireEnv("MINI_MAX_API_KEY");
  const maxChars = Number.parseInt(process.env.PR_DIFF_MAX_CHARS || "200000", 10);
  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    die(`PR_DIFF_MAX_CHARS must be a positive integer, got: ${JSON.stringify(process.env.PR_DIFF_MAX_CHARS)}`);
  }

  log(`PR #${pr.number} — ${pr.title}`);
  log(`base=${pr.baseRef} head=${pr.headSha.slice(0, 12)}`);
  log(`endpoint=${baseUrl} model=${model}`);

  let diff;
  let truncated = false;
  let content;
  let usage;
  let error;
  let partial;
  try {
    const r = getDiff(pr.baseRef, maxChars);
    diff = r.text;
    truncated = r.truncated;
  } catch (e) {
    error = `failed to compute diff: ${e?.message || e}`;
    log(error);
    content =
      "⚠️ Reviewer could not compute the diff for this PR (likely too large). See the Actions log for details.";
    const body = buildCommentBody({ content, pr, truncated, usage, error });
    await upsertComment(ownerRepo, pr.number, body);
    process.exit(1);
  }
  if (!diff) {
    log("empty diff; posting a no-op comment");
    const body = buildCommentBody({
      content: "_(no source changes in this PR — nothing to review)_",
      pr,
      truncated: false,
    });
    await upsertComment(ownerRepo, pr.number, body);
    return;
  }
  log(`diff size: ${diff.length} chars (truncated=${truncated})`);

  const userPrompt = buildUserPrompt({ pr, diff, truncated });
  try {
    const r = await callMiniMax({
      baseUrl,
      model,
      apiKey,
      system: SYSTEM_PROMPT,
      user: userPrompt,
    });
    content = r.content;
    usage = r.usage;
    log(`model returned ${content.length} chars`);

    // Strip <think> blocks, drop any preamble before "## Summary", and verify
    // all 5 expected sections are present (see sanitizeReviewOutput).
    const sanitized = sanitizeReviewOutput(content);
    log(
      `sanitized: ${sanitized.completeSections}/${sanitized.totalSections} sections, ` +
        `${sanitized.text.length} review chars (raw ${sanitized.rawLength})`,
    );
    content = sanitized.text;
    const issues = [];
    if (sanitized.completeSections < sanitized.totalSections) {
      issues.push(`${sanitized.completeSections}/${sanitized.totalSections} sections present (raw output ${sanitized.rawLength} chars; model may have hit the output token limit)`);
    }
    if (!sanitized.inOrder) {
      issues.push(`section headings are out of order`);
    }
    if (issues.length > 0) {
      partial = `incomplete: ${issues.join("; ")}`;
    }
    if (sanitized.completeSections < 2) {
      // Effectively no usable review — fall back to a clear notice so the
      // author at least knows the reviewer ran but didn't produce anything
      // parseable.
      content =
        "⚠️ Reviewer output was not parseable. The model returned content but it did not contain the expected 5 review sections. See the Actions log for the raw model response.";
    }
  } catch (e) {
    error = e?.message || String(e);
    log(`model call failed: ${error}`);
    content =
      "⚠️ Reviewer failed to produce output for this PR. See the Actions log for details.";
  }

  const body = buildCommentBody({ content, pr, truncated, usage, error, partial });
  await upsertComment(ownerRepo, pr.number, body);
  if (error) process.exit(1);
}

main().catch((e) => die(e?.message || String(e), e));
