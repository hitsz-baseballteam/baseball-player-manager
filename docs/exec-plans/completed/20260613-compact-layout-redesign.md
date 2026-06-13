# 20260613 Compact Layout Redesign

## Problem

Current layout suffers from:
- Large hero section with verbose description text pushing content below the fold
- Every panel is a rounded corner card with 22-26px padding and visible borders, creating excessive "block" feel
- Kicker, title, description patterns repeat verbosely across panels
- Unnecessary text (e.g. "守位概览" both as kicker AND h2 title)
- Large whitespace gaps between panels (18px+)
- The AppShell description is a long concatenated status string instead of a concise label

## Goals

1. **Tighter information density** — reduce wasted whitespace and panel padding
2. **Remove redundant text** — no repeated titles, no verbose descriptions
3. **Slimmer panel design** — reduce border-radius and padding, use subtle separators instead of heavy card blocks
4. **Consolidate related information** — merge adjacent panels where possible
5. **Preserve functionality** — all actions, metrics, and interactive elements remain

## Changes

### 1. AppShell Hero Section (app-shell.tsx + app-shell.module.css)

- Remove the verbose `heroDescription` concat in player-manager-client.tsx — use a short single-line status
- Shrink hero padding from 26px → 16px
- Remove status card or inline it next to the title as a compact tag
- Reduce gap between hero elements
- Shrink title font-size at larger breakpoints

### 2. Home Overview (home-overview.tsx + home-overview.module.css)

**Alert Deck:**
- Merge critical alert + advisory notes into a single panel
- Remove kicker text ("比赛日提醒") — it's redundant with the title
- Reduce padding from 24px → 14px
- Keep only the first 2 critical items + link to full view
- Remove repeated "去排阵页X区" jump buttons in footer — keep a single entry point

**Command Strip:**
- Remove intro description paragraph ("今天先做哪一步...")
- Remove kicker text
- Compact buttons — reduce min-height, padding
- Combine quick actions + support actions into a single toolbar row (or hide support actions behind a "..." toggle)

**Metrics Panel:**
- Remove kicker + title header ("关键指标" / "今天能不能开打，先看这四格")
- Replace with a single compact metrics bar (4 inline stat pills no longer inside a card)
- Remove verbose detail text in each metric

**Scenario Panel:**
- Remove from homepage — the scenario selector is already in the lineup page; move key info into the metrics bar
- OR: merge scenario switch into a compact inline control at the top of the page

**Lineup Pulse (Defense + Batting):**
- Merge defense and batting into a single compact grid (3 columns: position | defense | batting)
- Remove kicker + title headers
- Reduce card sizes

### 3. AppShell Global (app-shell.module.css)

- Reduce `--shell-panel-radius` from 12px → 8px
- Reduce main gap from 18px → 12px
- Reduce main margin-top from 22px → 16px
- Reduce content gap from 18px → 12px

### 4. Roster Overview (roster-overview.module.css)

- Reduce action bar padding from 16px 20px → 12px 16px
- Compact filter bar spacing
- Reduce player card padding

### 5. Lineup Page (lineup-page-client.module.css)

- Already relatively compact — reduce action bar padding, tighten gap

### 6. Scenarios / Settings / Import-Export pages

- Reduce hero padding / text via AppShell changes (auto-applied)
- Reduce action bar padding

## Non-Goals

- No changes to business logic, data flow, or workspace operations
- No changes to theme system
- No changes to accessibility patterns (focus rings, ARIA labels, touch targets)
- No removal of functional controls

## Verification

1. `npm run build` — no TypeScript errors
2. `npm run lint` — no lint errors
3. Visual check: homepage fits more content above the fold on a 1440px viewport
4. All interactive elements remain reachable via keyboard
5. Touch targets stay ≥44px
