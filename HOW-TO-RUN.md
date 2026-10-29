# How to run Pitch (and what's next)

Last updated 2026-10-27, end of milestone 1. Everything is on `main`.

**Pitch is a learning project.** It runs only on this computer and is not deployed. The only online
part is your Supabase project (logins, database, image files).

## What you need on the computer

Already installed on this laptop: **git**, **Node 24** (`node --version`), **uv** (`uv --version`).
uv installs the right Python (3.12) by itself.

## 1. Get the code

Already on this laptop: `C:\Users\HARSHIT\alacrity\canva-clone`. On another computer:

```
git clone https://github.com/sevensixteeeen/canva-clone.git
cd canva-clone
```

## 2. Run the app without Supabase (fake data)

On this laptop `.env.local` is filled in, so `npm run dev` uses your Supabase project instead: start
the API too (section 4). Without those settings, the app uses fake data. Everything is stored **in your browser only** (IndexedDB), so nothing
reaches the internet and a different browser starts empty.

```
cd frontend
npm install        # only the first time, or after package.json changes
npm run dev
```

Open http://localhost:5173, sign up with any email and a password of 8+ characters (it's only stored
in this browser), and try the loop: **Create a design → add text / a rectangle → Uploads → place an
image → drag things → Download PNG**. Stop the server with **Ctrl+C**.

The app uses fake data whenever `.env.local` has no `VITE_SUPABASE_*` values. The login screen says
"Test build: accounts are stored only in this browser" when that's the case.

## 3. Run the backend tests

```
cd backend
uv sync           # only the first time: creates .venv with Python 3.12 and the packages
uv run pytest     # 90 tests, about 20 seconds; uses a throwaway Postgres in backend/.test-postgres
```

They never touch Supabase or your own PostgreSQL service.

### End-to-end tests (the app in a real browser)

```
cd frontend
npx playwright install chromium   # only the first time: the test browser (~150 MB)
npm run e2e                       # 63 tests, about 5 minutes
```

Playwright starts its own copies of the app: on port 5180 with fake data (almost every test), and on port 5181 with
the real data layer pointed at a made-up Supabase address, whose answers the tests act out (`e2e/real-mode/`). Neither
ever touches your Supabase (a test fails if anything tries). Each test also fails on console errors and on accessibility problems found by axe.
If one fails, `npx playwright show-report e2e-report` shows what happened, step by step.

## 4. Run it for real (with your Supabase project, as on this laptop)

Two terminals, both from the repo folder:

```
# terminal 1: create/update the tables, then start the API on http://127.0.0.1:8000
cd backend
uv run --env-file ../.env.local python -m app.migrate
uv run --env-file ../.env.local uvicorn app.main:app --reload

# terminal 2: the editor; /api calls are forwarded to the API
cd frontend
npm run dev
```

API docs while it runs: http://127.0.0.1:8000/docs

Each time the API starts, it also empties old Trash in the background: designs and uploads that have been
in Trash for over 30 days are deleted for good, with their files. The terminal shows a line like
`Trash clean-up: deleted for good 0 design(s) ...`. To run it by hand: `uv run --env-file ../.env.local python -m app.purge`.
To turn it off, add `PURGE_ON_START=0` to `.env.local`.

## If something goes wrong

| you see | do this |
| --- | --- |
| `npm error network ... ECONNRESET` | the network dropped mid-download; run it again, or add `--maxsockets=1 --fetch-retries=5` |
| `Port 5173 is in use` | another `npm run dev` is still running; close that terminal or press Ctrl+C in it |
| `Missing environment variables: DATABASE_URL ...` | `.env.local` is missing or incomplete: copy `.env.example` to `.env.local` and fill it in |
| editor says "Open this on a larger screen" | the window is narrower than 1024 px; make it wider |
| `git commit -m` with quotes breaks in PowerShell | write the message to a file and use `git commit -F message.txt` |

## Where things are

| | |
| --- | --- |
| `frontend/` | the React app (screens in `src/pages`, the editor in `src/editor`) |
| `backend/` | the FastAPI API (`app/`), its tests (`tests/`) |
| `supabase/migrations/` | the database tables |
| `replica/` | the plan and the reports: `architecture.md`, `backend.md` (Supabase steps), `build-log.md`, `bugs.md`, `test-plan.md`, `parity.md` |

---

# What's next

Done: milestone 1 is built, Supabase is set up, the live run passed (sign up, create, autosave,
upload), and everything is merged into `main`.

Pitch won't be deployed, so `/replica-launch` and `/replica-deploy` are skipped. Custom email isn't
needed either: Supabase's built-in email is fine for one person.

1. **One last live check:** in the editor, Uploads → click your photo to place it → **Download PNG**.
   The photo should be in the PNG (`replica/bugs.md` T5).
2. **`/replica-build` milestone 2:** resize and rotate, multi-select, delete, undo/redo, zoom, editing
   text on the page, fonts, pages, JPG and PDF download, the Projects screen. It's big, so Claude
   plans it first and waits for your OK.
3. **`/replica-test`:** browser tests with Playwright and accessibility checks. Needs your OK to install
   `@playwright/test` and `@axe-core/playwright`.
