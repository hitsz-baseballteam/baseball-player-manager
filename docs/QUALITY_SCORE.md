# Quality Score

Last updated: 2026-06-24

## Current scores

| Dimension | Score | Notes |
| --- | --- | --- |
| Type safety | 9/10 | TypeScript strict mode enabled; new public-site content types covered by tests |
| Test coverage | 8/10 | 341 passing tests across 86 suites; new homepage and content tests added |
| Build health | 9/10 | `npm run build` passes with no errors |
| Lint hygiene | 7/10 | 0 errors, 15 pre-existing warnings unrelated to this change |
| Documentation | 8/10 | `DESIGN.md` updated; `AGENTS.md` and architecture docs present |
| Accessibility | 8/10 | FAQ uses native `<details>`/`<summary>`; focus styles present |

## Recent changes

### 2026-06-30 — Phase 1 homepage number wall backendization

- Extended `PublicHomeConfig` with `members` so the public homepage number wall can be edited from `/panel/settings`.
- Added sanitization and API schema coverage for up to 60 homepage members, including nickname and visual tone fields.
- Updated `PublicHome` to prefer configured members with static content as fallback.
- Added tests for config-driven homepage rendering, member sanitization, and settings-page save payloads.
- Verification: targeted tests pass; `npm run build` succeeds; `npm run lint` remains at 0 errors with pre-existing warnings.

### 2026-06-24 — Phase 1 public homepage static content enhancement

- Extended `src/lib/public-site-content.ts` with typed `TrainingInfo`, `ContactChannel`, `FaqItem`, and `TeamHistory` structures.
- Added structured training info card, FAQ accordion, contact matrix, and team history/honors sections to the public homepage.
- Updated navigation anchors to cover all new sections.
- Added tests for `public-site-content.ts` and expanded `public-home.test.tsx`.
- Updated `docs/DESIGN.md` to describe the new public homepage modules and their configuration source.

### 2026-06-24 — Phase 2 dynamic content wiring

- Extended `Workspace.preferences` with `publicHomeConfig` (training, contacts, FAQ, history, feeds).
- New SQL migration `20250624_add_public_home_config.sql` adds the JSONB column to `app_workspace_meta`.
- New `src/lib/public-site-data.ts` exposes safe public snapshots of `milestones` and `games`.
- `src/app/page.tsx` is now a Server Component that pre-fetches public data and feeds it to `PublicHome`.
- Settings page now has a "主页展示设置" card so non-developers can edit homepage training copy and feed toggles.
- New milestones/games modules render on the public homepage when data is available.

### 2026-06-24 — Phase 3 SEO, polish, and docs

- Added JSON-LD structured data (SportsOrganization, FAQPage, SportsEvent) to the homepage for search engine enrichment.
- Updated `docs/DESIGN.md` and `docs/QUALITY_SCORE.md`.
- Full regression: lint 0 errors, 341 tests pass, build succeeds.

## Known debt

- 15 lint warnings in pre-existing files (not introduced by this change).
- Some public homepage sections remain static (`hero`, `intro`, `stats`, `timeline`, `firstMatch`, `trainingSteps`, `culture`, `gallery`); members, training, contacts, FAQ, history, milestones, and games now flow through workspace preferences or public feeds.
