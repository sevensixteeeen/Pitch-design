# Build log: Canva clone

One line per screen. "fake data" = checked in the browser on the in-browser fake data layer; the real
backend (Supabase + FastAPI) is built and tested through the API but not yet connected (no Supabase
project yet).

| screen | date | state | what's missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-10-27 | done | — | `main.tsx` had never been written, so nothing mounted (BUG-001). Routes for all 24 screens |
| S01 Sign up / log in | 2026-10-27 | partial | live Supabase test; "forgot password" link; Google (M4) | — |
| S02 Home | 2026-10-27 | partial | live Supabase test; thumbnails (no design thumbnails are made yet) | — |
| S03 Create / custom size | 2026-10-27 | partial | live Supabase test | — |
| S04 Templates | 2026-10-27 | stub | milestone 3 | — |
| S05 Projects | 2026-10-27 | stub | milestone 2 | — |
| S06 Folder | 2026-10-27 | stub | milestone 3 | — |
| S07 Trash | 2026-10-27 | stub | milestone 3 (Trash restore already works from inside the editor) | — |
| S08 Editor shell + canvas | 2026-10-27 | partial | resize/rotate, multi-select, delete, undo/redo, zoom, text editing, pages, File menu, rename, Share, BottomBar (M2) | autosave: saving while new edits arrive, stopping on the right errors, and one last save when leaving the editor took the most care. Text has to wait for the font before drawing. The page shadow is a CSS box behind the canvas (Konva can't use the shadow token) and must let clicks through |
| S09 Elements panel | 2026-10-27 | partial | rectangle only; ellipse, lines, search (M2) | — |
| S10 Text panel | 2026-10-27 | partial | text styles (M2) | — |
| S11 Uploads panel | 2026-10-27 | partial | drag onto the page, progress bars, drop anywhere (M2); live Storage test | — |
| S12–S18 | — | not started | milestones 2–3 | — |
| S19 Share / S20 Download | 2026-10-27 | partial | M1 is one "Download PNG" button; the panel with JPG / PDF / scale comes in M2–M3 | — |
| S21–S22 | — | not started | milestone 4 | — |
| S23 Settings | 2026-10-27 | stub | milestone 4 (delete-account route exists in the API) | — |
| S24 Not found | 2026-10-27 | done (fake data) | — | — |

## Milestone 1 definition of done

| check | result |
| --- | --- |
| every state from the recon map, plus empty, error, loading | S08: loading, failed + retry, not found, in Trash (read only + Restore), saved / saving / reconnecting / other tab / gone / logged out / refused. Uploads: loading, empty, error, per-file errors |
| works at 390 px and 1440 px | Home and Projects: no sideways scroll at 390 px. Editor: at 900 px shows "Open this on a larger screen" (spec: editor needs ≥ 1024 px). Desktop checked at 1536 × 720; the browser window could not be resized to 1440 × 900 |
| keyboard only | partial: Tab reaches Home, Download, the rail (arrow keys between tabs) and every add button; Enter adds and is announced. **Moving things on the canvas needs a mouse** until arrow-key nudging (M2) |
| no console errors | none during the whole click-through |
| no copy borrowed from the original | all labels written fresh |
| features.csv updated | 14 rows to `partial` ("fake data only; live Supabase pending") |
| screenshots saved | `replica/clone-screens/S01-login.jpg`, `S02-home.jpg`, `S08-editor.jpg`: JPEG at 1536 × 720, records only. `imgdiff.py` needs PNG at a fixed viewport: Playwright in `/replica-test` |

## What was checked in the browser (2026-10-27, fake data)

Sign up → Home with the sample design → Create 1200 × 628 → editor fits the page → add heading →
add rectangle → drag it → upload a generated 640 × 480 PNG → place it → PNG export is 1200 × 628 with
the photo's pixels in it and no selection box → reload: all elements still there → second tab saves
first, first tab shows "Changed in another tab" → edit and leave at once: the edit was saved →
unknown design id: S24 → design in Trash: read only, Restore works → `npm run build` passes →
FastAPI serves `index.html` for app pages, the JS files, 401 on `/api/me`.

Not checked yet: anything against live Supabase (logins, Storage, signed links, canvas tainting with
Storage images); "Reconnecting…" (the fake layer has no network to lose).

## First live run on Supabase (2026-10-27)

Supabase project (eu-west-1) set up by you; migrations 0001 and 0002 applied. Read-only checks: row level
security on for all 8 tables, `anon` / `authenticated` have no table rights, the Data API refuses the
publishable key ("permission denied"). You clicked through with your own email:

| step | result | evidence (totals only) |
| --- | --- | --- |
| sign up, confirmation email, log in | works | 1 account, email confirmed, profile created |
| create a design, add text and a rectangle | works | 1 design, 2 texts, 1 rectangle |
| autosave, then reload | works | 9 saves (all 200), reload shows everything |
| upload a photo | works | 1 upload ready, file in `user-files`, size matches |
| place the photo, PNG with the photo | **not done yet** | no image on any page (bugs.md T5) |
| coming back after idle | **BUG-005** found and fixed | two 500s in the API log; test added |

Features moved to `yes`: 7 (parity 16.4 → 24.6, must-haves 0 → 7 of 30).

## Name and scope (2026-10-27)

- **Renamed to Pitch:** the browser tab, sidebar, login screen, API title, README and `HOW-TO-RUN.md`.
  Folder, repo and internal package names stay `canva-clone`.
- **Learning project, never deployed:** `/replica-launch` and `/replica-deploy` are skipped. Nothing
  about hosting, custom email, a privacy policy or billing will be built.

## Notes for later

- The main JS file is 484 kB (Konva). Load the editor with `lazy()` so Home and Login stay small (M2).
- Typed API: TypeScript types are still hand-written in `lib/document.ts`; generating them from the
  API (`openapi-typescript`, one dev package) is planned for M2, when groups make the type recursive.
