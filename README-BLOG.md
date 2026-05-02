# Content management (blogs, portfolio, admin)

## Overview

- **Neon PostgreSQL** — blogs, projects, admin users  
- **Cloudinary** — uploaded images  
- **Vercel serverless** — `/api/*` routes  
- **Admin dashboard** — `/admin` (login + Blogs & Portfolio tabs)

Admin APIs use **JWT** sessions (no `ADMIN_API_KEY` in headers). Sign in at `/admin`, then use the issued bearer token for API calls (the dashboard does this automatically).

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `NEON_DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs admin JWTs (use a long random value in production) |
| `CLOUDINARY_*` | Image uploads |
| `ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_EMAIL` | Optional; used only by `npm run seed-admin` |

Add the same variables in **Vercel → Project → Settings → Environment Variables**.

## Database setup

Apply schema (Neon SQL editor or `psql`):

```bash
psql "$NEON_DATABASE_URL" -f database/schema.sql
```

Or run:

```bash
npm run setup-db
```

(applies `database/schema.sql` via `scripts/setup-database.js`)

## Install & seed

```bash
npm install
npm run migrate          # optional: import legacy blog HTML into DB
npm run seed-admin       # first admin user (uses ADMIN_SEED_* from .env)
npm run seed-projects    # optional: Mkulima Sokoni / YodaAI-style samples
```

## Admin UI

- URL: **`/admin`** (rewrites to `admin/index.html`)
- Log in with credentials created by `seed-admin` (stored hashed in `admin_users`).
- **Blogs** and **Portfolio** tabs for CRUD; image upload uses Cloudinary via `/api/upload-image` with the same JWT.

## Public URLs

- Blog index: `/blog`
- Blog post: `/blog/{slug}`
- Portfolio: `/portfolio` (projects from `/api/projects`)

## API reference

### Public

- `GET /api/blogs` — query: `page`, `limit`, `category`, `slug`, `id`
- `GET /api/projects` — published projects only

### Auth

- `POST /api/admin-auth` — body: `{ "username", "password" }` → sets cookie / returns token (see `api/admin-auth.js`)
- `GET /api/admin-auth` — validate session (Bearer token or cookie)

### Admin (requires `Authorization: Bearer <jwt>`)

- `GET/POST/PUT/DELETE /api/blogs-admin`
- `GET/POST/PUT/DELETE /api/projects-admin`
- `POST /api/upload-image` — JSON `{ "image": "data:image/...;base64,..." }`

## Troubleshooting

- **401 on admin routes** — Log in again; ensure `JWT_SECRET` matches between deploys and local `.env`.
- **DB errors** — Confirm `NEON_DATABASE_URL` and that `database/schema.sql` has been applied (including `projects` and `admin_users` columns).
- **Upload failures** — Check Cloudinary env vars and JWT on the request.

## File map

```
api/
  admin-auth.js, blogs.js, blogs-admin.js
  projects.js, projects-admin.js, upload-image.js
  _db.js, _auth.js
admin/index.html
database/schema.sql
scripts/migrate-blogs.js, seed-admin.js, seed-projects.js
blog.html, blog-detail.html, portfolio.html
```
