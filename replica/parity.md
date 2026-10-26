# Parity: Canva clone vs Canva (core editor loop)

Date: 2026-10-27  Build: no commit yet (working tree)  Tools: `parity.py`, `imgdiff.py` (replica-diff)

## Verdict: **not shippable**

- 0 of 30 must-have features are done.
- Open S1: **BUG-001**, the frontend doesn't start (no `src/main.tsx`, router or editor).
- Open S2: **BUG-002**, `npm run build` fails on type errors.

## Scores

| measure | score | notes |
| --- | --- | --- |
| **feature parity** (`parity.py`) | **1.6 / 100** | 53 features counted, 9 left out on purpose. Weighted must 3, should 2, could 1, partial = half |
| what a user can actually do today | **0** | The app doesn't start. The 1.6 comes only from backend work: two `partial` rows (sign-up, delete account) |
| layout parity (`imgdiff.py`) | **n/a** | Not measured, see below |
| overall | **1.6 / 100** | Feature parity only; there is no layout score to blend in |

By area: onboarding 37.5, account 50.0, every other area 0. Full tool output is in the appendix.

What the backend already covers but can't be scored until a screen uses it: designs (create, open,
autosave with the two-tab check, rename, trash, restore, delete), folders, the three-step image upload,
title search, delete account. 60 API tests pass (`replica/test-plan.md`).

## Layout diff: not done, on purpose

- **No screenshots of the original.** Canva's terms forbid reverse engineering, so recon used public pages
  only, and the logged-in editor was never captured (`replica/screens/README.md`). Comparing against
  Canva's editor would need exactly those screenshots, so this project skips the original-vs-clone layout
  diff entirely. The skill agrees on the priority: parity means doing the same job, not looking the same.
- **No clone screenshots yet.** The clone doesn't render (BUG-001).
- **Later:** once it renders, use `imgdiff.py --mode pixel` for the clone's own regressions (this week
  against last week) at 1440×900 and 390×844, saved in `replica/clone-screens/`.

No diff images were produced.

## Behaviour diff (planned, not yet walkable)

The clone can't be walked through yet, so "clone does" below is what `architecture.md` decided. It is
checked through the API where that applies, and nothing has been checked in a browser. "Original does"
comes only from `recon.md`, i.e. public help pages.

| flow | original does | clone does (planned) | fix or keep |
| --- | --- | --- | --- |
| F02 core loop | about 10 clicks + 2 typing steps (recon estimate, not measured) | can't be measured yet | measure after milestone 1; aim for fewer |
| F01 sign up | email or Google | email only until milestone 4. Supabase's built-in mail sends only a few emails per hour | **fix before friends sign up:** custom SMTP, or turn "Confirm email" off for the demo |
| F07 two tabs | real-time collaboration (out of our scope) | the second tab's save is refused: "changed in another tab. Reload?" (API-tested) | keep; never a silent overwrite |
| F08 trash | 30 days in Trash, restores to Projects or Uploads | 30 days; a design whose folder was deleted restores to the Projects root (API-tested); purge job not built | keep; build the purge in milestone 3 |
| F02/F06 export | transparent PNG and export scale are paid | planned free (could / should) | keep: a reason to switch |
| F10 version history | paid; up to 1,000 versions | planned free, 1,000 per design (milestone 4) | keep |
| F11 resize | paid "Magic Resize" | planned free "copy and resize" (milestone 4) | keep |
| F02 download | export runs as a job with a "preparing" state (recon's inferred model) | export runs in the browser, no queue | keep, but still show "Preparing…" for big PDFs |

## Missing features, in build order

`parity.py` sorts by priority, then area name. The real build order is the milestones in `architecture.md`:

**Milestone 1, vertical slice (closes BUG-001):** sign up / log in (S01), Home with recent designs and
empty state (S02), create from a preset or custom size (S03; the screen already has both), editor shell with a canvas (S08): add a text box, add a
rectangle, drag it, autosave; upload one photo and place it (S11); download PNG (S20).

**Milestone 2, the other must-haves:** select / multi-select / drag-select, move-resize-rotate, smart
guides, align, layer order, group, duplicate / delete, opacity, undo / redo, zoom; edit text in place, fonts
and text styles; shapes and lines with fill / stroke, page background, add / duplicate / delete pages;
JPG and PDF download; projects list, rename, delete.

**Milestone 3, should-haves (15):** lock, layers list, X/Y/W/H inputs, crop, flip, text effects, letter
spacing / line height, templates (our own), pages grid view, folders, trash with purge, keyboard
shortcuts, context menu, export scale, not-found page.

**Milestone 4, could-haves (8):** Google sign-in, transparent PNG, version history, copy and resize,
curved text, image corner radius / border, search, account settings + delete account screen.

## Top five to build next

All five are milestone 1, which is `/replica-build`'s next step:

1. **App shell:** `src/main.tsx` and the router, wiring the Login, Home and CreateDesign screens that
   already exist, plus the S24 not-found route. Closes BUG-001; with the BUG-002 / BUG-004 fixes,
   `npm run build` passes.
2. **Editor shell (S08) with a Konva canvas** that opens a saved design: add a text box, add a rectangle,
   drag them.
3. **Autosave with its indicator** (Saving… / Saved / Reconnecting…), on the API's revision check.
4. **Upload a photo and place it** (S11), on the API's three-step upload.
5. **Download PNG** (S20), proving a page containing an uploaded photo still exports (no "tainted"
   canvas). This ends the core loop.

Estimate, not a measurement: if all five land fully, about 8 must-haves become `yes` and 4 `partial`,
which would put feature parity near **24 / 100**. That's still not shippable until milestone 2.

## Next

`/replica-build` (milestone 1). Then `/replica-test` again with Playwright, then back here.
`/replica-entrepreneur` comes once parity is there.

## Appendix: `parity.py replica/features.csv --markdown` (generated 2026-10-27)

### Parity: 1.6 / 100

features 1.6  (53 counted, must-haves 0 of 30 done)

Not shippable yet: 30 must-have features are not done.

### By area, weakest first
- home                           0.0  (1 features)
- create                         0.0  (2 features)
- editor                         0.0  (9 features)
- text                           0.0  (6 features)
- elements                       0.0  (4 features)
- uploads                        0.0  (4 features)
- canvas                         0.0  (3 features)
- arrange                        0.0  (7 features)
- pages                          0.0  (3 features)
- export                         0.0  (5 features)
- projects                       0.0  (5 features)
- templates                      0.0  (1 features)
- onboarding                    37.5  (2 features)
- account                       50.0  (1 features)

### Missing, in build order
- [must] arrange: Align to page and to each other, no  (S13 [help])
- [must] arrange: Duplicate and delete elements, no  (context toolbar + keyboard)
- [must] arrange: Group and ungroup, no  (Ctrl+G / Ctrl+Shift+G [help][3p])
- [must] arrange: Layer order forward / backward / front / back, no  (S13 [help])
- [must] canvas: Move resize and rotate elements, no  (hard part 1)
- [must] canvas: Select / multi-select / drag-select, no  (hard part 1)
- [must] canvas: Snap and smart alignment guides, no  (hard part 1)
- [must] create: Create a design from a preset size, no  (S03 - presets are our own list (post / story / A4 / slide))
- [must] create: Create a design with custom width x height, no  (S03 - 40..8000 px; area cap; px/in/mm/cm units [help][api])
- [must] editor: Autosave with saved / saving indicator, no  (S08 states - hard part 4 | backend: PUT content with revision + 409 done)
- [must] editor: Editor shell with side panel and top bar, no  (S08)
- [must] editor: Undo and redo, no  (Ctrl+Z / Ctrl+Shift+Z - hard part 4)
- [must] editor: Zoom and fit to screen, no  (BottomBar)
- [must] elements: Add basic shapes and lines, no  (S09)
- [must] elements: Shape fill and stroke colour, no  (S14)
- [must] elements: Transparency / opacity, no  (slider [3p])
- [must] export: Download as JPG with quality slider, no  (S20 [help])
- [must] export: Download as PDF (all or chosen pages), no  (S20 - hard part 3)
- [must] export: Download as PNG, no  (S20 - core loop end)
- [must] home: Home with recent designs and empty state, no  (S02)
- [must] pages: Add / duplicate / delete pages, no  (cannot delete last page)
- [must] pages: Page background colour, no  (S14)
- [must] projects: Projects list of all designs, no  (S05 | backend: GET /api/designs done)
- [must] projects: Rename and delete a design, no  (S05 DesignCard menu | backend: PATCH + trash routes done)
- [must] text: Add text box (heading / subheading / body), no  (S10)
- [must] text: Edit text in place on the canvas, no  (S08 - hard part 2)
- [must] text: Font family / size / colour / bold / italic / underline / align, no  (S15 S14 - Google Fonts only)
- [must] uploads: Place uploaded image on page, no  (S11 -> S08 drag or click)
- [must] uploads: Upload your own images, no  (S11 - size and type limits; error state | backend: 3-step upload (start/complete) with type/size/quota checks done)
- [must] onboarding: Sign up and log in with email, partial  (S01 | backend: Supabase Auth + token check in API; live test pending (needs Supabase keys))
- [should] arrange: Exact position and size inputs (X Y W H rotation), no  (S13)
- [should] arrange: Layers list with drag to reorder, no  (S13 Layers tab [help][3p])
- [should] arrange: Lock and unlock elements, no  (Alt+Shift+L [3p])
- [should] editor: Keyboard shortcuts (copy paste nudge delete), no  ([3p] list - verify)
- [should] editor: Not found / no access page, no  (S24 - deleted design or someone else's design)
- [should] editor: Right-click context menu, no  (S08)
- [should] elements: Flip horizontal / vertical, no  ([3p])
- [should] export: Export scale (1x 2x 3x), no  (S20 [help] - paid in original)
- [should] pages: Pages grid view with drag reorder, no  (S18)
- [should] projects: Folders and move design to folder, no  (S05 S06 | backend: folder routes done)
- [should] projects: Trash with restore and 30-day purge, no  (S07 [help] | backend: trash/restore/delete done; purge job pending)
- [should] templates: Start from a template (our own set), no  (S04 S12 - write 10-20 of our own)
- [should] text: Letter spacing and line height, no  ([3p])
- [should] text: Text effects (shadow / outline), no  (S16 [3p])
- [should] uploads: Crop an image, no  (S17)
- [could] editor: Resize design to another size (copy and resize), no  (S22 - paid Magic Resize in original)
- [could] editor: Version history and restore, no  (S21 [help] paid in original)
- [could] export: Transparent PNG export, no  ([help] paid in original)
- [could] onboarding: Sign in with Google, no  (OAuth)
- [could] projects: Search your own designs, no  (S02 SearchInput | backend: q= title search (ilike) done)
- [could] text: Curved text, no  (S16 [3p])
- [could] uploads: Image corner radius and border, no  ([3p])
- [could] account: Account settings and delete account, partial  (S23 | backend: DELETE /api/me done and tested; S23 screen pending)

### Left out on purpose (not scored)
- Canva template library: owned by Canva and its creators - use our own templates
- Stock photos / graphics / video / audio: licensed content - optional later via Unsplash/Pexels API under their terms
- Pro / licensed fonts: licensed - use open-licence Google Fonts
- Magic Studio AI tools (bg remover / Magic Write / Magic Design): Canva's own models - could add later with your own model
- Print ordering: partner deals
- Apps marketplace and integrations: partner network
- Real-time collaboration / comments / share links: out of the chosen scope - would make it L
- Brand kit: out of the chosen scope (paid in original)
- Video / Docs / Whiteboards / Sheets / Websites: separate products
