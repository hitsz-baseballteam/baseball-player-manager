# Design: Phase 1 Static Homepage Enhancement

## Code roots

```
/Users/kennywang/app/baseball-player-manager/src/lib/public-site-content.ts
/Users/kennywang/app/baseball-player-manager/src/components/public-home.tsx
/Users/kennywang/app/baseball-player-manager/src/components/public-home.module.css
/Users/kennywang/app/baseball-player-manager/src/components/public-home.test.tsx
/Users/kennywang/app/baseball-player-manager/docs/DESIGN.md
```

## Approach

### Data layer

Extend `PublicSiteContent` in `src/lib/public-site-content.ts` with new typed fields. Keep the file as the single source of truth for Phase 1 static content.

```ts
export type TrainingInfo = {
  schedule: string;
  location: string;
  whatToBring: string[];
  whatWeProvide: string[];
  note: string;
};

export type ContactChannel = {
  type: "wechat-group" | "email" | "social";
  label: string;
  value: string;
  href?: string;
  qrImage?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type TeamHistory = {
  foundedYear: number | null;
  story: string;
  awards: string[];
};
```

Update `PUBLIC_SITE_CONTENT` with realistic default copy for HITSZ Baseball.

### Presentation layer

Modify `public-home.tsx` to:

1. Update `content.navigation` and add corresponding `id` anchors (`#history`, `#faq`).
2. Replace the current `#training` `<dl>` with a structured training card.
3. Add a new `#history` section after `#about`.
4. Add a new `#faq` section with collapsible entries. Use native `<details>`/`<summary>` for accessibility and zero JS.
5. Expand the `#join` section into a contact matrix: keep the WeChat QR card, add email and social link cards.

All rendering consumes `content.*` values; no hard-coded strings.

### Styling

Add new CSS classes to `public-home.module.css`:

- `.trainingCard`, `.trainingGrid`, `.trainingList` for the training block.
- `.historySection`, `.historyGrid`, `.awardsList` for history/honors.
- `.faqSection`, `.faqItem`, `.faqSummary`, `.faqAnswer` for FAQ.
- `.contactMatrix`, `.contactCard`, `.contactEmail`, `.contactSocial` for the contact block.

Maintain the existing color tokens (`--public-navy`, `--public-orange`, `--public-cream`, etc.) and typography rhythm.

### Testing

Update `public-home.test.tsx` to assert:

- Navigation links point to the new anchors.
- Training section renders schedule, location, bring/provide lists, and note.
- FAQ questions and answers are present and accessible.
- Contact matrix renders email and social links with correct `href` values.
- History section renders story and awards.

Add `src/lib/public-site-content.test.ts` to assert the exported content shape has the new required fields and non-empty defaults.

### Documentation

Update `docs/DESIGN.md` under the "公开球队主页" section to list the new required content modules and their configuration source.

## Steering / Constitution check

| rule | status | waiver |
| --- | --- | --- |
| Steering/constitution present | n/a | No `.sdd/constitution.md`, `.sdd/steering.md`, or `.kiro/steering/*` found |
| Scope matches product/tech constraints | pass | Phase 1 stays static and avoids DB changes; aligns with `docs/PRODUCT_SENSE.md` simplicity principle |
| No forbidden dependency or workflow change | pass | No new runtime dependencies; only content/config additions |
