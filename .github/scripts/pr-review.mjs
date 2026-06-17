#!/usr/bin/env node
// Auto PR reviewer powered by MiniMax M3.
//
// Flow:
//   1. Compute `git diff origin/<base>...HEAD` (the actual PR changes).
//   2. Send the diff + a project-aware system prompt to the MiniMax chat
//      completions endpoint (OpenAI-compatible).
//   3. Upsert the model output as a single PR comment, identified by a
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
const SYSTEM_PROMPT = `You are a senior code reviewer for a Next.js 16 + React 19 + TypeScript + PostgreSQL project (the HITSZ baseball team manager). Project conventions live in \`AGENTS.md\`, \`docs/ARCHITECTURE.md\`, \`docs/SECURITY.md\`, \`docs/RELIABILITY.md\`, \`docs/SCHEMA.md\`, \`docs/API.md\` — read them on disk when the diff references them, but DO NOT restate them.

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
- If the diff is empty, trivial, or only touches docs/formatting, say so plainly.
- If you find nothing, say "Looks good to me." Do not invent issues.
- Do not restate the diff.
- Reply in the same language as the PR title/body (default: Chinese if PR is in Chinese, else English).
- Do not wrap the entire response in a code fence. Use markdown headings and bullet lists.`;

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
    max_tokens: 2048,
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

function buildCommentBody({ content, pr, truncated, usage, error }) {
  const header = `### MiniMax M3 review — PR #${pr.number}`;
  const meta = [
    truncated ? "⚠️ diff was truncated; review is partial" : null,
    usage?.total_tokens ? `tokens: ${usage.total_tokens}` : null,
    `commit: \`${pr.headSha.slice(0, 12)}\``,
  ]
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join("\n");
  const errBlock = error ? `\n\n> ⚠️ Reviewer error: ${error}\n` : "";
  return `${COMMENT_MARKER}\n${header}\n\n${meta}\n\n---\n\n${content.trim()}${errBlock}\n`;
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

  log(`PR #${pr.number} — ${pr.title}`);
  log(`base=${pr.baseRef} head=${pr.headSha.slice(0, 12)}`);
  log(`endpoint=${baseUrl} model=${model}`);

  let diff;
  let truncated = false;
  let content;
  let usage;
  let error;
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
  } catch (e) {
    error = e?.message || String(e);
    log(`model call failed: ${error}`);
    content =
      "⚠️ Reviewer failed to produce output for this PR. See the Actions log for details.";
  }

  const body = buildCommentBody({ content, pr, truncated, usage, error });
  await upsertComment(ownerRepo, pr.number, body);
  if (error) process.exit(1);
}

main().catch((e) => die(e?.message || String(e), e));
