# Proposal: Phase 1 Static Content Enhancement for Public Homepage

## Intent

Upgrade the public homepage (`/`) of the HITSZ Baseball team site from a single-page recruitment poster into a more complete, information-rich portal. This run covers only the **static content layer**: training details, FAQ, contact matrix, and a team history/honors narrative. All content lives in `src/lib/public-site-content.ts`; no database schema changes are required.

## Scope

### In scope

- Extend `src/lib/public-site-content.ts` with structured types and data for:
  - `TrainingInfo` (schedule, location, what to bring, what the team provides, notes)
  - `ContactChannel` (wechat-group, email, social links)
  - FAQ entries
  - Team history and awards
  - Expanded navigation anchors
- Update `src/components/public-home.tsx` and `public-home.module.css` to render the new sections.
- Update `src/components/public-home.test.tsx` to assert the new content and interactions.
- Update `docs/DESIGN.md` to reflect the new public homepage sections.

### Out of scope

- Database migrations or dynamic data from `milestone` / `games` tables (Phase 2).
- CMS or file upload system.
- Multi-language support.
- New routes beyond `/`.

## Rationale

Prospective members visiting the site need quick answers to three questions: when/where do you train, how do I join, and what should I expect. The current homepage has strong visual branding but thin operational content. Adding structured training info, FAQ, and a contact matrix reduces the friction before someone scans the WeChat QR code, and improves the team's credibility through history/honors.

Because Phase 1 is static-only, it can ship without touching the workspace persistence layer, making it a safe, independently reviewable increment.
