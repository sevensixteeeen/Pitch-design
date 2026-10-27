# Pitch (learning project)

A web design editor in the style of Canva, rebuilt from scratch to learn how such an app works:
start a design at any size, put text, shapes and your own photos on a canvas, and download it as an
image. Built step by step with the replica-skill pack (recon → architecture → design → backend →
build → test → diff).

> **A learning project, not a product.** It runs on my own computer only and is not deployed or
> published. It is not affiliated with Canva, or with the presentation app also called Pitch. It was
> planned from public sources only (help pages, store listings, public reviews) and contains none of
> Canva's code, logos, icons, fonts, templates or copy.

## Status: milestone 1 of 4 (2026-10-27)

The core loop works end to end, live on a Supabase project: sign up, create, autosave, upload. Without
Supabase settings it falls back to fake data stored in the browser.

| works now | coming next (milestone 2) |
| --- | --- |
| sign up / log in, Home with your designs and search | resize, rotate, multi-select, delete |
| create a design from a preset or a custom size (px, in, mm, cm) | undo / redo, zoom |
| editor: add headings, a rectangle, your uploaded images | edit text on the page, fonts and styles |
| drag to move, autosave with save status, warning when another tab saved first | more shapes and lines, pages |
| download the page as a PNG at its real size | JPG and PDF download, the Projects screen |

Feature parity with the original's core loop: **24.6 / 100** (`replica/parity.md`, `replica/features.csv`).
Screen by screen progress: `replica/build-log.md`.

## Quick start

```
cd frontend
npm install
npm run dev          # http://localhost:5173, fake data, no accounts needed
```

```
cd backend
uv sync
uv run pytest        # 61 API tests against a throwaway local Postgres
```

Everything else (running against Supabase, fixing common errors, the next steps) is in
**[HOW-TO-RUN.md](HOW-TO-RUN.md)**.

## How it's built

| part | tech |
| --- | --- |
| editor and pages | React 19 + TypeScript, Vite, Konva (canvas), Zustand (editor state), Tailwind CSS v4 with design tokens, Radix UI, Lucide icons |
| API | FastAPI (Python 3.12, uv), Pydantic validates every saved design, psycopg 3 with plain SQL |
| database, logins, files | Supabase: Postgres, Auth, private Storage bucket with short-lived signed links |
| hosting | none, by choice: it runs locally (the API on port 8000, the editor on 5173). Only Supabase is online |

Security basics already in place: every query is limited to the signed-in user's own rows (tested with
a second user on every route), row level security on as a backstop, upload type / size / quota checks,
rate limits, no secrets in the browser. Details: `replica/backend.md`.

## Where things are

```
frontend/              React app: src/pages (screens), src/editor (canvas, panels, autosave), src/data (fake + real data layers)
backend/               FastAPI app (app/) and its tests (tests/)
supabase/migrations/   the database tables, applied by `python -m app.migrate`
replica/               the plan and the reports
  recon.md             what the original does (screens, flows, feature list), from public sources
  architecture.md      stack, database schema, API routes, build order
  design/              colour and type tokens, component specs
  backend.md           backend decisions, security checklist, Supabase setup steps
  test-plan.md         every flow's test cases;  bugs.md: bugs found and fixed
  build-log.md         progress per screen;  parity.md: how close the clone is
HOW-TO-RUN.md          run it, fix common errors, what to do next
```

## Secrets

Keys live only in `.env.local` (ignored by git). `.env.example` lists every variable name without values.
Never commit real keys.
