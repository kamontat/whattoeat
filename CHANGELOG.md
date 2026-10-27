# Changelog

What changed in this project and why, newest first.

## 2026-10-27: Open the app without a connection

### Features

- The app opens and works offline after one visit online. A service worker saves every page,
  script, style, icon and neighbourhood preset (about 780 KB), so the installed app still
  opens in a mall basement or on airplane mode.
- With a connection, pages and presets still come from the network, so a new deploy shows
  on the next load. When the network fails or takes more than 3 seconds, the saved copy
  answers instead.

### Improvements

- `bun run build` now ends with `scripts/service-worker.ts`, which writes `dist/sw.js` with
  every built file except source maps and a version hashed from their contents. Every page
  loads `lib/offline.ts`, which registers the worker in built pages only; `bun run dev`
  stays without one.

### Decisions

- Each build gets its own cache, and only build files are cached, nothing at runtime, so a
  page is never served with another deploy's chunks. The new worker takes over straight
  away and deletes older caches. Saving pages as they are fetched was left out because
  an offline page could then load chunks the cache no longer has.
- Hashed chunks come from the cache first, since their names change when they do. Pages
  and unhashed files try the network first with a 3-second limit: always reading the cache
  would keep a stale page until the next visit, and waiting on the network alone would
  hang on weak signal.

## 2026-10-26: Cancel the paste box, and a smaller download file

### Features

- The paste box that opens when the clipboard can't be read has a Cancel button next to
  Check. It closes the box, clears the typed text and any import error, and puts focus back
  on the Paste JSON row, so tapping Paste reads the clipboard again.
- "Download file" saves the export gzipped as `whattoeat-YYYY-MM-DD.json.gz`, several times
  smaller than the JSON (the Ladprao preset: 110 KB as the old download, 14 KB gzipped), so a
  list too large to copy and paste still moves between devices as a file. "Choose a file"
  reads both `.json.gz` and plain `.json`, so older exports still import.

### Decisions

- Cancel cannot bring back a clipboard permission the browser has blocked: once a site is
  blocked, Brave and Chrome refuse the read without asking again, and only site settings
  undo that. A hint for the blocked state (from the Permissions API) was considered and left
  out for now.
- The download is compressed with the browser's built-in `CompressionStream` rather than a
  library, and a chosen file is told apart by gzip's first two bytes rather than its name.
  The export format stays version 8; only the file around it changed.

## 2026-10-25: Profiles, and presets that replace and update

### BREAKING CHANGES

- Restaurants, tag groups, history, both filters, the pick count, the preset record and the
  session's tag group are now stored per profile under `whattoeat:<profile id>:<store>`
  instead of `whattoeat:<store>`. Saved data moves into the first profile on the next load;
  code must build these keys with `profileKey` (or the stores' key functions such as
  `restaurantsKey()`) instead of the removed constants (`STORAGE_KEY`, `HISTORY_KEY`, ...).
- The export format goes from version 7 to 8 with a new `presets` list. Version 1–7 files
  still import, with no preset record; `toExportFile` and `exportJson` take the preset record
  as a new argument before `now`.
- Neighbourhood presets no longer have an "Add to my list" mode: applying presets always
  replaces the active profile's list. To keep your own restaurants, export first or use a
  separate profile. `addPresets` is gone from `#lib/presets`.

### Features

- Profiles keep several separate restaurant lists on one device, for example Personal,
  Couple and Family. Each has its own restaurants, tags, history, filters, pick count and
  preset record; language and theme stay shared.
- A `/settings/profiles` page lists every profile with its restaurant and history counts.
  Tapping a row switches to it; each row has Rename, Copy and Delete. A "+" button adds an
  empty profile, in a sheet on phones and a side panel on wide screens, like the Restaurants
  page.
- Copy makes `<name> - 1` (then `- 2`, ...) with everything except pick history, and keeps
  the current profile active. Delete asks once with Delete and Cancel on the row itself.
- Settings opens with a Profile row that leads to the profiles page, and the Settings tab
  shows the active profile's initial and name.
- An export now carries which presets the profile uses. Replace takes the file's record;
  Merge adds records only for presets the profile has none for.
- A preset the profile already uses shows an Update button when its bundled list changes.
  Update brings that one preset up to date in place: edited copies go back to the preset's
  version, new places are added, dropped ones are removed, and restaurants you deleted or
  added yourself are left alone. The message counts what changed and offers Undo.

### Improvements

- Applying presets to an empty profile reads "Use 2 areas · 138 restaurants" and saves at
  once; with restaurants saved it reads "Replace with …", names the profile in the warning
  and asks first.
- The neighbourhood city chips only list cities that have presets, and a test flags any
  city or district in the index that no preset uses.
- While searching neighbourhoods, a row whose match is a place beyond the first two shown
  puts that place in its subtitle, highlighted.
- The "Delete all data" prompt counts every profile and the restaurants across all of them,
  since it wipes the whole device.
- Settings' "Appearance" section is now "This device", because it holds the settings that
  every profile shares.

### Decisions

- Profiles replace the idea of local presets: a group's list should keep its own edits and
  history, not be reloaded from a template each time.
- Existing data moves into a profile named "Personal" ("ส่วนตัว" in Thai) on first load. The
  move is all-or-nothing and retries on the next load, so a full or blocked storage never
  leaves the saved list unread.
- Other open tabs reload when the profile changes elsewhere, and so does a page restored by
  the Back button, so no page keeps showing or saving the old profile's data.
- The rest of Settings is not regrouped under the profile's name yet; the Profile row and
  "This device" already show what is shared and what is not.
- Presets are Replace-only because a profile now stands for one occasion; adding a second
  area on top is what a second profile is for. File and paste import keep Replace and Merge.
- Update never runs on its own and there is no "update all": the user taps it per preset,
  without a confirm step, because Undo covers a mistake. An update that changes nothing just
  says the preset is up to date.
- A restaurant a preset dropped is removed even if it came from another preset too; preset
  ids are unique across files, so this should not happen.

## 2026-10-24: A Phanat Nikhom preset and official links for the last map-only restaurants

### Features

- A Phanat Nikhom preset lists 30 places in the town centre of Phanat Nikhom, Chonburi: 10 at
  Lotus's Phanat Nikhom, 13 in the old town around the market and clock tower, and 7 on
  Sukprayoon Road. It adds Chonburi as a new city and Phanat Nikhom as a new district.

### Improvements

- 24 preset restaurants in Ladprao, Ratchayothin, Samyan and Siam that had only a map link now
  also link to the brand's own Facebook, Instagram, LINE, TikTok, X, website or menu pages.

### Bug fixes

- Yi Fang is gone from the Samyan preset, because the brand left Thailand in October 2024.
- Pathe in the Ladprao preset no longer lists a phone number that belonged to its Victory
  Monument branch.

### Decisions

- Nine restaurants keep only their map link, because no official page could be tied to that
  branch. A wrong page sends people to the wrong shop, which is worse than no page.
- Pages on a parent company's site (Ssamthing Together on Maguro Group's site, Lotus's Eats on
  Lotus's corporate site) are not used as `website`, which is for a brand's own homepage only.
- The Phanat Nikhom preset covers only the town centre. Lotus's is the only large store there,
  so cafés and shops further out (Overcome, Yoo Barn, GMT+7 and others) were left out. 18 of
  its places are tagged `unverified`, mostly chain branches with no dated recent review.

## 2026-10-23: Labelled links, names in English and Thai, and a Samyan Mitrtown preset

### BREAKING CHANGES

- A restaurant's `name` is now `{ en, th }` instead of a string, and the export format goes
  from version 5 to 6. Saved lists and version 1–5 files convert on read; code that reads
  `name` as a string must use `displayName` (or `localize`) instead.
- Every bundled preset restaurant has a new random 8-character id. A preset added before this
  change is not recognised as added, and adding it again creates duplicates; delete those
  restaurants and add the preset again.
- A restaurant's single `link` string is now `links`, a list of `{ label, url }`, and the
  export format goes from version 6 to 7. Saved lists and version 5–6 files convert on read,
  each old link becoming one unlabelled link; code that reads `link` must read `links` (or
  `openLinks`, which keeps the http(s) ones in priority order).
- The preset-data upsert script takes a draft `links` list instead of `link`, and refuses any
  label that is not one of the preset labels.

### Features

- Each restaurant has an English and a Thai name. The add/edit form shows both fields, the
  current language first, and needs at least one. Lists, the picker, history and prompts show
  the current language's name and fall back to the other when it is empty.
- Search on the Restaurants page matches either name; a row found only by its other-language
  name shows that name, highlighted.
- A new Samyan preset (Samyan Mitrtown, Pathum Wan) with 56 places, including the 24-hour zone
  and the Samyan Food Legends and K-StrEAT food halls.
- The Siam preset grows from 29 to 87 places and adds Siam Discovery.
- A restaurant can have several links, each with an optional label. The form shows one row
  per link (label and URL) with Add link and Remove; a row whose URL is not http(s), or that
  has a label but no URL, shows its own error, and blank rows are dropped on save.
- Link labels suggest `main`, `map`, `facebook`, `instagram`, `line`, `tiktok`, `x`,
  `website`, `menu` and `delivery`, shown in the current language. A blank label is filled in
  from the link's site (facebook.com, lin.ee, twitter.com, Google Maps and so on).
- The restaurant's name, and the list's open-link button, open the link with the highest
  priority: main, map, then the social sites, website, menu, delivery and any other label.
  With two or more links the picker card shows each one as an icon in that order, named in
  its tooltip and for screen readers.
- Every preset restaurant has a map link, and most also link their official homepage, social
  accounts, menu page and the brand's own ordering or delivery pages: about 1,300 links in
  all, up from one per restaurant.

### Improvements

- Bundled presets are version 6 files with every name under `en`. The preset-data skill's
  upsert script takes a draft `name` as a string (English) or `{ en, th }`, merges only the
  languages given and matches existing restaurants by either name.
- `Localized` and `localize` moved from `#lib/presets` to `#lib/i18n`, and `localize` now
  falls back to the other language when the current one is blank.
- Preset names are the brand only, with the Thai name in `th` and no ` - <place>` suffix; a
  brand uses one spelling, Thai name and link in every preset.
- Every preset restaurant has a link: the brand's website, else its social page, else a Google
  Maps search. Floors and hours were corrected from official directories (most of The Mall
  Ngamwongwan is on 5F).
- Presets drop 8 duplicates and 2 closed Teenoi branches, merge tags that meant the same thing
  (`grill` and `bbq`, `kakigori` and `bingsu`) and move cuisine words from tags to cuisine.
  Places not confirmed open in 2025-2026 carry a plain `unverified` tag.
- The preset-data upsert script matches and dedupes restaurants by name and area, since
  branches of a brand now share a name.
- Link labels compare like tags, ignoring case and extra spaces, so `MAP`, `map` and
  `แผนที่` are the same label.
- Presets drop places found closed or no longer listed (Din's, Gogida and Makai at Samyan
  Mitrtown, Nabezo Premium at Siam Paragon, BEANS at Siam Discovery, bonnana at Central
  Ladprao), move Panda Mala to Major Ratchayothin 3F and mark Saint Etoile `unverified`.
  Links whose domains now serve spam or belong to another branch or country were removed.
- The preset-data skill writes version 7 files with every link it can confirm, a label per
  social site and one homepage per restaurant.

### Bug fixes

- On wide screens the edit panel fits the screen and scrolls, so a long form can reach Save;
  before, the panel ran off the bottom of the window.
- On phones, tag suggestions show above the pinned Save and Cancel row instead of under it.

### Decisions

- An old one-string name becomes Thai only when it is all Thai script with no Latin letters.
  Preset names like `Sushiro (ซูชิโร่) - Siam Paragon` stay English: some brackets hold a
  description rather than a name, so splitting them automatically would guess. Thai preset
  names were then split by hand later the same day.
- Preset ids were regenerated rather than kept, because the app is not public yet and some
  ids were readable slugs (`lifeladprao-05`).
- Where no brand website or social page could be confirmed, the link is a Google Maps search
  rather than a guessed URL.
- History keeps each visit's name as one string, the name shown when Eat here was pressed;
  a restaurant that still exists shows its current name in the current language.
- Preset link labels are stored as English keys and shown translated, so a list reads right
  in either language; free-text labels are still allowed rather than a fixed menu.
- Social links are labelled by site rather than one `social` label, so the picker can show
  each platform's icon.
- A preset restaurant keeps only its brand's homepage, not branch or "find us" pages, since
  the map link already finds the branch.
- Preset links come only from pages seen while researching, never guessed URLs. 37 preset
  restaurants still have only a map link because the session's web-search limit ran out.
- Places with weaker signs of closing (Saint Etoile, Tim Ho Wan) are tagged `unverified`
  instead of removed.

## 2026-10-18: Delete only restaurants, and About names its environment

### Features

- Settings › Reset has a Delete restaurants row that empties the restaurant list and forgets
  which presets were added, keeping history, groups, theme and language. It asks first, is
  greyed out while there are no restaurants, and says how many it deleted.

### Improvements

- Settings › Reset reads Delete restaurants, Delete history, Delete all data: "Clear history"
  is now "Delete history" (Thai ลบประวัติ). Delete restaurants and Delete history share one
  card, Delete all data keeps its own, prompts open in place inside the card, and each result
  shows under its card.
- `<history-clear>` no longer draws its own card or result line; it fires `history-cleared`
  with the number of visits deleted, and the settings panel shows the message.

- About always names where the page came from — `production`, `preview`, `local` (a
  `bun run build` on a workstation) or `development` (`bun run dev`) — and lists its rows as
  Environment, Built, Source on GitHub, Commit, Changelog. The commit and changelog show only
  on a deployed page, the build time everywhere but the dev server, and the pull request and
  branch only on a preview. The "Development build" row is gone.
- The `build` script stamps `BUN_PUBLIC_BUILD_DATE` itself, so local builds show their build
  time too; the deploy workflows now set `BUN_PUBLIC_ENVIRONMENT` instead of the date.

### Bug fixes

- Production About said "Development build" instead of showing its commit and build time.
  Production sets no branch or pull request, so the bundle kept those as reads of
  `process.env`, which throw in the browser, and one shared `try` blanked every value. Each
  variable now reads on its own.

### Decisions

- A build with no named environment counts as `local`, and one with no build date at all as
  `development`, so `bun run dev` needs no variable of its own.
- Delete restaurants also clears the added-preset records: with the restaurants gone they
  would only leave presets marked as added with nothing behind them.

## 2026-10-17: Neighbourhood presets, a new filter bar, search by name and a new Tags page

### BREAKING CHANGES

- A restaurant's `location` is now `link`, and the export format goes from version 4 to 5.
  Saved data and imported files convert on read: a location that is a link becomes the
  link, and any other location moves to the first line of the notes. Code that reads or
  writes `location` must use `link`.
- The restaurant form only accepts a link starting with `https://` or `http://`; free text
  such as "Central Ladprao, 4F" now belongs in Notes.
- The Tags page moved from `/tags` to `/settings/tags`, and `/tags` is gone (no redirect, as
  the app is not public yet). Reach it from Settings › Organise › Tags; update any bookmark.
- Home's wide filter side panel and its **Hide** / **Filter** toggle are gone, and
  `whattoeat:filter-panel` is no longer read. The filter now sits in a row of pills under the
  title on every width.
- `cycleTag` is gone from `#lib/filter`; use `setTagState(filter, group, value, state)`.

### Features

- The Tags page lives under Settings at `/settings/tags`, opened from a new **Organise**
  section after Appearance. It has a back link to Settings, and the Settings tab stays marked.
- The Tags page is rebuilt to match Restaurants and to stay usable with many groups:
  - Pick one group at a time. On phones a pill strip scrolls sideways and stays pinned with the
    header; from 768px the pills wrap; from 1024px a groups column sits on the left.
  - The subtitle follows the picked group (`4 values · 30 restaurants`, or that plain tags are
    not used by the home filter).
  - Search finds group names and values across every group, with the match highlighted. A group
    result picks that group; a value result opens it.
  - Editing is done in forms like the restaurant form, in a bottom sheet on phones and a side
    panel from 768px: **New group** (the `+` button), **Edit** for a custom group (a pencil next
    to search: rename, move up or down, delete) and a value's form (name and group together,
    with the merge and delete prompts in place). Moving up or down saves at once.
  - Type stays visible with how many restaurants use each value, as dashed rows with no arrow,
    so it reads as information only.
- A Neighbourhoods page at `/settings/presets` fills the list from ready-made restaurant lists
  bundled with the site: Ladprao (144 restaurants), Ratchayothin (55), Siam (29, across Siam
  Paragon, Siam Center and Siam Square One) and Ngamwongwan (12, at The Mall Ngamwongwan, the
  first preset outside Bangkok, under Nonthaburi). Tick one or more,
  grouped by district, and press **Add to my list** to merge them in, or switch to **Replace
  my list** to swap the whole list after an inline confirm. Both offer Undo for 6 seconds.
  Presets you have added show **Added**; one whose list changed since shows **Update**.
- A search field (name, district or mall) and city chips appear on the Neighbourhoods page
  once there are more than 7 presets or 2 or more cities.
- Settings › Import starts with a **Neighbourhood presets** row showing how many you have
  added, and the empty Home card leads with **Start with a neighbourhood**, with **Add some
  restaurants** beneath it as the secondary choice.
- Preset lists live in `src/assets/data/presets/` and are served from `/data/presets/`, with
  an `index.json` holding each preset's names in English and Thai, district, malls and count.
  `bun run presets:index` refreshes the counts, and tests fail when the index and the files
  disagree.

- Restaurants has a search button. It turns the title row into a search field
  with a clear button and Cancel, and the list narrows to names that contain every word you
  type, in any order. Case and Latin accents are ignored ("cafe" finds "Café"); Thai is
  matched as typed. The matched part of each name is bold.
- "2 of 157 restaurants" shows while searching; screen readers hear it once typing pauses.
- When nothing matches, a card offers **Add "…"**, which opens the new-restaurant form with
  the name filled in, or **Clear search**.
- The keyboard's Search key opens the restaurant when only one matches, and otherwise puts the
  keyboard away so every result is in view. On wide screens `/` opens search and `Esc`
  closes it.

- A pull request preview marks itself on every page: an amber line where the page meets the
  nav (on top of the phone tab bar, under the wide top bar), and a browser tab title starting
  with `[Preview]`. Production shows neither.
- Settings › About names a preview's pull request: **Source on GitHub** shows `#34 -
  branch-name` beneath and opens the pull request. A new **Environment** row reads
  `production` or `preview`. The preview workflow passes the number and branch to the build
  as `BUN_PUBLIC_PR_NUMBER` and `BUN_PUBLIC_BRANCH`.

- A restaurant can have a link: a map, its website or a social page. On the Home result its
  name opens the link in a new tab, and in the Restaurants list an open-link button sits
  beside the row.

- Home and Restaurants share a new filter bar: one pill per group (Type, Cuisine, Area, custom
  groups, and plain tags on Restaurants only), each with a badge counting its chosen values,
  grey when the group only skips. **Clear all** follows the pills.
- Opening a pill lists the group's values, each with how many restaurants use it and its own
  **✓ Want** and **✕ Skip** buttons; pressing the lit one again clears it. From 768px it opens
  as a popover under the pill (Done, Escape or a click outside closes it); on phones as a
  sheet with a tab per group and a **Show N restaurants** button.
- A group with more than 10 values gets a search box and lists the values chosen before it
  opened under **Selected**, then the 8 most used, then **Show all** for the rest, A to Z.
- Restaurants has its own filter, using the same bar with plain tags added. The list, search
  and count follow it ("1 of 3 restaurants"). When nothing matches, a card offers **Clear**.
- The Restaurants filter is saved under `whattoeat:list-filter`, apart from Home's
  `whattoeat:filter`. Renaming, moving or deleting a value on the Tags page updates both.
- Home picks 1 to 5 restaurants per press instead of always two; the default stays 2. A
  − n + stepper sits beside the pick button (in the heading row from 768px, showing
  "2 per pick"; in the pinned bar on phones, showing the number alone), and Settings has a
  **Restaurants per pick** row under Language and Theme. Both save the same
  `whattoeat:pick-count`.

### Improvements

- The Ratchayothin preset drops Ohkajhu at Major Ratchayothin (closed), moves Sushiro there
  to 2F, and adds After You, a dessert cafe on 1F. It shows **Update** for anyone who added
  it before.
- On phones the Restaurants title row, and the search field while searching, stay at the top
  of the screen, so search is one tap away in a long list.
- Editing from the results keeps the search; after a save, focus lands on the saved
  restaurant, or back in the field if it no longer matches. A change in another tab re-filters
  the results, and emptying the list ends search.
- From 768px the Restaurants edit panel starts hidden and the list takes the full width. Add
  opens the panel beside the list and pressing it again hides it; Add while editing switches
  to a new restaurant instead. Clicking a row opens the panel for editing, and Save, Cancel,
  Delete or the panel's new close button hide it again, returning focus to Add (or to the
  search field while searching).
- Add on Restaurants is a round plus button, in the header and pinned on phones, labelled
  "Add restaurant" for screen readers and on hover. The empty list card has its own "Add
  restaurant" button.
- `restaurant-manager` is split into `restaurant-search`, `restaurant-list` and
  `restaurant-form` under `src/components/restaurant/`. Each has its own shadow root and
  styles, takes data through properties and reports back with events, so each is tested alone
  without the store. `restaurant-manager` keeps the store, the sheet and side panel, and the
  form state. Name matching and the count line (`searchByName`, `noMatch`, `countText`) moved
  to `#lib/search`.
- `app-sheet`'s `containsFocus()` now sees focus inside a slotted component's own shadow
  root, so closing the sheet does not take focus back from where the page put it.
- `app-header` takes a `base` attribute (default `./`) that prefixes every tab link, so a
  page one folder deep, like `/settings/presets`, passes `base="../"`. A new `<app-toast>`
  shows a short message with an optional action button.
- A page whose pinned bar is taller than Home's sets `--pinned-space` from its measured
  height, so the Undo message and keyboard scrolling clear the whole bar.
- The **Built** row in Settings › About puts its title on the left and the date on the right,
  like **Environment**.
- The wide top bar is shorter: 64px on touch screens and 52px with a mouse, down from 76px and
  60px.
- A new `preset-data` agent skill covers creating and updating neighbourhood presets, from web
  research or a pasted list, with the field conventions of the existing files. Its
  `upsert-preset.ts` script applies a small draft to a preset file, giving new restaurants ids
  that no other preset uses, setting timestamps and the index entry's `updatedAt`, and keeping
  each restaurant's place and floor as the first line of its notes.
- Screen readers hear every pick by name as a list ("Picked A, B, and C"), however many a
  press shows.
- The Tags link is gone from the Restaurants header, which now shows only search (and Add from
  768px).
- `restaurant-search` takes its wording from the page through a `labels` property, and the
  match highlighting both lists use lives in `#lib/highlight`. The tags page parts are in
  `src/components/tags/` (`tag-picker`, `tag-list`, `tag-value-form`, `tag-group-form`).

### Bug fixes

- While searching, screen readers read the result count once instead of twice: the title kept
  for them had its own copy of "N of M restaurants".

### Decisions

- Search matches names only, because it is for finding a place you already know in order to
  edit it; browsing by cuisine or area stays with the Home filter.
- It sits behind a header button that turns the title into the field, iOS style, rather than
  an always-visible field or a separate sheet. The field is focused inside the tap itself,
  because iOS only opens the keyboard for a focus made during the tap.
- Only Latin accents are folded (U+0300 to U+036F). Thai vowel and tone marks are combining
  marks too, and stripping them would make different Thai words match; a highlight always
  takes the marks after the last matched letter, so they are never split from their letter.
- The visible count updates at once, while a separate hidden line speaks it after a 500 ms
  pause, so screen readers are not interrupted on every key.
- The title row stays put only on phones; from 768px the edit side panel is already the part
  that stays in view, and two stuck areas would overlap.
- Tags shows one group at a time behind a picker, rather than every group stacked as a card, so
  any group is one tap away however many there are. The picker changes shape with the width
  (pills, wrapping pills, a column) rather than one layout everywhere.
- The open form's typed text lives in the page, not the form, because the sheet and the side
  panel are different elements: resizing across 768px moves the form without losing it.
- There is one form at a time: opening another drops the first's unsaved edits, as tapping
  another restaurant does. Picking a group or starting a search leaves it open.
- The line above the values that named the group's kind was dropped after review: the subtitle
  carries the counts, Edit sits next to search, and the dashed Type rows need no "fixed" label.
- The edit panel used to always show an empty "New restaurant" form, which repeated the Add
  button in the header. Hiding it until Add or a row opens it gives the list the full width
  and works like the phone sheet. Closing it drops anything typed, the same as closing the
  sheet.
- The restaurant parts are separate custom elements rather than render functions sharing one
  shadow root, so a test of one never has to mount or mock the others. `restaurant-form` is
  controlled by the manager rather than keeping its own state, because the side panel and the
  phone sheet are two form elements, and what is typed must survive crossing between them.
  `restaurant-search` uses `display: contents` so its row and count stay items of the sticky
  top bar's grid.
- Presets get their own page rather than a row per preset in Settings or a popup, so the list
  stays usable with dozens of neighbourhoods across several cities. Home is unchanged apart
  from the empty card.
- Add never changes a restaurant already in your list, so your edits survive adding a preset
  that contains it. Replace changes only restaurants: history and custom groups stay. The mode
  goes back to Add each time the page opens, so Replace is never left on by accident.
- Which presets you have added is kept in `whattoeat:presets` with the restaurant ids each one
  brought in. A preset counts as added only while at least one of those restaurants is still
  saved, so emptying the list by hand never leaves every preset locked. The record is written
  only after the list itself saved. It is not part of the export file, so another device shows
  the presets as not added, and adding them again changes nothing.
- The preset index is committed and edited by hand rather than generated during the build,
  which stays a single `bun-server` command; a test keeps it honest.
- Three follow-ups that only matter once there are more presets are in `TODO.md`.
- The preview marker started as a "Preview #34" label, first at the top of the screen and
  then on the phone tab bar. It covered page titles in one spot and caught taps meant for the
  tabs in the other, so it became a line with no text or tap target. The pull request details
  moved to Settings › About, where they are one tap from the source link.
- Environment is worked out from whether a pull request number was passed in, rather than
  from a separate variable that could disagree with it.
- In the Restaurants list the link is a button beside the row rather than the name itself,
  because the whole row is already the edit button and a link cannot sit inside a button.
- An old text location goes into the notes rather than being dropped, so nothing typed is
  lost. The bundled Ladprao and Ratchayothin presets were rewritten the same way, so their
  mall and floor now lead each note.
- The Restaurants filter is kept separate from Home's rather than shared, so narrowing the
  list to review or edit some places never changes what Home picks from. Plain tags filter
  only there; Home still filters groups alone, so a value moved into plain tags stays in the
  Restaurants filter and drops out of Home's.
- The filter was redesigned because tapping a value once to include it, twice to exclude it
  and again to clear it could only be learned from hint text. Three directions were mocked
  up: a Want/Skip mode switch over the old chips, group pills with dropdowns, and a search
  box that reads the filter back as a sentence. Group pills won: compact, familiar from
  shopping and map apps, and the same with a mouse or a finger.
- Within the pills, a value gets two buttons (Want and Skip) rather than a checkbox with a
  smaller Skip button, or one Any of / None of rule per group. Both actions stay visible and
  equal, and a group can still want one value and skip another (Tags: cheap, not spicy).
- In a big group, a value chosen while it is open stays where it is and moves under
  **Selected** only the next time the group opens, so a row never jumps away from the pointer.
- Home's side panel was dropped rather than kept beside the pills, so both pages filter the
  same way and the picks get the full width (two to a row from 768px).
- The pick count was mocked up four ways: a stepper beside the pick button, an extra pill in
  the filter row, an inline link in the count line, and a Settings row only. The stepper
  keeps the count next to the action it changes; the Settings row stays as well, for anyone
  who sets it once and leaves it.

## 2026-10-16: Mobile redesign, one-tap JSON paste and shared restaurant names

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
- History (stage 4) groups visits under Today, Yesterday and date headings; each row shows the
  name and time with a Delete button named "Delete visit to {name} at {time}". Stats sit in
  their own card that scrolls sideways.
- Tags (stage 4): each value is a row you tap, with its restaurant count; rename, move and
  delete open in a bottom sheet on phones, or in a side panel from 768px that says "Choose a
  value to rename, move or delete it." until one is picked. A custom group's options (rename,
  move up or down, delete) open in a sheet.
- Settings > Reset has a "Clear history" row, greyed out with no history, that opens a sheet
  to clear visits older than 1 week, 1 month or 1 year, or all of them, each with its count;
  "Deleted N visits." confirms it.
- The site can be installed (stage 5): every page links `manifest.webmanifest` (opens full
  screen at Home, off-white `#f6f5f2`) and a home screen icon, and sets the iPhone "Add to
  Home Screen" tags. The new square icon (the favicon's plate, fork and knife) comes as SVG
  and 180, 192 and 512px PNGs, the 512 also as an Android maskable icon.

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
- Home now shows its "What to Eat" title.
- Clearing history moved from the end of History into Settings, under Reset.
- History, Tags and Restaurants show the same centred empty-state card as Home, with the next
  step as a button.
- Sheets open with focus on their title instead of a button, so nothing looks pressed on a
  phone before a tap; side panels on wide screens still start on their first control.
- Sheets slide back down when they close, keeping their content until they are gone, and the
  page behind an open sheet no longer scrolls.
- The restaurant list is compact: each row shows the name and type line only; location, notes
  and tags are in the form. Delete moved from every row to the end of the edit form, behind a
  prompt that names the restaurant.
- Clear in Home's filter is a full-size button instead of a small inline link.
- Picks are white tiles with a pin on the location and a soft red "Eat here" button; on wide
  screens two sit side by side from 960px.
- `IDEAS.md` is now `TODO.md`, and the README links point to it.
- `TODO.md` lists five more planned features: a location that only accepts a link (making the
  restaurant name clickable on the random result and the restaurant list), an iOS-style
  floating tab bar on phones, filtering by tags, filtering by buffet, and search on the
  restaurant and tag lists.
- Two restaurants can have the same name. The form no longer shows "A restaurant with this
  name already exists." when adding or editing; a blank name is still refused.
- Import keeps every restaurant name as it is in the file, instead of adding a ` - <n>` suffix
  to names that repeat in the file or are already saved.
- Settings > Import: "Paste JSON" is one row that reads the clipboard and checks the export
  at once. The text box and Check only open when the browser blocks the clipboard, has none,
  or the clipboard is empty.
- An import, from a file or the clipboard, is saved straight away when no restaurants,
  history or groups are saved yet, instead of asking to replace or merge.
- This changelog has one entry per day: entries that shared a date are merged, and each
  title names only that day's most important changes. The `changelog` skill now merges new
  work into the day's entry instead of adding a second heading.

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
- After deleting or moving a value from its sheet on Tags, focus no longer lands on a different
  value's row; it goes to the Add a group field.
- Screen readers now hear why a group cannot move further up or down, and the "Move to…"
  action's spoken name starts with its visible text.
- The Delete all data prompt is padded on every side instead of sitting on its card's edge.

### Decisions

- The first preview used a street-sign palette (paper, chili red, sign yellow) with Anuphan;
  it felt too vivid and too large, so the "Calm neutral" variant was chosen from mockups over
  a warm cream one.
- The compact density keys on the pointer (`hover: hover` and `pointer: fine`), not the
  screen width, so tablets and touch laptops keep touch-sized controls.
- Fonts are inlined as data URIs in the bundled CSS because the build refuses unresolved
  `url()`s; static font files would need a separate copy step.
- The redesign ships in five stacked pull requests from one spec
  (`docs/superpowers/specs/2026-10-15-mobile-redesign-design.md`); all five stages are in.
- Home switches between the sheet and the side panel with a media-query controller
  (`src/lib/media.ts`) rather than CSS alone, so only one copy of the filter and of the pick
  button ever exists.
- Filter chips are 36px tall, as in the chosen mockup, rather than 44px; that is still above
  the 24px WCAG AA minimum.
- Closing the restaurant sheet without saving discards the edit rather than keeping a draft,
  so the sheet always opens on what is saved.
- "Add a group" on Tags stays an inline card rather than a sheet: it is where focus goes after a
  value or group is moved or deleted, so it must always be on the page.
- A closing sheet is closed at once (focus moves, the page is usable) and only drawn for the
  slide-down, rather than waiting for the animation before closing.
- The app icons ship with `--statics src/assets/icons:icons` because the bundler copies the
  manifest but does not follow the icon paths inside it. Offline use (a service worker) was
  left out and added to `TODO.md`.
- With nothing saved there is nothing to lose, so the Replace or Merge question is only
  asked when restaurants, history or groups already exist.

## 2026-10-15: Cuisine, area and custom tag groups with a Tags page

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

## 2026-10-14: Visit history and clearing old visits

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

## 2026-10-13: Dark mode, two picks per press, lock history and type, cuisine and area filters

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

## 2026-10-12: Random restaurant picker with English and Thai

### BREAKING CHANGES

- `GET_START.md` no longer creates the repository: run its prompt inside a copy you already
  have, made with **Use this template** or by cloning the template. An agent started in an
  empty directory now stops and asks you to clone first.
- The template's `hello-world` component and its test are gone; the home page is now the
  random restaurant picker.

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
- Every page has a site icon (an orange plate with fork and knife), so browser tabs show it
  and the console no longer reports a `/favicon.ico` 404.
- `IDEAS.md` lists features left for later — tag filter, weighted random, pick history,
  cloud sync, CSV, separate English and Thai names, recovering invalid entries in the app,
  dark mode — each with what it gives and what makes it more than a small change.

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
- The README describes this app rather than the template: getting started clones
  `kamontat/whattoeat`, the template customization steps and the missing `GET_START.md`
  are gone, and a new "Data and storage" section lists the `localStorage` keys and how to
  recover entries from the `whattoeat:restaurants:invalid` backup.
- `tests/routes/pages.test.ts` fails if a page stops linking the icon.

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
- Browser storage only, no backend: each device keeps its own list and JSON export/import
  moves it between devices.
- Restaurant names are one free-text field; only the interface is translated.
- Pages are `restaurants.html` and `settings.html` rather than `*/index.html`, so links
  have no trailing slash and the built chunks resolve.
- Stored entries that fail validation are copied to `whattoeat:restaurants:invalid`
  before a save drops them, rather than being lost or blocking the app.
- The icon is an SVG under `src/assets/` linked from each page, so the build bundles it as a
  hashed asset; no `--statics` folder or `favicon.ico` was added.
