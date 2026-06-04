# Baseball Player Manager

A Next.js 16 application for managing a shared baseball roster, defensive assignments, and batting-order scenarios.
The current UI is hybrid: a legacy DOM-based manager is hosted inside a newer React/Next.js shell, and workspace data is persisted through protected server-side APIs backed by PostgreSQL.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL via `pg`
- Supabase SQL migrations

## Environment Variables

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`
- `APP_ADMIN_PASSCODE`

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm test
npm run build
```

## Deployment Flow

This repository uses a two-branch Vercel workflow:

- `dev` — primary development branch; pushes should produce **Vercel Preview** deployments
- `main` — production branch; pushes should produce **Vercel Production** deployments

Operational note:

- the `main` → Production and non-`main` → Preview behavior is currently controlled by the linked Vercel project settings, not by a repo-local `vercel.json`
- the linked Vercel project currently uses `main` as its Git production branch

## Database Schema

The repository currently includes one migration:

- [`supabase/migrations/20260529093022_create_app_workspace.sql`](./supabase/migrations/20260529093022_create_app_workspace.sql)

That migration creates the `public.app_workspace` table used by the application and seeds a default shared workspace row when missing.

## API Surface

The app currently uses these server routes:

- `POST /api/unlock`
- `POST /api/logout`
- `GET /api/workspace`
- `PUT /api/workspace`

`/api/workspace` is protected by a signed `httpOnly` cookie set through the unlock flow.

## Project Docs

- [AGENTS.md](./AGENTS.md) — compact repo map for agents
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — observed current-state architecture
- [docs/index.md](./docs/index.md) — documentation index
