# Test plan: Canva clone

Build: no commit yet (working tree of 2026-10-27)  Date: 2026-10-27  Env: local, throwaway Postgres + fake Storage / login keys

**State of the app:** the backend runs and is tested. The frontend **does not start** (BUG-001: no
`src/main.tsx`, no router, no editor yet), so every case that needs a screen is **blocked** until
`/replica-build` milestone 1. Playwright + axe specs get written then, one per flow, in `e2e/`.

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
| F01-H1 | happy | open /login, "Create account", email + 8-char password, open confirm email, log in | Home (S02) in its empty state | manual + e2e | blocked |
| F01-E1 | edge: empty input | leave email or password empty | submit button disabled | e2e | blocked |
| F01-E2 | edge: very long input | 300-character email | clear error message, no crash | e2e | blocked |
| F01-E3 | edge: emoji and accents | `josé@exämple.com`, password with emoji | accepted or a clear message, never a crash | e2e | blocked |
| F01-E4 | edge: double click / first requests at once | two requests right after sign-up | one profile, both succeed | api: `test_F01_E4_first_requests_at_once_create_one_profile` | pass |
| F01-E5 | edge: back button mid-flow | sign up, press Back before confirming | back on S01, can log in after confirming | manual | blocked |
| F01-E6 | edge: refresh | log in, refresh | still logged in, same page | e2e | blocked |
| F01-E7 | edge: expired session | token past its expiry | API 401; app returns to /login, "Please log in again" | api: `test_bad_claims_refused`; UI e2e | pass (API), blocked (UI) |
| F01-E8 | edge: offline | submit with network off | "Can't reach the server…", no spinner forever | e2e | blocked |
| F01-E9 | edge: mobile width | 360 px wide | form fits, no sideways scroll | e2e | blocked |
| F01-E10 | edge: keyboard only | Tab through, Enter submits, mode switch reachable | works without a mouse, focus visible | e2e | blocked |
| F01-E11 | edge: screen reader labels | inspect form | labelled Email / Password fields, error has `role=alert`, axe clean | e2e | blocked |
| F01-N1 | negative: wrong password | log in with a wrong password | "That email and password don't match." | manual (live Supabase) | blocked |
| F01-N2 | negative: email already used | sign up twice with one email | "There's already an account…" (see to-check T2) | manual | blocked |
| F01-N3 | negative: weak password | 7 characters | "Use at least 8 characters…" | e2e | blocked |
| F01-N4 | negative: forged token | token signed by another key, unsigned, other project, anonymous | 401 | api: `test_auth.py` (6 tests) | pass |

## F02 Core loop: blank custom-size design → PNG (S02 → S03 → S08 → S10 → S09 → S19 → S20)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F02-H1 | happy | Create → Custom 1200×628 → heading, type → rectangle → Share → Download PNG | PNG of the page downloads; design listed on Home | api: `test_F02_H1_create_edit_reopen` (server part); e2e | pass (API), blocked (UI) |
| F02-E1 | edge: size out of range | 39 px, 8001 px, 8000×8000 | inline error, button disabled; server refuses with the same text | api: `test_create_rounds_sizes_and_checks_limits`; e2e | pass (API), blocked (UI) |
| F02-E2 | edge: unit conversion | 210 × 297 mm | created at 794 × 1123 px, unit shown as mm | api: rounding in same test; e2e | pass (API), blocked (UI) |
| F02-E3 | edge: leave before autosave | edit, close tab within 1 s | "unsaved changes" warning | e2e | blocked |
| F02-E4 | edge: 0 pages selected for download | untick all pages | Download disabled | e2e | blocked |
| F02-E5 | edge: double click Create | two creates with one id at the same moment | one design | api: `test_F02_E5_double_click_create_makes_one_design` | pass |
| F02-E6 | edge: very long input, emoji, accents (title) | 255 / 256 chars, 255 emoji, `Café déjà vu — ñandú 🎨` | 255 ok, 256 refused with message, text kept exactly | api: `test_F02_E6_very_long_and_emoji_titles` | pass |
| F02-E7 | edge: very long text box | 10,000 / 10,001 characters with emoji | first saves, second refused | api: `test_F02_E7_long_and_emoji_text_in_design` | pass |
| F02-E8 | edge: search with accents and case | search `CAFÉ`, `ürün` | finds `Café menu`, `Ürün katalog` | api: `test_F02_E8_search_with_accents_and_case` | pass (local locale, see T1) |
| F02-E9 | edge: time zones and daylight saving | read timestamps | stored UTC, sent with an offset; "Edited 2 h ago" right across a DST change | api: `test_F02_E9_times_carry_a_time_zone`; UI e2e with `timezoneId` | pass (API), blocked (UI) |
| F02-E10 | edge: slow network | throttle to 3G | "Saving…" until the server answers, never "Saved" early | e2e | blocked |
| F02-E11 | edge: offline | network off while editing | "Reconnecting…", retries, saves when back | e2e | blocked |
| F02-E12 | edge: refresh mid-edit | refresh 5 s after an edit | the edit is there | e2e | blocked |
| F02-E13 | edge: mobile width | 390 px | editor usable or a clear "best on a bigger screen" notice | e2e | blocked |
| F02-E14 | edge: keyboard only | add text, move it with arrow keys, open Download | all reachable by keyboard | e2e | blocked |
| F02-E15 | edge: uploaded image in the PNG | place own photo, download PNG | PNG includes the photo (canvas not "tainted") | manual (live Storage) | blocked |
| F02-N1 | negative: someone else's design | open Bob's design id as Alice | S24 "can't find that page"; API 404 | api: `test_isolation.py`; e2e | pass (API), blocked (UI) |
| F02-N2 | negative: design deleted in another tab | delete forever in tab A, keep editing in tab B | B shows a clear message, no silent loss | api: `test_trash_restore_delete`; e2e | pass (API), blocked (UI) |

## F03 Start from a template (S02 → S04 → S08)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F03-H1 | happy | Templates → pick one → edit → download | new design is a copy; template unchanged | api + e2e | not built (milestone 3) |
| F03-E1 | edge: fonts not loaded | open a template on a cold cache | text measured after fonts load, no jumping lines | e2e | not built |
| F03-E2 | edge: apply to a non-empty page (S12) | apply over existing content | asks replace or add page | e2e | not built |

## F04 Use my own photo (S08 → S11 → S17)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F04-H1 | happy | upload a PNG, place it, crop, lower transparency | image on page, saved | api: `test_three_step_upload`; e2e | pass (API), blocked (UI); crop not built (milestone 3) |
| F04-E1 | edge: file too large | 26 MB | "That image is over 25 MB." | api: `test_type_and_size_limits` | pass |
| F04-E2 | edge: unsupported type | HEIC, SVG | "Use a PNG, JPG or WebP image." | api: `test_F04_E2_unsupported_type_heic`, `test_type_and_size_limits` | pass |
| F04-E3 | edge: upload fails halfway | file never reaches Storage, retry | "didn't arrive", retry with same id succeeds, one asset | api: `test_F04_E3_upload_fails_halfway_then_retry` | pass |
| F04-E4 | edge: very large image | 8001 px side | "over 8000 px on one side" | api: `test_image_side_limit` | pass |
| F04-E5 | edge: double click upload | same upload id started twice, completed twice | one asset, same result | api: `test_retried_start_and_complete_are_harmless` | pass |
| F04-E6 | edge: quota, two uploads at once | 175 MB used, two 25 MB uploads at the same moment | exactly one accepted | api: `test_F04_E6_quota_holds_with_two_uploads_at_once` | pass |
| F04-E7 | edge: image deleted forever | delete an upload a design uses | design opens, placeholder, still saves | api: `test_F04_E7_image_deleted_forever_shows_as_missing`; e2e | pass (API), blocked (UI) |
| F04-E8 | edge: trashed upload | trash an upload a design uses | still shows in the design | api: `test_F04_E8_trashed_upload_still_shows_in_designs` | pass |
| F04-E9 | edge: file differs from what was promised | promise 1 KB, send 25 MB | file deleted, row deleted, 422 | api: `test_file_that_does_not_match_is_thrown_away` | pass |
| F04-N1 | negative: someone else's image | put Bob's asset id in Alice's design | no link for it (placeholder) | api: `test_open_design_signs_only_own_ready_images` | pass |

## F05 Arrange a layout (S08, S13)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F05-H1 | happy | shift-click 3 → align left → Group → Forward → Lock | arranged, grouped, locked; survives reload | e2e | not built (milestone 2) |
| F05-E1 | edge: group across locked items | include a locked item | clear rule (refuse or skip locked) | e2e | not built |
| F05-E2 | edge: move a locked element | drag it | does not move | e2e | not built |
| F05-E3 | edge: ungroup one item | take one out of a group | others stay grouped | e2e | not built |
| F05-E4 | edge: snapping with rotated items | rotate 30°, drag near another | guides use the rotated box | e2e | not built |
| F05-E5 | edge: keyboard only | arrow keys nudge, Shift+arrow 10 px | moves, undoable | e2e | not built |

## F06 Multi-page design to PDF (S08, S18, S20)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F06-H1 | happy | add page, duplicate, reorder in grid, PDF all pages | PDF has the pages in the new order | e2e | not built (milestone 2/3) |
| F06-E1 | edge: delete the last page | delete page 1 of 1 | blocked in UI; server refuses `pages: []` | api: `test_autosave_validates_the_document`; e2e | pass (API), not built (UI) |
| F06-E2 | edge: many pages | 200 pages, then 201 | 200 saves, 201 refused | api: `test_F06_E2_many_pages` | pass |
| F06-E3 | edge: page range | download pages 2–3 | PDF has 2 pages | e2e | not built |

## F07 Come back later (S02 / S05 → S08)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F07-H1 | happy | edit, close, reopen from Home | every edit there | api: `test_F02_H1_create_edit_reopen`; e2e | pass (API), blocked (UI) |
| F07-E1 | edge: two tabs at once | both tabs save from the same revision at the same moment | one saves, the other gets "changed in another tab. Reload?" | api: `test_F07_E1_two_tabs_save_at_the_same_moment`, `test_autosave_bumps_revision_and_detects_other_tab`; e2e | pass (API), blocked (UI) |
| F07-E2 | edge: save fails while offline | edit offline, close tab | warning; nothing lost while tab open | e2e | blocked |
| F07-E3 | edge: reopen a design in Trash | open its link | opens read-only with "Restore"; saves refused | api: `test_F07_E3_reopening_a_trashed_design`; e2e | pass (API), blocked (UI) |
| F07-E4 | edge: editor open over 1 hour | image links expire | images reload with fresh links | manual | blocked |

## F08 Organise (S05 → S06 → S07)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F08-H1 | happy | rename, move to folder, delete, restore from Trash | each change shows; restored design back | api: `test_rename_and_move`, `test_trash_restore_delete`; e2e | pass (API), blocked (UI) |
| F08-E1 | edge: delete a folder with designs | delete "Clients" with 2 designs | designs move to Projects root | api: `test_folder_lifecycle_and_counts` | pass |
| F08-E2 | edge: restore into a deleted folder | trash design, delete its folder, restore | restored to root | api: same test | pass |
| F08-E3 | edge: 30-day purge | design in Trash 31 days | gone, with its files | api + job | not built (milestone 3) |
| F08-E4 | edge: double click "Move to Trash" | trash twice | 30-day clock keeps the first time | api: `test_F08_E4_double_click_trash_keeps_first_time` | pass |
| F08-E5 | edge: emoji and accents in names | folder `Clients 💼 — São Paulo` | kept exactly | api: `test_F08_E5_emoji_folder_name` | pass |
| F08-E6 | edge: empty / very long folder name | "", spaces, 101 chars | "A folder name needs 1–100 characters." | api: `test_folder_name_rules` | pass |
| F08-N1 | negative: delete forever outside Trash | delete a live design | "Move it to Trash first." | api: `test_trash_restore_delete` | pass |
| F08-N2 | negative: someone else's folder | Bob renames / deletes / moves into Alice's folder | 404, nothing changed | api: `test_isolation.py` | pass |

## F09 Fix a mistake (S08)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F09-H1 | happy | add text, Ctrl+Z, Ctrl+Shift+Z | removed, then back | e2e | not built (milestone 2) |
| F09-E1 | edge: undo after autosave | wait for "Saved", undo | undone and saved again | e2e | not built |
| F09-E2 | edge: undo across page add/delete | add page, undo | page gone | e2e | not built |
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
