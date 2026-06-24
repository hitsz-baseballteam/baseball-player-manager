# Spec Delta

Canonical store `.sdd/specs/requirements.md` is absent; this delta is entirely new requirements.

## ADDED

### REQ:public-home-training-info

The public homepage must display structured training information so prospective members know when, where, and how to attend.

Acceptance criteria:
- A "Training" or "First Practice" section shows the regular schedule, location, what to bring, what the team provides, and any notes (e.g., rain policy).
- The information is sourced from `src/lib/public-site-content.ts` via a typed `TrainingInfo` structure.
- The section is readable on mobile without breaking the existing layout.

### REQ:public-home-faq

The public homepage must include a Frequently Asked Questions section addressing common recruitment concerns.

Acceptance criteria:
- At least six FAQ entries are rendered, covering: zero-base welcome, equipment, training frequency/intensity, balancing school and practice, gender inclusion, whether competition is mandatory, and how to contact the team.
- Each entry can be expanded to reveal the answer and collapsed to hide it.
- The interaction works with keyboard (Enter/Space) and screen readers.

### REQ:public-home-contact-matrix

The public homepage must provide multiple contact channels beyond a single WeChat QR code.

Acceptance criteria:
- A contact section displays the WeChat group QR code, an email address, and any social media links (e.g., official account, Bilibili, Xiaohongshu).
- Email links use `mailto:`; social links open externally.
- No personal phone numbers or personal WeChat IDs are exposed.

### REQ:public-home-history-honors

The public homepage must include a lightweight team history and honors section to build trust.

Acceptance criteria:
- A section displays founding year (when known), team story/motto, and a list of honors/major events.
- Content is sourced from `src/lib/public-site-content.ts`.
- Visual treatment distinguishes it from the existing "About" section.

### REQ:public-home-navigation

The public homepage navigation must let users jump to every major content section.

Acceptance criteria:
- Navigation items include: 认识球队, 训练日常, 球队历史, 常见问题, 加入我们.
- Each item links to the corresponding in-page anchor (`#about`, `#training`, `#history`, `#faq`, `#join`).
- On mobile, opening the hamburger menu and tapping a link scrolls to the section and closes the menu.

### REQ:public-home-content-configurability

All new static content must live in a single configuration file so non-developers can update wording by editing one location.

Acceptance criteria:
- All Phase 1 content is declared in `src/lib/public-site-content.ts`.
- No new content strings are hard-coded inside `public-home.tsx`.
