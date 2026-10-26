# Components: Canva-clone editor

Every repeated UI part from `recon.md` → Components, with sizes, every state (including the ones the recon could not see: focus, disabled, loading, error, empty), the tokens it uses and its keyboard / screen-reader behaviour.

Ground rules for all of them:
- **Tokens only.** Use classes from `tailwind.theme.css` (`bg-surface`, `text-muted`, `border-input`, `rounded-md`, `shadow-pop`). The default Tailwind palette is switched off, so `bg-blue-500` fails on purpose.
- **Canvas colours come from CSS too.** Konva draws on a `<canvas>`, which can't use classes. The editor reads `--tk-color-selection` and `--tk-color-guide` once with `getComputedStyle(document.documentElement)`, so a rebrand still reaches the canvas.
- **Accessible base:** Radix primitives (Dialog, DropdownMenu, ContextMenu, Popover, Tabs, Slider, Tooltip, Toast, Toggle) provide focus trapping, arrow-key menus and ARIA. We style them; we don't rewrite their behaviour.
- **Icons:** `lucide-react` only, 16 px in dense toolbars, 20 px elsewhere, `stroke-width` 1.75. An icon-only control always has an `aria-label`.
- **Focus:** every interactive part shows `focus-visible` as a 2 px `accent` ring with a 2 px offset (`ring-2 ring-accent ring-offset-2 ring-offset-app`). The accent/bg and accent/surface ring pairs pass 3:1 (see contrast report).
- **Copy:** every label and empty-state line is written fresh for this app. Nothing is copied from Canva.
- **Motion:** 120 ms for hovers and presses, 200 ms for panels and popovers, `ease-standard`. With `prefers-reduced-motion`, everything is instant.
- **Desktop-first editor:** the editor (S08–S22) needs ≥ 1024 px (`layout.editor-min-w`). Below that, S08 shows a short "Open this on a larger screen" message with a link back to Projects. Home, Projects and Settings work down to 360 px.

---

```
Button
  variants  primary (bg accent, text on-accent), secondary (bg surface, text fg, border border),
            ghost (transparent, text fg, hover surface-hover), danger (bg danger, text on-danger)
  sizes     sm 32px (px-3, text-sm), md 40px (px-4, text-sm/600), lg 48px (px-6, text-base/600)
  states    default, hover (primary → accent-hover; others → surface-hover), active (translate-y 1px),
            focus-visible (ring), disabled (opacity .5, no pointer, aria-disabled), loading (spinner
            replaces the leading icon, label stays, button keeps its width)
  tokens    radius md, font sans, motion fast
  a11y      real <button type="button|submit">; loading sets aria-busy="true" and keeps the label
            for screen readers; disabled buttons that explain *why* use a Tooltip
  used on   all
```

```
IconButton
  variants  ghost (default), toggle (pressed = bg accent-soft, icon accent)
  sizes     sm 28px (16px icon, dense toolbars), md 36px (20px icon)
  states    default, hover (surface-hover), pressed (aria-pressed=true), focus-visible, disabled
  tokens    radius md, text fg / accent when pressed
  a11y      aria-label required; Tooltip with the label + shortcut (e.g. "Group · Ctrl+G")
  used on   S08 TopBar, ContextToolbar, SidePanelRail, BottomBar, S13
```

```
TextInput / NumberInput
  variants  text, email, password (show/hide IconButton), number (with optional unit suffix
            and ▲▼ steppers)
  sizes     sm 32px (toolbars, S13 X/Y/W/H), md 40px (forms)
  states    default (border input), hover (border fg), focus (ring accent, border accent),
            error (border danger + message below in danger text-xs), disabled (bg surface, text muted),
            read-only
  number    ↑/↓ = ±1, Shift+↑/↓ = ±10; Enter commits, Escape reverts; out-of-range values clamp on
            commit and show the range in the error line (e.g. "40–8000 px")
  tokens    bg app, text fg, placeholder muted, radius md, text-sm
  a11y      a visible <label> (or aria-label in dense toolbars); error linked with aria-describedby
            and aria-invalid="true"
  used on   S01, S03, S13, S22, S23
```

```
UnitSelect
  variants  px | in | mm | cm
  states    closed, open, focus-visible
  behaviour switching unit converts the W/H fields (96 px = 1 in) and keeps the size in px
  a11y      Radix Select (arrow keys, type-ahead)
  used on   S03, S22
```

```
SearchInput
  variants  global (S02, md 40px, pill radius), panel (S09/S15, sm 32px)
  states    empty (placeholder), typing, has value (clear ✕ IconButton), loading (spinner at the end),
            no results (EmptyState below the input), focus-visible
  behaviour 250 ms debounce; Escape clears, then blurs
  a11y      role="searchbox", aria-label; result count announced through an aria-live="polite" line
  used on   S02, S04, S09, S15
```

```
Card: DesignCard
  variants  grid (thumbnail 4:3 box, contain-fit on surface; title + "Edited 2 h ago" below),
            list (48px thumbnail row)
  states    default, hover (shadow card + "…" IconButton appears), focus-visible (ring),
            selected (checkbox ticked, ring accent), loading (Skeleton), thumbnail missing (page-size
            placeholder in workspace colour), in trash (shows "Deletes in N days", muted)
  menu      Open, Rename, Make a copy, Move to folder, Move to Trash | Restore, Delete forever (Trash)
  tokens    radius lg, bg app, border border
  a11y      the whole card is one link to the editor; the "…" menu is a separate button so it is
            reachable by Tab; selection checkbox has its own label
  used on   S02, S05, S06, S07
```

```
Card: TemplateCard / AssetCard
  variants  template (thumbnail + title), asset (image only, square crop on surface)
  states    default, hover (shadow card), focus-visible, dragging (opacity .6, follows pointer),
            uploading (progress bar along the bottom), upload failed (danger icon + "Retry"),
            missing (purged image: placeholder pattern)
  behaviour click = add to the page centre; drag = drop at the pointer
  a11y      <button>; Enter adds to page; aria-label from title / file name
  used on   S04, S11, S12
```

```
TopBar (editor)
  layout    56px high (layout.topbar-h), bg app, border-bottom border
  left      Home IconButton, File menu (DropdownMenu), Resize button, Undo / Redo IconButtons
  centre    design title: click to rename inline (TextInput sm), Enter saves, Escape cancels
  right     SaveStatus, Share (Button primary sm)
  states    SaveStatus: "Saved" (muted, check icon) · "Saving…" (spinner) · "Reconnecting…" (warning)
            · "Not saved: retrying" (danger, Retry link) · "Changed in another tab" (danger, Reload)
  a11y      <header>; SaveStatus is aria-live="polite"; Undo/Redo disabled at the ends of the history
  used on   S08
```

```
SidePanelRail + SidePanel
  rail      72px wide (layout.rail-w), bg app; tabs: Design, Elements, Text, Uploads, Projects;
            each tab = 20px icon over text-xs label
  panel     360px (layout.panel-w), bg app, border-right border; slides 200ms; header with title +
            close IconButton; contextual panels (Color, Font, Effects, Position) replace the tab panel
            and show a "Back" arrow
  states    collapsed (rail only), open, contextual panel open, loading (Skeleton grid), empty, error
            ("Couldn't load. Try again" + Button)
  a11y      Radix Tabs in vertical orientation (↑/↓ between tabs); panel is the tabpanel; Escape
            closes a contextual panel and returns focus to the control that opened it
  used on   S08–S16
```

```
Canvas + Page
  layout    workspace fills the space between panel, top bar and bottom bar (bg workspace);
            the page is centred with shadow page; multi-page designs stack vertically, 32px apart,
            each with a small page label + page actions (duplicate, delete, add) above it
  states    loading design (page-size Skeleton), idle, panning (Space + drag, or middle mouse),
            zooming (Ctrl + wheel, pinch), fonts loading (text drawn after document.fonts.load)
  a11y      the <canvas> is aria-hidden; a visually hidden list mirrors the active page's elements
            ("Text: Summer sale", "Image", "Rectangle") so a keyboard user can Tab to an element and
            select it; selected element is announced through aria-live
  used on   S08
```

```
SelectionBox
  variants  single (8 handles + rotate handle 24px below the top edge), multi (one box around all,
            no rotate handle in v1), group (dashed outline around children on hover)
  states    hover outline (1px selection), selected (1.5px selection, white-filled 8px handles),
            resizing (live W×H badge, inverse), rotating (live angle badge), locked (handles hidden,
            small lock badge; click selects but drag does nothing), editing text (box stays, handles hide)
  keys      arrows nudge 1px, Shift+arrows 10px; Delete/Backspace deletes; Escape deselects / leaves
            a group; Shift while resizing keeps proportions (images keep them by default)
  tokens    selection colour, on-inverse on inverse for badges
  used on   S08
```

```
SmartGuides
  variants  edge alignment, centre alignment, page centre, equal spacing (with distance labels)
  states    shown only while dragging/resizing; snap distance 5 screen px; Alt (hold) disables snapping
  tokens    guide colour, 1px lines; distance labels text-xs on-inverse on guide
  a11y      visual only; keyboard users align with S13 Arrange buttons instead
  used on   S08
```

```
ContextToolbar (floating, under the TopBar)
  variants  text (font, size stepper, colour, B/I/U, align, list, spacing, Effects, Position, …),
            shape (fill, stroke, stroke width, corner radius, Position, …),
            image (Crop, Flip, Transparency, corner radius, Position, …),
            multi-select (Group, Align, Position, …), page (background colour)
  states    each control as IconButton/toggle; overflow "…" menu when the toolbar is too narrow
  a11y      role="toolbar" with roving tabindex (←/→ move between controls, Tab leaves the toolbar);
            F6 jumps between TopBar, toolbar, canvas and panel
  used on   S08
```

```
ContextMenu (right-click)
  variants  element (Copy, Paste, Duplicate, Delete, Lock, Group/Ungroup, Bring forward, Send backward,
            Align to page), page (Add page, Duplicate page, Delete page), empty canvas (Paste, Select all)
  states    open, item hover/focus, item disabled (e.g. Delete page when only one page is left), with
            shortcut hints right-aligned in muted
  a11y      Radix ContextMenu; also opens with Shift+F10 / the Menu key on the selected element
  used on   S08
```

```
ColorPicker / Swatch
  variants  swatch row (document colours, then a default set of 12), full picker (saturation square,
            hue slider, hex TextInput, "Add to document colours")
  states    swatch default, hover (scale 1.08), selected (2px ring fg + 2px gap), focus-visible;
            invalid hex (error on the input, colour not applied)
  a11y      swatches are radio buttons in a radiogroup with labels like "Blue #2F5BEA";
            the square has arrow-key control (Radix Slider in 2D is not available: ←/→ saturation,
            ↑/↓ brightness)
  used on   S14
```

```
FontPicker / FontRow
  layout    SearchInput, "Recently used" (max 5), then the curated list (~30 open-licence fonts)
  FontRow   40px, font name rendered in its own font; check icon when current
  states    default, hover, current, focus-visible, loading (row shows name in sans until the font
            file has loaded), no results
  a11y      listbox with ↑/↓ and type-ahead; Enter applies and returns focus to the toolbar
  used on   S15
```

```
Slider
  variants  transparency (0–100 %, shows number input next to it), effect amount, export scale (0.5–3×, steps)
  states    default, dragging, focus-visible, disabled
  tokens    track border, range accent, thumb app with border input + shadow card
  a11y      Radix Slider (arrow keys, PageUp/PageDown ±10, Home/End); aria-valuetext with the unit
  used on   S16, S20, ContextToolbar (transparency popover)
```

```
Tabs
  variants  underline (Projects: All / Designs / Folders / Uploads), segmented (Position: Arrange / Layers)
  states    active (text fg + 2px accent underline / bg app on surface track), inactive (text muted),
            hover (text fg), focus-visible
  a11y      Radix Tabs (←/→, Home/End)
  used on   S05, S13
```

```
LayerRow
  variants  element (thumbnail 32px + name), group (disclosure ▸ to expand its children)
  states    default, hover (surface-hover; shows lock / hide IconButtons), selected (bg accent-soft),
            locked (lock icon stays visible), dragging (shadow pop, drop line in accent), focus-visible
  behaviour top of the list = front of the page; drag to reorder; double-click renames
  a11y      list with aria-roledescription "layer"; Alt+↑/↓ moves the focused layer
  used on   S13
```

```
PageThumb
  variants  strip (in the BottomBar pages view, 64px tall), grid (S18, 4–6 per row)
  states    default, current (ring accent), hover (shows "…" menu), dragging (shadow pop, drop gap),
            focus-visible
  a11y      "Page 3 of 7" labels; Ctrl+↑/↓ moves the focused page; menu has Duplicate / Delete
            (Delete disabled when one page is left)
  used on   S08, S18
```

```
ZoomControl
  layout    in the BottomBar (40px): slider 10–400 %, percentage button (opens presets: Fit, 50, 100,
            200 %), grid-view IconButton, page counter "Page 2 / 5"
  keys      Ctrl+= / Ctrl+- zoom, Ctrl+0 fit
  a11y      slider aria-valuetext "125 percent"
  used on   S08
```

```
Popover / DropdownMenu
  variants  Create menu (S02/S03), Share (S19), File (S08), sort (S05), transparency, colour
  states    open (shadow pop, radius lg, 200ms fade+scale from 0.98), item hover/focus (surface-hover),
            item disabled, item with shortcut hint, item danger (text danger)
  a11y      Radix (focus moves into the menu, Escape closes and returns focus, arrows + type-ahead)
  used on   S03, S05, S08, S19
```

```
Modal / Dialog
  variants  form (Sign up / Log in, Rename, New folder, Resize), confirm (Delete forever, Delete account)
  sizes     sm 400px, md 560px
  states    open (scrim behind, shadow pop, radius lg), submitting (primary Button loading, inputs
            disabled), error (message at the top in danger, focus moves to it)
  confirm   danger dialogs name the thing ("Delete 'Summer flyer' forever?"); the danger button is not
            the default focus; account deletion requires typing DELETE
  a11y      Radix Dialog: focus trap, Escape closes (not while submitting), aria-labelledby the title
  used on   S01, S22, S23, delete confirms
```

```
Dropzone + UploadProgress
  states    idle ("Drop images here or" + Button "Upload files"), drag-over (dashed accent border,
            bg accent-soft), uploading (per-file row: name, progress bar accent, cancel ✕),
            error per file ("Too big: max 25 MB", "PNG, JPG or WebP only", "Upload failed" + Retry),
            quota reached (warning: "You've used your 200 MB")
  a11y      the Button is the keyboard path (opens the file dialog); progress is role="progressbar"
            with aria-valuenow; errors announced via aria-live
  used on   S11 (also: drop files anywhere on the canvas)
```

```
Toast
  variants  success, error, info, undo-able ("Moved to Trash · Undo")
  states    shown (bottom-centre, bg inverse, text on-inverse, radius md, shadow pop), auto-dismiss
            after 5 s (paused on hover/focus; errors stay until dismissed), dismissed
  a11y      Radix Toast: role="status" (errors: role="alert"); the Undo action is reachable with F8
  used on   all
```

```
Tooltip
  states    shown after 500 ms hover or on keyboard focus; hides on Escape
  tokens    bg inverse, text on-inverse, text-xs, radius sm
  a11y      Radix Tooltip; never the only place a label lives
  used on   all IconButtons
```

```
EmptyState
  variants  no designs (S02/S05: "Nothing here yet" + Button "Create a design"),
            no uploads (S11: "Your images will show up here" + Upload button),
            no results ("No matches for 'xyz'" + Clear search), trash empty, 404 / no access (S24:
            "This design doesn't exist or isn't yours" + Button "Back to Projects")
  layout    centred, max-width 360px, an icon from Lucide (no illustrations copied from anyone),
            text-lg title, text-sm muted body, one primary action
  used on   S02, S05, S07, S11, S24
```

```
Skeleton
  variants  card, row, panel grid, page
  states    loading (bg surface-hover with a 1.2 s shimmer; static under reduced motion)
  a11y      aria-hidden; the container gets aria-busy="true"
  used on   S02, S05, S08
```

```
Checkbox / Toggle
  variants  checkbox (card selection, "Transparent background", "Compress"), switch (settings)
  states    unchecked (border input), checked (bg accent, check on-accent), indeterminate, focus-visible,
            disabled; "Pro" lock does not exist in this app: everything is free
  a11y      Radix Checkbox / Switch with a visible label
  used on   S05, S20, S23
```

---

## Screen layouts at a glance

| screen | layout |
| --- | --- |
| S01 | centred Dialog (sm) on bg surface; app name above; email, password, primary Button, switch between "Sign up" and "Log in" |
| S02, S04, S05, S06, S07 | left sidebar 240px (Home, Projects, Templates, Trash) + content max 1280px; top row SearchInput + "Create a design" primary Button; responsive DesignCard grid (2 cols at 360px → 5 at 1280px) |
| S08–S22 | TopBar 56 · Rail 72 + Panel 360 · workspace with ContextToolbar floating 8px below the TopBar · BottomBar 40 |
| S23 | sidebar + single column form, max 560px |
| S24 | EmptyState centred |

## Step 4 (not done yet): primitives page

The skill builds these components once, in isolation, on a `/design` route, and screenshots it before any screen exists. That requires scaffolding `frontend/` (Vite, React, Tailwind, Radix, Lucide), which **needs your approval first**. See the plan in the chat.
