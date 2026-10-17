# Neighbourhood presets — design

Date: 2026-10-17

## Goal

Let someone fill their restaurant list from bundled, ready-made lists for the neighbourhoods
they eat in, instead of typing restaurants one by one. The first two presets are Ladprao (144)
and Ratchayothin (55), cut from the owner's own list; the design has to stay usable when there
are dozens of neighbourhoods across several cities.

Approved mockups: <https://claude.ai/code/artifact/439c2df8-b7f0-4595-bc74-29643011aad1>
(version "v3.3 add or replace"). Earlier versions on the same page show the options that
were compared.

This replaces the first cut in PR #28 (one Settings row per preset, each going through the
file-import Replace / Merge prompt). The branch `worktree-import-presets` is reworked in
place.

### What the user asked for

- Presets split by neighbourhood, bundled with the site and fetched on demand.
- A design that scales to many neighbourhoods and follows UI/UX best practice.
- One "Neighbourhood presets" entry in Settings (from option A), multi-select (from option B),
  and "Start with a neighbourhood" (from option C).
- Home stays as it is: the restaurant count under the title, the picker button pinned at the
  bottom. Nothing new on Home except in the empty state.
- Presets on their own page, not a popup, at `/settings/presets`.
- Preset data served from `/data/presets/`.
- Not merge-only: the user must be able to choose Add (merge) or Replace.

### Non-goals

- No "near me" sort or location permission.
- No removing a preset's restaurants again later.
- No change to the restaurant data format or the export file format (still version 4).
- No change to file and paste import: they keep their Replace / Merge prompt.
- No migration work: the app has no outside users yet.

## Data

### Files

- Preset files move from `src/assets/presets/` to `src/assets/data/presets/`, shipped by
  `--statics src/assets/data:data` (replacing PR #28's `src/assets/presets:presets` on both
  `dev` and `build`). They are served at `/data/presets/<id>.json`.
- Each preset file is a normal version 4 export (`app`, `version`, `exportedAt`,
  `restaurants`, `history: []`, `groups: []`), so `parseImport` validates it unchanged.
- Restaurant ids are unique across all preset files. A test enforces it, so "counted once"
  and "already in your list" can work by id.

### Index

`src/assets/data/presets/index.json`, served at `/data/presets/index.json`:

```json
{
  "version": 1,
  "presets": [
    {
      "id": "ladprao",
      "city": "bangkok",
      "district": "chatuchak",
      "name": { "en": "Ladprao", "th": "ลาดพร้าว" },
      "count": 144,
      "updatedAt": "2026-10-16",
      "places": ["Central Ladprao", "Union Mall", "Lotus Ladprao", "Ha Yaek Lat Phrao", "Lat Phrao Soi 15"],
      "areas": ["central ladprao", "union mall", "lotus ladprao", "ha yaek lat phrao", "lat phrao"]
    }
  ]
}
```

- `city` and `district` are ids. Their display names in both languages live in the same file,
  under top-level `cities` and `districts` maps (`{ "bangkok": { "en": "Bangkok", "th": "กรุงเทพฯ" } }`),
  so adding a city or district needs no code change.
- `places` are the malls or streets shown in each row's subtitle and matched by search. They
  are written by hand.
- `areas` are the `area` group values the preset's restaurants may use. A test checks every
  restaurant in the file against them (the PR #28 check, now driven by the index, so a new
  preset needs no test edit). *Builder's call, from the builder check.*
- `updatedAt` is the date the file's content last changed. It drives the "Update" state.
- The index is committed, not built. `bun run presets:index` (a script under `scripts/`)
  rewrites `count` from each file. Everything else in the index is written by hand. A test fails
  when any `count` differs from its file, when a file has no index entry, or when an entry
  has no file.
- Neighbourhoods for the first two presets: Ladprao = Central Ladprao, Union Mall, Lotus
  Ladprao, Ha Yaek Lat Phrao, Lat Phrao Soi 15 (The Fat Cow); Ratchayothin = Major
  Ratchayothin, Avenue Ratchayothin, SCB Park (Café DoiTung). Both are in Chatuchak, Bangkok.
  This is the split already in PR #28.

### What the browser stores

A new key `whattoeat:presets` holds the presets this browser has added:

```json
[{ "id": "ladprao", "updatedAt": "2026-10-16", "ids": ["2mUS3Bxm", "pk3InoUW", "…"] }]
```

- `ids` are the restaurant ids that preset's file held when it was added (all of them, not
  only the ones that were new).
- A preset counts as added only while the key records it **and** at least one of its `ids` is
  still in the saved list. This is worked out locally, with no fetch. So deleting a preset's
  restaurants by hand, a file or paste Replace, or emptying the list makes the preset tickable
  again. Without this, a user who empties their list would land on a page where every preset
  is locked. *Builder's call, from the builder check.*
- Written only by the presets page, and only after a successful save.
- `resetStorage` already clears all of `localStorage`, so Delete all data clears it too.
- After a Replace, it holds exactly the presets ticked for that Replace.
- Not part of the export file. A list moved to another device shows its presets as not added.
  That's acceptable: adding again changes nothing, because existing ids are kept (see Add).
- An unreadable value is treated as an empty list.

## Pages and entry points

### Home (`src/components/random-picker.ts`)

Unchanged, except for the empty card. "No restaurants yet." gets a second link, "Start with a
neighbourhood", to `./settings/presets`, placed above the existing "Add some restaurants".
The new link is the primary-styled one. It only shows in the empty state.

### Settings (`src/components/data-transfer.ts`)

- PR #28's preset rows and their fetch logic are removed.
- The Import section gets one link row at the top, above "Choose a JSON file": pin icon,
  "Neighbourhood presets", subtitle "{added} of {total} added", and a chevron. It links to
  `./settings/presets`.
- The subtitle needs the index. Settings fetches it when it loads. Until it arrives, and if the
  fetch fails, the subtitle is left out and the row still links.

### `/settings/presets` (new)

- File: `src/routes/settings/presets.html`, with a new `<preset-picker>` component in
  `src/components/preset-picker.ts`. It is registered in `src/types/global.d.ts` and loaded
  from `../../components/preset-picker.ts`. The `../` depth follows the `adding-a-page` skill.
- `<app-header current="presets" base="../">`. `presets` is a new `Page`, whose tab is
  `settings` (the way `tags` maps to `restaurants`); its browser tab title is the page title.
- At the top, a back link "‹ Settings" to `../settings`, styled like Tags' back link.
- The large title is "Neighbourhoods".
- Single column, same max width as Settings.

#### Header base

`app-header` gets an optional `base` attribute, defaulting to `./`. Every tab href is written
relative to it (`${base}restaurants`; home is `${base}` alone). It is the first page one folder
deep. Without this, `./restaurants` from `/settings/presets` would resolve to
`/settings/restaurants` and 404.

#### Loading

- On load, fetch `../data/presets/index.json`. While it loads, show the title and a quiet
  "Loading…" line. If it fails, show an error line, "The neighbourhood list could not be
  loaded. Check your connection and try again.", with a Retry button.
- Preset files are fetched only when Add or Replace is pressed, all ticked files in
  parallel. If any one fails, nothing is saved, the error line shows, and the selection is
  kept.

#### List

- Grouped by district. The district name is the group label, and districts are sorted by name
  in the current language.
- Rows within a district are sorted by name.
- Each row has a checkbox, the name, and a subtitle "{count} · {first two places} +{rest}".
  The whole row toggles. Rows are at least 44px tall.
- City chips show above the list only when the index has 2 or more cities. One chip is
  always selected, with no "all": it filters the districts shown. The first city in the index
  is selected first.
- A search field shows above the chips only when there are more than 7 presets. It matches
  name, district name and places, case-insensitive, in both languages. A match on a place
  highlights it in the subtitle.
- While a search is typed, it covers every city and the chips are ignored, so a mall in another
  city can still be found. Clearing the search brings the chip filter back.
- Switching city chips keeps the selection.
- When ticked rows are hidden, by a search or a chip, a line above the list says "{n} selected,
  not shown". Its Clear link clears the search and selects the city of the first hidden ticked
  row. It never clears the selection. *Builder's call, from the builder check.*
- No matches: "No neighbourhood matches “{query}”."

#### Row states

| State | When | Add mode | Replace mode |
| --- | --- | --- | --- |
| Not added | not added (see "What the browser stores") | tickable | tickable |
| Added | added, and stored `updatedAt` equals the index's | ticked, greyed, locked; badge "Added" | tickable, starts unticked; badge "In your list" |
| Update | added, and stored `updatedAt` older than the index's | tickable; badge "Update" | tickable; badge "In your list" |

#### Mode switch and pinned button

- Pinned at the bottom, the same way Home pins its picker button: a two-way segmented control,
  **Add to my list** | **Replace my list**, above the action button.
- The switch is hidden when no restaurants are saved. The mode is then Add.
- The mode starts as Add every time the page opens. It is not stored.
- Changing the mode clears the selection. Ticking means something different in each mode, so
  a selection carried over could be misread.
- The action button:
  - Nothing ticked: "Go to picker", a link to `../`.
  - Add mode: "Add {n} areas · {m} restaurants". `m` counts restaurants whose ids are in the
    ticked presets and not already saved. The index has no ids, so `m` is an estimate until the
    files load: the sum of the ticked presets' `count`, minus Added ones. The label says
    "restaurants" either way, and the success message gives the real number.
  - Replace mode: "Replace with {m} restaurants", in the outlined danger style. A line above
    the button reads "Your {saved} saved restaurants will be removed."
- Singular forms: "1 area", "1 restaurant".

#### Add (merge)

1. Fetch the ticked files and validate each with `parseImport`.
2. Take their restaurants, dropping any id already saved and any repeat id across the files.
3. Append them to the saved list. Existing restaurants are never changed, so edits survive.
4. Record each ticked preset in `whattoeat:presets` with the index's `updatedAt` and its file's ids.
5. Show the message "Added {k} restaurants" with Undo. If `k` is 0: "Nothing new to add. These
   restaurants are already in your list." with no Undo, and the presets are still recorded.

Ticking an Update row adds only its new restaurants, by the same rule. Restaurants that were
changed or removed upstream are not touched.

#### Replace

1. Pressing the button swaps the pinned area for an inline confirm card, the same pattern as
   Settings › Delete all data: "Replace your {saved} restaurants with {m} from {names}? Your
   history and groups stay." with Cancel and Replace. Focus moves to Replace; Cancel moves it
   back to the button.
2. On confirm: fetch and validate, take the restaurants with repeat ids dropped, and save them
   as the whole list. `whattoeat:presets` becomes exactly the ticked presets.
3. Show the message "Replaced with {k} restaurants" with Undo.

History entries keep their restaurant names, so visits to removed restaurants still show, as
they do after deleting a restaurant today. Custom groups are untouched.

#### Undo message

- A new small component, `<app-toast>`, fixed above the pinned area. It has a `role="status"`
  message and an Undo button, and disappears after 6 seconds. It stays while hovered or
  focused.
- Undo restores the saved restaurant list and `whattoeat:presets` from before the action. The
  snapshot lives in memory only, and leaving the page drops it.
- After Undo: "Undone." for 3 seconds, with no button.
- If localStorage refuses the write, the app's existing storage warning shows, as it does
  elsewhere. The message then says "Added for this session only" instead of claiming a
  normal save.

#### After saving

You stay on the page. The selection clears and rows show their new states. The pinned button
falls back to "Go to picker".

## Copy

English below; Thai is written with the same meaning, in the style of the existing Thai copy.
Keys go in `src/lib/i18n.ts`.

| Where | English |
| --- | --- |
| Settings row | Neighbourhood presets |
| Settings row subtitle | {added} of {total} added |
| Empty home link | Start with a neighbourhood |
| Page title | Neighbourhoods |
| Back link | Settings |
| Search placeholder | Search area or mall |
| Switch | Add to my list / Replace my list |
| Button, add | Add {n} areas · {m} restaurants |
| Button, replace | Replace with {m} restaurants |
| Button, idle | Go to picker |
| Replace warning | Your {saved} saved restaurants will be removed. |
| Replace confirm | Replace your {saved} restaurants with {m} from {names}? Your history and groups stay. |
| Badges | Added / Update / In your list |
| Messages | Added {k} restaurants / Replaced with {k} restaurants / Undone. / Nothing new to add. These restaurants are already in your list. |
| Errors | The neighbourhood list could not be loaded. Check your connection and try again. / The selected neighbourhoods could not be loaded. Nothing was changed. Try again. |

## Accessibility

- The rows are real checkboxes inside labels (`<label><input type="checkbox">…</label>`).
  Locked rows are `disabled`, with the badge text inside the label.
- The switch is a radio group with a visible label "When adding" (visually hidden is fine).
  Arrow keys move between its two options.
- The pinned button's label changes as the selection does. An `aria-live="polite"` region
  announces the total, at most once per change.
- The confirm card and the message follow the existing focus and `role` patterns in
  `data-transfer.ts`.
- 44px targets on touch and 36px with a fine pointer, as on every other page.

## Tests

Mirroring `src/` under `tests/`, test first as usual:

- `tests/lib/presets.test.ts`: the index matches the files (count, an entry for every file, a
  file for every entry); every file passes `parseImport`; ids are unique across files; every
  restaurant's area belongs to its preset's neighbourhood (the PR #28 check); the stored-key
  load/save tolerates bad values.
- Pure merge and replace functions with their state rules, in `src/lib/presets.ts`.
- `tests/components/preset-picker.test.ts`: grouping and sorting; search and the
  hidden-selection line; chips appear only with 2 or more cities; row states in both modes;
  switch hidden when empty; mode resets and clears the selection; button labels; add; replace
  with confirm; Undo; fetch failures for the index and for files; keyboard on the switch.
- `tests/components/app-header.test.ts`: `base` prefixes every tab, and `presets` highlights
  Settings.
- `tests/components/random-picker.test.ts`: the empty card's new link.
- `tests/components/data-transfer.test.ts`: the single row and its subtitle. PR #28's preset
  tests are replaced.
- `tests/routes/pages.test.ts` already covers the new page's GTM line.

## Left to the builder

- How `<app-toast>` is shared, whether one per page or a small module.
- Exact Thai wording.
- Styling details within the existing `uiStyles` tokens, matching the mockups.
- Whether the merge and replace helpers live in `presets.ts` or extend `transfer.ts`.
