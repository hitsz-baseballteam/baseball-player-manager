# Tasks: Phase 1 Static Homepage Enhancement

### T001 — Extend public-site-content types and defaults

- files:
  - `/Users/kennywang/app/baseball-player-manager/src/lib/public-site-content.ts`
  - `/Users/kennywang/app/baseball-player-manager/src/lib/public-site-content.test.ts` (new)
- detail: Add `TrainingInfo`, `ContactChannel`, `FaqItem`, and `TeamHistory` types to `PublicSiteContent`. Populate `PUBLIC_SITE_CONTENT` with realistic defaults for HITSZ Baseball (training schedule, FAQ, contacts, history, awards). Ensure the existing `navigation`, `hero`, `steps`, and `values` fields remain intact.
- evidence: `npm test -- src/lib/public-site-content.test.ts` passes.
- review: ~80 changed lines

### T002 — Update homepage navigation anchors

- files:
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.tsx`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.module.css`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.test.tsx`
- detail: Expand `content.navigation` to include 认识球队 → #about, 训练日常 → #training, 球队历史 → #history, 常见问题 → #faq, 加入我们 → #join. Add matching `id="history"` and `id="faq"` anchors in the page structure. Ensure the mobile hamburger menu closes when a navigation link is clicked.
- evidence: `npm test -- src/components/public-home.test.tsx` passes (assert navigation hrefs and anchor presence).
- review: ~60 changed lines

### T003 — Implement structured training info card

- files:
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.tsx`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.module.css`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.test.tsx`
- detail: Replace the existing `#training` definition-list with a card-style layout driven by `content.training`. Display schedule, location, items the newcomer should bring, items the team provides, and the note. Keep the existing background image and section styling.
- evidence: `npm test -- src/components/public-home.test.tsx` passes (assert training card text and list items).
- review: ~120 changed lines

### T004 — Implement FAQ accordion section

- files:
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.tsx`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.module.css`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.test.tsx`
- detail: Add a new `#faq` section rendering `content.faq` entries. Use native `<details>`/`<summary>` elements for expand/collapse behavior to guarantee keyboard and screen-reader accessibility without extra JS. Style the disclosure widgets to match the site's visual language.
- evidence: `npm test -- src/components/public-home.test.tsx` passes (assert questions, answers, and `<details>` elements exist).
- review: ~100 changed lines

### T005 — Implement contact matrix section

- files:
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.tsx`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.module.css`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.test.tsx`
- detail: Expand the existing `#join` section into a contact matrix: retain the WeChat group QR card, add an email card with a `mailto:` link, and add social-media link cards. Render from `content.contacts`. Ensure no personal phone numbers or personal WeChat IDs are present in defaults.
- evidence: `npm test -- src/components/public-home.test.tsx` passes (assert email href, social hrefs, and QR image).
- review: ~120 changed lines

### T006 — Implement team history and honors section

- files:
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.tsx`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.module.css`
  - `/Users/kennywang/app/baseball-player-manager/src/components/public-home.test.tsx`
- detail: Add a new `#history` section after `#about`. Display founding year, team story, and a list of honors/awards from `content.history`. Use a visual treatment distinct from the existing value list (e.g., timeline or split layout).
- evidence: `npm test -- src/components/public-home.test.tsx` passes (assert story and awards render).
- review: ~100 changed lines

### T007 — Regression verification and design doc update

- files:
  - `/Users/kennywang/app/baseball-player-manager/docs/DESIGN.md`
- detail: Run the full quality gate. Update the "公开球队主页" section of `docs/DESIGN.md` to document the new required modules and their configuration source (`src/lib/public-site-content.ts`). No production code changes in this task.
- evidence: `npm run lint && npm test && npm run build` all pass.
- review: ~20 changed lines

## Review Workload

Budget per task: 400 changed lines

| task | estimate |
| --- | --- |
| T001 | ~80 |
| T002 | ~60 |
| T003 | ~120 |
| T004 | ~100 |
| T005 | ~120 |
| T006 | ~100 |
| T007 | ~20 |
| **total** | **~600** |

Over-budget exceptions: none.
