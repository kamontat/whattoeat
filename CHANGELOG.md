# Changelog

What changed in this project and why, newest first.

## 2026-10-14: Import renames restaurants whose name is already used

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
