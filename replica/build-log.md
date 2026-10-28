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

## Milestone 2d: top bar and snapping (2026-10-28)

| part | state | notes |
| --- | --- | --- |
| title | done | click it to rename; Enter or clicking away saves, Escape cancels; an empty title keeps the old one; a failed save puts the old title back with a message |
| File menu | done | Rename; Make a copy (opens the copy, made from what's on screen); Move to Trash (saves the last edits first, goes Home, Undo restores and reopens) |
| equal spacing | done | while moving: snaps to the centre between two neighbours, or repeats the gap next to it; the gaps are marked with pink lines and their size in px; edge / centre alignment wins when both apply; Alt turns it off |
| snapping while resizing | done | the dragged handle snaps to the page's and other elements' edges and centres, with a guide; not for rotated elements; Alt turns it off |
| not in 2d | | Resize design (S22, milestone 4); dragging an upload onto the page (click to place works) |

Found and fixed during testing:
- **File → Rename lost the cursor at once.** The closing menu gave focus back to the File button, which
  closed the title field again. The 2c trick (opening a moment later) wasn't enough here. Fixed the way the
  menu library intends: the shared `Menu` now has an `onCloseAutoFocus` option, and Rename uses it to send
  focus to the title field instead. Re-tested with real clicks.

Checked in the browser on fake data (a 1920 × 1080 slide, three 324 px squares):
- repeat-the-gap: C dropped near x 1401 snapped to 1398 (gaps 276 and 276)
- centred: B dropped near 752 snapped to 748 (gaps 326 and 326)
- during a scripted slow drag: two "326" labels and the guide lines on screen; gone after release
- resize: C's right handle released 4 px short of the page edge snapped to exactly 1920
- title click: field focused with the text selected; "Quarterly plan" shown and saved
- File → Rename then Escape: title unchanged
- Make a copy: "Quarterly plan (copy)" opened with the same size and content; the original untouched
- a heading added and the design moved to Trash at once: the heading was saved (3 → 4 elements), Home
  showed the Undo message, and Undo restored and reopened the design
- no console errors; `npm run build` passes

Feature matrix: 2 rows to `yes`. Parity 69.1 → 71.5; must-haves 26 → 28 of 30. The two left ("Place uploaded
image on page", "Download as PNG") only need the live check with Supabase Storage.

## Milestone 2c: downloads and Projects (2026-10-28)

| part | state | notes |
| --- | --- | --- |
| S20 Download panel | done | PNG or JPG of any page (JPG quality 10–100 %), PDF of all or chosen pages; "Preparing…" while making it; an error message if it fails; Download disabled with 0 pages chosen. Files are named after the design ("… - page 2.png" when there are several pages) |
| PDF | done | each page a JPEG picture at the design's size (96 px = 1 inch = 72 pt), the design's title in the PDF. `pdf-lib` (MIT, 1 new package) is loaded only when a PDF is made. Real, selectable text in PDFs stays a milestone 4 item |
| S05 Projects | done | every design, sort by last edited or title, rename, Move to Trash with Undo; loading, empty and error states. Home got Rename too (same shared actions) |
| not in 2c | | Projects tabs (Folders, Uploads), multi-select, list view (milestone 3); export scale and transparent PNG (milestones 3–4); renaming in the editor's top bar |

Found and fixed during testing:
- **The Rename dialog's title field didn't get focus**, so typing went nowhere and Enter just closed the
  dialog. Two causes: a dialog opened from a menu loses focus to the closing menu's button, and the dialog's
  default focus is its first button (the ✕). Fixed by opening the dialog a moment after the menu has closed,
  plus a new `initialFocus` option on the shared `Dialog`. After closing, focus now returns to the card's
  "…" button. Re-tested with mouse and with keyboard only.

Checked in the browser on fake data:
- PNG of page 1 chosen from the panel: 1080 × 1080, white, `Untitled design - page 1.png`
- JPG of page 2: yellow, 1080 × 1080; 30 % and 90 % files differ; 100 % = 14,450 bytes vs 7,715 at 90 %
- PDF of all pages: opened with `pdf-lib`, 2 pages of 810 × 810 pt, titled after the design
- PDF of page 2 only: 1 page; 0 pages chosen shows "Download 0 pages", disabled
- Projects: 2 designs; rename ("Give it a name." for an empty title; renamed to "Zebra flyer"); sorted by title
- Move to Trash and Undo; restoring from the editor's Trash banner
- 390 px wide: no sideways scrolling on Projects or Home; no console errors
- `npm run build` passes; `npm audit` 0 vulnerabilities

Feature matrix: 4 rows to `yes`, 1 note. Parity 59.8 → 69.1; must-haves 22 → 26 of 30.

## Milestone 2b-2: shapes, lines, pages, groups (2026-10-28)

| part | state | notes |
| --- | --- | --- |
| server first | done | `document.py`: `triangle` shapes, `line` and `group` elements (groups hold groups, 8 deep), elements inside groups count towards the 5,000 limit, images inside groups get links. 5 new tests, written first: 3 failed before the change |
| shapes and lines (S09) | done | Elements panel: rectangle, ellipse, triangle, line, arrow. Line toolbar: colour, thickness (keeps its middle), solid / dashed / dotted, arrow at either end; its side handles change the length only |
| pages | done | each page on its own canvas, stacked, with "Page N" and add / duplicate / delete above it; one page is active (outlined) and all editing goes there; clicking another page's element moves there; the last page can't be deleted; duplicates get new ids; undo covers page changes |
| group / ungroup | done | Ctrl+G / Ctrl+Shift+G and toolbar buttons; a group resizes evenly and everything inside scales with it; ungrouping puts each element exactly where it was shown |
| not in 2b-2 | | editing a text box inside a group (ungroup first); the pages grid and reordering pages (S18, milestone 3); showing only the pages near the screen (every page has its own canvas, so designs with dozens of pages will be slow) |

Why one canvas per page: browsers can't draw a single canvas tens of thousands of pixels tall, and it also
makes the page labels and buttons ordinary, accessible HTML.

Checked in the browser on fake data:
- ellipse, triangle, arrow added
- line thickness 5 → 10 with its middle kept (y 538 → 536); dashed; arrows at both ends
- line lengthened 432 → 533 with the side handle; thickness and left end unchanged
- triangle moved 200 px with Shift+arrows from the keyboard element list
- triangle + ellipse grouped (box 524 × 324, children relative, layer kept)
- group corner-resized ×1.0958, children's sizes and positions scaled
- group rotated to exactly 90°
- ungrouped: both shapes landed exactly where calculated (to 2 decimals), rotation 90°
- added page 2, rectangle on page 2, duplicated it (all ids unique)
- clicking page 1's arrow switched to page 1
- PNG of page 1 still 1080 × 1080 with the arrow in it
- deleted page 2, undo brought it back
- down to 1 page: the delete button disabled ("A design needs at least one page")
- the exact JSON the editor saved validated against the server's rules
- reload: everything there; no console errors
- `npm run build` passes; 67 backend tests pass

Fixed during testing: the Elements buttons said "Add a ellipse" / "Add a arrow".

Feature matrix: 3 rows to `yes`. Parity 53.9 → 59.8; must-haves 19 → 22 of 30.

## Milestone 2b-1: text and colour (2026-10-27)

| part | state | notes |
| --- | --- | --- |
| type on the page (S08) | done | double-click or Enter; a text area exactly over the text (font, size, spacing, rotation, zoom); Escape / Ctrl+Enter / click away finishes; one undo step; an emptied box is removed |
| text toolbar (S15) | done | font menu (each font shown in itself), size, colour, B/I/U (+ Ctrl+B/I/U), alignment, Spacing popover (letter spacing, line height) |
| fonts | done | 8 new open-licence fonts + Inter, installed as `@fontsource` packages and served by the app; the editor waits for the design's fonts before drawing |
| colour picker (S14) | done | colours in this design, 12 defaults, "none" for outlines, the system picker (one undo step per drag), hex field with an error message |
| shapes | done | fill, outline colour, outline width; a new outline starts at 4 px |
| page background | done | the toolbar shows the Page controls when nothing is selected |
| not in 2b-1 | | live re-wrapping while dragging a text side handle (still stretches until release); copy/paste; the colour picker's own saturation square (the system picker instead) |

Every change that alters a text box's height (typing, font, size, bold, spacing, line height) re-measures
it with the real font and keeps its top-left corner in place (same helper as the 2a fix).

Checked in the browser on fake data:
- page background to yellow
- double-click and type: saved, 2 lines, top kept, focus back on the canvas
- font to Lora: saved; Lora loaded from the app's own files; 0 requests outside the app
- size 120: 3 lines, height 468
- Ctrl+B turns bold off
- red swatch, then hex `#2b8a3e`, then `zz12` refused with a message
- left alignment
- letter spacing +6 px and line height 1.5: height 540, top kept
- blue fill
- outline added at 4 px, then removed
- three live system-picker colours undone in one step
- Enter edits from the keyboard; emptying removes the box; Ctrl+Z restores it with every style
- reload: the Lora heading reopens with its font ready
- no console errors; `npm run build` passes; `npm audit` 0 vulnerabilities

Feature matrix: 5 rows to `yes`, 1 note. Parity 43.0 → 53.9; must-haves 15 → 19 of 30.

## Milestone 2a: canvas editing (2026-10-27)

| part | state | notes |
| --- | --- | --- |
| select: click, Shift-click, drag a box; a plain click picks one | done | |
| move several at once, snapping to page edges and centre and to other elements | done | Alt turns snapping off |
| resize and rotate handles | done | text: the corners scale the font, the sides re-wrap; images keep proportions; rotation snaps to 45° |
| duplicate, delete, layer order, align | done | selection toolbar (Position menu) and shortcuts |
| opacity | done | slider; one undo step per drag |
| undo / redo | done | 100 steps, browser only (cleared on reload, as planned) |
| zoom | done | bottom bar, Ctrl+= / − / 0, Ctrl+scroll; scrollbars when zoomed in; PNG stays at real size |
| keyboard | done | the element list (Tab into it, Enter selects), then arrows nudge 1 px (Shift: 10 px), Delete, Escape |
| group / ungroup | **moved to 2b** | needs a new element type in the document model (server first, `bugs.md` T3) |
| not in 2a | | snapping while resizing, equal-spacing guides, hover outline, context menu, copy/paste, the zoom slider (+/− buttons and a menu instead) |

Harder than expected:
- **Konva's own dragging would fight a multi-selection.** Its handles already move the other selected
  items themselves (by starting a drag on each), which would have clashed with snapping and moved them
  twice. Caught while reading the code, before testing. Moving is done by hand instead (mouse-move,
  snapping, one commit on release).
- **Re-wrapping text made it jump.** A narrower text box gets taller; keeping the box's centre fixed moved
  the text up. Found in the browser test, fixed by keeping the (rotated) top-left corner fixed, and
  re-tested.
- **While a text side handle is dragged, the text is drawn stretched.** It re-wraps when the mouse is
  released. Live re-wrapping during the drag is left for later.
- **No screenshots this time.** The test browser window was behind other windows, and Chrome then neither
  draws it nor lets it be captured. Every step was checked through the saved design data instead
  (positions, sizes, rotation, font size, order, opacity) using real mouse drags and keys.

Checked in the browser on fake data (a second dev server, `npx vite --mode fake --port 5174`, using
`.env.fake.local`, so your Supabase project was untouched):
- move +196 / +118 px
- resize +98 px
- rotate to exactly 90°
- text corner: font 86 → 96.32
- text side: width −294, two lines, top kept
- snap the centre onto exactly 540
- undo / redo
- duplicate (+20 px), delete, undo a delete
- keyboard select and nudge (+3, +10)
- send to back
- align left (x = 0)
- opacity 0.8
- zoom 51 → 67 → 75 % and back to fit
- PNG still 1080 × 1080 while zoomed
- no console errors
- `npm run build` passes

Feature matrix: 8 rows moved to `yes`, 2 to `partial`, 1 note updated. Parity 24.6 → 43.0; must-haves 7 → 15 of 30.

## Name and scope (2026-10-27)

- **Renamed to Pitch:** the browser tab, sidebar, login screen, API title, README and `HOW-TO-RUN.md`.
  Folder, repo and internal package names stay `canva-clone`.
- **Learning project, never deployed:** `/replica-launch` and `/replica-deploy` are skipped. Nothing
  about hosting, custom email, a privacy policy or billing will be built.

## Forgot password (2026-10-28, branch `build/forgot-password`)

Asked for by you when the live photo check needed a password nobody can look up (Supabase keeps only a
one-way hash).

- **Login → "Forgot password?"** (login mode only) opens an email-only form. Sending always shows the same
  words, whether or not the account exists, so the form can't be used to find out who has an account.
- **The email link** (Supabase's `resetPasswordForEmail`, back to `/reset-password`) logs you in and shows
  "Choose a new password" (8+ characters, Supabase's `updateUser`). Saving goes to Home with a "Password
  changed" toast. Without a login (link expired, already used, typed by hand) the page says so and offers a
  new link.
- **If Supabase sends the link to the Site URL** instead (`/reset-password` not on its redirect list),
  `routeResetLink()` in `lib/supabase.ts` moves a `#…type=recovery` link to `/reset-password` before the
  router and the Supabase client start. Adding `http://localhost:5173/**` under Authentication → URL
  Configuration → Redirect URLs avoids the detour.
- **Fake data:** no email is sent (the form says so); `/reset-password` changes the logged-in test user's
  password.
- New Supabase error words: `same_password`, `weak_password`.

Checked in the browser on fake data (port 5174): new-password form for the logged-in test user; a 6-character
password refused with the message; a new one saved, then Home; logged out, `/reset-password` shows "This link
doesn't work any more"; "Send a new link" opens the forgot form; sending shows the test-build note; "Log in"
keeps the email; the new password logs in; a fresh load of `/#type=recovery…` lands on `/reset-password`.
`npm run build` passes. **Checked live** by you on 2026-10-28: the real Supabase email, the link, a new
password saved, logged in.

**Show password** (branch `build/show-password`): both password boxes (log in / sign up, new password)
have an eye button inside the box that shows or hides what's typed. It's a real button: Tab reaches it,
screen readers hear "Show password" with on/off (`aria-pressed`). `TextField` gained a `trailing` slot for it;
the new `PasswordField` lives in `components/ui/inputs.tsx`. Checked on fake data: dots → text → dots.

## Notes for later

- The main JS file is 1,123 kB (336 kB gzipped) after 2c: Konva, supabase-js, Radix and the editor.
  (Correction: the "484 kB" noted here before was measured before the editor existed.) Load the editor with
  `lazy()` so Home and Login stay small. `pdf-lib` is already a separate 420 kB file loaded only for PDFs.
- Typed API: TypeScript types are still hand-written in `lib/document.ts`; generating them from the
  API (`openapi-typescript`, one dev package) is planned for M2, when groups make the type recursive.
