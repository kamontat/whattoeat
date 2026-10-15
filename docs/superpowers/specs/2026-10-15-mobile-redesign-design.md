# Mobile-first redesign — design

Date: 2026-10-15

## Goal

Redesign the whole site around how it is used: on a phone, often one-handed, deciding where
to eat. Keep every current feature and the data model; change the shell, the page layouts
and the visual system. Meet WCAG 2.2 level AA throughout, and AAA target size (44 × 44 CSS px)
for every control.

This replaces the "Rethink the phone header" item in `IDEAS.md`.

### What the user asked for

- A full redesign of the site with the current features, not only the header.
- Mobile first: phones are the main device.
- Careful accessibility to the W3C standard (WCAG).
- Anything else that makes it better that they did not think of.

### Assumptions (open to correction)

- No change to `src/lib/` data, storage keys or export format. This is UI only.
- Lit, Bun, the CSS reset, English and Thai, light, dark and auto themes all stay.
- No web fonts: the system stack already covers Thai, and nothing is fetched from a third party.
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

| Topic              | Decision                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Phone navigation   | Fixed bottom tab bar with four tabs: Pick, Restaurants, History, Settings. Icon above a visible text label            |
| Tags page          | Stays its own route; reached by a "Manage tags" link on Restaurants. The Restaurants tab is current on the Tags page  |
| Wide screens       | From 48 rem: the same nav moves into a top bar beside the brand; no bottom bar                                         |
| Language and theme | Move from the header into an "Appearance" section on Settings, as native radio groups styled as segmented controls     |
| Footer             | Source, changelog and build info move into an "About" section at the end of Settings; no footer on other pages         |
| Home layout        | Results on top, filter summary below, the pick button pinned above the tab bar                                         |
| Filter             | Opens in a bottom sheet; the home page shows a one-line summary with the active count                                 |
| Restaurants        | List first. "Add restaurant" and "Edit" open the form in a sheet; Delete moves into the edit sheet                     |
| Tags values        | Each value is one row button ("thai · 2 restaurants"); it opens a sheet with Rename, Move and Delete                    |
| Custom group tools | A "Group options" button on the group heading opens a sheet with Rename, Move up/down and Delete                       |
| History            | Visits grouped under day headings (Today, Yesterday, then dates); stats table kept, restyled                           |
| Sheets             | One shared `app-sheet` component on native `<dialog>` with `showModal()`                                              |
| Confirmations      | Keep the current inline "Are you sure?" pattern, now inside sheets; no `window.confirm`                                 |
| Icons              | Inline SVG in `src/lib/icons.ts`, `aria-hidden="true"`, always next to visible text or with an accessible name        |
| Installable        | Web app manifest, `theme-color` and Apple meta tags so the site can be added to the home screen. Offline is out of scope |
| Delivery           | One spec and plan, five pull requests stacked in order (see Delivery)                                                  |

## Visual system

`src/styles/global.css` holds the tokens; `src/styles/ui.ts` the shared component styles.

### Direction

Warm, food-market feel, kept from the current palette: cream ground, deep chili orange for the
one primary action per screen, ink-brown text. Bigger type, generous spacing, rounded cards.
The picked results get the visual weight on Home; everything else is quieter.

### Tokens

Colour, both themes (light values shown; dark keep today's hues, tuned to the same ratios):

| Token                  | Use                                       | Contrast rule (tested)                       |
| ---------------------- | ----------------------------------------- | -------------------------------------------- |
| `--color-bg`           | Page ground                               |                                              |
| `--color-surface`      | Cards, sheets, bars                       |                                              |
| `--color-surface-2`    | Chips, pressed rows, table header         |                                              |
| `--color-text`         | Body text                                 | ≥ 7 : 1 on bg and surface                    |
| `--color-muted`        | Secondary text                            | ≥ 4.5 : 1 on bg, surface and surface-2       |
| `--color-primary`      | Primary button, current tab, links        | ≥ 4.5 : 1 on bg and surface                  |
| `--color-primary-text` | Text on primary                           | ≥ 4.5 : 1 on primary                         |
| `--color-primary-soft` | Selected chip background                  | text on it ≥ 4.5 : 1                         |
| `--color-border`       | Decorative dividers only                  | none                                         |
| `--color-control`      | Edges of inputs, chips, secondary buttons | ≥ 3 : 1 on bg and surface (WCAG 1.4.11)      |
| `--color-focus`        | Focus ring                                | ≥ 3 : 1 on bg, surface and primary           |
| `--color-danger`       | Destructive buttons, errors               | ≥ 4.5 : 1 on bg and surface                  |
| `--color-success`      | Visited, done messages                    | ≥ 4.5 : 1 on bg and surface                  |

`tests/styles/palette.test.ts` grows to check every rule above in all three palette blocks.

Other tokens:

- Space: `--space-1` … `--space-8` on a 4 px base (0.25 rem steps up to 3 rem).
- Radius: `--radius-sm` 8 px, `--radius` 12 px, `--radius-lg` 20 px (sheets, result cards), `--radius-pill`.
- Type: 1 rem body (16 px, so iOS does not zoom inputs), line-height 1.6 for Thai tone marks;
  headings on a `clamp()` scale; `--font` stays the system stack with Thai fallbacks.
- Touch: `--tap` 2.75 rem (44 px), the minimum block size of every button, link-button, chip and input.
- Motion: `--duration` 180 ms; set to 0 ms under `prefers-reduced-motion: reduce`.
- Elevation: one shadow for sheets and the pinned bars.

### Shared styles (`uiStyles`)

- Buttons: `primary`, default (outlined with `--color-control`), `danger`, `quiet` (text only,
  still 44 px tall). Full-width variant `block`.
- Focus: `:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px }` on
  every interactive element, inside and outside shadow roots. Never `outline: none` without a
  replacement.
- Inputs and selects: 44 px tall, 16 px text, `--color-control` edge, visible label above,
  hint and error tied with `aria-describedby`, `aria-invalid` on error.
- Chips: 44 px tall hit area (visual pill may be 36 px with padding making up the rest), state
  shown by symbol and colour, never colour alone.
- `.visually-hidden`, `.card`, `.actions`, `.warning`, `.error`, `.success` kept with new tokens.

## Shell

### `src/routes/*.html`

Every page gets:

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;
  never `maximum-scale` or `user-scalable=no` (WCAG 1.4.4).
- `<meta name="theme-color">` twice, one per `prefers-color-scheme`.
- `<link rel="manifest">`, `apple-touch-icon`, `apple-mobile-web-app-capable` and `-title`.
- `<main id="main">` so the skip link has a target.
- No `<app-footer>` except on Settings (inside the page component's About section).

`tests/routes/pages.test.ts` checks these on every page.

### `app-header`

One component, one `<header>` with brand and one `<nav aria-label="Main">`:

- Skip link first: "Skip to content", visually hidden until focused, jumps to `#main`.
- Phones (< 48 rem): a slim top bar with the brand mark and name. The `<nav>` is fixed to the
  bottom of the viewport, four equal tabs, each a link with an icon and a text label, at least
  56 px tall plus `env(safe-area-inset-bottom)`. The current tab has `aria-current="page"`, the
  primary colour, a filled icon and a top indicator bar (not colour alone).
- Wide (≥ 48 rem): brand left, the four links inline right, same `aria-current` styling.
- Pages pad their bottom by the tab bar height so nothing hides behind it.
- `current` takes `home | restaurants | tags | history | settings`; `tags` marks the Restaurants tab.
- Keeps setting `document.title` per page.

### Pinned action bar

Home ("What should I eat?") and Restaurants ("Add restaurant") pin their main action just
above the tab bar on phones, inside the page component, `position: sticky; bottom:` the tab
bar height. On wide screens it is a normal in-flow button.

### `app-sheet` (new, `src/components/app-sheet.ts`)

A modal sheet for the filter, the restaurant form and the tag actions.

- Built on `<dialog>` and `showModal()`: focus moves into it, the page behind is inert, Esc closes.
- Properties: `heading` (string), `open` (boolean). Slots: default (body), `footer` (actions).
- Title is an `<h2>` referenced by `aria-labelledby`; a Close button (icon + accessible name)
  in the header.
- Phones: slides up from the bottom, full width, up to 90 dvh, body scrolls, footer pinned.
  Wide: centred, max 32 rem. No slide when reduced motion is set.
- Closing (button, Esc, backdrop tap) fires `sheet-close`; focus returns to the element that
  opened it.
- Tested in `tests/components/app-sheet.test.ts`: opens with `showModal`, labels, close event,
  focus return. happy-dom's `<dialog>` support is checked first; if it lacks `showModal`, the
  test stubs it.

## Pages

### Home (`random-picker`)

Top to bottom on a phone:

1. Visually hidden `<h1>` (kept) and storage warnings.
2. **Results.** Before the first pick: a friendly prompt card ("Two picks are waiting. Tap the
   button.") with the count of restaurants in play. After a pick: the two result cards,
   stacked, large name, meta line, location (link if a URL), notes, chips, and a full-width
   **Eat here** button. The visited state keeps its text label and success colour.
3. **Filter summary.** One row: "Filter" button with the active count as text ("Filter · 2
   on"), the human summary of active values, and "Clear" when active. The button opens the
   filter sheet.
4. **Pinned bar.** Count text ("4 of 5 restaurants") and the big primary button ("What should
   I eat?" / "Pick again"), disabled with a reason when nothing matches.

Filter sheet: the current group rows and tri-state chips, unchanged in behaviour (`cycleTag`),
with chips at 44 px, the hint at the top, and Clear and Done in the sheet footer.

The live region announces the new picks by name ("Picked Som Tam Nua and Jay Fai") instead of
re-reading both cards. Focus stays on the pick button. Empty state (no restaurants) keeps its
link to Restaurants, now a primary button-styled link.

### Restaurants (`restaurant-manager`)

1. `<h1>` "Restaurants" with the count, and a "Manage tags" link to `/tags`.
2. Storage warnings.
3. **List**, A–Z as now. Each row is a card: name, meta line, location, notes (two lines,
   clamped visually; full text in the edit sheet), chips, and one **Edit** button whose
   accessible name includes the restaurant name ("Edit Jay Fai").
4. Pinned **Add restaurant** button.
5. Empty list: a prompt card with the same Add button.

**Form sheet** (`heading` "Add restaurant" or "Edit <name>"): the current form fields and
`tag-input`s unchanged in behaviour and validation; Save in the sheet footer. In edit mode, a
**Delete restaurant** button at the end of the body opens the existing inline confirmation
(focus moves to the confirm button, as now). Saving or deleting closes the sheet and returns
focus to the row's Edit button (or the Add button, or the list heading after a delete). A
`role="status"` message confirms "Saved Jay Fai" / "Deleted Jay Fai".

### Tags (`tag-manager`)

1. `<h1>` "Tags", the intro text, storage warnings.
2. One section per group (Type, Cuisine, Area, custom groups, Plain tags), each with an `<h2>`.
   Custom groups add a **Group options** button beside the heading.
3. Values as a list of row buttons: value, count ("2 restaurants"), and a chevron. Type values
   stay read-only text rows (no button).
4. A **Add a group** button at the end opens a sheet with the name field.

**Value sheet** (`heading` the value): three actions, Rename, Move to another group, Delete,
each switching the sheet body to its existing form or confirmation (including the merge
prompt). Errors and confirmations keep their current text and `role="alert"`.

**Group sheet**: Rename, Move up, Move down (disabled at the ends, with the reason as text),
Delete with confirmation.

### History (`visit-history`)

1. `<h1>` "History" (keeps `tabindex="-1"` for the focus moves it already does).
2. **Stats**: total line and the table (Restaurant, Times, Last time), in a horizontally
   scrollable region with `tabindex="0"`, a label and a `<caption>`, so it reflows at 320 px.
3. **Visits** grouped by local day: `<h3>` "Today", "Yesterday", or the formatted date; each
   visit a row with name and time and a **Delete** button named "Delete visit to <name> at
   <time>". The inline confirmation stays.
4. **Clear history** last, its range buttons in a wrapping row, confirmation unchanged.

### Settings (`data-transfer` + new `app-preferences`)

Sections, each a card with an `<h2>`:

1. **Appearance** (new `app-preferences` component): Language (English / ไทย) and Theme
   (Auto / Light / Dark) as `<fieldset>` + `<legend>` + native radio inputs styled as
   segmented controls. Uses `setLang` and `setTheme` as the header does today; labels shown
   in text, not icons only. The language option labels are written in their own language and
   carry `lang="en"` / `lang="th"`.
2. **Export**, **Import**: unchanged behaviour. The file input gets a styled button-looking
   label that keeps the native input focusable.
3. **Reset**: unchanged, styled as a danger zone.
4. **About**: `<app-footer>` content (source, changelog, build).

## Accessibility checklist (WCAG 2.2 AA)

Applied to every page and checked in each pull request's test plan:

- 1.3.1: landmarks (`header`, `nav`, `main`), one `<h1>` per page, headings in order, lists as
  `<ul>`, form fields with `<label>`, groups with `fieldset`/`legend` or `role="group"` + label.
- 1.4.3 / 1.4.11: contrast rules above, tested.
- 1.4.4 / 1.4.10 / 1.4.12: zoom allowed; no horizontal scroll at 320 px except the stats table
  region; text spacing overrides do not clip (no fixed heights on text containers).
- 2.1.1 / 2.1.2: everything works by keyboard; sheets trap focus only while open; Esc closes.
- 2.4.1: skip link. 2.4.3: focus returns after sheets and confirmations. 2.4.7 / 2.4.11 /
  2.4.13: visible 3 px focus ring never hidden under the pinned bars (`scroll-padding-bottom`
  on `html` equal to the bars' height).
- 2.5.3: visible label text is part of every accessible name. 2.5.8: targets ≥ 44 px.
- 3.1.1 / 3.1.2: `<html lang>` follows the language (already done); mixed-language labels marked.
- 3.3.1 / 3.3.2: errors in text, tied to their field.
- 4.1.2 / 4.1.3: states via `aria-pressed`, `aria-current`, `aria-expanded`; status messages in
  `role="status"` / `role="alert"`.
- `prefers-reduced-motion` removes slides and transitions; `forced-colors: active` keeps
  borders, focus and the current-tab indicator visible (use `CanvasText`/`Highlight` where
  colour carried meaning).

Manual checks on each preview: VoiceOver on iOS Safari through the main flow (pick, eat here,
add, edit, filter), keyboard only on desktop, 200 % zoom, 320 px width, both themes, Thai.

## Installable app

- `src/assets/manifest.webmanifest`: name, short name, `start_url: "./"`, `display:
  "standalone"`, theme and background colours, icons (SVG plus 192 and 512 PNG,
  maskable).
- PNG icons generated once from `favicon.svg` and committed (a small script under `scripts/`
  if the build cannot do it).
- First step of that stage is to confirm `bun-server build` copies a linked `.webmanifest`
  and PNGs to `dist/` with correct paths; if not, follow `adding-a-page` / `build-and-deploy`
  skills to add them as statics.
- Offline support (a service worker) is left as a new item in `IDEAS.md`.

## i18n

New keys in both languages: skip link, tab labels (Pick), "Manage tags", "Add restaurant",
"Edit {name}", "Delete restaurant", "Saved {name}", "Deleted {name}", sheet Close, "Done",
"Group options", "Move up", "Move down", "Filter · {count} on", "Picked {a} and {b}", "Today",
"Yesterday", "Appearance", "About", the empty-results prompt. `tests/lib/i18n.test.ts`
already checks both languages have the same keys. Keys no longer used are removed.

## Testing

- Existing component tests are updated, not deleted: they select by `data-action`, which is
  kept on every control that keeps its job. Flows that moved into sheets open the sheet first.
- New tests: `app-sheet`, `app-preferences`, tab bar (`aria-current`, Tags marks Restaurants,
  four links), skip link, page meta tags, palette rules, history day grouping, pick
  announcement text, Edit button accessible names.
- happy-dom cannot compute layout or colour on screen: sizes, sticky bars and overlap are
  preview checks in each pull request.

## Delivery

Stacked pull requests, each green and deployable on its own:

1. **Foundation and shell**: tokens, `uiStyles`, focus, palette tests, page meta, skip link,
   bottom tab bar, `app-sheet`, Settings Appearance and About, footer removed from other pages.
2. **Home**: results-first layout, filter sheet, pinned pick bar, announcement.
3. **Restaurants**: list first, form sheet, delete in sheet.
4. **Tags and History**: value and group sheets; day-grouped visits; stats table region.
5. **Installable**: manifest, icons, Apple meta; `IDEAS.md` offline item; README updates.

## Out of scope

- New features (search, sorting, weighted random, sync).
- Offline caching.
- Web fonts.
- Changes to `src/lib/` beyond what a view needs (for example a pure "group visits by day"
  helper, which goes in `src/lib/history.ts` with tests).
