# Changelog

What changed in this project and why, newest first.

## 2026-10-16: Paste JSON in one tap, and restaurants can share a name

### Improvements

- Two restaurants can have the same name. The form no longer shows "A restaurant with this
  name already exists." when adding or editing; a blank name is still refused.
- Import keeps every restaurant name as it is in the file, instead of adding a ` - <n>` suffix
  to names that repeat in the file or are already saved.

- Settings > Import: "Paste JSON" is one row that reads the clipboard and checks the export
  at once. The text box and Check only open when the browser blocks the clipboard, has none,
  or the clipboard is empty.
- An import, from a file or the clipboard, is saved straight away when no restaurants,
  history or groups are saved yet, instead of asking to replace or merge.

### Decisions

- With nothing saved there is nothing to lose, so the Replace or Merge question is only
  asked when restaurants, history or groups already exist.

## 2026-10-16: TODO list replaces ideas list

### Improvements

- `IDEAS.md` is now `TODO.md`, and the README links point to it.
- `TODO.md` lists five more planned features: a location that only accepts a link (making the
  restaurant name clickable on the random result and the restaurant list), an iOS-style
  floating tab bar on phones, filtering by tags, filtering by buffet, and search on the
  restaurant and tag lists.

## 2026-10-16: Mobile redesign, stage 1: calm look, tab bar and grouped Settings, stage 2: Home, and stage 3: Restaurants

### Features

- A tab bar for Home, Restaurants, History and Settings sits along the bottom edge on phones;
  from 768px wide the same four links move into a top bar beside the logo. The current tab
  shows in red with a short bar on its top edge.
- A "Skip to content" link is the first thing a keyboard reaches on every page.
- Settings is a set of grouped lists: Appearance (language and theme as segmented controls),
  Export, Import, Reset and About (source, changelog and build, moved from the old footer).
- Two components for the next stages: `app-sheet`, a bottom sheet on `<dialog>` that returns
  focus to what opened it, and `app-preferences`, language and theme as native radio groups.
- Home (stage 2) on phones: a Filter button with the active count and the active values as
  chips beside it; either opens the filter in a bottom sheet with Done. The pick button stays at
  the bottom, just above the tab bar.
- Home from 768px: the filter is a side panel and the pick button sits beside the title. A
  Hide button collapses the panel and a Filter button brings it back; the choice is kept in
  `whattoeat:filter-panel`.
- Screen readers hear "Picked A and B" on every pick, instead of both result cards being read
  again.
- Restaurants (stage 3) on phones: a pinned Add button and rows you tap to edit; the form opens
  in a bottom sheet titled "New restaurant" or "Edit {name}", with Save and Cancel kept at its
  bottom. From 768px the list and the form sit side by side and the selected row is marked.
- "Saved {name}" and "Deleted {name}" confirm every change on Restaurants and are read out each
  time.

### Improvements

- A calm, neutral look: an off-white page, white cards with hairline borders, chili red as
  the only accent, sentence-case labels and the IBM Plex Sans Thai font, bundled into the CSS
  so it loads with the page and works offline.
- Every control is at least 44px tall on touch screens; with a mouse or trackpad the layout
  switches to a compact 36px size, still above the WCAG minimum of 24px.
- Every colour pair is tested for WCAG AA contrast in light and dark, including input and
  chip edges at 3:1, and every control shows a 3px focus ring.
- Language and theme moved from the header into Settings. Tags is reached from a "Tags" link
  on Restaurants instead of its own header link, and the Restaurants tab stays marked there.
- Pages fill the screen on notched phones, colour the browser bar for light and dark, and
  turn off sliding animations when the system asks for reduced motion.
- Home now shows its "What to Eat" title. Tags and History keep their layouts for now; stage 4
  redesigns them.
- The restaurant list is compact: each row shows the name and type line only; location, notes
  and tags are in the form. Delete moved from every row to the end of the edit form, behind a
  prompt that names the restaurant.
- Clear in Home's filter is a full-size button instead of a small inline link.
- Picks are white tiles with a pin on the location and a soft red "Eat here" button; on wide
  screens two sit side by side from 960px.

### Bug fixes

- Focus stays in the Settings reset flow: Delete all data moves it to the confirm button and
  Cancel moves it back.
- On iPhone, Home no longer scrolls into blank space under the pick button: the page uses the
  visible screen height (`100dvh`) instead of iOS's `100vh`, and the button sits right on the
  tab bar.
- A quick second tap on a filter chip no longer zooms the page on phones; pinch zoom still
  works.
- Keyboard focus never hides behind the pinned pick button; the scroll padding covers it and
  the tab bar.
- On phones the restaurant form's cuisine and area stack in one column, so a long chip no
  longer pushes a box off screen, and nothing shows through under Save and Cancel.
- Rotating a phone or resizing a window while editing keeps the edit, in either direction; on
  Home, rotating with the filter sheet's close button focused no longer loses focus.

### Decisions

- The first preview used a street-sign palette (paper, chili red, sign yellow) with Anuphan;
  it felt too vivid and too large, so the "Calm neutral" variant was chosen from mockups over
  a warm cream one.
- The compact density keys on the pointer (`hover: hover` and `pointer: fine`), not the
  screen width, so tablets and touch laptops keep touch-sized controls.
- Fonts are inlined as data URIs in the bundled CSS because the build refuses unresolved
  `url()`s; static font files would need a separate copy step.
- The redesign ships in five stacked pull requests from one spec
  (`docs/superpowers/specs/2026-10-15-mobile-redesign-design.md`); stages 1 to 3 are in.
- Home switches between the sheet and the side panel with a media-query controller
  (`src/lib/media.ts`) rather than CSS alone, so only one copy of the filter and of the pick
  button ever exists.
- Filter chips are 36px tall, as in the chosen mockup, rather than 44px; that is still above
  the 24px WCAG AA minimum.
- Closing the restaurant sheet without saving discards the edit rather than keeping a draft,
  so the sheet always opens on what is saved.

## 2026-10-15: Cuisine, area and custom groups as tag groups, and a Tags page to manage them, and two ideas dropped

### BREAKING CHANGES

- Exports are now `version: 4` and carry a `groups` list. A build from before this change
  cannot import them and says "This export version is not supported."
- Restaurants are saved with a `groups` map (`{ "cuisine": [...], "area": [...] }`) instead
  of single `cuisine` and `area` strings. A build from before this change shows restaurants
  saved by this one without a cuisine or area.
- In code, `Restaurant.cuisine` and `Restaurant.area` are gone; read values with
  `groupValues(item, "cuisine")`. `GROUPS`, `Group` and `ValueGroup` are removed from
  `#lib/restaurant` (use `allGroupIds` from `#lib/groups`), `Filter` is keyed by any group
  id with `EMPTY_FILTER = {}`, and `exportJson` and `toExportFile` take the group list as a
  new argument.

### Features

- A restaurant can have several cuisines and several areas, like `thai, japanese`. The home
  filter matches any of them.
- Custom groups, like "price" or "vibe", stored under `whattoeat:groups` and exported with
  the restaurants. Each one gets its own field in the restaurant form and its own row in the
  home filter, and its values show on restaurants as `Price: cheap` chips before the plain
  tags.
- A Tags page (`/tags`, linked from the header between Restaurants and History) lists every
  group, Type, Cuisine, Area, custom groups and plain Tags, with how many restaurants use
  each value. Custom groups can be added, renamed, moved up or down and deleted; a deleted
  group's values become plain tags. Values can be renamed (renaming onto an existing value
  merges the two), moved to another group, or deleted, each change applied to every
  restaurant at once after an inline confirmation with the count.

### Improvements

- Cuisine and Area in the restaurant form are chip inputs like Tags, suggesting the values
  other restaurants already use, most used first.
- Saved restaurants with the old `cuisine` and `area` strings, and exports of versions 1 to
  3, load with those strings moved into the new groups. Nothing has to be re-entered.
- Importing a version 4 file merges its groups into yours: a group with the same name (in any
  case) is folded into the existing one, and a group named like Cuisine or Area, in English
  or Thai, is folded into that built-in group.
- The saved home filter follows every rename, move and delete on the Tags page, also when the
  home page is open in another tab, so a renamed value stays selected.
- The desktop header still fits on one row with the fifth link, in English and Thai.

### Decisions

- Cuisine, area, type and tags are all labels, so they share one model, but Type keeps its
  fixed three values and translated names, and plain tags keep their meaning (shown, not
  filtered). A `groups` map was chosen over turning `tags` into an object, which would have
  changed what `tags` means in older files, and over prefixed tags like `cuisine:thai`,
  which need parsing everywhere and rewrite every restaurant when a group is renamed.
- Type, Cuisine and Area are fixed groups that cannot be renamed or deleted, so their labels
  stay translated. Restaurants refer to custom groups by id, so renaming a group never
  touches a restaurant.
- Values of a group that no longer exists (deleted in another tab, or missing from an
  imported file) become plain tags instead of being dropped.
- A value cannot be renamed to blank text or to text with a comma, because commas separate
  values in the chip inputs. The Tags page replaces the "Rename or merge a tag" idea in
  `IDEAS.md`; drag-and-drop reordering and single-value custom groups were left out.
- CSV import and export, and separate English and Thai names, are removed from `IDEAS.md`
  because they are no longer planned.

## 2026-10-14: Import renames restaurants whose name is already used, history locks are now visits, and clearing old history

### BREAKING CHANGES

- Exports are now `version: 3`, with each history entry's time in `visitedAt`. A build from
  before this change cannot import them and says "This export version is not supported."
- In code, `<lock-history>` is now `<visit-history>` (`src/components/visit-history.ts`), and
  `addLock`, `removeLock`, `lockedAt` and `lastLockedAt` are now `addVisit`, `removeVisit`,
  `visitedAt` and `lastVisitedAt`. The `picker.lock` and `picker.locked` messages are now
  `picker.visit` and `picker.visited`.

### Features

- The History page has a **Clear history** section between Stats and Visits, with
  **Older than 1 week**, **Older than 1 month**, **Older than 1 year** and **All** (ล้างประวัติ:
  เก่ากว่า 1 สัปดาห์, 1 เดือน, 1 ปี, ทั้งหมด). Each shows how many visits it would delete, such
  as "Older than 1 month (12)", and is disabled at 0. Pressing one asks "Delete 12 visits
  older than 1 month? This cannot be undone." with **Delete visits** / **Cancel** first. A
  week is 7 days, a month and a year are calendar ones, and a visit exactly at the cutoff is
  kept.

### Improvements

- History speaks of visits instead of locks: "No visits yet.", "4 visits in total", "Visits"
  and "Delete this visit". After **Eat here**, the card shows "✓ Going here · 12:30". The
  Thai text already said เลือก and is unchanged.
- History saved in the browser with `lockedAt` still loads, and version 2 exports still
  import, their `lockedAt` read as `visitedAt`.

### Bug fixes

- Import no longer creates two restaurants with the same name, which the add form has never
  allowed. An imported restaurant whose name is already used (ignoring case and surrounding
  spaces) gets the first free ` - <n>` suffix, counting from 1: `Somtam`, `Somtam - 1`,
  `Somtam - 2`. This covers a name repeated inside one file, on both Replace and Merge, and a
  name already saved, on Merge. An entry that replaces the restaurant with the same id keeps
  its name.

### Decisions

- Only incoming restaurants are renamed; saved ones keep their names, so a merge never
  changes what is already on the list. A suffix was chosen over skipping or rejecting the
  clashing entries, because two places can share a name and both are worth keeping.
- "Lock" was the design's word for pressing **Eat here** and read oddly in the app. "Pick"
  and "choose" were rejected because **Pick again** already means a new random pair; a visit
  is what each entry records. The rename covers the code and the stored field too, so the
  words match everywhere, with old data read rather than migrated.
- History is never cleaned up automatically. Keeping a year or the newest 1000 visits,
  whichever is more, was built first and dropped: visits should only disappear when someone
  asks, and size is no concern, since a visit is about 105 characters and two a day for a
  year come to about 77 KB of the roughly 5 MB browsers allow. The clear section sits above
  the visit list so a long history does not push it out of reach.
- `IDEAS.md` no longer lists pick history, which shipped as visit history.

## 2026-10-13: Dark mode and theme switch, copy and paste import and export, tag rework, build footer, data reset, a warning for unreadable saved data, two random options per pick, a lock history, and filtering by type, cuisine and area

### BREAKING CHANGES

- The home page no longer filters by tag. A saved tag filter is ignored and the home page
  starts unfiltered; set the same choice again with the new Type, Cuisine and Area groups.
  Tags stay on restaurants and their cards.

- Stored restaurants that fail validation are no longer copied to
  `whattoeat:restaurants:invalid`, so the next change to the list deletes them for good. To
  keep one, copy `whattoeat:restaurants` from the browser's developer tools before changing
  the list. A backup already saved under the old key stays there but is no longer updated.

### Features

- The app has a dark palette. It follows the system colour scheme by default, and a new
  header switch (`◐ ☀ ☾` for auto, light and dark, labelled in English and Thai) forces
  either one. The choice is saved under `whattoeat:theme`, follows changes made in other
  tabs, and still works for the session when the browser blocks storage.
- `tests/styles/palette.test.ts` checks that every text colour pair in both palettes meets
  WCAG AA (4.5:1) and that the system-dark and chosen-dark rules stay identical.
- Settings has a **Copy JSON** button that puts the export on the clipboard as one line of
  JSON. When the browser has no clipboard or refuses it, a read-only text box shows the JSON
  instead, selected on focus, to copy by hand.
- Settings can import JSON pasted into an **Or paste JSON** box: **Check** runs the same
  validation and Replace / Merge / Cancel choice as a file, so a list can move between
  devices through a chat or notes app without saving a file.
- The tag field in the restaurant form is a chip input (`<tag-input>`) that suggests tags
  already in use, most used first. Enter, a comma, a click or pasting a list adds tags;
  Backspace in an empty box removes the last one; text typed but not confirmed is still
  saved. Enter that confirms a character in an input method does not add a tag.
- The home page can filter the random pick by tag. Tapping a tag cycles it through include
  (✓), exclude (✕) and off: a restaurant is picked only if it has any included tag (or none
  is included) and no excluded tag. The filter is saved under `whattoeat:filter`, a
  "Filter active: … · Clear" line shows while one is on, and when nothing matches the pick
  button is disabled with a message.
- The home page shows how many restaurants there are, or "3 of 12 restaurants match" while
  a filter is on.
- Every page has a footer (`<app-footer>`) linking the source on GitHub and this changelog,
  with the short commit sha the page was built from (linking to that commit) and the build
  time with its time zone, in English and Thai. The dev server and manual deploys show
  "Development build" instead of the sha and time.
- Settings has a **Reset** card whose **Delete all data** button, after an in-page warning
  that names how many restaurants will go, clears every `localStorage` entry: restaurants,
  theme, language and tag filter. The page resets at once without a reload, in English and
  Thai.

- Home, Restaurants and Settings warn when saved restaurants could not be read, for example
  "2 saved restaurants could not be read and were skipped. They will be removed the next
  time the list changes.", in English and Thai. Saved data that is not JSON, or not a list,
  counts as one; before, it was dropped without any trace. The warning goes after the next
  save or a reset.
- Each picked card has an **Eat here** button (กินร้านนี้). Pressing it saves a lock with
  the restaurant, its name and the date and time under `whattoeat:history`, and the card
  shows "✓ Locked at 12:30". One lock per pick; **Pick again** starts over.
- A new **History** page (`/history`, linked in the header between Restaurants and
  Settings) shows the total number of locks, a table of how often and when last each
  restaurant was locked (deleted restaurants marked "(deleted)"), and every lock newest
  first with its date and time. **Delete** asks **Delete this lock** / **Cancel** before it
  removes one.
- Export files are now `version: 2` and carry the history. Version 1 files still import:
  **Replace** with one keeps the current history, and **Merge** combines locks by id.
  **Delete all data** removes the history too, and its prompt now says so.
- Home, History and Settings warn when the browser could not save the history, the same way
  they already do for restaurants.
- Restaurants have a **Type** (any of food, drinks and dessert), a **Cuisine** (the country
  or style, like `thai`) and an **Area** (a short place name, like `siam`), stored as
  `kinds`, `cuisine` and `area`. The form shows type as three toggles and suggests cuisines
  and areas already in use; cards and the list show them as "Drinks, Dessert · japanese ·
  ari". Cuisine and area are lowercased like tags. The location field stays for an address
  or map link.
- The home filter has Type, Cuisine and Area groups, shown only when some restaurant uses
  them. Values in one group match any of them; a restaurant must match every group.
  Restaurants, exports and imports without the new fields load with them empty, and the
  export format stays `version: 2`.

### Improvements

- The light primary colour is slightly darker (`#d9480f` to `#c4440e`), and so is the
  success colour (`#2b8a3e` to `#2b7a3b`), so links, white button text and success messages
  meet WCAG AA; before, they measured 4.08, 4.30 and 4.37 to 1.
- On phones the header is always two rows, with the name and switches on top and the nav
  links below, instead of wrapping freely into up to three rows. From `40rem` up it is one
  row.
- New restaurants get an 8-character id from `0-9A-Za-z` instead of a 36-character UUID,
  so exported and copied JSON is shorter. Ids are redrawn on a clash with the list.
- Import messages say "data" instead of "file" in English and Thai, since they now cover
  pasted text too.
- The restaurant form refuses a name that is already in the list, ignoring case and
  surrounding spaces, and says "A restaurant with this name already exists." Editing may keep
  a restaurant's own name but not take another's. `addRestaurant` and `updateRestaurant`
  throw on such a name too.
- Tags are case-insensitive: they are stored trimmed, with single spaces and in lowercase,
  so `Thai` and `thai` are one tag. Saved and imported data is cleaned the same way when
  read and written back on the next save; the export format version does not change.
- The home page shows two different restaurants per press instead of one, side by side and
  stacked on phones. **Pick again** prefers restaurants that were not in the last pair and
  reuses them only when the filtered list is too short. A deleted or filtered-out restaurant
  drops out of the pair while the other stays.
- The header keeps the brand, four nav links and switches on one row from `44rem` up (was
  `40rem`), with tighter gaps, so adding History did not push Settings onto a second line.
- The home filter is one panel with each group's name beside its chips (above them on
  phones); an included chip fills in green and an excluded one is dashed and struck
  through. Picked cards are left aligned with a smaller title, the type line under the
  name and **Eat here** across the bottom, level between the two cards.
- The restaurant form asks for name, type, cuisine and area side by side, location, then
  tags and notes, and list entries show their details in the same order as the cards.

### Decisions

- The theme is applied as `data-theme` on `<html>` by `#lib/theme`, loaded before the
  stylesheet; with no choice saved there is no attribute and pure CSS
  (`prefers-color-scheme`) picks the palette, so the default needs no JavaScript.
- The switch sits in the header next to the language switch rather than only on the
  Settings page, so it is one tap away on every page.
- Dark primary buttons use dark text on a light orange, because white on a bright enough
  orange fails contrast.
- Copied text is the same JSON as the download, not a base64 string or a share link: it
  stays readable and editable, and one parser handles both.
- Existing UUID ids stay valid and are not shortened, because merge matches restaurants by
  id; rewriting them would make other devices and older exports add duplicates. The export
  format version does not change.
- Duplicate names count as the same when they match ignoring case and surrounding spaces,
  rather than only on exact text. Import does not check names; only adding and editing do.
- Tags are stored in one lowercase form rather than keeping the casing first typed, so
  every comparison is plain string equality; Thai has no case, so only English tags lose
  their capitals. Lowercasing uses `toLowerCase()`, not the locale-aware version, so a
  device's language never changes which tags match.
- Included tags match on any of them (OR) rather than all, so adding a tag widens the pool
  and exclude does the narrowing. Tags no restaurant uses any more are dropped from the
  saved filter. Renaming or merging tags is left for later in `IDEAS.md`.
- The footer's commit and build time come from `BUN_PUBLIC_COMMIT_SHA` and
  `BUN_PUBLIC_BUILD_DATE`, set by the deploy workflows and inlined at build time like the
  GTM id. A preview links the pull request head, not the merge commit GitHub builds from.
- The build time shows in the viewer's own time zone, with the zone name added separately:
  `dateStyle` and `timeStyle` refuse `timeZoneName`, and listing the fields instead spells
  Thai times out as "15 นาฬิกา 30 นาที".
- Reset calls `localStorage.clear()` rather than removing known keys, so keys added later
  are covered too. It then fires a `storage` event with `key: null`, the same signal a clear
  in another tab sends, so the existing theme, language and restaurant listeners reset this
  tab with no new wiring. The confirmation lives in the page because the browser's
  `confirm()` can be blocked.
- Unreadable entries get a warning instead of a backup that the app never showed. The app
  itself cannot write one (adding, editing and import all validate), so they only come from
  editing storage by hand, another build of the app, or corruption. Showing them in the app
  to fix or discard, the idea in `IDEAS.md`, was dropped as too much for so rare a case. The
  warning is on every page, not only Settings, because a change on any page deletes them.
- History is its own list instead of lock times stored on each restaurant, so deleting or
  renaming a restaurant keeps its history and the restaurant format did not change. Each
  lock keeps the name it had when locked; the stats show the current name.
- The lock is a button inside the card rather than a clickable card, because the card already
  holds a map link and nested controls break keyboard and screen reader use.
- Type, cuisine and area are their own fields rather than tags with a prefix like
  `area:siam` or tags sorted into groups in Settings, so the form can ask for each one and
  nobody has to type a prefix. Type is a fixed list so it can be translated; cuisine and
  area are free text.
- Groups combine with AND and values inside a group with OR, so "siam" plus "food" and
  "dessert" means food or dessert in Siam. Tags left the filter so it shows only the three
  groups.
- The export format version stays at 2 because the new fields are optional: older files
  still import, and the app as it is now reads every file.

## 2026-10-12: Site icon, app README and ideas for later

### Features

- Every page has a site icon (an orange plate with fork and knife), so browser tabs show it
  and the console no longer reports a `/favicon.ico` 404.
- `IDEAS.md` lists features left for later — tag filter, weighted random, pick history,
  cloud sync, CSV, separate English and Thai names, recovering invalid entries in the app,
  dark mode — each with what it gives and what makes it more than a small change.

### Improvements

- The README describes this app rather than the template: getting started clones
  `kamontat/whattoeat`, the template customization steps and the missing `GET_START.md`
  are gone, and a new "Data and storage" section lists the `localStorage` keys and how to
  recover entries from the `whattoeat:restaurants:invalid` backup.
- `tests/routes/pages.test.ts` fails if a page stops linking the icon.

### Decisions

- The icon is an SVG under `src/assets/` linked from each page, so the build bundles it as a
  hashed asset; no `--statics` folder or `favicon.ico` was added.

## 2026-10-12: Random restaurant picker with English and Thai

### BREAKING CHANGES

- The template's `hello-world` component and its test are gone; the home page is now the
  random restaurant picker.

### Features

- The home page (`/`) picks a random restaurant from your list with one button, never the
  same one twice in a row, and shows its tags, location (a link only for `http(s)://`) and
  notes.
- `/restaurants` adds, edits and deletes restaurants (name, comma-separated tags, location
  or map link, notes), sorted by name, with an inline delete confirmation that keeps
  keyboard focus.
- `/settings` exports the list as `whattoeat-YYYY-MM-DD.json` and imports it back with
  **Replace all** or **Merge** (by id). A file with any invalid or duplicate entry is
  rejected and the current list is left untouched; imported text is cleaned like typed input.
- English and Thai UI with an EN | TH toggle in the header, remembered per browser,
  detected from the browser language on first visit, applied to `<html lang>` and tab titles,
  and followed across open tabs.
- The list lives in `localStorage` (`whattoeat:restaurants`) and stays in sync across tabs.
  When the browser refuses to save, the Restaurants and Settings pages warn that changes
  will be lost instead of claiming success.

### Decisions

- Browser storage only, no backend: each device keeps its own list and JSON export/import
  moves it between devices.
- Restaurant names are one free-text field; only the interface is translated.
- Pages are `restaurants.html` and `settings.html` rather than `*/index.html`, so links
  have no trailing slash and the built chunks resolve.
- Stored entries that fail validation are copied to `whattoeat:restaurants:invalid`
  before a save drops them, rather than being lost or blocking the app.

## 2026-10-12: Agent skills and a green template CI, Google Tag Manager, and clean, fully typechecked builds

### BREAKING CHANGES

- `GET_START.md` no longer creates the repository: run its prompt inside a copy you already
  have, made with **Use this template** or by cloning the template. An agent started in an
  empty directory now stops and asks you to clone first.

### Features

- Claude Code skills in `.claude/skills/` teach an agent the repository's workflow and
  conventions: `shipping-a-change` (worktree, test first, pull request with a preview URL),
  `landing-a-change` (changelog, merge commit, cleanup), `changelog`, `adding-a-page`,
  `ui-components`, `build-and-deploy` and `repo-scripts`.
- Google Tag Manager loads on every page from `src/lib/gtm.ts` when the production build
  carries a container id. `Deploy Production` passes it from the `GTM_ID` repository
  variable as `BUN_PUBLIC_GTM_ID`; without it, and in dev, tests and PR previews, nothing
  loads. `tests/routes/pages.test.ts` fails if a page under `src/routes/` stops loading it.
- `GET_START.md` has an optional Google Tag Manager phase: create and publish a Web
  container, store its id with `gh variable set GTM_ID`, and check the deployed bundle
  carries it.

### Improvements

- `@kctools/bun-server` is upgraded to 0.4.2, alongside `@kcstyles/reset.css` 2.0.0,
  `@kcconfigs/biome` 3.0.0, `@kcconfigs/tsconfig` 2.1.0, happy-dom 21 and wrangler 4.149.0.
- `bun run build` empties `dist/` first (`--clean`, new in bun-server 0.4.1), so no stale
  file or chunk from an earlier build reaches a deploy.
- `bun run check` typechecks every TypeScript file, not only `src/`: the `bun` preset of
  `@kcconfigs/tsconfig` 2.1.0 includes the whole repository, so `tests/` and future
  `scripts/` are covered with no `include` to maintain.
- The README matches the project again: the real scripts (`check` is `check:type` plus
  `check:biome`), where code lives (`src/`, `tests/`, `scripts/`), the template deploy skip,
  the `GTM_ID` variable, and the routing difference between `dev` and `preview`.
- `GET_START.md` enables merge commits and head-branch deletion on the new repository,
  which `landing-a-change` relies on.
- `GET_START.md` follows the clone-then-ask flow: it detects whether `origin` is your own
  repository or the template, and for a direct clone creates your repository and starts a
  fresh single-commit history.
- Tests never fetch external scripts: happy-dom reports them as loaded instead.

### Bug fixes

- Production builds ship Lit's production build instead of its development build, about
  half the size and without the dev-mode console warning, because `bun-server build` 0.4.0
  sets `NODE_ENV=production`.
- `bun run check` passes on the template: the page title placeholder is plain `TODO`
  instead of `<TODO>`, which Biome parsed as an unclosed tag.
- The template repository no longer runs its deploy jobs, which failed on every push and
  pull request because it has no Worker of its own.

### Decisions

- The deploy jobs are skipped with `github.event.repository.is_template` rather than a
  hardcoded repository name, so repositories created from the template deploy without
  editing the condition.
- The title placeholder is plain `TODO` rather than an escaped `&lt;TODO&gt;`, so it reads
  the same in source and browser tab; the README and `GET_START.md` call it out because the
  `<TODO>` grep no longer lists it.
- GTM loads through a module script reading a build-time id, not Google's inline snippet
  with the id in the HTML. That keeps the id out of the repository and GTM off everywhere
  but production, at the cost of starting after the HTML is parsed and having no
  `<noscript>` fallback.
- The id is a repository variable, not a secret, because it ends up in public page source
  anyway; only production receives it so preview traffic never reaches the container.
