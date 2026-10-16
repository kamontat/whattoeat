# Mobile-first redesign — design

Date: 2026-10-15

## Goal

Redesign the whole site around how it is used: on a phone, often one-handed, deciding where
to eat. Keep every current feature and the data model; change the shell, the page layouts
and the visual system. Meet WCAG 2.2 level AA throughout, and AAA target size (44 × 44 CSS px)
for every control on touch screens, except filter chips at 36 px; with a mouse or trackpad,
controls use a compact 36 px size (still above the AA minimum of 24 px).

This replaces the "Rethink the phone header" item in `IDEAS.md`.

Approved mockups (phone, desktop, Tags, dark): the "Chosen" page of the design canvas at
<https://claude.ai/code/artifact/7cabd42f-544c-4073-8299-3dbb384f2604>. The "Directions A-C"
page keeps the three directions that were compared.

### What the user asked for

- A full redesign of the site with the current features, not only the header.
- Mobile first: phones are the main device.
- Careful accessibility to the W3C standard (WCAG).
- Anything else that makes it better that they did not think of.
- Layout and navigation from direction C ("This or That": compact grouped lists, iOS-style
  floating tab bar); colours from direction B ("Street Sign": paper, ink, chili red, sign yellow).
- No "or" badge between the two picks. Names stay as they are today.
- After the stage 1 preview: the first build felt too vivid, too large and odd. The user chose
  "Calm neutral" (Refine page of the canvas): neutral ground, white cards, chili red as the only
  accent, IBM Plex Sans Thai. This replaces direction B's colours and Anuphan.
- Language and theme live in Settings only (first in Settings and the wide top bar; the user
  removed them from the top bar after the preview).

### Assumptions

- No change to `src/lib/` data, storage keys or export format. This is UI only.
- Lit, Bun, the CSS reset, English and Thai, light, dark and auto themes all stay.
- All visible text keeps today's i18n strings; new keys only where a new control needs one.
- WCAG 2.2 AA is the bar; AAA where it costs little (target size, focus appearance).

## Audit of the current site (390 × 844, sample data)

| Area        | Finding                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Header      | Two rows on phones; five text links about 20 px tall; language and theme buttons about 32 px                |
| Home        | Filter panel fills the first screen; the main button sits mid-page; results appear below it, out of reach    |
| Restaurants | A nine-field form comes first; the list starts about 1000 px down                                            |
| Tags        | Every value has Rename, Move to… and Delete: about 40 buttons for 15 values, hard to scan                     |
| History     | Works; a long flat list of visits with a Delete button each                                                  |
| Settings    | Works; plain                                                                                                  |
| Contrast    | Text passes AA (4.8–7.8 : 1). `--color-border` is 1.3 : 1, so input and chip edges fail WCAG 1.4.11 (3 : 1)  |
| Focus       | No explicit focus style; relies on browser default, which is weak on the orange button                        |
| Missing     | Skip link, reduced-motion handling, safe-area insets, `theme-color`, web app manifest, 16 px inputs (iOS zoom) |

## Decisions

| Topic              | Decision                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Look               | Direction C's layout with the "Calm neutral" refinement: neutral ground, white cards, one red accent (see Visual system) |
| Font               | IBM Plex Sans Thai (SIL Open Font License), self-hosted woff2 in `src/assets/fonts/`, Thai and Latin, weights 400, 500, 600 |
| Phone navigation   | Tab bar attached to the bottom edge with four tabs: Home, Restaurants, History, Settings. Icon above a visible text label  |
| Tags page          | Stays its own route, reached by a "Tags" link on Restaurants and a back link to Restaurants. The Restaurants tab is current     |
| Wide screens       | From 48 rem (768 px): the four links move into a top bar beside the brand; no bottom bar                                       |
| Language and theme | In Settings only (Appearance group); not in the header at any width                                                    |
| Footer             | Source, changelog and build info move into an "About" section at the end of Settings; no footer on other pages                 |
| Home, phone        | Title, filter chips, the two picks stacked (no "or"), the pick button pinned above the tab bar                                 |
| Home, desktop      | Filter always open in a left panel; picks side by side; pick button beside the title                                           |
| Filter, phone      | Opens in a bottom sheet from the "Filter" chip; active values show as chips beside it                                          |
| Restaurants, phone | Compact grouped list, one row per restaurant; tapping a row opens the edit sheet; "Add" pinned above the tab bar               |
| Restaurants, desk  | List and edit panel side by side; a row fills the panel, Add empties it                                                         |
| Tags values        | Each value is one row with its count; tapping opens a sheet (desktop: right panel) with Rename, Move to… and Delete             |
| Custom group tools | A ⋯ button beside the group heading opens Rename, Move up, Move down and Delete                                                |
| History            | Visits grouped under day headings (Today, Yesterday, then dates) in grouped lists; stats table kept, restyled                  |
| Settings           | Grouped lists: Language and Theme segmented controls, Export, Import, Reset, About                                             |
| Sheets             | One shared `app-sheet` component on native `<dialog>` with `showModal()`                                                      |
| Confirmations      | Keep the current inline confirmation wording, now inside sheets or panels; no `window.confirm`                                  |
| Icons              | Inline SVG in `src/lib/icons.ts`, `aria-hidden="true"`, always next to visible text or with an accessible name                |
| Installable        | Web app manifest, `theme-color` and Apple meta tags so the site can be added to the home screen. Offline is out of scope       |
| Delivery           | One spec; one plan per stage, written when the stage starts; five pull requests stacked in order (see Delivery)               |

## Visual system

`src/styles/global.css` holds the tokens and the `@font-face` rules; `src/styles/ui.ts` the
shared component styles.

### Direction

Calm neutral (chosen on the canvas's Refine page after the first preview felt too vivid and too
large): a near-white neutral ground, white cards and grouped lists with hairline borders instead
of shadows, ink text, and chili red as the only accent: the main action per screen (Pick, Add,
Save), the current tab and included filter values. Secondary actions that matter, like Eat
here, use a soft red tint. Sentence-case labels, medium-weight rows, 28 px titles on phones.

### Tokens

| Token                  | Light     | Dark      | Use                                              | Contrast rule (tested)                 |
| ---------------------- | --------- | --------- | ------------------------------------------------ | -------------------------------------- |
| `--color-bg`           | `#f6f5f2` | `#161513` | Page ground, sheets                              |                                        |
| `--color-surface`      | `#ffffff` | `#1f1e1b` | Cards, grouped lists, bars                       |                                        |
| `--color-surface-2`    | `#efede8` | `#2a2825` | Plain chips, segmented track, selected row       |                                        |
| `--color-text`         | `#1d1b18` | `#f1efea` | Body text                                        | ≥ 4.5 : 1 on bg, surface, surface-2    |
| `--color-muted`        | `#6b665e` | `#a8a299` | Secondary text, counts, inactive tabs            | ≥ 4.5 : 1 on bg, surface, surface-2    |
| `--color-primary`      | `#c8321f` | `#ff6b55` | Main action fill, current tab, selected-row bar  | ≥ 4.5 : 1 on bg and surface            |
| `--color-primary-text` | `#ffffff` | `#161513` | Text on primary                                  | ≥ 4.5 : 1 on primary                   |
| `--color-primary-soft` | `#fbe9e6` | `#3a1f1a` | Soft actions (Eat here), current top-bar link    | link ≥ 4.5 : 1 on it                   |
| `--color-link`         | `#b42c1b` | `#ff8a77` | Links, text on primary-soft                      | ≥ 4.5 : 1 on bg, surface, surface-2    |
| `--color-control`      | `#8f8a80` | `#807a70` | Edges of inputs, chips, secondary buttons        | ≥ 3 : 1 on bg and surface (1.4.11)     |
| `--color-border`       | `#e6e3dc` | `#34312c` | Card and row hairlines, decorative lines only    | none                                   |
| `--color-danger`       | `#b42c1b` | `#ff8a77` | Destructive text and edges (same as link)        | ≥ 4.5 : 1 on bg, surface, surface-2    |
| `--color-focus`        | `#1d1b18` | `#f1efea` | Focus ring                                       | ≥ 3 : 1 on bg and surface              |
| `--color-success`      | `#2b6e35` | `#6fd08a` | "Going here" label, done messages                | ≥ 4.5 : 1 on bg, surface, surface-2    |

The yellow accent tokens are gone. Measured: lowest text pair 4.87 : 1 (light muted on
surface-2); primary on bg 4.9 : 1 (light) and 6.5 : 1 (dark); text on primary 5.3 : 1; link on
primary-soft 5.4 : 1; control edge 3.15–4.3 : 1; focus 14.5–17.2 : 1.
`tests/styles/palette.test.ts` checks every rule above in all three palette blocks.

Other tokens:

- Radius: `--radius-sm` 10 px (buttons, inputs, segmented), `--radius` 12 px (grouped lists,
  cards, panels), `--radius-lg` 20 px (sheets), `--radius-pill` for chips.
- Type: IBM Plex Sans Thai (400, 500, 600) with `"Noto Sans Thai", system-ui, sans-serif` as
  fallback, `font-display: swap`; 1 rem body (16 px, so iOS does not zoom inputs), line-height
  1.5; page titles `--title-size` semibold; group labels 0.8125 rem medium muted, sentence case.
- Touch: `--tap` 2.75 rem (44 px), the minimum block size of every button, link-button, row
  and input; chips are 2.25 rem (36 px), above the 24 px AA minimum (see Home).
- Density: `@media (hover: hover) and (pointer: fine)` (mouse, trackpad) switches to a compact
  set. Touch / compact: `--tap` 2.75 / 2.25 rem, `--pad-x` 1 / 0.875 rem, `--row-pad-y` 0.5 /
  0.375 rem, `--title-size` 1.75 / 1.5 rem, `--row-text` 1 / 0.9375 rem, `--seg-min` 3.25 /
  2.75 rem, `--bar-height` 4.75 / 3.75 rem, `--brand-size` 1.25 / 1.0625 rem. Keyed to the
  pointer, not the width, so tablets and touch laptops keep touch sizes.
- Motion: `--duration` 180 ms; 0 ms under `prefers-reduced-motion: reduce`.
- Elevation: hairline borders for cards and lists; one shadow for sheets.

### Shared styles (`uiStyles`)

- Buttons: `primary` (red fill), `soft` (primary-soft fill, link text), default (surface with a
  1px control edge), `danger` (link-coloured text and edge), `quiet`. Rounded corners
  (`--radius-sm`), `--tap` minimum height.
- Grouped list: `.group` container with `.item` rows, hairline border, divider between rows,
  optional leading icon, trailing count or chevron. Rows that act are real `<a>` or `<button>`
  elements filling the row.
- Group label: `.group-label` above a group, small medium-weight muted text in sentence case; a
  real heading element.
- Segmented control: native radio inputs in a `fieldset` on a light grey track; the selected
  segment is a white face with a 1px muted edge and a small shadow, its text semibold.
- Chips: plain (surface-2), included (primary-soft with a ✓ icon), excluded (dashed edge with a
  ✕ icon). State is never colour alone.
- Focus: `:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px }` on
  every interactive element, inside and outside shadow roots. Never `outline: none` without a
  replacement.
- Inputs: 48 px tall, 16 px text, control edge, label above, hint and error tied with
  `aria-describedby`, `aria-invalid` on error.
- `.visually-hidden`, `.warning`, `.error`, `.success` kept with new tokens.

## Shell

### `src/routes/*.html`

Every page gets:

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;
  never `maximum-scale` or `user-scalable=no` (WCAG 1.4.4).
- `<meta name="theme-color">` twice, one per `prefers-color-scheme`.
- No font preload: the fonts are inlined in the bundled CSS (see Font).
- `<link rel="manifest">`, `apple-touch-icon`, `apple-mobile-web-app-capable` and `-title`
  (stage 5).
- `<main id="main">` so the skip link has a target.
- No `<app-footer>` except inside the Settings page's About section.

`tests/routes/pages.test.ts` checks these on every page.

### `app-header`

One component, one `<header>`, one `<nav aria-label="Main">` with four links:

- Skip link first: "Skip to content", visually hidden until focused, jumps to `#main`.
- Phones (< 48 rem): no top bar; each page shows its own title. The `<nav>` is a white bar
  attached to the bottom edge with a hairline top border and `env(safe-area-inset-bottom)`
  padding: four equal tabs, each a link with an icon and a text label. The current tab has
  `aria-current="page"`, red icon and label, and a short red bar on its top edge (so colour is
  not the only cue).
- Wide (≥ 48 rem): a top bar (`--bar-height`) on the surface colour with the logo and "What to
  Eat" on the left and the four links on the right, the current one in red on a primary-soft
  tint.
- The header has no language or theme switches at any width; they are in Settings.
- Pages pad their bottom by the tab bar height (phones) so nothing hides behind it.
- `current` takes `home | restaurants | tags | history | settings`; `tags` marks Restaurants.
- Keeps setting `document.title` per page.

### Pinned action

Home ("What should I eat?" / "Pick again", a full-width red button) and Restaurants ("Add",
a red button at the right) pin their main action just above the tab bar on phones, inside the
page component (`position: sticky`). On wide screens the action sits in the page heading row.
A page with a pinned action marks its `<html>` with `has-pinned` (`src/routes/index.html`
only, so far); `global.css` keys `--pinned-space` (4.5 rem on phones, 0 past 48rem) off that
class and folds it into `scroll-padding-bottom` alongside `--tab-bar-space`, so a focused
control never ends up hidden behind the pinned bar.

### `app-sheet` (new, `src/components/app-sheet.ts`)

A modal sheet for the phone filter, the restaurant form and the tag actions.

- Built on `<dialog>` and `showModal()`: focus moves into it, the page behind is inert, Esc closes.
- Properties: `heading` (string), `subheading` (optional string), `open` (boolean). Slots:
  default (body), `footer` (actions).
- Title is an `<h2>` referenced by `aria-labelledby`; a round Close button (icon with the
  accessible name "Close") in the header; a decorative grabber.
- Slides up from the bottom, full width, rounded top corners, up to 90 dvh, body scrolls,
  footer pinned. Centred, max 32 rem, on wide screens when a page still uses it. No slide
  under reduced motion.
- Closing (button, Esc, backdrop tap) fires `sheet-close`; focus returns to the element that
  opened it.
- Tested in `tests/components/app-sheet.test.ts`: opens with `showModal`, labels, close event,
  focus return. If happy-dom lacks `showModal`, the test stubs it.

## Pages

### Home (`random-picker`)

Phone, top to bottom:

1. `<h1>` "What to Eat" (now visible) with the count line ("3 of 5 restaurants match" /
   "5 restaurants") under it; storage warnings.
2. Filter row: a "Filter" chip button (funnel icon) that opens the filter sheet, then one chip
   per active value (included or excluded style), each a `<button>` that also opens the sheet.
3. Results: before the first pick, nothing but the pinned button (the title and count say
   enough). After a pick, two white tiles stacked with 12 px between them: name (20 px
   semibold), meta line (muted), location with a pin icon (link if a URL), notes, small tags,
   and a soft red **Eat here** button. The visited state keeps today's "✓ Going here · {time}" label.
4. Pinned button: "What should I eat?", then "Pick again"; disabled when nothing matches, with
   the existing "No restaurant matches this filter." text shown above it.

Filter sheet: title "Filter", the existing hint, one group per filter row (group label +
chips at 36 px, above the 24 px WCAG AA minimum), **Clear** (a 36 px quiet button) in the
sheet content and **Done** in the footer. Behaviour unchanged (`cycleTag`).

Desktop (≥ 48 rem): `main.wide` (65 rem) provides room for two columns. The filter uses
`MediaController` (src/lib/media.ts), so only one component instance renders and switches
layout. Left, a side panel with the filter content; Clear sits as a 36 px quiet button after
the active-filter sentence, wrapping as a flex row. A **Hide** button in the panel heading
(`aria-expanded`, named "Hide filter") collapses it: the picks take the full width and a
"Filter" button (with the active count) appears beside the pick button to bring it back; focus
stays on the toggle. The choice is remembered in `whattoeat:filter-panel` (`src/lib/panel.ts`).
Right, the title row with the pick button at its end, then the two tiles side by side (one
column until 60 rem, where there is room for two).

On phones the page uses the visible screen height (`100dvh`, since iOS's `100vh` includes the
hidden toolbar), the tab bar has one exact height (`--tab-bar-height`) that the pinned button
sits on, and `touch-action: manipulation` stops a quick second tap on a chip from zooming
(pinch zoom still works).

The live region announces the new picks by name ("Picked Som Tam Nua and Jay Fai") instead
of re-reading both tiles. Focus stays on the pick button. With no restaurants, the empty
state keeps its text and link to Restaurants, styled as a button.

### Restaurants (`restaurant-manager`)

Phone:

1. Title "Restaurants" with "5 restaurants" under it, and a "Tags" pill link at the right.
2. Storage warnings.
3. One grouped list, A–Z: each row is a link-styled button showing only the name and a
   one-line meta (type); location, notes and chips are in the form. The chevron is included.
   Its accessible name is "Edit <name>" plus the meta line as description.
4. Pinned **Add** button (uses `html.has-pinned` scroll room).
5. Empty list: today's empty text with the Add button.

Form sheet (heading "New restaurant" or "Edit <name>"): today's fields, `tag-input`s and
validation; footer **Delete** (edit only) and **Save**. Delete sits at the end of the edit
form footer and shows today's inline confirmation, naming the restaurant, in the sheet; focus
moves to the confirm button as now. Saving or deleting closes the sheet and returns focus to
the row (or the Add button, or the title after a delete). Closing the sheet discards unsaved
edits. A `role="status"` message confirms "Saved <name>" / "Deleted <name>".

Desktop: the title row holds Tags and Add. Below, list and panel side by side (equal
columns). The selected row gets `aria-current="true"`, the surface-2 fill and a chili bar on
its start edge. The panel holds the same form (switched by `MediaController`), Cuisine and
Area side by side, and Delete, Cancel and Save in its footer. No sheet on desktop.

### Tags (`tag-manager`)

Phone:

1. Back link "‹ Restaurants", title "Tags", today's intro text, storage warnings.
2. One grouped list per group, under its group label: Type, Cuisine, Area, custom groups in
   their order, then Tags (plain tags). Rows show the value and its count ("2 restaurants").
   Type rows are plain text (no chevron, not focusable); every other row opens the value
   sheet. A group with no values shows today's "No values yet." row.
3. Custom groups add a ⋯ icon button beside their label, named "<group> options".
4. **Add a group** button at the end, opening a sheet with today's name field and Add.

Value sheet (heading the value, subheading "<group> · <count>"): rows Rename, Move to…
(subtitle "Another group") and Delete (danger). Each switches the sheet body to today's form
or confirmation: rename field with the merge prompt when the name exists, the move select,
the delete prompt.

Group sheet (heading the group): Rename, Move <group> up, Move <group> down, Delete. A move
that is not possible stays visible but disabled (`aria-disabled="true"`) with a reason
("Already the first group" / "Already the last group"). Delete shows today's prompt.

Desktop: back link, title and intro with Add a group at the right; groups on the left; the
selected value's Rename (field + Save), Move (select + Move) and Delete on the right panel,
with the same prompts. Group options stay a sheet.

### History (`visit-history`)

No mockup; it follows the same vocabulary.

1. Title "History" (keeps `tabindex="-1"` for the focus moves it already does).
2. Stats: total line and the table (Restaurant, Times, Last time) on a surface card, in a
   horizontally scrollable region with `tabindex="0"`, a label and a `<caption>`.
3. Visits grouped by local day under group labels "Today", "Yesterday" or the formatted
   date; each visit a row with name and time and a Delete icon button named "Delete visit to
   <name> at <time>". The inline confirmation stays, inside the row.
4. Clear history last: its range buttons in a wrapping row, confirmation unchanged.

Desktop: centred column, 640 px.

### Settings (`data-transfer` + new `app-preferences`)

Grouped lists in one column (desktop: centred, 640 px):

1. Appearance group (new `app-preferences` component): Language (EN / ไทย) and Theme (Auto /
   Light / Dark) rows, each a `fieldset` with a visually hidden `legend` matching the row
   label and native radio inputs styled as a segmented control. "ไทย" carries `lang="th"`.
   Uses `setLang` and `setTheme`.
2. Export: rows "Download JSON" (with "Restaurants saved: 5" under it) and "Copy JSON".
3. Import: rows "Choose a JSON file" (a label for the native file input, which stays
   focusable) and "Or paste JSON" (reveals the textarea and Check). The found / replace /
   merge flow is unchanged.
4. Reset: row "Delete all data" in danger colour; today's confirmation.
5. About: `<app-footer>` content (source, changelog, build) as rows.

## Accessibility checklist (WCAG 2.2 AA)

Applied to every page and checked in each pull request's test plan:

- 1.3.1: landmarks (`header`, `nav`, `main`), one `<h1>` per page, headings in order (group
  labels are `<h2>`), lists as `<ul>`, form fields with `<label>`, radio groups in
  `fieldset`/`legend`.
- 1.4.3 / 1.4.11: contrast rules above, tested.
- 1.4.4 / 1.4.10 / 1.4.12: zoom allowed; no horizontal scroll at 320 px except the stats table
  region; text spacing overrides do not clip (no fixed heights on text containers).
- 2.1.1 / 2.1.2: everything works by keyboard; sheets trap focus only while open; Esc closes.
- 2.4.1: skip link. 2.4.3: focus returns after sheets and confirmations. 2.4.7 / 2.4.11 /
  2.4.13: visible 3 px focus ring never hidden under the pinned button or tab bar
  (`scroll-padding-bottom` on `html` equal to their height).
- 2.5.3: visible label text is part of every accessible name. 2.5.8: targets ≥ 44 px on
  touch (chips 36 px), ≥ 36 px with a fine pointer; all above the 24 px AA minimum.
- 3.1.1 / 3.1.2: `<html lang>` follows the language (already done); mixed-language labels marked.
- 3.3.1 / 3.3.2: errors in text, tied to their field.
- 4.1.2 / 4.1.3: states via `aria-pressed`, `aria-current`, `aria-disabled`, checked radios;
  status messages in `role="status"` / `role="alert"`.
- `prefers-reduced-motion` removes slides and transitions; `forced-colors: active` keeps
  edges, focus and the current-tab and selected-row markers visible.

Manual checks on each preview: VoiceOver on iOS Safari through the main flow (pick, eat here,
add, edit, filter, tags), keyboard only on desktop, 200 % zoom, 320 px width, both themes, Thai.

## Font

- IBM Plex Sans Thai has one file per script and weight. Regular, medium and semibold (400,
  500, 600) in Thai and Latin are committed under `src/assets/fonts/` with the OFL licence file:
  six files, about 65 KB. Bold text uses 600.
- `@font-face` in `global.css` per file, with its `unicode-range` and `font-display: swap`.
  Shadow roots inherit `font-family` from `:root`.
- Checked on 2026-10-15: `bun-server build` inlines fonts referenced from `global.css` as
  base64 data URIs in the bundled CSS (about 93 KB of CSS with the six fonts, before compression). That costs no extra
  request and keeps the fonts available offline, so no preload and no static copy are needed.
  Serving them as statics does not work: Bun refuses a CSS `url()` it cannot resolve.

## Installable app

- `src/assets/manifest.webmanifest`: name, short name, `start_url: "./"`, `display:
  "standalone"`, theme and background colours, icons (SVG plus 192 and 512 PNG, maskable).
- PNG icons generated once from `favicon.svg` and committed.
- Stage 5 first checks how `bun-server build` handles a linked `.webmanifest` and PNG icons;
  if they are not emitted, the `build-and-deploy` skill covers adding them with `--statics`.
- Offline support (a service worker) is left as a new item in `IDEAS.md`.

## i18n

New keys in both languages: skip link, "Done", sheet "Close", "Edit {name}", "Saved {name}",
"Deleted {name}", "{group} options", "Already the first group", "Already the last group",
"Another group", "Picked {a} and {b}", "Today", "Yesterday", "Appearance", "About",
"Delete visit to {name} at {time}". `tests/lib/i18n.test.ts` already checks both languages
have the same keys. Keys no longer used are removed.

## Testing

- Existing component tests are updated, not deleted: they select by `data-action`, which is
  kept on every control that keeps its job. Flows that moved into sheets open the sheet first.
- New tests: `app-sheet`, `app-preferences`, header (four links, `aria-current`, Tags marks
  Restaurants, switches present), skip link, page meta tags, palette rules, history day
  grouping, pick announcement text, restaurant row accessible names, disabled group moves.
- happy-dom cannot compute layout, breakpoints or colour on screen: sizes, sticky bars,
  desktop columns and overlap are preview checks in each pull request.

## Delivery

Stacked pull requests, each green and deployable on its own:

1. **Foundation and shell**: tokens, IBM Plex Sans Thai, `uiStyles`, focus, palette tests, page meta, skip
   link, phone tab bar and desktop top bar, `app-sheet`, Settings
   (Appearance, grouped lists, About), footer removed from other pages.
2. **Home**: title and filter row, filter sheet, desktop filter panel, tiles, pinned button,
   announcement.
3. **Restaurants**: grouped list, form sheet, desktop list and panel.
4. **Tags and History**: value and group sheets, desktop panel; day-grouped visits.
5. **Installable**: manifest, icons, Apple meta; `IDEAS.md` offline item; README updates.

## Out of scope

- New features (search, sorting, weighted random, sync).
- Offline caching.
- Changes to `src/lib/` beyond what a view needs (for example a pure "group visits by day"
  helper, which goes in `src/lib/history.ts` with tests).
