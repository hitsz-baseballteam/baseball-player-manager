# Design QA

- Reference: `public/ui-reference/hitsz-home-first-pitch.png`
- Implementation URL: `http://localhost:3000/`
- Desktop viewport: `1440x1024`
- Mobile viewport: `390x844`
- Evidence:
  - `artifacts/design-qa/reference-vs-implementation.png`
  - `artifacts/design-qa/home-desktop-hero.png`
  - `artifacts/design-qa/home-desktop-about.png`
  - `artifacts/design-qa/home-desktop-join.png`
  - `artifacts/design-qa/home-mobile-hero.png`
  - `artifacts/design-qa/home-mobile-menu-open.png`

## Findings

- P1: none.
- P2: none after fixing the closed mobile navigation drawer and header box sizing.
- P3: none blocking handoff.
- The implementation preserves the selected navy, orange, cream, oversized recruitment-poster typography, real team photography, and direct recruitment CTA.
- Mobile navigation opens correctly and the document width remains equal to the viewport width.
- `/panel/stats` redirects unauthenticated visitors to `/panel/login?next=%2Fpanel%2Fstats`.
- Public canonical/Open Graph metadata, panel `noindex`, robots, and sitemap were verified in the browser.

final result: passed
