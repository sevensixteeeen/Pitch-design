<img src="frontend/public/favicon.svg" alt="Pitch logo: a bold P with an orange spark" width="72">

# Pitch (learning project)

**Design it. Pitch it.**

A web design editor in the style of Canva, rebuilt from scratch to learn how such an app works: start a
design from a template or at any size, put text, shapes, lines and your own photos on its pages, arrange
them, and download the result as PNG, JPG or PDF. Built step by step with the replica-skill pack
(recon → architecture → design → backend → build → test → diff).

> **A learning project, not a product.** It runs on my own computer only and will not be deployed or
> published. It is not affiliated with Canva, or with the presentation app also called Pitch. It was
> planned from public sources only (help pages, store listings, public reviews) and contains none of
> Canva's code, logos, icons, fonts, templates or copy. The 12 templates are written for this project.

## Status: milestones 1–3 done (2026-10-29)

- **30 of 30 must-have** and **all 14 should-have** features are built (`replica/features.csv`).
- Feature parity with the original's core editor: **94.9 / 100** (`replica-diff`).
- Checked by **92 API tests** and **76 end-to-end tests** in a real browser (Playwright, with an axe
  accessibility scan of every screen). Every bug found is written up in `replica/bugs.md` (10 so far, all fixed).
- Tried live on Supabase: sign up, password reset by email, create, autosave, upload a photo, place it and
  download the PNG.
- Not built: the optional "could" features, such as version history, copy and resize, transparent PNG,
  Google sign-in, curved text and a delete-account screen.

## What it does

| area | what you can do |
| --- | --- |
| account | sign up, log in, log out; "Forgot password?" with an email link; change your password in Settings; show / hide the password |
| home and projects | your designs with previews and search; folders (make, rename, delete, "Move to folder…"); Trash with Restore and Delete forever (deleted for good after 30 days) |
| start a design | from a size preset, a custom size (px, in, mm, cm) or one of 12 templates (posts, stories, slides, posters, A4) |
| add | headings and text, rectangles, ellipses, triangles, lines and arrows, your own photos, templates onto a page |
| select and arrange | click, Shift-click, drag a box; move, resize and rotate with snapping guides and equal spacing; align; layer order; group / ungroup; lock; flip; exact X / Y / width / height / rotation; a Layers list you can drag to reorder |
| text | type on the page; 9 open-licence fonts; size, colour, bold / italic / underline, alignment, spacing; shadow and outline |
| photos | upload (PNG, JPG, WebP), place, crop |
| pages | several pages; add, duplicate, delete; a grid view to see and reorder them |
| editing | undo / redo, copy / cut / paste (also between designs), a right-click menu, zoom, keyboard shortcuts, a keyboard-only way to select and move |
| saving and downloads | autosave with its status (and a warning when another tab saved first); PNG and JPG at 1×, 2× or 3×; PDF of all or chosen pages |

## Quick start

No accounts or keys needed: without Supabase settings the app uses fake data stored in your browser.

```
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Tests:

```
cd backend
uv sync
uv run pytest        # 90 API tests against a throwaway local Postgres

cd frontend
npx playwright install chromium   # the first time only
npm run e2e          # 76 end-to-end tests, about 5 minutes; never touch Supabase
```

Running it against your own Supabase project, the database migrations, the Trash clean-up and fixes for
common errors are all in **[HOW-TO-RUN.md](HOW-TO-RUN.md)**.

## How it's built

| part | tech |
| --- | --- |
| editor and pages | React 19 + TypeScript, Vite, Konva (canvas), Zustand (editor state, undo history), Tailwind CSS v4 with design tokens, Radix UI, Lucide icons, pdf-lib (loaded only for PDFs) |
| fonts | Inter, Montserrat, Poppins, Space Grotesk, Playfair Display, Lora, Oswald, Bebas Neue, Caveat: open-licence `@fontsource` packages served by the app (no requests to Google) |
| API | FastAPI (Python 3.12, uv); Pydantic checks every saved design; psycopg 3 with plain SQL |
| database, logins, files | Supabase: Postgres, Auth, a private Storage bucket with short-lived signed links |
| tests | pytest with a throwaway local Postgres (pgserver); Playwright + axe-core in Chromium on fake data |
| identity | its own, "Glow": a dark app in Midnight Black, Electric Blue and Cantaloupe Orange, a blue-to-orange glow, glass cards, serif page titles (Playfair Display), a P-and-spark logo (`replica/brand.md`) |
| hosting | none, on purpose: it runs locally (the API on port 8000, the editor on 5173). Only Supabase is online |

A few choices worth knowing, with the reasons in `replica/architecture.md` and `replica/build-log.md`:

- **One data layer, two versions.** Every screen calls `frontend/src/data/api.ts`; `fake.ts` keeps data in
  the browser, `http.ts` talks to the API and Supabase. That's why the app and its end-to-end tests run
  without any account.
- **The server checks every design.** The editor saves the whole document as JSON; `backend/app/document.py`
  refuses anything it doesn't know, so a new field always goes into the server first.
- **Templates are files in the app** (`frontend/src/templates`), and a backend test checks each one against the
  save rules.
- **Old Trash is cleaned up when the API starts**, not by a cloud timer, because the app only runs locally
  (turn it off with `PURGE_ON_START=0`).

Security basics: every query is limited to the signed-in user's own rows (tested with a second user on every
route), row level security is on as a backstop, uploads are checked for type, size and quota, requests are
rate-limited, and no secret key reaches the browser. Details: `replica/backend.md`.

## Where things are

```
frontend/              the React app
  src/pages/           screens: login, home, projects, folder, trash, templates
  src/editor/          the editor: canvas, toolbars, panels (position, layers, effects, templates), crop,
                       undo, autosave, copy and paste, page grid, downloads
  src/components/      shared pieces: buttons, inputs, dialogs, design and folder cards
  src/data/            the fake and the real data layers
  src/templates/       the 12 templates and make_templates.py, which writes them
  e2e/                 end-to-end tests (Playwright)
backend/               FastAPI app (app/) and its tests (tests/)
supabase/migrations/   the database tables, applied with `python -m app.migrate`
replica/               the plan and the reports
  recon.md             what the original does (screens, flows, features), from public sources
  architecture.md      stack, database, API routes, build order, and the decisions changed on the way
  design/              colour and type tokens, component specs
  backend.md           backend decisions, security checklist, Supabase setup steps
  features.csv         every feature and whether it's built;  parity.md: how close the clone is
  test-plan.md         every flow's test cases;  bugs.md: bugs found and fixed
  build-log.md         what was built in each milestone, and what was harder than expected
HOW-TO-RUN.md          run it, test it, fix common errors
```

## Secrets

Keys live only in `.env.local`, which git ignores. `.env.example` lists every variable name without values.
Never commit real keys or paste them anywhere public.
