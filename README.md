# Pitch (learning project)

A web design editor in the style of Canva, rebuilt from scratch to learn how such an app works:
start a design at any size, put text, shapes and your own photos on a canvas, and download it as an
image. Built step by step with the replica-skill pack (recon → architecture → design → backend →
build → test → diff).

> **A learning project, not a product.** It runs on my own computer only and is not deployed or
> published. It is not affiliated with Canva, or with the presentation app also called Pitch. It was
> planned from public sources only (help pages, store listings, public reviews) and contains none of
> Canva's code, logos, icons, fonts, templates or copy.

## Status: milestone 2, part 2 of 4 done (2026-10-27)

Milestone 1 (the core loop, live on Supabase) and milestone 2's first two parts (2a canvas editing,
2b-1 text and colour) are done. Without Supabase settings the app falls back to fake data stored in the
browser.

**Works now**

| area | what you can do |
| --- | --- |
| account and home | sign up / log in; Home with your designs and search |
| create | a design from a preset or a custom size (px, in, mm, cm) |
| add | headings, subheadings, body text, a rectangle, your uploaded images |
| select and arrange | click, Shift-click, drag a box; move several at once with snapping guides; resize and rotate handles; layer order; align; duplicate; delete; opacity |
| text | type on the page; 9 open-licence fonts served by the app; size, colour, bold / italic / underline, alignment, letter spacing, line height |
| colour | colour picker (colours in this design, defaults, custom, hex) for text, shape fill and outline, and the page background |
| editing | undo / redo (100 steps), zoom (buttons, Ctrl+= / − / 0, Ctrl+scroll), keyboard shortcuts, a keyboard-only way to select and move |
| saving and export | autosave with save status and a warning when another tab saved first; download the page as a PNG at its real size |

**Coming next**

| part | what |
| --- | --- |
| 2b-2 | more shapes (ellipse, triangle, lines with arrows), several pages, group / ungroup |
| 2c | JPG and PDF download, the Projects screen |
| milestones 3–4 | templates, folders, trash, crop, layers list, version history and more (`replica/architecture.md`) |

Feature parity with the original's core loop: **53.9 / 100**, with 19 of 30 must-haves done
(`replica/features.csv`). Screen by screen progress and every browser check: `replica/build-log.md`.

## Quick start

```
cd frontend
npm install
npm run dev          # http://localhost:5173, fake data, no accounts needed
```

```
cd backend
uv sync
uv run pytest        # 62 API tests against a throwaway local Postgres
```

Everything else (running against Supabase, fixing common errors, the next steps) is in
**[HOW-TO-RUN.md](HOW-TO-RUN.md)**.

## How it's built

| part | tech |
| --- | --- |
| editor and pages | React 19 + TypeScript, Vite, Konva (canvas), Zustand (editor state and undo history), Tailwind CSS v4 with design tokens, Radix UI, Lucide icons |
| fonts | Inter, Montserrat, Poppins, Space Grotesk, Playfair Display, Lora, Oswald, Bebas Neue, Caveat: open-licence `@fontsource` packages, served by the app (no requests to Google) |
| API | FastAPI (Python 3.12, uv), Pydantic validates every saved design, psycopg 3 with plain SQL |
| database, logins, files | Supabase: Postgres, Auth, private Storage bucket with short-lived signed links |
| hosting | none, by choice: it runs locally (the API on port 8000, the editor on 5173). Only Supabase is online |

Security basics already in place: every query is limited to the signed-in user's own rows (tested with
a second user on every route), row level security on as a backstop, upload type / size / quota checks,
rate limits, no secrets in the browser. Details: `replica/backend.md`.

## Where things are

```
frontend/              React app: src/pages (screens), src/editor (canvas, toolbars, text editing, colour picker, undo, autosave), src/data (fake + real data layers)
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
