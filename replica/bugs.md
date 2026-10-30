# Bugs: Canva clone

Only bugs reproduced (BUG-001 to 005 on 2026-10-27; BUG-006 to 009 by the Playwright suite on 2026-10-28; BUG-010 found by you on 2026-10-29). Things that might be wrong but weren't reproduced are under
"To check" at the end. Format: replica-test `bug-report.md`. Builds: working tree 2026-10-27 (BUG-001 to 005), `main` bf3b002 (BUG-006 to 008).

| id | severity | title | status |
| --- | --- | --- | --- |
| BUG-001 | S1 | The frontend doesn't start: no `src/main.tsx`, no router, no editor | fixed in 06f9fe2 (shell) + a583f43 (editor) |
| BUG-002 | S2 | `npm run build` fails on 8 TypeScript errors in `fake.ts` and `stubs.tsx` | fixed in 06f9fe2 |
| BUG-003 | S3 | After "delete my account", the old login token still works for up to 1 hour and recreates data | fixed in c0c21a9 |
| BUG-004 | S3 | S24 "not found" page puts a link inside a button | fixed in 06f9fe2 |
| BUG-005 | S3 | After the app sits idle, the first requests fail with 500 (Supabase closed the pooled connections) | fixed in db8707b |
| BUG-006 | S3 | The editor says "Saved" for about a second after an edit, before the save has started | fixed in 27fc260 |
| BUG-007 | S4 | Editor side panel is outside every landmark (axe `region`) | fixed in 27fc260 |
| BUG-008 | S4 | The "Open this on a larger screen" note has no main landmark (axe `landmark-one-main`, `region`) | fixed in 27fc260 |
| BUG-009 | S4 | Icon buttons' tooltips repeat the name to screen readers and sit outside every landmark (axe `region`) | fixed in 5d881fb |
| BUG-010 | S3 | With the API server down, a password-reset link says "This link doesn't work any more" and other screens send you to log in | fixed in 573cabd |

### BUG-001: The frontend doesn't start

- Severity: S1 (core flow blocked: no flow can be used at all)
- Flow / case: every flow; F01-H1, F02-H1
- Screen: all
- Build: working tree 2026-10-27  Browser / device: n/a (fails before a browser is involved)

Steps
1. `cd frontend`
2. `npx vite build` (or `npm run dev` and open http://localhost:5173)

Expected: the app builds / the login screen (S01) loads.
Actual: `Error: Failed to resolve /src/main.tsx from C:/Users/HARSHIT/alacrity/canva-clone/frontend/index.html`.
`index.html` loads `/src/main.tsx`, which doesn't exist. Nothing creates the React root or the routes
(`/login`, `/`, `/create`, `/design/:id/edit`…). The editor screen (S08) isn't written yet.
(`@supabase/supabase-js`, which was also missing, was installed on 2026-10-27.)
Evidence: build output above; `Grep createRoot|<Routes|path=` in `frontend/src` finds nothing.
Suspected cause: the last `/replica-build` run stopped after the screen pieces (Login, Home, CreateDesign,
DesignCard, UI kit), before the app shell.
Status: fixed in 06f9fe2 (`main.tsx`, routes) and a583f43 (editor S08). Check: `npm run build` passes; the app runs and the core loop was clicked through on fake data (see `build-log.md`).

### BUG-002: The production build fails on TypeScript errors

- Severity: S2 (`npm run build` runs `tsc --noEmit` first, so nothing can be built for deploy; no workaround
  short of skipping the type check)
- Flow / case: all (deploy)
- Screen: n/a
- Build: working tree 2026-10-27

Steps
1. `cd frontend`
2. `npx tsc --noEmit`

Expected: no errors.
Actual: 8 errors (re-checked after installing supabase-js, which removed 2 others):
- `src/data/fake.ts` lines 167, 290, 296, 309, 348, 389, 394: TS2353 "Object literal may only specify known
  properties, and 'owner_id' / 'deleted_at' / 'folder_id' does not exist in type '{ id: string; }'".
- `src/pages/stubs.tsx` line 25: TS2322 "Property 'asLink' does not exist on type … ButtonProps".
Evidence: `npx tsc --noEmit` output, 2026-10-27.
Suspected cause: `fake.ts`'s `put(store, row: { id: string })` is too narrow for object literals (TypeScript
refuses extra fields written inline); it should take any row that has an `id`. `Button` has no `asLink`
prop (see BUG-004).
Status: fixed in 06f9fe2. `put()` is generic over rows with an `id`; `npx tsc --noEmit` reports 0 errors.

### BUG-003: After deleting the account, the old login token still works and recreates data

- Severity: S3 (deletion does run; but a still-open tab can bring back a profile and create designs that no
  one can ever log in to see or delete)
- Flow / case: X-3 (delete account)
- Screen: S23 (route only so far)
- Build: working tree 2026-10-27

Steps
1. Alice is logged in in two tabs.
2. Tab A: `DELETE /api/me` with `{"confirm": "DELETE"}` → 204.
3. Tab B, same token (valid up to 1 hour): `GET /api/me`, then `POST /api/designs`.

Expected: 401 "Please log in again." in tab B; nothing of Alice's in the database.
Actual: `GET /api/me` → 200, `POST /api/designs` → 201. Afterwards the database has 1 profile and 1 design for
Alice. Her Supabase login no longer exists, so these rows stay forever.
Evidence: a probe test run 2026-10-27 printed `me=200 create=201 profiles=1 designs=1`. The test was removed
again; it becomes the regression test with the fix.
Suspected cause: the API trusts any validly signed, unexpired token and creates the profile if it is
missing (`auth.py`). Deleting the Supabase user doesn't revoke tokens already handed out.
Suggested fix: on account deletion, record the user id in a small `deleted_accounts` table (new migration,
RLS on); `current_user` answers 401 for those ids. Waiting for your OK.
Status: fixed in c0c21a9. Migration `0002_deleted_accounts.sql`; the login check answers 401 for deleted ids. Regression test `test_BUG_003_old_token_refused_after_account_deletion` (failed before the fix, passes after). Still possible: a request landing in the very same moment as the deletion.

### BUG-004: The "not found" page (S24) puts a link inside a button

- Severity: S3 (visibly works with a mouse, but it's invalid HTML: a `<button>` containing an `<a>`.
  Keyboard users get two tab stops for one action, and screen readers announce it oddly)
- Flow / case: F02-N1 (someone else's design → S24)
- Screen: S24
- Build: working tree 2026-10-27

Steps
1. Read `frontend/src/pages/stubs.tsx` lines 24–28, or run `npx tsc --noEmit`.

Expected: one link styled as a button ("Back to Projects").
Actual: `<Button asLink><Link …/></Button>`. `Button` has no `asLink` prop (TS2322), so it renders a real
`<button>` with the link inside.
Evidence: TS2322 at `stubs.tsx(25,19)`; `Button.tsx` props (`ButtonProps extends ButtonHTMLAttributes`).
Suggested fix: render the `Link` itself with the button's classes (or give `Button` an `asChild` via Radix
`Slot`, already installed through `radix-ui`).
Status: fixed in 06f9fe2. "Back to Home" is one link with the button styling (`buttonStyles()`); it says Home because Projects is still a stub in milestone 1.

### BUG-005: After the app sits idle, the first requests fail with 500

- Severity: S3 (it recovers on its own and a reload fixes it; but the user can land on the login page while
  still logged in, or see "Couldn't load your designs")
- Flow / case: F07 Come back later; seen during the first live run on Supabase
- Screen: S01 / S02 (any request)
- Build: main 5b34f39 + live Supabase (eu-west-1 session pooler)  Browser / device: Chrome, desktop

Steps
1. Start the API against Supabase, use the app, then leave it idle for a while.
2. Come back and open the app (or make any request).

Expected: the request works.
Actual: `GET /api/me` → 500 twice in a row, then everything works again. API log:
`psycopg.OperationalError: consuming input failed: server closed the connection unexpectedly`, raised in
`auth.py` `current_user` on the first query of the request.
Evidence: uvicorn log of the 2026-10-27 live run; failing test `tests/test_db.py::test_BUG_005_closed_pool_connection_is_replaced`
(closes the pool's connections from the server side, then expects the next request to work).
Cause: Supabase's pooler closes database connections that sit idle; our pool (`app/db.py`) kept them and
handed a closed one to the next request.
Status: fixed in db8707b: the pool checks each connection before a request gets it
(`check=ConnectionPool.check_connection`) and swaps a dead one for a new one. The test failed before the fix
with the same error and passes after; all 62 tests pass. Cost: one tiny extra round trip per request.

### BUG-006: "Saved" shows while an edit is still waiting to be saved

- Severity: S3 (visibly wrong; a refresh in that second loses the edit while the screen said it was safe)
- Flow / case: F02-E10 ("Saving…" until the server answers, never "Saved" early)
- Screen: S08 editor, top bar
- Build: `main` bf3b002, 2026-10-28  Browser / device: Playwright Chromium 1248, 1440 × 900, fake data

Steps
1. Create a design.
2. Click "Add a heading".
3. Look at the save status within the next second.

Expected: "Saving…" (the edit only exists in this tab until the save lands).
Actual: "Saved" for about 1 s; the autosave waits 1 s after the last change and only then switched to "Saving…".
Evidence: `e2e/f02-core-loop.spec.ts` F02-E10 failed ("Saved" found within 500 ms of the edit). The same bug made
F02-E12, F02-E14, F05-H1, F05-E5 and F06-H1 read stale data, because their "wait for Saved" step passed at once.
Cause: `useAutosave` set "saving" only when the timed save started.
Fix: the autosave switches the status to "Saving…" as soon as an edit arrives (unless it has stopped on a
conflict, sign-out etc.). Status: fixed in 27fc260; F02-E10 and the others pass.

### BUG-007: Editor side panel is outside every landmark

- Severity: S4 (screen-reader users can't jump to the panel by landmark; everything still works)
- Flow / case: F02-H1, F04-H1 axe scans of S08
- Screen: S08 editor, side panel (Text / Elements / Uploads)
- Build: `main` bf3b002  Browser: Playwright Chromium, axe-core via `@axe-core/playwright`

Steps
1. Open any design in the editor.
2. Run an axe scan.

Expected: no violations.
Actual: `region (moderate): All page content should be contained by landmarks` on the tab rail and the open panel.
Fix: the side panel is an `<aside aria-label="Side panel">` (Radix Tabs `asChild`). Status: fixed in 27fc260.

### BUG-008: The small-screen note has no main landmark

- Severity: S4
- Flow / case: F02-E13 (phone-sized window)
- Screen: S08 editor below its minimum width
- Build: `main` bf3b002  Browser: Playwright Chromium at 390 × 844

Steps
1. Open a design.
2. Make the window 390 px wide.
3. Run an axe scan.

Expected: no violations.
Actual: `landmark-one-main` and `region`: the note is a plain `<div>`.
Fix: the note is a `<main>`. Status: fixed in 27fc260.

### BUG-009: Icon button tooltips are announced twice and sit outside the landmarks

- Severity: S4 (screen readers hear each icon button's name twice; nothing is blocked)
- Flow / case: F08-H2 axe scan, right after a dialog closed and gave focus back to a card's "…" button
- Screen: every screen with icon buttons (all "…" buttons, the editor's top and bottom bars)
- Build: branch `build/milestone-3a`, 2026-10-28  Browser: Playwright Chromium, axe-core

Steps
1. On Projects, open a design's "…" menu, choose "Move to folder…", then Cancel (focus returns to "…").
2. The tooltip "More actions for …" opens on that focus.
3. Run an axe scan.

Expected: no violations; the button is announced once.
Actual: `region (moderate)` on the tooltip (`div[data-radix-popper-content-wrapper]`). While the tooltip is
open, Radix also points the button's `aria-describedby` at it, and it repeats the `aria-label`, so the name is
read twice ("More actions for …, button, More actions for …").
Fix: `IconButton` hides the tooltip from screen readers (`aria-hidden`), drops the `aria-describedby`, and
announces its shortcut with `aria-keyshortcuts` (e.g. `Control+Z`) instead. Status: fixed in
5d881fb; the F08 axe scans pass.

### BUG-010: "This link doesn't work any more" when only the API server is down

- Severity: S3 (misleading: the reset looks broken and logged-in people are sent to log in; workaround: start the
  API server and reload)
- Flow / case: F01-H2 (forgot password), live; found by you on 2026-10-29
- Screen: S01 reset page, and every screen behind a login
- Build: `main` 2800847  Browser: your Chrome, real Supabase; reproduced in Playwright with a made-up Supabase

Steps
1. Leave the API server off (it had been stopped for low memory); run the editor with `npm run dev`.
2. Log in → "Forgot password?" → open the link from the email.

Expected: "Choose a new password", or, if Pitch's server doesn't answer, a message saying so.
Actual: "This link doesn't work any more". The link had worked (Supabase logged you in), but the next step asks
Pitch's API "who is this?", the dev server answered 502, and the app treated any failure there as "not logged
in". Logging in showed "Something went wrong on our side", and Home sent you back to log in.
Evidence: `curl http://localhost:5173/api/me` → 502 with the API off; `e2e/real-mode/server-unreachable.spec.ts`
failed on exactly that heading before the fix.
Fix: a new `UnreachableError` for failed requests and 502 / 503 / 504; the login check keeps "can't reach the
server" apart from "logged out" (`auth.tsx`), and the reset page, every screen behind a login and the login form say
"Can't reach Pitch's server" with Try again. Status: fixed in 573cabd; both new tests pass.
The tests run in a new "real-mode" Playwright project: the real data layer against a made-up Supabase address,
with every Supabase and API answer acted out by the test, so nothing leaves the browser.

### BUG-011 to BUG-018: small things you found clicking around (2026-10-30)

All found by you on 2026-10-30; fixed on branch `build/minor-fixes`. BUG-011 to 017 each have a test in
`e2e/minor-fixes.spec.ts` (the rotate-handle one was checked to fail on the old code).

- **BUG-011 (S3) New elements stack and vanish.** Every new shape or text box landed exactly in the centre, and
  new shapes were grey `#9aa3ad`, the same as an existing grey rectangle, so a new one seemed to disappear.
  Fix: a new element steps down and right (4 % of the page's shorter side) while its spot is taken and it still
  fits (`store.ts addElement`); new shapes are Electric Blue `#0297de`.
- **BUG-012 (S4) Font size box too narrow.** "60" showed as "6(" and "32" as "3": a crowded toolbar squeezed
  the 64 px box. Fix: 80 px and it never shrinks (`ContextToolbar.tsx`).
- **BUG-013 (S3) Rotate handle jumps after a flip.** On a rotated element, a flip moved the rotate handle to the
  bottom. A flip was drawn as a negative scale on the element's own node, which the Transformer reads as a half
  turn. Fix: the flip moved to an inner group (`Mirrored` in `Canvas.tsx`), so the selected node is never
  mirrored; the crop overlay mirrors the same way. Saved designs don't change.
- **BUG-014 (S4) Wrong unit in the size error.** With inches chosen, Create a design still said "40–8000 px".
  Fix: the limits are shown in the chosen unit, "0.42–83.33 in" (min rounded up, max down, so both are allowed).
- **BUG-015 (S4) Sort resets.** "Title A–Z" on Projects went back to "Last edited" after leaving the page.
  Fix: the choice is remembered in this browser (local storage; if storage is blocked, it just isn't remembered).
- **BUG-016 (S4) Menus don't match.** The editor's File menu had "Make a copy", the design cards didn't. Fix: the
  card menu has it too; the copy stays where you are (same folder) and the list shows it.
- **BUG-017 (S4) Unclear upload error.** A broken image file showed the browser's "The source image could not be
  decoded". Fix: "broken.png: this file isn't a valid image."
- **BUG-018 (S3) Slow server answers.** On localhost, API calls took 1–2.3 s and opening a design about 5 s.
  Measured from your PC: one trip to the Supabase database (Ireland) takes about 280 ms, and every read made
  about 6 (a connection test, BEGIN, the deleted-account check, the profile insert, the query, COMMIT).
  Fix: the two login checks are one statement (`auth.py`); reads (GET) run without BEGIN/COMMIT; a connection
  used in the last 30 s isn't tested again (`db.py`). Measured on the live database with read-only stand-in
  queries: one read request 1,655 ms → 546 ms. Tests: `tests/test_db.py` (BUG-005 still passes; a connection
  is never tested twice in a row; a read hands back a normal connection). What's left is distance: a Supabase
  project in Mumbai would make each trip about ten times shorter, but it means a new project and moving data.

## To check (not reproduced, can't be yet)

- **T1 Accent search on Supabase.** ✅ Checked 2026-10-27 on the live database (locale `en_US.UTF-8`):
  `'Café menu' ilike '%CAFÉ%'` and `'Ürün katalog' ilike '%ürün%'` are both true. Nothing to fix.
- **T2 "Email already used" message.** With "Confirm email" on, Supabase hides whether an email exists
  (sign-up "succeeds" without a session), so F01-N2 will likely show "Check your inbox" instead of
  "There's already an account". That is Supabase's anti-enumeration behaviour; decide if that is fine.
- **T3 Groups and future element types.** ✅ Done in 2b-2 (2026-10-28): `document.py` was updated first
  (triangles, lines, groups), with tests, and the editor's saved JSON was checked against it. The rule
  stands for any new element type.
- **T4 Real Storage calls.** ✅ Checked 2026-10-27: a live upload went through all three steps; the file is
  in the `user-files` bucket and its size matches the row (`file_info()` works on real Storage). Thumbnail and
  delete calls still only ran against the fake.
- **T5 Canvas tainting.** ✅ Checked 2026-10-28: on the live app a photo from Storage was placed on a page,
  saved (1 design with 1 placed photo, by totals), and Download → PNG produced a file with the photo in it.
  The signed Storage links allow the canvas to export. Thumbnails: the editor doesn't make them yet (0 in
  the bucket); the upload call is built and tested, the editor side isn't.
