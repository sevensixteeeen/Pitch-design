# Recon map: Canva (web)

Scope: the core editor loop. Start a design (custom size or one of your own templates), edit it on a canvas (text, shapes, uploaded images, layers, alignment, pages), then download it as PNG, JPG or PDF. Also the minimum around that loop: sign-up, a home screen, projects and folders, and the trash.
For: a learning / portfolio project. Not for sale.
Date: 2026-10-26

## How this recon was done (read first)

- **Public sources only.** Canva's consumer Terms of Use include an acceptable-use clause saying users may not "copy, replicate, decompile, reverse-engineer, attempt to derive the source code of, modify, or create derivative works of the Service". This is confirmed through ConductAtlas, a third-party terms tracker, as of the Aug 2026 version; check it yourself on canva.com/policies/terms-of-use. Canva's developer, enterprise and MCP terms also ban using their tools to build a competing product. So this recon never logged into a Canva account, took no screenshots of the logged-in editor, and never read Canva's code or network calls.
- **canva.com blocks automated fetching (HTTP 403).** Facts from canva.com help pages come from search-result excerpts of those pages, so they are second-hand. The public developer docs (canva.dev) were read directly.
- **Evidence tags** used below:
  - `[help]` Canva help article (search excerpt)
  - `[api]` public Connect API docs
  - `[3p]` a third-party guide
  - `[gk]` general public knowledge of Canva's web UI. **Unverified.** Check these against a public walkthrough video before building.
- Everything is written as "what the user sees and does", never "how Canva does it internally". The data model is our own design, inferred from behaviour.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help: layer, group, align | https://www.canva.com/help/article/layer-group-align/ | group/ungroup from the floating toolbar, Position → Forward/Backward, align to page. Every element type can be grouped except sheets. Search excerpt only |
| 2 | help: download file types | https://www.canva.com/help/download-file-types/ | PNG/JPG/PDF Standard/PDF Print/SVG. Quality and scale sliders. Transparent PNG/SVG, compression, CMYK and file-size limit are paid. Search excerpt |
| 3 | help: design from scratch / custom size | https://www.canva.com/help/design-from-scratch/ | Custom size with px/in/mm/cm units. Each side 40–8000 px and width × height ≤ 25,000,000 px² (the help page's "8000×3125" is that area cap at full width, not a height cap). Search excerpt + source 6 |
| 4 | help: version history | https://www.canva.com/help/version-history/ | File menu → Version history, up to 1,000 versions, no time limit, paid plans. Search excerpt |
| 5 | help: deleted designs (trash) | https://www.canva.com/help/deleted-designs/ | Items stay in Trash 30 days and restore to Projects or Uploads. Search excerpt |
| 6 | Connect API: create design | https://canva.dev/docs/connect/api-reference/designs/create-design | Design object fields. Custom size 40–8000 px, area ≤ 25M px², title 1–255 chars. Read directly |
| 7 | Connect API: get design | https://canva.dev/docs/connect/api-reference/designs/get-design | id, owner, title, thumbnail, urls, page_count |
| 8 | Connect API: exports | https://canva.dev/docs/connect/api-reference/exports/ | Export is an async job (create job → poll status → download links). Formats: pdf, jpg, png, gif, pptx, mp4, html, csv |
| 9 | Connect API: export formats | https://canva.dev/docs/connect/api-reference/designs/get-design-export-formats | Available formats depend on design type and page types |
| 10 | Canva MCP prohibited use | https://www.canva.dev/docs/apps/mcp/prohibited-use/ | Bans reverse engineering, competing products and scraping. Applies to MCP users |
| 11 | Canva developer / apps terms | https://www.canva.com/policies/apps-terms/ | No-competing-product clause (search excerpt) |
| 12 | ConductAtlas: ToU reverse-engineering clause | https://conductatlas.com/platform/canva/canva-terms-of-use/prohibition-on-reverse-engineering-service/ | Consumer ToU clause text (third party) |
| 13 | keyboard shortcuts (third party) | https://linuru.com/canva/ | Ctrl+Z / Ctrl+Shift+Z, Ctrl+G / Ctrl+Shift+G, Alt+Shift+L lock. `[3p]` |
| 14 | group / lock / align guide | https://bringyourownlaptop.com/blog/group-lock-align-in-canva | `[3p]` |
| 15 | editing tools transcript (NSW Education) | https://education.nsw.gov.au/teaching-and-learning/technology-for-learning/resources/professional-learning-resources/canva-for-education/canva-foundations/transcript-canva-editing-tools | text toolbar, font size ±, Effects (shadow, outline, curve), crop/flip, transparency `[3p]` |
| 16 | pricing (third party; canva.com/pricing returned 403) | https://stylefactoryproductions.com/blog/canva-pricing | Prices conflict between sources, so none are used. Paid gates only |
| 17 | App Store listing | https://apps.apple.com/us/app/canva-graphics-text-design/id897446215 | Pitch, free with in-app purchases, 5 GB free storage |

Still worth doing by hand (you watching, at normal speed): watch one or two public "Canva for beginners" YouTube walkthroughs and tick or fix every `[gk]` item below.

## Core loop

Pick a canvas size, put text, shapes and your own photos on it, arrange them until it looks right, and download it as an image or PDF, with no design skills needed.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up / log in | logged-out landing → "Sign up" / "Log in" | create an account or sign in | AuthModal, Button, TextInput, OAuth buttons | default, error (bad email/password), loading `[gk]` |
| S02 | Home | `/` after login | launchpad: search, create, recent designs | TopNav, SearchInput, "Create a design" Button, design-type shortcut row, DesignCard grid | empty (new user, no designs), filled, loading (skeleton) `[gk]` |
| S03 | Create a design / custom size | S02 → "Create a design" → "Custom size" | choose a preset size or type width × height | Popover, preset list, NumberInput ×2, UnitSelect (px/in/mm/cm), aspect-lock toggle | default, invalid size (side <40 or >8000 px), area too large (>25M px²) `[help]` `[api]` |
| S04 | Templates browse | S02 → Templates | start from a ready-made design | SearchInput, filter chips, TemplateCard grid | filled, no results, loading `[gk]`. **The clone uses its own templates.** |
| S05 | Projects | sidebar → Projects | all your designs, uploads and folders | Tabs (All, Designs, Folders, Uploads), DesignCard grid/list toggle, sort menu, multi-select bar | empty, filled, selection mode `[gk]` |
| S06 | Folder | S05 → open a folder | designs in one folder | Breadcrumb, DesignCard grid, "New folder" | empty folder, filled `[gk]` |
| S07 | Trash | S05 → Trash | restore or permanently delete | DesignCard grid, Restore / Delete forever actions, 30-day notice | empty, filled `[help]` |
| S08 | Editor shell | open or create a design → `/design/:id/edit` | the canvas where everything happens | TopBar (File menu, Resize, undo/redo, save status, title, Share), SidePanelRail, SidePanel, Canvas + Page, BottomBar (zoom, page count, grid view) | loading design, saved, saving, offline/save failed, nothing selected `[gk]` |
| S09 | Editor: Elements panel | S08 rail → Elements | add shapes, lines and graphics | SearchInput, shape grid, line grid | default, search no-results `[gk]` |
| S10 | Editor: Text panel | S08 rail → Text | add heading / subheading / body text | "Add a text box" Button, text style presets | default `[gk]` |
| S11 | Editor: Uploads panel | S08 rail → Uploads | upload your own images and reuse them | Dropzone / "Upload files" Button, AssetCard grid, UploadProgress | empty, uploading (progress), filled, upload error (file too big or wrong type) `[gk]` |
| S12 | Editor: Design/Templates panel | S08 rail → Design | apply one of your templates to the page | TemplateCard grid | filled, applying `[gk]` |
| S13 | Editor: Position panel | select element → Position | arrange and align; layer list | Tabs (Arrange, Layers), align buttons, LayerRow list (drag to reorder), W/H/X/Y/rotate inputs | nothing selected, one selected, many selected `[help]` `[3p]` |
| S14 | Editor: Color panel | select element → colour swatch | pick fill/text/background colour | ColorSwatch rows (document colours, defaults), ColorPicker (hex input) | default, custom colour `[gk]` |
| S15 | Editor: Font panel | select text → font name | choose a font | SearchInput, FontRow list (rendered in its own font), recently used | loading fonts, no results `[gk]` `[3p]` |
| S16 | Editor: Effects panel | select text → Effects | shadow, outline, curve | EffectTile grid, Slider controls | none, effect on + sliders `[3p]` |
| S17 | Editor: crop mode | double-click image or Crop button | crop or reposition an image inside its frame | crop handles, Done / Reset Buttons | cropping `[3p]` |
| S18 | Editor: pages grid view | BottomBar → grid view | see, reorder, duplicate and delete pages | PageThumb grid (drag), add-page Button | 1 page, many pages `[gk]` |
| S19 | Share menu | S08 → Share | entry point to download (and sharing, out of scope) | Popover, Download row | default `[gk]` |
| S20 | Download panel | S19 → Download | choose format and options and download | Select (file type), Slider (size/scale), Checkbox (transparent bg, pro), page Select, Download Button | default, preparing (progress), done, failed `[help]` `[api]` |
| S21 | Version history | S08 → File → Version history | browse and restore older versions | VersionRow list, preview canvas, Restore Button | 1 version, many `[help]` (paid in original) |
| S22 | Resize dialog | S08 → Resize | copy or resize to another size | size presets, custom W×H, "Copy & resize" / "Resize" Buttons | default `[3p]` (paid "Magic Resize" in original) |
| S23 | Account settings | avatar → Settings | name, email, password, delete account | Form, TextInput, danger zone | default, saved, error `[gk]` |
| S24 | Not found / no access | open a design you don't own or one that was deleted | dead-end with a way home | EmptyState, Button | 404, permission denied `[gk]` |

## Flows

```
F01 New user signs up
    S01 -> S02 (empty state)
    happy path clicks: 3 (Sign up, choose email/Google, submit)
    edge: email already used, weak password, OAuth cancelled

F02 Core loop: blank custom-size design -> PNG   (the number to beat)
    S02 -> S03 -> S08 -> S10 -> S08 -> S09 -> S08 -> S19 -> S20
    happy path: 10 clicks + 2 typing steps (estimate, not measured)
      Create a design, Custom size, [type W/H], Create new design,
      Text tab, Add a heading, [type], Elements tab, pick shape,
      Share, Download, Download
    edge: size out of range, unit conversion (in/mm -> px), user leaves
          before autosave finishes, download of 0 selected pages

F03 Start from a template
    S02 -> S04 -> S08 (template copied into a new design) -> edit -> S19 -> S20
    happy path clicks: ~6
    edge: template has fonts not yet loaded; applying a template to a
          non-empty page (S12) - replace or add a page?

F04 Use my own photo
    S08 -> S11 (upload) -> drag onto page -> S17 crop -> transparency slider
    happy path clicks: ~6
    edge: file too large, unsupported type (HEIC), upload fails halfway,
          very large image (memory), image dropped onto a frame

F05 Arrange a layout
    S08: shift-click several -> align (S13 Arrange) -> Group -> Position
         Forward/Backward -> Lock
    happy path clicks: ~6
    edge: grouping across locked items, moving a locked element, ungrouping
          one item from a group [help], snapping guides with rotated items

F06 Multi-page design to PDF
    S08 -> add page -> duplicate page -> S18 reorder -> S19 -> S20 (PDF, all pages)
    happy path clicks: ~7
    edge: delete the last remaining page (must block), 50+ pages, selecting a
          page range for download

F07 Come back later
    S02 (recent designs) or S05 -> S08, every edit already saved
    happy path clicks: 1
    edge: two tabs editing the same design, save fails while offline,
          reopening a design that is in the trash

F08 Organise
    S05 -> rename / move to folder (S06) / delete -> S07 -> restore
    happy path clicks: ~4
    edge: delete a folder with designs in it, restore into a deleted folder,
          auto-purge after 30 days [help]

F09 Fix a mistake
    S08: Ctrl+Z / Ctrl+Shift+Z, or the toolbar arrows
    happy path clicks: 1
    edge: undo after autosave, undo across page add/delete, undo of a text edit
          that is still being typed

F10 Restore an older version (could)
    S08 -> File -> S21 -> pick version -> Restore
    happy path clicks: 4
    edge: restoring overwrites unsaved work; version list grows past 1,000 [help]

F11 Resize to another format (could)
    S08 -> S22 -> pick size -> Copy & resize -> new S08
    happy path clicks: 3
    edge: elements end up off-page; text too big for the new size
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon-only | default, hover, focus, disabled, loading | all |
| TextInput / NumberInput | text, email, password, number with unit | default, focus, error, disabled | S01, S03, S13, S22, S23 |
| UnitSelect | px, in, mm, cm | default, open | S03, S22 |
| SearchInput | global, panel | empty, typing, results, no results | S02, S04, S09, S15 |
| DesignCard | grid, list | default, hover (… menu), selected, loading thumb | S02, S05, S06, S07 |
| TemplateCard / AssetCard | image tile | default, hover, dragging, uploading | S04, S11, S12 |
| TopBar (editor) | - | saved, saving, save failed | S08 |
| SidePanelRail + SidePanel | Elements, Text, Uploads, Design, Projects | collapsed, open | S08–S16 |
| Canvas + Page | single, multi-page scroll | idle, panning, zoomed | S08 |
| SelectionBox | single, multi, group | idle, hover outline, resizing, rotating, locked | S08 |
| SmartGuides | edge, centre, spacing | shown while dragging | S08 |
| ContextToolbar (floating) | text, shape, image, multi-select | default, overflow (…) | S08 |
| ContextMenu (right-click) | element, page, canvas | open | S08 |
| ColorPicker / Swatch | swatch row, full picker, hex input | default, selected | S14 |
| FontPicker / FontRow | - | loading, selected | S15 |
| Slider | transparency, effect amount, export scale | default, dragging | S16, S20 |
| Tabs | Arrange/Layers, Projects tabs | active, inactive | S05, S13 |
| LayerRow | element, group (expandable) | default, hover, selected, locked, dragging | S13 |
| PageThumb | strip, grid | default, active, dragging | S08, S18 |
| ZoomControl | slider + % + fit | - | S08 |
| Popover / DropdownMenu | Create menu, Share, File, sort | open, closed | S03, S08, S19 |
| Modal / Dialog | confirm, form | open, submitting | S01, S22, delete confirms |
| Dropzone + UploadProgress | - | idle, drag-over, uploading, error | S11 |
| Toast | success, error, undo-able | shown, dismissed | all |
| EmptyState | no designs, no uploads, no results, 404 | - | S02, S05, S07, S11, S24 |
| Skeleton loader | card, panel | loading | S02, S05, S08 |

## Inferred data model

Our own model, built from what the user sees. It makes no claim about Canva's internals.

```
User         id, email, name, avatar_url, password_hash | oauth_provider, created_at
             evidence: S01, S23
             confidence: high

Design       id, owner_id, title (1-255 chars), width_px, height_px,
             display_unit (px|in|mm|cm), folder_id?, thumbnail_url,
             created_at, updated_at, deleted_at? (trash), current_version
             evidence: [api] create/get design (id, owner, title, thumbnail,
             created_at/updated_at, page_count), [help] custom size 40..8000 px,
             [help] trash 30 days
             confidence: high (fields); medium (deleted_at, display_unit)

Page         id, design_id, position (order), background_color, background_asset_id?
             evidence: S18 pages grid, [api] page_count, Design panel backgrounds
             confidence: medium

Element      id, page_id, parent_group_id?, type (text|shape|line|image|group),
             x, y, width, height, rotation, opacity, flip_x, flip_y,
             locked, z_index, props (json, per type)
               text:  content, font_family, font_size, color, bold, italic,
                      underline, align, letter_spacing, line_height, effect
               shape: kind (rect|ellipse|triangle|...), fill, stroke,
                      stroke_width, corner_radius
               line:  points, stroke, stroke_width, dash, arrow_ends
               image: asset_id, crop (x,y,w,h), corner_radius
             evidence: ContextToolbar options (S08, S13, S14, S15, S16, S17),
             [help] layer/group/align, [3p] lock, transparency, flip, crop
             confidence: medium (core geometry); guess (exact prop names, json shape)

Asset        id, owner_id, kind (image), storage_key, mime, width, height,
             size_bytes, created_at, deleted_at?
             evidence: S11 Uploads, [help] trash restores to Uploads,
             [api] create design from asset_id
             confidence: high

Folder       id, owner_id, name, parent_folder_id?, created_at
             evidence: S05, S06
             confidence: medium

Template     id, title, category, width_px, height_px, thumbnail_url,
             content (json snapshot of pages + elements)
             evidence: S04, S12. The clone writes its own templates.
             confidence: medium

DesignVersion id, design_id, snapshot (json), created_at, created_by
             evidence: [help] version history, up to 1,000 versions
             confidence: medium (could feature)

ExportJob    id, design_id, format (png|jpg|pdf), options (json: scale,
             quality, pages, transparent_bg), status (in_progress|success|failed),
             file_urls[], created_at
             evidence: [api] export = async job with status + download links,
             S20 preparing/done states
             confidence: high (concept); medium (exact fields)
```

Relationships: User 1-n Design, User 1-n Folder, User 1-n Asset, Folder 1-n Design (and Folder 1-n Folder), Design 1-n Page, Page 1-n Element, Element(group) 1-n Element, Element(image) n-1 Asset, Design 1-n DesignVersion, Design 1-n ExportJob. A Template is copied into a new Design and is not linked to it afterwards.

## Feature matrix

See `features.csv`. Must: 30, should: 15, could: 8, skip: 9.

## Out of scope (cannot or should not be cloned)

- **Canva's template library** (1.6M+ templates per third-party counts). Canva and its creators own it. The *feature* stays, using templates you design yourself.
- **Stock photos, graphics, video and music.** Licensed content. Use your own images, or a free API such as Unsplash or Pexels within their terms, as a separate opt-in.
- **Licensed / Pro fonts.** Use open-licence fonts (Google Fonts).
- **Canva's logo, icons, illustrations, UI copy and brand.** These come in later through `/replica-brand`.
- **Magic Studio / AI features** (background remover, Magic Write, Magic Design). These depend on Canva's models. Possible later as your own feature on your own model, so they are `could` or `skip`.
- **Print ordering.** It relies on partner deals.
- **Apps marketplace and integrations.** That is a partner network.
- **Real-time collaboration, comments and share links.** Outside the scope you chose; they would turn an M project into an L.
- **Video editing, Docs, Whiteboards, Sheets, Websites.** Separate products.

## Size

Screens 24, flows 11, entities 9.

Hard parts:
1. **Selection and transform engine.** Click, shift-click, drag-select, resize from 8 handles, rotate, snap to smart guides, groups and locked items. Most of the "feels like Canva" comes from this.
2. **Text editing on the canvas.** Editing text right where it sits on a rotated, scaled page, plus loading web fonts so text is measured correctly.
3. **Export fidelity.** A PNG/JPG made from the canvas is easy. A PDF with real, selectable text and embedded fonts that matches the screen pixel for pixel is not.
4. **Undo/redo together with autosave.** One history of changes that survives saving, page changes and grouping, without losing work.

Size: **M (upper end)**, a few weeks of steady work for one learner. That assumes a canvas library (for example Konva or Fabric.js) instead of writing the engine from scratch. Without a library it becomes L.
