# Baseball Player Manager

Next.js + Supabase version of the baseball player manager. The frontend keeps the existing single-page workflow and UI structure, while persistence now goes through protected server-side APIs backed by Supabase.

## Stack

- Next.js 16 App Router
- Server-side Supabase access with `service_role`
- Shared passcode protection via signed `httpOnly` cookie
- Workspace snapshot storage in `public.app_workspace`

## Environment Variables

Copy [.env.example](/Users/kennywang/Documents/baseball%20player%20manager/.env.example) to `.env.local` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ADMIN_PASSCODE`

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build and Test

```bash
npm run lint
npm test
npm run build
```

## Supabase Schema

Local migration file:

- [supabase/migrations/20260529172000_create_app_workspace.sql](/Users/kennywang/Documents/baseball%20player%20manager/supabase/migrations/20260529172000_create_app_workspace.sql)

This migration has already been applied to Supabase project `frwuqncmghzrmqnxcfnw`, and the default shared workspace row was verified.

## Deployment

Deploy to Vercel after setting the same three environment variables in the Vercel project:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ADMIN_PASSCODE`

The app does not expose Supabase credentials to the browser. All reads and writes go through:

- `POST /api/unlock`
- `POST /api/logout`
- `GET /api/workspace`
- `PUT /api/workspace`
