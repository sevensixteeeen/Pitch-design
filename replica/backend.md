# Backend: Pitch

Status 2026-10-27: **connected to your Supabase project and checked live; 62 tests pass.** The app is named
Pitch and is a learning project that **won't be deployed**. So the items below about friends signing up,
custom SMTP, the privacy policy and Render no longer apply.
Follows `architecture.md`. Where the replica-backend checklist and the architecture differ, the
architecture wins and the reason is written below.

## How to run

```
# 1. once: copy .env.example to .env.local and fill it in (see "Your steps")
# 2. create the tables (from backend/)
uv run --env-file ../.env.local python -m app.migrate
# 3. start the API on http://127.0.0.1:8000  (docs: /docs)
uv run --env-file ../.env.local uvicorn app.main:app --reload
# 4. start the editor (from frontend/); /api is forwarded to port 8000
npm run dev
# tests (from backend/): throwaway local Postgres, fake login keys, fake Storage
uv run pytest
# made-up designs for your own account (user id from Dashboard > Authentication > Users)
uv run --env-file ../.env.local python -m app.seed --owner <your-user-id> --allow-remote
```

Without the `VITE_SUPABASE_*` values the frontend keeps using the fake in-browser data (`src/data/index.ts`).

## What's where

| file | does |
| --- | --- |
| `supabase/migrations/0001_init.sql` | the schema (copy of `replica/schema.sql`) |
| `supabase/migrations/0002_deleted_accounts.sql` | ids of deleted accounts, so their still-valid login tokens get 401 (BUG-003). The purge job (M3) can drop rows older than a day |
| `backend/app/migrate.py` | runs each migration file once, records it in `schema_migrations` |
| `backend/app/seed.py` | made-up folders and designs; refuses non-local databases without `--allow-remote` |
| `backend/app/auth.py` | checks the login token (JWT) against Supabase's public keys; creates the profile row |
| `backend/app/document.py` | the design document's rules (Pydantic); mirrors `frontend/src/lib/document.ts` |
| `backend/app/storage.py` | Supabase Storage (signed links, upload tokens, delete) + the admin "delete user" call |
| `backend/app/routes/` | `me`, `designs`, `folders`, `assets` |
| `backend/app/ratelimit.py` | per-user limits: upload start 60/min, thumbnail 120/min, account delete 5/h |
| `frontend/src/data/http.ts` | the real data layer: Supabase Auth in the browser + `/api` calls |
| `frontend/src/lib/supabase.ts` | the browser's Supabase client (publishable key only) |
| `.env.example` | every variable name, no values |

## Routes built (21 of the 27 in architecture.md)

`GET/DELETE /api/me` · `GET/POST /api/designs` · `GET/PATCH/DELETE /api/designs/{id}` ·
`PUT …/content` · `POST …/trash`, `…/restore`, `…/thumbnail` · `GET/POST /api/folders` ·
`PATCH/DELETE /api/folders/{id}` · `GET/POST /api/assets` · `POST …/complete`, `…/trash`, `…/restore` ·
`DELETE /api/assets/{id}`

Not yet, in their milestones: `PATCH /api/me` (S23), `GET /api/templates` (3), `POST /api/cron/purge` + GitHub
Actions (3), versions list/restore (4), copy (4), changing a design's size in `PATCH` (4).

## Decisions (where this differs from the replica-backend skill)

- **Login token instead of http-only cookies** (your choice, 2026-10-26). supabase-js keeps the token in
  localStorage, where an injected script could read it. Risk kept small: React escapes text, the app loads
  no third-party scripts. Revisit before adding any third-party script or user-written HTML.
- **Sign out everywhere** uses Supabase's `global` sign-out. Tokens already issued stay valid until they
  expire (1 hour by default), because the API checks tokens without asking Supabase each time.
- **Payments: N/A by decision.** Nothing is sold (architecture.md). No Stripe, no webhooks.
- **Email: Supabase Auth's built-in mail**, not Resend/Postmark. Only auth emails exist. It sends only a few
  per hour: **before friends sign up**, add custom SMTP (e.g. Resend's free tier, your own domain) under
  Authentication > Emails > SMTP, or turn off "Confirm email" for the demo.
- **Password reset / magic link**: Supabase Auth provides both; the S01 screen has no "forgot password"
  link yet (frontend work, `/replica-build`). `recon.md` lists only email and Google sign-in (S01), so no
  magic link.
- **Google sign-in**: milestone 4 (could). Needs your own Google Cloud OAuth client; scopes `openid email
  profile` only, which don't need Google's long verification review.
- **Roles / teams**: none (single users, recon has no teams). The authorisation rule is "row's `owner_id` =
  caller", written into every query.
- **Account deletion** (`DELETE /api/me`, body `{"confirm": "DELETE"}`): built now as you asked; the S23
  screen comes later. Order is files → rows → Supabase login, so any failed step can be retried.
  architecture.md said rows first; I flipped it, because deleting rows first would leave files with no row
  pointing at them if Storage failed.
- **Jobs**: none this round. The 30-day Trash purge and pending-upload cleanup come with milestone 3.
- **Integrations**: none in the feature matrix (stock photos, AI, apps are `skip`).
- **Image width/height** are measured by the browser and only used for layout; the server checks the
  file's real size in bytes and type against what was promised before marking it ready.
- **Lists return at most 500 rows** (no paging yet); fine at this size.
- **Design document rules** live in `backend/app/document.py`. When the editor gets a new element type
  or field, add it there first or saves are refused (422). TypeScript types are still hand-written in
  `lib/document.ts`; generating them from the API (`openapi-typescript`) is a later step.

## Backups

Checked 2026-10-27: Supabase's [pricing page](https://supabase.com/pricing) and
[backups guide](https://supabase.com/docs/guides/platform/backups) say the **Free plan has no managed daily
backups** (Pro: 7 days). One older docs page says every project gets daily backups, so check
Dashboard > Database > Backups once the project exists. Until then, take your own copy now and then with
your local PostgreSQL 18 tools (newer `pg_dump` can read older servers):
`pg_dump "<DATABASE_URL>" -Fc -f canva-YYYY-MM-DD.dump`, and keep it outside the repo.
Files in Storage are not in that dump.

## Security checklist

- [x] secrets only in env vars, `.env*` in `.gitignore` (`!.env.example` allowed), nothing secret in client
      bundles: only `VITE_*` reach the browser, and those are the public URL + publishable key
- [x] input validated on the server on every route (Pydantic models; friendly messages for sizes, names,
      files; the design document fully typed, unknown fields and NaN refused; 3 MB request cap)
- [x] authorisation checked on every read and write (`owner_id` in every query, composite foreign keys for
      folders), **tested with a second user**: `tests/test_isolation.py` hits every route with Bob's token on
      Alice's ids and gets 404, and every list comes back empty
- [x] Data API backstop: RLS on with no policies on every table (tested), anon/authenticated rights revoked
- [~] rate limits: upload start, thumbnail and account delete limited in the API. Sign-up, login and auth
      emails are limited by Supabase Auth itself (Authentication > Rate Limits). In-memory, so per process
- [n/a] webhooks verify signatures: no webhooks
- [x] uploads: PNG/JPEG/WebP only (no SVG), 25 MB, 8000 px, 200 MB per user (locked so two uploads can't
      both slip under it), private bucket, served from Supabase's domain through 1-hour signed links;
      the file that arrives is checked against what was promised
- [x] no user data in URLs or logs: URLs carry only ids; validation errors no longer echo the input
      (FastAPI's default did, and crashed on NaN; test added); search text goes in `?q=`, see note below
- [x] dependencies audited 2026-10-27: `pip-audit` no known vulnerabilities; `npm audit` 0, including
      `@supabase/supabase-js` 2.118
- [ ] privacy policy lists every processor: **Supabase** (database, logins, files), **Render** (hosting),
      **GitHub** (code, and the purge job later). Add the SMTP provider if you add one. No analytics.
      Written with `/replica-launch`.

Note on search: `?q=` puts the search words in the request URL, which hosts may log. It is the user's own
search of their own titles; acceptable here, or move it to a POST body later.

## Your steps (Claude never creates accounts or handles keys)

1. Create a Supabase project (free). Pick a strong database password and keep it in a password manager.
2. Project Settings > JWT Keys: switch to the new **asymmetric signing keys** (the API checks tokens with
   the public keys and does not use the legacy shared secret).
3. Project Settings > Data API: untick `public` under **Exposed schemas**.
4. Storage: create a **private** bucket named `user-files`, file size limit 25 MB, allowed types
   `image/png, image/jpeg, image/webp`.
5. Authentication > Providers > Email: set minimum password length to **8** (matches the app). Under
   URL Configuration add `http://localhost:5173` (and later your real domain) as Site URL / redirect URL.
6. Copy `.env.example` to `.env.local` and fill in the values from the dashboard.
7. Run the migration (see "How to run"), sign up in the app, open the confirmation email, log in.

## Next

`/replica-test`, then live checks against your Supabase project (sign up, upload a photo, export PNG with it
to prove the canvas isn't "tainted").
