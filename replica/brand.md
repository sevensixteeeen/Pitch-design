# Pitch: brand

Current look: **Glow** (chosen 2026-10-30 from your reference: a dark app, Midnight Black, Electric Blue, Cantaloupe
Orange, a glowing gradient, serif titles). Earlier looks are kept below under History. A learning project that is never
deployed, so there are no trademark, domain, store or handle checks: the name "Pitch" was your choice on 2026-10-27, and
the README says Pitch isn't linked to Canva or to the presentation app also called Pitch.

The palette and the mood come from a screenshot you shared (a social-media video showing a landing-page concept). Only
the ideas are used (three colours, a glow, a serif title with one italic word, glass cards): none of that page's layout,
words, logo or product.

## Idea

**Design it. *Pitch* it.** Pitch is where you shape an idea and get it ready to show: a poster, a post, a slide.
It should feel like a calm studio at night: dark, focused, with a warm glow; nothing pushed at you, nothing locked
(the angle from `fixes.md`).

## Logo

- **Mark:** a bold **P** in a rounded square, with a small **spark** in the top-right corner: an idea being pitched.
  Glow colours: Electric Blue square, Midnight P, Cantaloupe Orange spark.
- **Wordmark:** "pitch" in lowercase, Space Grotesk bold, slightly tight, next to the mark.
- Works at 16 px (browser tab) up to any size: plain shapes, no thin lines, no gradient in the mark.
- **Never like the original's mark:** no circle badge, no script lettering, no purple, turquoise or gradient.
- Files: `brand/logo-mark-glow.svg` (the master), `frontend/public/favicon.svg` (same), and
  `frontend/src/components/Logo.tsx` (`LogoMark`, `Wordmark`), which takes its colours from the tokens.

## Colour

All in `design/tokens.json`; `python contrast.py tokens.json`: 28 pairs, 0 failing AA.

| role | colour | use |
| --- | --- | --- |
| surface | Midnight Black `#02070a` | the page behind everything |
| bg | Panel `#0a141b` | the sidebar, panels, dialogs |
| workspace | `#050c10` | the editor around the pages (no glow there: the design is the star) |
| accent | Electric Blue `#0297de` (hover `#3fb4f0`) | main buttons, links, the active item, the canvas selection |
| on-accent | Midnight `#02070a` | text on blue buttons: white on this blue would be only 3.2:1 |
| spark | Cantaloupe Orange `#fc734d` | the logo's spark, small highlights ("Start from a template"), the warm part of the glow, snapping guides |
| text | `#eef4f8`; muted `#93a4b1` | all text |
| danger | Coral `#ff6b7a` | Delete buttons, with dark text |

## The glow and glass

- **Glow** (`.bg-glow` in `styles/index.css`): Electric Blue rising into Cantaloupe Orange from the bottom, over
  Midnight, with faint vertical lines. Behind the login brand panel and the main screens (Home, Projects, Templates,
  Trash, Settings). Never in the editor.
- **Glass** (`.glass`): see-through, slightly blurred cards over the glow: design, folder and template cards, the login
  card. Both are built from the colour tokens with `color-mix`, so they follow any palette change.

## Type

- Page titles (h1): **Playfair Display**, medium, often with one word in *italic* ("Hi! What will you *make*?").
- Smaller headings (h2, h3) and the wordmark: **Space Grotesk**.
- Everything else: **Inter**. All three were already in the app (open licence); no new packages.

## Voice

Three words: **warm** (not cute), **plain** (not curt), **calm** (not flat).

| do | don't |
| --- | --- |
| "Moved to Trash" + Undo | "Oops! Something happened!" |
| Say what happened and what to do: "Can't reach Pitch's server. Check that it's running." | Blame the user, or say "Error 502" |
| Short sentences, everyday words | Jargon, exclamation marks everywhere |
| Tell people when nothing is lost | Scare people about things that are undoable |
| "Design it. *Pitch* it." | Upgrade nags, "Go Pro" |

## History

- **Ember** (2026-10-29 → 2026-10-30): a light app with ember red-orange `#c8401a`, warm paper greys, ink text, a
  marigold spark, Space Grotesk headings. `brand/preview.png`, `brand/logo-mark-ember.svg`, screenshots `brand/shot-*.png`.
- **Midnight** (2026-10-30, not used): a first dark draft with `#0b1120` and `#3d8bff`, replaced by your reference
  palette. `brand/preview-midnight.png`.

## Sweep (2026-10-29, unchanged since)

`sweep.py . --config replica/brand.json` reports "Canva" hits, but nearly all are the ordinary word "canvas". A search
for "Canva" not followed by "s" finds only things kept on purpose: the repo, folder and package names `canva-clone`
(your decision, 2026-10-27), internal storage and test-database names, the README's "not linked to Canva" note, and a
comment in the first database migration (already applied). None of the original's colours appear anywhere; Electric
Blue `#0297de` is a sky blue, well away from the original's turquoise `#00c4cc`.
