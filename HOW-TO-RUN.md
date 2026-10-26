# How to run the Canva clone (and what to do next)

Last updated 2026-10-27, end of milestone 1. The working app is on the branch **`build/milestone-1`**
(not merged into `main` yet).

## What you need on the computer

Already installed on this laptop: **git**, **Node 24** (`node --version`), **uv** (`uv --version`).
uv installs the right Python (3.12) by itself.

## 1. Get the code

Already on this laptop: `C:\Users\HARSHIT\alacrity\canva-clone`. On another computer:

```
git clone https://github.com/sevensixteeeen/canva-clone.git
cd canva-clone
```

Then make sure you are on the milestone branch (until it's merged):

```
git switch build/milestone-1
```

## 2. Run the app on fake data (no accounts needed)

This is what was tested today. Everything is stored **in your browser only** (IndexedDB), so nothing
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
uv run pytest     # 61 tests, about 15 seconds; uses a throwaway Postgres in backend/.test-postgres
```

They never touch Supabase or your own PostgreSQL service.

## 4. Run it for real (after the Supabase setup, see "Tomorrow morning")

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

# Tomorrow morning

In this order; each step unlocks the next.

### 1. Look at the app, then decide about the branch

Run it on fake data (section 2) and click through it. If you're happy, merge the branch into `main`
(ask Claude: "merge build/milestone-1 into main and push"). If not, write down what's off.

### 2. Create your Supabase project (you do this; Claude never handles your keys)

Follow **"Your steps"** in `replica/backend.md`. In short:

1. Create a free Supabase project; keep the database password in a password manager.
2. Project Settings → JWT Keys: switch to the new **asymmetric signing keys**.
3. Project Settings → Data API: untick **`public`** under Exposed schemas.
4. Storage: create a **private** bucket named **`user-files`**, 25 MB limit, types
   `image/png, image/jpeg, image/webp`.
5. Authentication → Email: minimum password length **8**; add `http://localhost:5173` as Site URL /
   redirect URL.
6. Copy `.env.example` to `.env.local` and paste the values from the dashboard. Never paste them into
   chat, never commit `.env.local` (git already ignores it).

### 3. First live run

Run section 4 (migration + API + editor). Then check, with your own email:

- [ ] sign up → the confirmation email arrives → log in
- [ ] create a design, add text and a rectangle, reload: still there
- [ ] upload a photo, place it, **Download PNG**: the photo is in the PNG (the "tainted canvas" check)
- [ ] two tabs on one design: the second save says "Changed in another tab"

Tell Claude what happened. If uploads all fail with "didn't match", the first place to look is
`file_info()` in `backend/app/storage.py` (it has only run against a fake so far).

### 4. Then, with Claude

1. Mark the 13 `partial` rows in `replica/features.csv` as `yes` where the live check passed.
2. `/replica-test`: browser tests with Playwright and accessibility checks. It needs your OK to
   install `@playwright/test` and `@axe-core/playwright`.
3. `/replica-build` milestone 2: resize/rotate, multi-select, delete, undo/redo, zoom, editing text,
   pages, JPG/PDF download, the Projects screen.

### Not tomorrow, but before friends sign up

Supabase's built-in email sends only a few emails per hour: set up custom SMTP (e.g. Resend's free
tier) or turn off "Confirm email" for the demo. See `replica/backend.md`.
