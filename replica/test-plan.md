# Test plan: Canva clone

Build: `main` 27fc260 (2026-10-28); first written on the working tree of 2026-10-27  Date: 2026-10-27  Env: local, throwaway Postgres + fake Storage / login keys

**Update 2026-10-27, after `/replica-build` milestone 1:** the app starts and the core loop runs on fake
data (BUG-001/002/003/004 fixed). Many "blocked" rows below can now be run: re-run `/replica-test`.

**State of the app (when this plan was written):** the backend runs and is tested. The frontend **does not start** (BUG-001: no
`src/main.tsx`, no router, no editor yet), so every case that needs a screen is **blocked** until
`/replica-build` milestone 1. Playwright + axe specs get written then, one per flow, in `e2e/`.

**Update 2026-10-28: Playwright + axe suite added** (`frontend/e2e/`, `npm run e2e`): 34 tests over F01, F02, F04–F09,
on fake data, each failing on console errors, uncaught errors, any 5xx, any call to Supabase and axe violations.
It found BUG-006/007/008 (fixed). Results below are updated; totals at the end.

How to read `auto`:
- `api: <name>`: a pytest test in `backend/tests/` (`uv run pytest`). These run now.
- `e2e`: a Playwright spec, planned. Selectors by role and label. Every spec fails on console errors, any
  5xx and axe violations.
- `manual`: needs a real inbox, real Supabase or human eyes.

`result`: **pass** (ran, passed) · **blocked** (needs the app or live Supabase) · **not built** (feature is
in a later milestone).

## F01 New user signs up (S01 → S02)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F01-H1 | happy | open /login, "Create account", email + 8-char password, open confirm email, log in | Home (S02) in its empty state | manual + e2e | pass: e2e `f01-account` (fake data); live sign-up passed 2026-10-27 |
| F01-E1 | edge: empty input | leave email or password empty | submit button disabled | e2e | pass: e2e `f01-account` |
| F01-E2 | edge: very long input | 300-character email | clear error message, no crash | e2e | blocked |
| F01-E3 | edge: emoji and accents | `josé@exämple.com`, password with emoji | accepted or a clear message, never a crash | e2e | pass: e2e `f01-account` |
| F01-E4 | edge: double click / first requests at once | two requests right after sign-up | one profile, both succeed | api: `test_F01_E4_first_requests_at_once_create_one_profile` | pass |
| F01-E5 | edge: back button mid-flow | sign up, press Back before confirming | back on S01, can log in after confirming | manual | blocked |
| F01-E6 | edge: refresh | log in, refresh | still logged in, same page | e2e | pass: e2e `f01-account` |
| F01-E7 | edge: expired session | token past its expiry | API 401; app returns to /login, "Please log in again" | api: `test_bad_claims_refused`; UI e2e | pass (API); UI pass: e2e `f01-account` (signed-out visit goes to /login and back) |
| F01-E8 | edge: offline | submit with network off | "Can't reach the server…", no spinner forever | e2e | blocked |
| F01-E9 | edge: mobile width | 360 px wide | form fits, no sideways scroll | e2e | pass: e2e `f01-account` |
| F01-E10 | edge: keyboard only | Tab through, Enter submits, mode switch reachable | works without a mouse, focus visible | e2e | pass: e2e `f01-account` |
| F01-E11 | edge: screen reader labels | inspect form | labelled Email / Password fields, error has `role=alert`, axe clean | e2e | pass: e2e `f01-account` (axe on log in, errors, forgot password) |
| F01-N1 | negative: wrong password | log in with a wrong password | "That email and password don't match." | manual (live Supabase) | pass: e2e `f01-account` (fake data) |
| F01-N2 | negative: email already used | sign up twice with one email | "There's already an account…" (see to-check T2) | manual | pass: e2e `f01-account` (fake data; live: see T2) |
| F01-N3 | negative: weak password | 7 characters | "Use at least 8 characters…" | e2e | pass: e2e `f01-account` |
| F01-N4 | negative: forged token | token signed by another key, unsigned, other project, anonymous | 401 | api: `test_auth.py` (6 tests) | pass |
| F01-H2 | happy: forgot password | Log in → Forgot password? → email → Send link; then /reset-password: short password refused, new one saved, log in with it; logged out, the page offers a new link | each state shown; new password works | e2e `f01-account`; manual: the real email | pass (fake data); live email loop passed 2026-10-28 |
| F01-E12 | edge: show password | Tab to the eye button, Enter | password shown as text, `aria-pressed` on | e2e `f01-account` (F01-E10) | pass |
| F01-E13 | edge: Pitch's server down (BUG-010) | open a reset link, log in, open Home while the API answers 502 | "Can't reach Pitch's server" with Try again (not "link doesn't work", not back to log in); after Try again with the API up, "Choose a new password" | e2e `real-mode/server-unreachable` | pass |
| S23-H1 | happy: change password in Settings | wrong current; same password; 7 characters; then right | each refused with its message; then "Your password is changed", fields cleared; old password refused at login, new one works | e2e `settings` | pass |
| S23-E1 | edge: 390 px wide | Settings on a phone | no sideways scroll | e2e `settings` | pass |
| S23-E2 | edge: the real login code | wrong current, then right (Supabase acted out) | nothing saved for the wrong one; the new password sent once | e2e `real-mode/change-password` | pass |

## F02 Core loop: blank custom-size design → PNG (S02 → S03 → S08 → S10 → S09 → S19 → S20)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F02-H1 | happy | Create → Custom 1200×628 → heading, type → rectangle → Share → Download PNG | PNG of the page downloads; design listed on Home | api: `test_F02_H1_create_edit_reopen` (server part); e2e | pass (API); pass: e2e `f02-core-loop` (Download button in the top bar, PNG checked 1200 × 628) |
| F02-E1 | edge: size out of range | 39 px, 8001 px, 8000×8000 | inline error, button disabled; server refuses with the same text | api: `test_create_rounds_sizes_and_checks_limits`; e2e | pass (API); pass: e2e `f02-core-loop` |
| F02-E2 | edge: unit conversion | 210 × 297 mm | created at 794 × 1123 px, unit shown as mm | api: rounding in same test; e2e | pass (API); pass: e2e `f02-core-loop` |
| F02-E3 | edge: leave before autosave | edit, close tab within 1 s | "unsaved changes" warning | e2e | pass: e2e `f02-core-loop` |
| F02-E4 | edge: 0 pages selected for download | untick all pages | Download disabled | e2e | pass: e2e `f05-f09-editing` (F06-H1) |
| F02-E5 | edge: double click Create | two creates with one id at the same moment | one design | api: `test_F02_E5_double_click_create_makes_one_design` | pass |
| F02-E6 | edge: very long input, emoji, accents (title) | 255 / 256 chars, 255 emoji, `Café déjà vu — ñandú 🎨` | 255 ok, 256 refused with message, text kept exactly | api: `test_F02_E6_very_long_and_emoji_titles` | pass |
| F02-E7 | edge: very long text box | 10,000 / 10,001 characters with emoji | first saves, second refused | api: `test_F02_E7_long_and_emoji_text_in_design` | pass |
| F02-E8 | edge: search with accents and case | search `CAFÉ`, `ürün` | finds `Café menu`, `Ürün katalog` | api: `test_F02_E8_search_with_accents_and_case` | pass (local locale, see T1) |
| F02-E9 | edge: time zones and daylight saving | read timestamps | stored UTC, sent with an offset; "Edited 2 h ago" right across a DST change | api: `test_F02_E9_times_carry_a_time_zone`; UI e2e with `timezoneId` | pass (API), blocked (UI) |
| F02-E10 | edge: slow network | throttle to 3G | "Saving…" until the server answers, never "Saved" early | e2e | pass for the autosave's 1-second wait: e2e `f02-core-loop` (failed first: BUG-006, fixed); slow network not simulated |
| F02-E11 | edge: offline | network off while editing | "Reconnecting…", retries, saves when back | e2e | blocked |
| F02-E12 | edge: refresh mid-edit | refresh 5 s after an edit | the edit is there | e2e | pass: e2e `f02-core-loop` |
| F02-E13 | edge: mobile width | 390 px | editor usable or a clear "best on a bigger screen" notice | e2e | pass: e2e `f02-core-loop` (failed axe first: BUG-008, fixed) |
| F02-E14 | edge: keyboard only | add text, move it with arrow keys, open Download | all reachable by keyboard | e2e | pass: e2e `f02-core-loop` |
| F02-E15 | edge: uploaded image in the PNG | place own photo, download PNG | PNG includes the photo (canvas not "tainted") | manual (live Storage) | pass: live 2026-10-28 by hand (bugs.md T5); e2e `f04-photos` checks the photo's pixels in the PNG (fake data) |
| F02-N1 | negative: someone else's design | open Bob's design id as Alice | S24 "can't find that page"; API 404 | api: `test_isolation.py`; e2e | pass (API); pass: e2e `f02-core-loop` |
| F02-N2 | negative: design deleted in another tab | delete forever in tab A, keep editing in tab B | B shows a clear message, no silent loss | api: `test_trash_restore_delete`; e2e | pass (API), blocked (UI) |

## F03 Start from a template (S02 → S04 → S08)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F03-H1 | happy | Templates → pick one → edit → download | new design is a copy; template unchanged | api + e2e | pass: e2e `f03-templates` (copy with new ids, opens in the editor, listed on Home); templates checked by api `test_templates.py` |
| F03-E1 | edge: fonts not loaded | open a template on a cold cache | text measured after fonts load, no jumping lines | e2e | pass: text is measured after the template's fonts load (e2e `f03-templates`, previews wait for fonts too) |
| F03-E2 | edge: apply to a non-empty page (S12) | apply over existing content | asks replace or add page | e2e | pass: e2e `f03-templates` (empty page: applied at once; otherwise add as a new page or replace; undo) |
| F03-E3 | edge: filter and search | Presentations; search "poster"; search "zebra" | 2; 2; "No templates match" with Show all | e2e `f03-templates` | pass |
| F03-E4 | edge: 390 px wide | the Templates screen on a phone | 12 cards, no sideways scroll | e2e `f03-templates` | pass |

## F04 Use my own photo (S08 → S11 → S17)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F04-H1 | happy | upload a PNG, place it, crop, lower transparency | image on page, saved | api: `test_three_step_upload`; e2e | pass (API); upload + place + PNG pass: e2e `f04-photos`; crop pass: e2e `f04-crop-effects` |
| F04-E1 | edge: file too large | 26 MB | "That image is over 25 MB." | api: `test_type_and_size_limits` | pass |
| F04-E2 | edge: unsupported type | HEIC, SVG | "Use a PNG, JPG or WebP image." | api: `test_F04_E2_unsupported_type_heic`, `test_type_and_size_limits` | pass (API); UI pass: e2e `f04-photos` |
| F04-E3 | edge: upload fails halfway | file never reaches Storage, retry | "didn't arrive", retry with same id succeeds, one asset | api: `test_F04_E3_upload_fails_halfway_then_retry` | pass |
| F04-E4 | edge: very large image | 8001 px side | "over 8000 px on one side" | api: `test_image_side_limit` | pass |
| F04-E5 | edge: double click upload | same upload id started twice, completed twice | one asset, same result | api: `test_retried_start_and_complete_are_harmless` | pass |
| F04-E6 | edge: quota, two uploads at once | 175 MB used, two 25 MB uploads at the same moment | exactly one accepted | api: `test_F04_E6_quota_holds_with_two_uploads_at_once` | pass |
| F04-E7 | edge: image deleted forever | delete an upload a design uses | design opens, placeholder, still saves | api: `test_F04_E7_image_deleted_forever_shows_as_missing`; e2e | pass (API), blocked (UI) |
| F04-E8 | edge: trashed upload | trash an upload a design uses | still shows in the design | api: `test_F04_E8_trashed_upload_still_shows_in_designs` | pass |
| F04-E9 | edge: file differs from what was promised | promise 1 KB, send 25 MB | file deleted, row deleted, 422 | api: `test_file_that_does_not_match_is_thrown_away` | pass |
| F04-N1 | negative: someone else's image | put Bob's asset id in Alice's design | no link for it (placeholder) | api: `test_open_design_signs_only_own_ready_images` | pass |
| S17-H1 | happy: crop | Crop, drag the right side to the middle, Done; download; undo | half the photo, x unchanged; red kept, blue gone in the PNG; whole photo back | e2e `f04-crop-effects` | pass |
| S17-E1 | edge: cancel, reset, double-click | double-click opens crop; Escape keeps nothing; Enter keeps; Reset + Done removes the crop | as described | e2e `f04-crop-effects` | pass |
| S17-E2 | edge: a turned photo | turn 90°, crop its own right side (now at the bottom) | the kept part stays where it was on the page (pixels) | e2e `f04-crop-effects` | pass |
| S16-H1 | happy: text effects | Shadow on, Blur +2 by keyboard, Outline on, Shadow off | stored each time; Effects stays pressed while the outline is on | e2e `f04-crop-effects` | pass |
| X-6 | new fields stay optional | save without them, with null, with bad values | old designs save; bad crop / shadow / outline refused | api: `test_document_3e.py` (3 tests) | pass |

## F05 Arrange a layout (S08, S13)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F05-H1 | happy | shift-click 3 → align left → Group → Forward → Lock | arranged, grouped, locked; survives reload | e2e | group / ungroup pass: e2e `f05-f09-editing`; lock pass: e2e `f05-position` |
| F05-E1 | edge: group across locked items | include a locked item | clear rule (refuse or skip locked) | e2e | not built |
| F05-E2 | edge: move a locked element | drag it | does not move | e2e | pass: e2e `f05-position` (locked: no move, no delete; unlock, then both work) |
| F05-E3 | edge: ungroup one item | take one out of a group | others stay grouped | e2e | not built |
| F05-E4 | edge: snapping with rotated items | rotate 30°, drag near another | guides use the rotated box | e2e | not built |
| F05-E5 | edge: keyboard only | arrow keys nudge, Shift+arrow 10 px | moves, undoable | e2e | pass: e2e `f05-f09-editing` |
| F05-E6 | edge: delete and undo | Delete key, then Ctrl+Z | removed, then back | e2e `f05-f09-editing` | pass |
| F05-H2 | happy: Position panel | type X, Y, width, height, rotation 405; flip; undo twice | 100, 50, 300 × 200, 45°; flipped; undo takes back flip, then rotation | e2e `f05-position` | pass |
| F05-H3 | happy: Layers | three shapes → Layers tab; click a row; Alt+↑; lock a row; drag the top row to the bottom; undo | list top first; selected; order changes (and doesn't nudge); locked; reordered; back | e2e `f05-position` | pass |
| F05-E7 | edge: typed size rules | photo width 150 → height 100; text: height box disabled, narrower width → taller | proportions kept; text re-wraps | e2e `f05-position` | pass |
| F05-E8 | edge: tab through the boxes without typing | Tab × 5, Escape | nothing saved, no extra undo step | e2e `f05-position` | pass |
| F05-E9 | edge: copy / cut / paste | Ctrl+C, Ctrl+V twice, Ctrl+X, Ctrl+V | copies with new ids, +20 px each; cut and paste back | e2e `editor-extras` | pass |
| F05-E10 | edge: paste into another design | copy a photo, open another design, Ctrl+V, download | same place; the photo is in the PNG (red pixel) | e2e `editor-extras` | pass |
| S08-E1 | edge: right-click menu | right-click an element, Duplicate; Lock from the menu; Delete disabled when locked; right-click empty space, Select all | selects first; actions work; Paste disabled until something is copied | e2e `editor-extras` | pass |

## F06 Multi-page design to PDF (S08, S18, S20)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F06-H1 | happy | add page, duplicate, reorder in grid, PDF all pages | PDF has the pages in the new order | e2e | add / duplicate / delete + PDF of chosen pages pass: e2e `f05-f09-editing`; grid reorder not built |
| F06-E1 | edge: delete the last page | delete page 1 of 1 | blocked in UI; server refuses `pages: []` | api: `test_autosave_validates_the_document`; e2e | pass (API); UI pass: e2e `f05-f09-editing` (delete disabled on the last page) |
| F06-E2 | edge: many pages | 200 pages, then 201 | 200 saves, 201 refused | api: `test_F06_E2_many_pages` | pass |
| F06-E3 | edge: page range | download pages 2–3 | PDF has 2 pages | e2e | pass: e2e `f05-f09-editing` (one chosen page) |
| F06-E4 | edge: pages grid view | open grid, Alt+← on page 3, drag page 1 to the end, add, delete, click a page, Escape | order saved each time; focus on the edited page, then back on the button | e2e `editor-extras` | pass |
| S20-E1 | edge: download size | 1080 × 1080 at 3×; an 8000 × 3000 design | 3240 × 3240 PNG; only 1× offered, with a note | e2e `editor-extras` | pass |

## F07 Come back later (S02 / S05 → S08)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F07-H1 | happy | edit, close, reopen from Home | every edit there | api: `test_F02_H1_create_edit_reopen`; e2e | pass (API); pass: e2e `f07-f08-designs` |
| F07-E1 | edge: two tabs at once | both tabs save from the same revision at the same moment | one saves, the other gets "changed in another tab. Reload?" | api: `test_F07_E1_two_tabs_save_at_the_same_moment`, `test_autosave_bumps_revision_and_detects_other_tab`; e2e | pass (API), blocked (UI) |
| F07-E2 | edge: save fails while offline | edit offline, close tab | warning; nothing lost while tab open | e2e | blocked |
| F07-E3 | edge: reopen a design in Trash | open its link | opens read-only with "Restore"; saves refused | api: `test_F07_E3_reopening_a_trashed_design`; e2e | pass (API); pass: e2e `f07-f08-designs` |
| F07-E4 | edge: editor open over 1 hour | image links expire | images reload with fresh links | manual | blocked |
| F07-E5 | edge: rename from the editor title, accents + emoji | click the title, type `Café poster 🎨`, Enter | title kept exactly, saved | e2e `f07-f08-designs` | pass |

## F08 Organise (S05 → S06 → S07)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F08-H1 | happy | rename, move to folder, delete, restore from Trash | each change shows; restored design back | api: `test_rename_and_move`, `test_trash_restore_delete`; e2e | pass (API); rename + sort + Trash with Undo: e2e `f07-f08-designs`; folders + Trash screen: e2e `f08-folders-trash` (F08-H2, F08-H3) |
| F08-E1 | edge: delete a folder with designs | delete "Clients" with 2 designs | designs move to Projects root | api: `test_folder_lifecycle_and_counts` | pass (API); UI pass: e2e `f08-folders-trash` (F08-H2, the design stays) |
| F08-E2 | edge: restore into a deleted folder | trash design, delete its folder, restore | restored to root | api: same test | pass |
| F08-E3 | edge: 30-day purge | design in Trash 31 days | gone, with its files | api + job | pass: api `test_F08_E3_...`, `test_uploads_over_30_days...` (milestone 3a, runs at server start) + e2e `f08-folders-trash` (fake data) |
| F08-E4 | edge: double click "Move to Trash" | trash twice | 30-day clock keeps the first time | api: `test_F08_E4_double_click_trash_keeps_first_time` | pass |
| F08-E5 | edge: emoji and accents in names | folder `Clients 💼 — São Paulo` | kept exactly | api: `test_F08_E5_emoji_folder_name` | pass (API); UI pass: e2e `f08-folders-trash` (F08-H2) |
| F08-E6 | edge: empty / very long folder name | "", spaces, 101 chars | "A folder name needs 1–100 characters." | api: `test_folder_name_rules` | pass |
| F08-N1 | negative: delete forever outside Trash | delete a live design | "Move it to Trash first." | api: `test_trash_restore_delete` | pass |
| F08-N2 | negative: someone else's folder | Bob renames / deletes / moves into Alice's folder | 404, nothing changed | api: `test_isolation.py` | pass |
| F08-E7 | edge: empty title in the Rename dialog | spaces only | "Give it a name.", Save disabled | e2e `f07-f08-designs` | pass |
| F08-H2 | happy: folders | New folder → Move to folder… → open it → rename → delete (Cancel focused first) | each step shows; the design stays in Projects | e2e `f08-folders-trash` | pass |
| F08-H3 | happy: Trash | Move to Trash → Trash shows "Deletes in 30 days" → Restore → Trash again → Delete forever | restored, then gone; its link shows S24 | e2e `f08-folders-trash` | pass |
| F08-E9 | edge: new folder from Move to folder | choose "New folder…", name it, Move; then back to "No folder" | folder made with the design; then empty folder state | e2e `f08-folders-trash` | pass |
| F08-E10 | edge: 60-character folder name at 390 px | make, move into, open | no sideways scroll, name wraps / truncates | e2e `f08-folders-trash` | pass |
| F08-E11 | edge: keyboard only | New folder, Enter, type, Enter; "…" menu → Move to folder… → pick with arrows → Move | works without a mouse; focus returns to the button that opened each dialog | e2e `f08-folders-trash` | pass |
| F08-E12 | edge: Trash at 390 px | Trash with one design | no sideways scroll, "…" always visible | e2e `f08-folders-trash` | pass |
| F08-N3 | negative: someone else's (or a missing) folder | open /folders/<random id> | S24 "can't find" page | e2e `f08-folders-trash` | pass |

## F09 Fix a mistake (S08)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F09-H1 | happy | add text, Ctrl+Z, Ctrl+Shift+Z | removed, then back | e2e | pass: e2e `f05-f09-editing` |
| F09-E1 | edge: undo after autosave | wait for "Saved", undo | undone and saved again | e2e | pass: e2e `f05-f09-editing` |
| F09-E2 | edge: undo across page add/delete | add page, undo | page gone | e2e | pass: e2e `f05-f09-editing` |
| F09-E3 | edge: undo while typing | type, Ctrl+Z inside the text box | undoes typing, not the whole box | e2e | not built |

## F10 Restore an older version / F11 Resize to another format (could)

Not built (milestone 4). Cases to write then: F10-E1 restoring keeps the current content as a version;
F10-E2 list past 1,000 versions; F11-E1 elements off-page after resize; F11-E2 text too big.

## Cross-cutting

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| X-1 | second user's data | Bob calls every route on Alice's ids and every list | 404 everywhere, empty lists, Alice's data unchanged | api: `test_isolation.py` (4 tests) | pass |
| X-2 | Data API backstop | RLS on every table | no table without RLS | api: `test_rls_on_for_every_table`; manual: query a table with the publishable key on live Supabase | pass (local), blocked (live) |
| X-3 | delete account | DELETE /api/me | rows, files, login gone; other users untouched | api: `test_me.py` (3 tests) | pass |
| X-4 | abuse limits | 61 upload starts in a minute; 3 MB+ request | 429; 413 | api: `test_upload_start_is_rate_limited`, `test_oversized_request_body_refused` | pass |
| X-5 | bad input never echoed | send NaN in a design | 422 without the input in the reply | api: `test_autosave_validates_the_document` | pass |

## Totals (2026-10-27)

Automated: 60 API tests (`uv run pytest`), **60 passed, 0 failed** (some rows share a test).

| plan rows (81, plus F10/F11 listed above) | count |
| --- | --- |
| pass, fully | 27 |
| pass for the API part, UI part blocked or not built | 15 |
| blocked: needs the running app or live Supabase | 23 |
| not built yet (later milestone) | 16 |

## Totals (2026-10-28, after the Playwright suite)

Automated: 67 API tests (`uv run pytest`): **67 passed**. 34 end-to-end tests (`npm run e2e`, Chromium, fake data): **34 passed**
(two full runs, no flaky test). The first run failed 12 tests: 7 from BUG-006/007/008 (now fixed), 5 from mistakes in the
new tests themselves (wrong wording, a toast found twice, a check made before the list re-sorted), fixed in the specs.

Still not automated: offline / slow network (F01-E8, F02-E10 slow, F02-E11, F07-E2), two tabs in the UI (F07-E1),
very long email (F01-E2), back button (F01-E5), time zones in the UI (F02-E9), images expiring after an hour (F07-E4 manual),
the real Supabase email and live Storage (manual, done 2026-10-27/28). Features of milestone 3+ (templates, folders, Trash
screen, lock, crop, page grid) are still "not built".

## Totals (2026-10-28, after milestone 3a)

Automated: 73 API tests (**73 passed**), 42 end-to-end tests (**42 passed**, two full runs). New: 6 API tests for the
30-day clean-up, 8 end-to-end tests for folders and Trash. Found BUG-009 (S4, fixed).

## Totals (2026-10-29, after milestone 3b)

Automated: 73 API tests, 47 end-to-end tests (**47 passed**, two full runs). New: 5 end-to-end tests for the Position
panel, lock and Layers.

## Totals (2026-10-29, after milestone 3c)

Automated: 73 API tests, 53 end-to-end tests (**53 passed**, two full runs). New: 6 end-to-end tests for copy and
paste, the right-click menu, download sizes and the pages grid.

## Totals (2026-10-29, after milestone 3d)

Automated: 87 API tests (**87 passed**; 14 new check the templates), 57 end-to-end tests (**57 passed**, two full
runs; 4 new for templates).

## Totals (2026-10-29, after milestone 3e)

Automated: 90 API tests (**90 passed**), 61 end-to-end tests (**61 passed**, two full runs). Milestone 3 added 23 API
and 27 end-to-end tests.

## Totals (2026-10-29, after BUG-010)

Automated: 90 API tests, 63 end-to-end tests (61 on fake data, 2 in the new "real-mode" project).

## Totals (2026-10-30, after Settings)

Automated: 92 API tests, 73 end-to-end tests (70 on fake data, 3 in real-mode).
