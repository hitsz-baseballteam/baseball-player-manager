# Baseball Player Manager

[中文说明 / Chinese README](./README.zh-CN.md)

Baseball Player Manager is a full-stack Next.js application for running a shared baseball team workspace: roster management, defensive lineup scenarios, player profiles, and game data.

## Overview

- Stack: Next.js 16 App Router, React 19, TypeScript, PostgreSQL via `pg`
- Auth model: shared passcode login with a signed `httpOnly` cookie
- Persistence model: one shared workspace snapshot stored in PostgreSQL with optimistic concurrency via `version`
- Database migrations: `supabase/migrations/`

## Features

- Public team homepage at `/` for recruiting and club presentation
- Protected control panel under `/panel`
- Roster workbench for player records, filters, and bulk edits
- Scenario workspace for defensive assignments and batting order planning
- Player profile and per-player game data management
- Settings page for import/export, reset, and logout

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run auth:env -- "your-passcode"
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_CA_CERT` | No | Custom CA certificate for private/non-public roots |
| `APP_ADMIN_PASSCODE_HASH` | Yes | Hashed admin passcode used by the login flow |
| `AUTH_SECRET` | Yes | Secret used to sign the auth cookie |

Generate `APP_ADMIN_PASSCODE_HASH` and `AUTH_SECRET` with:

```bash
npm run auth:env -- "your-passcode"
```

Notes:

- `APP_ADMIN_PASSCODE` is no longer supported at runtime
- `AUTH_SECRET` and `APP_ADMIN_PASSCODE_HASH` must both be set

## Database

The app uses PostgreSQL directly through `pg`. Schema changes live in:

- [supabase/migrations/20260529093022_create_app_workspace.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260529093022_create_app_workspace.sql)

Current schema design:

- One main table: `public.app_workspace`
- One logical workspace slug: `default`
- Workspace data stored as `jsonb`
- Writes protected by version-based optimistic concurrency

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
npm run start
```

## App Structure

### Public and protected routes

| Route | Purpose |
|---|---|
| `/` | Public team homepage |
| `/panel/login` | Shared-passcode login page |
| `/panel` | Command desk homepage |
| `/panel/roster` | Roster management |
| `/panel/scenarios` | Scenario and lineup workspace |
| `/panel/stats` | Statistics and game-data center |
| `/panel/settings` | Import/export, reset, logout |
| `/panel/players/[playerId]` | Player profile |
| `/panel/players/[playerId]/games` | Player game records |

### Key source files

| File | Purpose |
|---|---|
| `src/lib/workspace.ts` | Domain types, sanitization, import/export, workspace rules |
| `src/lib/workspace-store.ts` | PostgreSQL persistence and optimistic concurrency |
| `src/lib/auth.ts` | Passcode auth and signed cookie verification |
| `src/lib/roster-actions.ts` | Shared roster business logic |
| `src/lib/lineup-actions.ts` | Shared scenario and lineup business logic |
| `src/components/player-manager-client.tsx` | Control panel homepage client |
| `src/components/roster-page-client.tsx` | Roster page client |
| `src/components/scenarios-page-client.tsx` | Scenario page client |
| `src/components/home-overview.tsx` | Homepage overview dashboard |

## API

Current server endpoints:

- `POST /api/logout`
- `GET /api/workspace`
- `PUT /api/workspace`

`/api/workspace` is protected by the unlock cookie issued after login.

## Verification

Run all core checks before merging changes:

```bash
npm run lint
npm test
npm run build
```

## Documentation

- [AGENTS.md](/Users/kennywang/app/baseball-player-manager/AGENTS.md) - repo map and working rules
- [docs/ARCHITECTURE.md](/Users/kennywang/app/baseball-player-manager/docs/ARCHITECTURE.md) - current architecture
- [docs/DESIGN.md](/Users/kennywang/app/baseball-player-manager/docs/DESIGN.md) - visual and interaction guidance
- [docs/FRONTEND.md](/Users/kennywang/app/baseball-player-manager/docs/FRONTEND.md) - frontend conventions
- [docs/SECURITY.md](/Users/kennywang/app/baseball-player-manager/docs/SECURITY.md) - auth and security model
- [docs/RELIABILITY.md](/Users/kennywang/app/baseball-player-manager/docs/RELIABILITY.md) - concurrency and reliability notes
- [docs/design-docs/index.md](/Users/kennywang/app/baseball-player-manager/docs/design-docs/index.md) - ADR index
- [docs/design-docs/core-beliefs.md](/Users/kennywang/app/baseball-player-manager/docs/design-docs/core-beliefs.md) - design principles

## Deployment Notes

The repository currently follows a two-branch workflow:

- `dev` for preview deployments
- `main` for production deployments

Operational behavior is currently controlled by the linked Vercel project configuration rather than a repo-local `vercel.json`.
