# Content management (blogs, portfolio, admin)

## Overview

- **Supabase Postgres** — blogs, projects, admin users  
- **Supabase Storage** (`taistat-media`) — uploaded images  
- **Vercel serverless** — `/api/*` routes  
- **Admin dashboard** — `/admin` (login + Blogs & Portfolio tabs)

Admin APIs use **JWT** sessions. Sign in at `/admin`, then the dashboard sends the bearer token automatically.

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase pooler Postgres URL (app runtime) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side key for Storage uploads |
| `SUPABASE_MEDIA_BUCKET` | Optional; default `taistat-media` |
| `JWT_SECRET` | Signs admin JWTs |
| `ADMIN_SEED_*` | Optional; used by `npm run seed-admin` |

Add the same variables in **Vercel → Project → Settings → Environment Variables**.

## Database setup

```bash
npm run setup-db
```

## Install & seed

```bash
npm install
npm run seed-admin
npm run seed-projects
```

## Admin UI

Open `/admin`, sign in, manage blogs (with go-live date/time scheduling) and portfolio projects.
