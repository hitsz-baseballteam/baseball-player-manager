# Design QA

- Reference: `public/ui-reference/hitsz-home-first-pitch.png`
- Canva editable reference: `https://www.canva.com/d/PdGTgC8Nbt7OUpK`
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
- P2: none after correcting the Hero information-band box sizing and the mobile close-button contrast.
- P3: none blocking handoff.
- The Hero now follows the reference's cream paper, oversized navy/orange headline, diagonal orange information band, outlined recruitment mark, and horizontal three-step cards.
- The selected `team-huddle.jpg` photo intentionally replaces the reference's fence photo while preserving the left-copy/right-photo composition.
- Desktop renders the full Hero and three-step flow within `1440x1024`; mobile renders the Hero and both CTAs within `390x844`.
- Mobile navigation opens correctly, its close icon remains visible, and the document width equals the viewport width.
- `/panel/stats` redirects unauthenticated visitors to `/panel/login?next=%2Fpanel%2Fstats`.
- Public canonical/Open Graph metadata, panel `noindex`, robots, and sitemap were verified in the browser.

final result: passed
