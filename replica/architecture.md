# Architecture: Pitch, a rebuild of Canva's core editor loop

Learning / portfolio project. Built from `recon.md` and `features.csv` (public sources only).
Date: 2026-10-26. Status: approved and built through milestone 1 (see `build-log.md`).

> **Decisions 2026-10-27:**
> - The app is named **Pitch**.
> - It is a learning project and will **not be deployed**. It runs locally, with only Supabase online.
>
> So the "hosting: Render" row and everything about serving it publicly (cold starts, custom SMTP
> before friends sign up, a privacy policy, `/replica-launch`, `/replica-deploy`) no longer apply.
> FastAPI can still serve the built frontend locally.

## The big picture (in plain words)

```
 Browser                                     Server (one app on Render)          Supabase (one account)
 ┌──────────────────────────────┐            ┌─────────────────────────┐        ┌──────────────────────┐
 │ React editor (TypeScript)    │  /api/...  │ FastAPI (Python)        │  SQL   │ Postgres database    │
 │  - Konva draws the canvas    │──────────▶ │  - checks the login     │──────▶ │  (6 tables)          │
 │  - undo/redo, autosave       │  + token   │  - checks who owns what │        ├──────────────────────┤
 │  - PNG / JPG / PDF export    │            │  - validates designs    │──────▶ │ Storage (image files)│
 │ supabase-js: sign up / login │──────────────────────────────────────────▶   │ Auth (logins)        │
 │ uploads go straight to       │──── signed upload URL (made by FastAPI) ───▶ │                      │
 │ Storage                      │            │ also serves the built   │        └──────────────────────┘
 └──────────────────────────────┘            │ React files (one site)  │
                                             └─────────────────────────┘
```

- **Login token (JWT):** when you log in, Supabase gives the browser a signed token, like a stamped ticket. The browser sends it with every `/api` request. FastAPI checks the stamp with Supabase's public key and reads your user id from it. Nobody can fake the stamp without Supabase's private key.
- **Signed URL:** a link to one private file that works for a short time (for example 1 hour) and then expires. FastAPI makes them; the browser uses them.
- **Row level security (RLS):** a Postgres feature that hides rows from users who don't own them. Here it is only a **backstop** (see Schema).

## Stack

| layer | choice | why |
| --- | --- | --- |
| editor + pages | React 19 + TypeScript, built with Vite 8 (Node 24 is already installed) | The editor has to run in the browser, so it must be JS/TS. Vite builds static files; no server-side rendering needed for a logged-in tool |
| canvas | Konva 10 + react-konva 19 (its major version follows React's) | Draws shapes, text and images; ships a Transformer (resize/rotate handles) and `toDataURL` export. Writing this from scratch would turn M into L |
| editor state | Zustand | One small store for the document, selection and undo history |
| styling | Tailwind CSS **v4** via `@tailwindcss/vite`, tokens from `/replica-design` (`design/tailwind.theme.css` is v4-only syntax) | Classes like `bg-surface text-muted` map to design tokens, never raw hex |
| API | FastAPI (Python 3.12, uv) + Pydantic | Your language. Pydantic validates every design before it is saved and produces the OpenAPI file the frontend types are generated from |
| database | Postgres on Supabase, via psycopg 3 + psycopg_pool | You already know psycopg from Montra. Plain SQL, no ORM |
| auth | Supabase Auth (email + password; Google later) | Sign-up, login, password reset and email confirm come ready-made; FastAPI only verifies the token |
| files | Supabase Storage, private bucket + signed URLs | Same account as the database |
| payments | **none** | Learning project; nothing is sold |
| email | Supabase Auth's built-in email | Only auth emails (confirm, reset). It is rate-limited to a few per hour, see "Parts that bite" |
| jobs | GitHub Actions scheduled workflow, daily 03:00 UTC → `POST /api/cron/purge` | Free, already on GitHub. Render's cron jobs are paid |
| hosting | Render free web service: FastAPI serves `/api/*` **and** the built React files | One site and one deploy, and no CORS between frontend and API. Cold start after 15 min idle |
| tests | pytest (API, against throwaway Postgres via `pgserver`), Vitest (editor logic), Playwright later via `/replica-test` | Same local-Postgres trick as Montra |

### Every dependency, and why (nothing else gets installed)

Python (`backend/pyproject.toml`):
- `fastapi`, `uvicorn[standard]`: the web server.
- `psycopg[binary]`, `psycopg_pool`: talk to Postgres; the pool reuses connections.
- `pyjwt[crypto]`: verify Supabase login tokens with the public keys (JWKS).
- `supabase`: the official client, used **only** for Storage (signed upload/download URLs, delete files) and the admin "delete user" call. Calling those REST endpoints by hand is more code to get wrong.
- dev: `pytest`, `httpx` (FastAPI's test client), `pgserver` (throwaway Postgres), `ruff`.

TypeScript (`frontend/package.json`):
- `react`, `react-dom`, `react-router-dom`: UI and the handful of pages.
- `konva`, `react-konva`: the canvas.
- `zustand`: editor state + undo history.
- `@supabase/supabase-js`: sign up / log in / upload to a signed URL.
- `pdf-lib`: build the PDF download in the browser.
- `@radix-ui/*` (only the primitives used: dialog, dropdown-menu, popover, tabs, slider, tooltip, toast): accessible behaviour (focus, keyboard, screen readers) for menus and dialogs.
- `lucide-react`: open-licence (ISC) icons. No Canva icons.
- dev: `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss` + `@tailwindcss/vite`, `openapi-typescript` (generates TS types from FastAPI), `vitest`.

## Repo layout

```
canva-clone/
  replica/                     planning docs (this file, recon, schema)
  backend/                     FastAPI app (uv project)
    app/main.py                routes mounted, serves frontend/dist in production
    app/auth.py                token check + "make sure profile exists"
    app/db.py                  connection pool
    app/document.py            Pydantic models of a design (pages, elements)
    app/routes/                designs.py, assets.py, folders.py, templates.py, me.py, cron.py
    tests/
  frontend/                    Vite + React + TS
    src/editor/                canvas, selection, text editing, history, export
    src/pages/                 home, projects, folder, trash, templates, settings
    src/api/types.ts           GENERATED from backend OpenAPI, never edited by hand
    public/fonts/              ~30 open-licence fonts, self-hosted
  supabase/migrations/0001_init.sql   = replica/schema.sql
  .github/workflows/purge.yml
```

## Schema

Tables: **6** (`profiles`, `folders`, `templates`, `designs`, `assets`, `design_versions`). Full SQL: `replica/schema.sql`, tested on a throwaway Postgres 16 (17 constraint checks passed on 2026-10-26).

**Access rule: data-layer checks.** Every SQL statement FastAPI runs includes `owner_id = <user id from the verified token>`. FastAPI connects as the table owner, so RLS does not apply to it. RLS is turned **on with no policies** and the `anon`/`authenticated` roles lose all table rights. That way Supabase's auto-generated Data API, which anyone with the public anon key can call, can read and write nothing. Also untick `public` under Settings → Data API → Exposed schemas.

Rules the database enforces itself, so a UI bug cannot break them:
- a design can only sit in a folder **with the same owner** (composite foreign key `(folder_id, owner_id)`); same for versions → designs
- every design has **1–200 pages** (so "delete the last page" is impossible)
- each side is 40–8000 px and **width × height ≤ 25,000,000 px²**
- design JSON is at most 2 MB (images are stored by reference, not inside it)
- uploads: PNG / JPEG / WebP only, ≤ 25 MB (SVG is refused: it can carry scripts)
- deleting a folder moves its designs back to the Projects root (`on delete set null (folder_id)`, Postgres 15+)
- deleting a profile deletes everything that user owns

### The design document (what lives in `designs.content`)

Defined once as Pydantic models in `backend/app/document.py`; TypeScript types are generated from them.

```
DesignContent   schema_version: 1, pages: Page[1..200]
Page            id, background: {color "#RRGGBB"} | {asset_id}, elements: Element[0..1000]
Element (base)  id, x, y, width > 0, height > 0, rotation (deg), opacity 0..1,
                locked, flip_x, flip_y, name?
  "text"        text (≤ 10,000 chars), font_family (from the curated list), font_size 1..800,
                color, bold, italic, underline, align (left|center|right|justify),
                letter_spacing, line_height 0.5..3, effect: none | shadow{...} | outline{...} | curve{...}
  "shape"       kind (rect|ellipse|triangle|star|...), fill, stroke, stroke_width, corner_radius
  "line"        points [x1,y1,x2,y2], stroke, stroke_width, dash (solid|dashed|dotted), arrow_start, arrow_end
  "image"       src {kind "asset", asset_id} | {kind "template", path}, crop {x,y,width,height}, corner_radius
  "group"       children: Element[]   (groups can hold groups)
```

Layer order = position in the `elements` array (last = on top). Total elements per design ≤ 5,000.

### Changes from the recon model, and why

| recon (`recon.md`) | here | why |
| --- | --- | --- |
| Page, Element as entities | typed JSON inside `designs.content` | the editor saves the whole document every few seconds; one row update beats rewriting hundreds of element rows, and undo/redo works on whole snapshots |
| Element `z_index`, `parent_group_id` | array order; groups hold `children` | matches how Konva draws, and nothing can end up with two elements at the same z |
| ExportJob | **no table** | exports run in the browser (Konva → PNG/JPG, pdf-lib → PDF); nothing to queue |
| Folder `parent_folder_id` | one level of folders | nested folders aren't in `features.csv`; can be added later |
| User | `profiles` (id = Supabase auth user id) | Supabase Auth owns emails and passwords; no foreign key into its `auth` schema, so the SQL also runs on a plain local Postgres for tests |
| Design `display_unit` | kept; sizes always stored in px | in/mm/cm are converted at 96 px per inch for display only |

## API

All routes are FastAPI, under `/api`, and need a valid login token unless stated. "Owner" = the row's `owner_id` is the caller. Routes that are not ours are listed so `/replica-test` knows where each flow happens.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| *(Supabase Auth, browser)* | sign up, log in, log out, reset password, confirm email | anyone | email, password | session + token | F01 |
| GET /api/me | current profile (every request also creates it if missing) | signed in | — | profile | F01 |
| PATCH /api/me | change display name | signed in | display_name | profile | — (S23) |
| DELETE /api/me | delete account: rows, storage files, then the Supabase auth user | signed in | confirm text | 204 | — (S23) |
| GET /api/designs | list: recent / in folder / in trash, sort, title search | signed in | folder_id?, in_trash?, q?, sort, cursor | designs (no content) + thumbnail URLs | F07, F08 |
| POST /api/designs | create blank (size) or from template; client may send the id | signed in | id?, title?, width_px, height_px, display_unit \| template_id | design | F02, F03 |
| GET /api/designs/{id} | open in editor | owner | — | design + content + signed URLs for its images | F07 |
| PUT /api/designs/{id}/content | autosave | owner | content, revision | new revision, updated_at; **409** if revision is stale | F02–F06, F09 |
| PATCH /api/designs/{id} | rename, move to folder, change size | owner | title?, folder_id?, width_px?, height_px? | design | F08 |
| POST /api/designs/{id}/trash | move to Trash | owner | — | design | F08 |
| POST /api/designs/{id}/restore | restore from Trash (to root if its folder is gone) | owner | — | design | F08 |
| DELETE /api/designs/{id} | delete forever (only if already in Trash) | owner | — | 204 | F08 |
| POST /api/designs/{id}/thumbnail | signed upload URL for the thumbnail PNG | owner | — | upload URL | F07 |
| POST /api/designs/{id}/copy | copy, optionally at a new size | owner | width_px?, height_px? | new design | F11 |
| GET /api/designs/{id}/versions | version list | owner | cursor | versions (no content) | F10 |
| POST /api/designs/{id}/versions/{vid}/restore | restore a version (current content is snapshotted first) | owner | revision | design | F10 |
| GET /api/folders | list folders | signed in | — | folders + design counts | F08 |
| POST /api/folders | create | signed in | name | folder | F08 |
| PATCH /api/folders/{id} | rename | owner | name | folder | F08 |
| DELETE /api/folders/{id} | delete; its designs move to root | owner | — | 204 | F08 |
| POST /api/assets | start an upload: checks type, size and the 200 MB per-user quota, creates a `pending` row | signed in | id?, original_name, mime, size_bytes | asset + signed upload URL | F04 |
| POST /api/assets/{id}/complete | confirm the file arrived in Storage, save width/height, mark `ready` | owner | width_px, height_px | asset | F04 |
| GET /api/assets | Uploads panel / trash | signed in | in_trash?, cursor | assets + signed URLs | F04 |
| POST /api/assets/{id}/trash | move to Trash | owner | — | asset | F08 |
| POST /api/assets/{id}/restore | restore | owner | — | asset | F08 |
| DELETE /api/assets/{id} | delete forever (row + file) | owner | — | 204 | F08 |
| GET /api/templates | browse templates | signed in | category?, q? | templates + thumbnail URLs | F03 |
| POST /api/cron/purge | daily cleanup (see Jobs) | GitHub Actions only (`Authorization: Bearer CRON_SECRET`) | — | counts | — |
| *(browser, no route)* | PNG / JPG / PDF download | — | — | file | F02, F06 |
| *(browser, no route)* | undo / redo, zoom, selection, align, group, layers | — | — | — | F05, F09 |

**Our routes: 27.** The service-role key never leaves the server. FastAPI signs file URLs only for assets whose `owner_id` is the caller, so an `asset_id` copied into someone else's design shows as a "missing image" placeholder.

Webhooks in: none. Webhooks out: none.

Jobs:
- **purge**: daily 03:00 UTC via GitHub Actions → `POST /api/cron/purge`. It permanently deletes designs and assets with `deleted_at` older than 30 days (rows + Storage files), `pending` uploads older than 24 h, and thumbnails of purged designs.
  **Changed 2026-10-28 (milestone 3a, your decision):** the app is never deployed, so GitHub can't reach it. The same clean-up runs in the background each time the API server starts (`PURGE_ON_START=0` turns it off) and by hand with `uv run --env-file ../.env.local python -m app.purge`. No `cron.py`, no `CRON_SECRET`, no `purge.yml`.
- **version snapshots**: no job. Inside `PUT …/content`, if the design's newest version is older than 10 minutes, the previous content is saved as a version first, and versions beyond 1,000 per design are deleted.

## The parts that bite

- **Canvas "tainting" (export breaks with images):** a browser refuses `toDataURL` on a canvas that drew an image from another site without permission. Images come from Supabase's domain, so every `<img>` loads with `crossOrigin="anonymous"`. This is proven in the vertical slice, not discovered at the end.
- **Signed URLs expire:** elements store `asset_id`, never a URL. `GET /api/designs/{id}` signs fresh URLs (1 h). An editor left open longer re-asks when an image fails to load.
- **Login token check:** verify with the project's public keys from `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` (cached). Check `aud = "authenticated"`, the issuer and the expiry. If the project still shows the legacy shared JWT secret, rotate to the new signing keys in the dashboard first.
- **Database connection:** Supabase's direct connection is IPv6 (IPv4 is a paid add-on), so a long-running server uses the **session pooler (port 5432)**, not the transaction pooler (6543, built for serverless, no prepared statements). Keep the pool small (min 1, max 5) to stay under the free plan's limits.
- **Sign-up emails:** Supabase's built-in email sends only a few auth emails per hour. Fine for you alone. Before friends sign up, either turn off "Confirm email" for the demo or add a custom SMTP (for example Resend's free tier).
- **Cold starts:** Render's free service sleeps after 15 min idle, and the first request takes up to about a minute. Supabase free projects pause after 7 days without activity. Autosave retries with backoff and shows "Reconnecting…", never "Saved", until the server answers.
- **Races / two tabs:** each save sends the `revision` it started from, and a stale one gets 409, "This design was changed in another tab. Reload?" No silent overwrite.
- **Idempotency:** the browser makes the uuid for new designs and uploads, so a retried click or save cannot create duplicates (`insert … on conflict do nothing`).
- **Client-supplied ids can collide or be guessed:** after `insert … on conflict do nothing`, read the row back with `id = … and owner_id = <caller>`. If nothing comes back, the id belongs to someone else, so return 409. Never return a row looked up by `id` alone.
- **New tables later:** Supabase gives new tables to `anon`/`authenticated` by default. Every future migration must `enable row level security` on its new tables and revoke those grants, as `0001_init.sql` does.
- **Profile before first insert:** the token-check dependency runs `insert into profiles (id) values (…) on conflict do nothing` on every request (cheap), so no route can hit a missing-profile foreign key error.
- **File sizes:** 25 MB per image (also set on the bucket), 8000 px max side (checked in the browser before upload; huge images are slow to decode), 200 MB per user so friends can't fill the free 1 GB.
- **Fonts:** the ~30 open-licence fonts are self-hosted (no requests to Google from users' browsers). Text is measured only after `document.fonts.load()` resolves, or line breaks jump.
- **Undo vs autosave:** undo history lives in the browser only (cleared on reload), with 100 steps. Autosave sends the current document; undoing after a save just causes another save.
- **Time zones:** only timestamps, stored UTC (`timestamptz`), shown in the browser's local time. Trash's 30 days are counted in UTC.
- **Search:** `ilike` on titles is fine at this size; the `pg_trgm` index is in `schema.sql` as a milestone-4 comment.
- **Realtime / offline:** none in scope. If the network drops, the unsaved document stays in memory and a "you have unsaved changes" warning blocks closing the tab.
- **GDPR-style deletion:** `DELETE /api/me` removes rows, then Storage files, then the auth user, in that order, so a failure never leaves files without an owner row.
- **Multi-tenancy:** single users only; no teams.

## Build order

Each milestone ends with something you can click.

**1. Vertical slice: the core loop, ugly, end to end**
- Screens: S01 (plain email/password form), S02 (bare list), S03 (custom size only), S08 (canvas: add text box, add rectangle, drag), S11 (upload one photo, place it), S20 (PNG download only).
- Tables: `profiles`, `designs`, `assets`. Bucket `user-files`.
- Routes: `GET /api/me`, `GET`/`POST /api/designs`, `GET /api/designs/{id}`, `PUT …/content`, `POST /api/assets`, `POST …/complete`.
- Proves: token check → FastAPI → Postgres; recursive document types Pydantic → OpenAPI → generated TS; private image → canvas → PNG without tainting; autosave with revision; FastAPI serving the built frontend.

**2. Must-haves** (30 rows in `features.csv`)
- canvas engine: multi-select, drag-select, resize/rotate, smart guides, align, layer order, group, duplicate/delete, opacity, undo/redo, zoom (S08, S13 Arrange tab)
- text: edit in place, curated fonts, size/colour/bold/italic/underline/align (S10, S14, S15)
- elements and pages: shapes, lines, fill/stroke, page background, add/duplicate/delete pages (S09, S14)
- export: JPG with quality, PDF via pdf-lib with each page as an image (S19, S20)
- projects: list, rename, delete to trash (S05; `POST …/trash`, `PATCH /api/designs/{id}`)
- autosave indicator states, S01 error states

**3. Should-haves** (15 rows)
- lock, Layers tab, X/Y/W/H inputs, crop (S17), flip, text effects (S16), spacing
- templates: `templates` table, `GET /api/templates`, S04, S12; write 10–20 of our own
- pages grid view (S18)
- folders: `folders` table, folder routes, S06
- trash: S07, restore, delete forever, `POST /api/cron/purge` + GitHub Actions
- keyboard shortcuts, context menu, export scale, S24 not found

**4. Could-haves** (8 rows)
- Google sign-in, transparent PNG, version history (`design_versions`, S21), copy and resize (S22), curved text, image corner radius/border, title search (pg_trgm), account settings (S23, `PATCH`/`DELETE /api/me`)
- PDF with real, selectable text (pdf-lib + embedded font files) replaces the image-per-page PDF here

**5. Fixes from `/replica-entrepreneur`:** once it has run.
