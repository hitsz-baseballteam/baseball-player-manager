## Harness Engineering — Local Operating Discipline

You are working in a project that follows Harness Engineering principles.

### Knowledge Model
- The repository is the system of record.
- Start from `AGENTS.md`, then follow links to deeper docs.
- Do not invent project conventions; verify them from the repo first.

### Documentation Discipline
- When docs and code disagree, trust the code, then update the docs.
- Keep `AGENTS.md` short and high-signal.
- Prefer links to deeper docs over repeating long prose.
- Files added under `docs/references/` must use the `-llms.txt` suffix.

### Planning
- Do not create a standalone execution plan for every task.
- Use `docs/exec-plans/active/` for medium/large, multi-step, cross-session, or architecture-affecting work when a durable execution record will help future agents.
- Small, self-contained changes can keep the plan inline in the task description, commit message, or PR description.
- Move finished plans to `docs/exec-plans/completed/` when the work is done.
- If the work changes architecture or important product behavior, record that decision in `docs/design-docs/`.

### Change Discipline
- Keep changes self-contained when practical: code, tests, docs, and verification notes together.
- Update `docs/QUALITY_SCORE.md` after significant changes, or explicitly note why scores did not change.
- Record unknowns explicitly instead of guessing.
- Verify with real commands before claiming success.
