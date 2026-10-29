# Pitch: brand

Chosen 2026-10-29 (direction "A · Ember", see `brand/preview.png`). A learning project that is never deployed,
so there are no trademark, domain, store or handle checks: the name "Pitch" was your choice on 2026-10-27, and
the README says Pitch isn't linked to Canva or to the presentation app also called Pitch.

## Idea

**Design it. Pitch it.** Pitch is where you shape an idea and get it ready to show: a poster, a post, a slide.
It should feel warm and confident, like a good sketchbook, and calm: nothing pushed at you, nothing locked
(the angle from `fixes.md`).

## Logo

- **Mark:** a bold **P** in a rounded square, with a small marigold **spark** in the top-right corner: an
  idea being pitched. Ember square, white P, marigold spark.
- **Wordmark:** "pitch" in lowercase, Space Grotesk bold, slightly tight, next to the mark.
- Works at 16 px (browser tab) up to any size: plain shapes, no thin lines, no gradient.
- **Never like the original's mark:** no circle badge, no script lettering, no purple, turquoise or gradient.
- Files: `brand/logo-mark-ember.svg` (the master), `frontend/public/favicon.svg` (same), and
  `frontend/src/components/Logo.tsx` (`LogoMark`, `Wordmark`), which takes its colours from the tokens.
- Where it's used: the browser tab, the sidebar (links to Home), the login screen, the editor's Home button.

## Colour

All in `design/tokens.json`; `python contrast.py tokens.json`: 28 pairs, 0 failing AA.

| role | colour | use |
| --- | --- | --- |
| accent | Ember `#c8401a` (hover `#a8330f`) | main buttons, the active item, links, the logo |
| accent-soft | Blush `#fdf2ed` | the active menu item, the login brand panel |
| text | Ink `#1f1b16` | all text; muted text `#625a51` |
| surface / workspace | Paper `#f6f2ec` / `#ebe5dc` | page backgrounds, the editor's workspace |
| spark | Marigold `#f2a900` | decoration only (the logo, illustrations): never text, it fails contrast |
| danger | Crimson-rose `#b3203c` | Delete buttons: a different red from ember, so they can't be mixed up |
| selection | Blue `#2f5bea` | the canvas selection box: it must show on any design, red-orange ones too |

Kept away from the original's colours (`brand.json`: purple `#8b3dff` / `#7d2ae8`, turquoise `#00c4cc`).

## Type

- Headings (h1–h3) and the wordmark: **Space Grotesk** (open licence, already one of the editor's fonts).
- Everything else: **Inter**.

## Voice

Three words: **warm** (not cute), **plain** (not curt), **calm** (not flat).

| do | don't |
| --- | --- |
| "Moved to Trash" + Undo | "Oops! Something happened!" |
| Say what happened and what to do: "Can't reach Pitch's server. Check that it's running." | Blame the user, or say "Error 502" |
| Short sentences, everyday words | Jargon, exclamation marks everywhere |
| Tell people when nothing is lost | Scare people about things that are undoable |
| "Design it. Pitch it." | Upgrade nags, "Go Pro" |

The existing screens already follow this, so no strings were rewritten; the login brand panel adds the tagline
"Design it. Pitch it." and "Posters, posts and slides in a calm editor. No upgrade pop-ups, nothing locked."

## Sweep (2026-10-29)

`sweep.py . --config replica/brand.json` reports 87 "Canva" hits, but 84 are the ordinary word "canvas". A
search for "Canva" not followed by "s" finds only things kept on purpose: the repo, folder and package names
`canva-clone` (your decision, 2026-10-27), internal storage and test-database names, the README's "not linked to
Canva" note, and a comment in the first database migration (already applied, so left as it is). None of the
original's colours appear anywhere.
