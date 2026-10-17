# Neighbourhood Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #28's per-preset Settings rows with a `/settings/presets` page where people tick neighbourhoods and add them to, or replace, their restaurant list.

**Architecture:** Preset files and a hand-kept `index.json` ship as statics under `/data/presets/`. `src/lib/presets.ts` holds the pure parts: the index schema, the `whattoeat:presets` storage key, row state, and the add and replace calculations. A new `<preset-picker>` component on `src/routes/settings/presets.html` renders and drives it. `<app-toast>` provides the Undo message. `app-header` gains a `base` attribute so the first nested page links correctly. Settings and the empty Home card link to the page.

**Tech Stack:** Bun, Lit 3, TypeScript, Biome, `bun test` with happy-dom, `@kctools/bun-server` statics.

**Spec:** `docs/superpowers/specs/2026-10-17-neighbourhood-presets-design.md`

## Global Constraints

- Branch `worktree-import-presets` (PR #28), worktree `.claude/worktrees/import-presets`. Every task runs `bun run format`, `bun run check`, `bun run test` and `bun run build` before its commit (the `shipping-a-change` skill).
- Test first: write the failing test, watch it fail for the right reason, then code.
- Statics: `--statics src/assets/icons:icons --statics src/assets/data:data src/routes` on both `dev` and `build`. Drop `src/assets/presets:presets`.
- URLs are relative, never root-relative. From `/settings/presets` the base is `../`; from root pages it is `./`.
- Storage key `whattoeat:presets`; value `AddedPreset[]`, where `AddedPreset = { id, updatedAt, ids }`.
- Undo message: shows for 6000 ms, paused while hovered or focused; "Undone." shows for 3000 ms.
- Search shows when `presets.length > 7`; city chips show when there are 2 or more cities.
- Touch targets are 44px (`var(--tap)`), as elsewhere. Every string goes through `t()` in `src/lib/i18n.ts`, in English and Thai. English copy is verbatim from the spec's Copy table.
- No change to the export format (version 4) or to file and paste import.

## Review Focus

1. **The list is emptied by hand and you come back via "Start with a neighbourhood".** Every preset must be tickable, because none of its ids are saved. Test this in Task 2 (`presetState`) and Task 5.
2. **You add a preset, then edit one of its restaurants, then add an overlapping or updated preset.** The edited restaurant must be unchanged. Test this in Task 2 (`addPresets`).
3. **One of two ticked files fails to load.** Nothing is saved, the selection is kept, and the error shows. Test this in Task 6.
4. **Undo after Replace when localStorage refuses the write.** The list goes back to what it was in memory, and the storage warning shows, not a success message. Test this in Task 6.
5. **The index returns 200 with JSON of the wrong shape**, for example a missing `presets` array or a bad entry. Treat it as a load failure with Retry, never a crash. Test this in Task 2 (`parseIndex`) and Task 5.

---

### Task 1: Move preset data under `/data/presets/` with an index

**Files:**
- Move: `src/assets/presets/ladprao.json` → `src/assets/data/presets/ladprao.json`; same for `ratchayothin.json`
- Create: `src/assets/data/presets/index.json`
- Create: `scripts/presets-index.ts`
- Modify: `package.json` (statics on `dev` and `build`; new script `"presets:index": "bun scripts/presets-index.ts"`)
- Rewrite: `tests/lib/presets.test.ts` (data checks only; PR #28's `PRESETS` and `presetUrl` tests go)

**Interfaces:**
- Produces: the files at `src/assets/data/presets/` and the index shape in the spec ("Index"), with top-level `version: 1`, `cities`, `districts` and `presets`.

- [ ] **Step 1: Write the failing data tests** in `tests/lib/presets.test.ts`, reading the files with `Bun.file`:
  - `index lists exactly the preset files`: the ids in `index.presets` equal the `*.json` basenames other than `index` (sorted, with `Glob`).
  - `<id>: count matches the file`: `parseImport(file).restaurants.length === entry.count`.
  - `<id>: every restaurant's area is one of the entry's areas`: `entry.areas` contains `groupValues(item, "area")[0]`.
  - `restaurant ids are unique across all preset files`.
  - `every city and district id has en and th names`.
- [ ] **Step 2: Run** `bun test tests/lib/presets.test.ts`. Expected: FAIL, because `src/assets/data/presets/index.json` is not found.
- [ ] **Step 3: Move the files with `git mv` and write `index.json`.**
  - `cities.bangkok = { en: "Bangkok", th: "กรุงเทพฯ" }` and `districts.chatuchak = { en: "Chatuchak", th: "จตุจักร" }`.
  - **ladprao:** `name { en: "Ladprao", th: "ลาดพร้าว" }`, `count: 144`, `updatedAt: "2026-10-16"`.
    - `places`: `["Central Ladprao", "Union Mall", "Lotus Ladprao", "Ha Yaek Lat Phrao", "Lat Phrao Soi 15"]`
    - `areas`: `["central ladprao", "union mall", "lotus ladprao", "ha yaek lat phrao", "lat phrao"]`
  - **ratchayothin:** `name { en: "Ratchayothin", th: "รัชโยธิน" }`, `count: 55`, `updatedAt: "2026-10-16"`.
    - `places`: `["Major Ratchayothin", "Avenue Ratchayothin", "SCB Park"]`
    - `areas`: `["major ratchayothin", "avenue ratchayothin", "ratchada"]`
- [ ] **Step 4: Write `scripts/presets-index.ts`.** It reads the index, sets each entry's `count` from its file's `restaurants.length`, and writes the index back with tabs and a trailing newline. It exits 1, naming the id, when a file is missing. Update the `package.json` statics and add the script.
- [ ] **Step 5: Run** `bun run presets:index && git diff --stat src/assets/data`. Expected: no change to `index.json`. Then run the tests: PASS.
- [ ] **Step 6: Run the full list** (format, check, test, build). Confirm that `dist/data/presets/index.json` exists and `dist/presets/` does not.
- [ ] **Step 7: Commit** `feat(assets): serve neighbourhood presets and their index from data/presets`.

### Task 2: Preset logic in `src/lib/presets.ts`

**Files:**
- Rewrite: `src/lib/presets.ts` (PR #28's `PRESETS` and `presetUrl` go)
- Test: `tests/lib/presets-logic.test.ts`

**Interfaces:**
- Produces (all exported from `#lib/presets`):
  - `type Localized = { en: string; th: string }`
  - `type PresetEntry = { id: string; city: string; district: string; name: Localized; count: number; updatedAt: string; places: string[]; areas: string[] }`
  - `type PresetIndex = { version: 1; cities: Record<string, Localized>; districts: Record<string, Localized>; presets: PresetEntry[] }`
  - `type AddedPreset = { id: string; updatedAt: string; ids: string[] }`
  - `type PresetState = "new" | "added" | "update"`
  - `type PresetFile = { entry: PresetEntry; restaurants: Restaurant[] }`
  - `PRESETS_KEY = "whattoeat:presets"`
  - `parseIndex(data: unknown): PresetIndex | undefined`: `undefined` on any shape error. It requires every entry's `city` and `district` to exist in the maps.
  - `indexUrl(base: string): string` returns `${base}data/presets/index.json`
  - `presetFileUrl(base: string, id: string): string` returns `${base}data/presets/${id}.json`
  - `localize(text: Localized): string`, picking `text[getLang()]`
  - `loadAddedPresets(): AddedPreset[]`: skips unreadable entries, and returns `[]` on bad JSON or blocked storage
  - `saveAddedPresets(list: AddedPreset[]): boolean`: `false` when localStorage refuses the write
  - `presetState(entry: PresetEntry, added: readonly AddedPreset[], savedIds: ReadonlySet<string>): PresetState`
  - `addPresets(saved: Restaurant[], files: PresetFile[], added: AddedPreset[]): { list: Restaurant[]; added: AddedPreset[]; newCount: number }`
  - `replaceWithPresets(files: PresetFile[]): { list: Restaurant[]; added: AddedPreset[] }`
  - `fetchIndex(base: string): Promise<PresetIndex>` and `fetchPresetFiles(base: string, entries: PresetEntry[]): Promise<PresetFile[]>`. Both reject on a network error, a non-OK status, or a failed `parseIndex` / `parseImport`.

- [ ] **Step 1: Write the failing tests.** Use small hand-made `PresetEntry` and `Restaurant` fixtures (copy `make()` from `tests/components/data-transfer.test.ts`):
  - `parseIndex rejects a missing presets array, an entry with an unknown district, and a non-number count`
  - `parseIndex accepts the bundled index` (read the real file)
  - `presetState is "new" when not recorded`
  - `presetState is "new" when recorded but none of its ids are saved` (Review Focus 1)
  - `presetState is "added" when recorded, an id is saved, and updatedAt matches`
  - `presetState is "update" when recorded, an id is saved, and the stored updatedAt is older`
  - `addPresets keeps an existing restaurant untouched when a preset has the same id` (Review Focus 2: an edited name survives)
  - `addPresets counts a restaurant in two files once`: `newCount` and `list.length` both reflect it
  - `addPresets records each file with entry.updatedAt and all of its file ids, replacing an older record for the same id`
  - `replaceWithPresets returns only the files' restaurants, deduped, and records exactly those presets`
  - `loadAddedPresets returns [] for bad JSON and drops entries without a string id`
  - `fetchPresetFiles rejects when one of two files returns 404` (stub `fetch` as in data-transfer tests)
  - `fetchIndex rejects a 200 with the wrong shape` (Review Focus 5)
- [ ] **Step 2: Run** `bun test tests/lib/presets-logic.test.ts`. Expected: FAIL, because the exports do not exist.
- [ ] **Step 3: Implement** the interfaces above in `src/lib/presets.ts`. Keep the storage style of `src/lib/groups.ts` (try/catch around `localStorage`, no event needed). Order: `list` is the saved list followed by the new restaurants in file order.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Run the full list and commit** `feat(lib): preset index, added state and add or replace logic`.

### Task 3: `app-header` base and the `presets` page

**Files:**
- Modify: `src/components/app-header.ts`
- Test: `tests/components/app-header.test.ts`

**Interfaces:**
- Produces: `Page` gains `"presets"`. `AppHeader` gains `@property() base = "./"`. `tabOf("presets") === "settings"`. `TITLES.presets = "presets.title"` (the i18n key "Neighbourhoods" / "ย่านร้านอาหาร", added in this task).

- [ ] **Step 1: Write the failing tests:**
  - `base prefixes every tab and the brand link`: with `base="../"`, the hrefs are `../`, `../restaurants`, `../history` and `../settings`.
  - `the default base keeps today's links`: `./`, `./restaurants`, …
  - `presets highlights the Settings tab and titles the browser tab "Neighbourhoods · What to Eat"`
- [ ] **Step 2: Run** `bun test tests/components/app-header.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Store tab hrefs as paths without `./` (`""`, `"restaurants"`, …) and render `${this.base}${path}`.
- [ ] **Step 4: Run** the tests, then the full list. Expected: PASS.
- [ ] **Step 5: Commit** `feat(components): app-header base for nested pages`.

### Task 4: `<app-toast>`

**Files:**
- Create: `src/components/app-toast.ts`; register `"app-toast": AppToast` in `src/types/global.d.ts`
- Test: `tests/components/app-toast.test.ts`

**Interfaces:**
- Produces: `class AppToast` with `show(message: string, options?: { action?: string; onAction?: () => void; duration?: number }): void` and `hide(): void`. The default duration is 6000 ms. It renders `<div role="status">` with the message and an optional `<button data-action="toast-action">`. Clicking the action calls `onAction` and hides. The timer pauses on `mouseenter` and `focusin` and restarts on `mouseleave` and `focusout`. Styling: fixed, `bottom: calc(var(--tab-bar-space) + var(--pinned-space))`, `--color-text` background with `--color-bg` text, as in the mockup.

- [ ] **Step 1: Write the failing tests:**
  - `show renders the message and the action`
  - `the action runs onAction and hides`
  - `it hides after the duration`: stub `setTimeout` as data-transfer's export test does
  - `hover and focus pause the timer`
  - `show again replaces the message and restarts the timer`
- [ ] **Step 2: Run** the tests. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** the tests: PASS, then the full list.
- [ ] **Step 5: Commit** `feat(components): app-toast with an action`.

### Task 5: `<preset-picker>`: loading and the list

**Files:**
- Create: `src/components/preset-picker.ts`; register `"preset-picker": PresetPicker` in `src/types/global.d.ts`
- Modify: `src/lib/i18n.ts` (keys below)
- Test: `tests/components/preset-picker.test.ts`

**Interfaces:**
- Consumes: Task 2's exports; `loadRestaurants` and `onRestaurantsChanged` from `#lib/store`.
- Produces: `class PresetPicker` with `@property() base = "../"`, `@state() index: PresetIndex | undefined`, `@state() loadError: boolean`, `@state() selected: Set<string>`, `@state() query: string`, `@state() city: string | undefined`. Rows are `<label class="item preset" data-preset=${id}><input type="checkbox">…</label>`. Locked rows have the input `disabled`. Badges are `<span class="badge" data-state="added|update|in-list">`.
- i18n keys: `presets.back` "Settings", `presets.loading` "Loading…", `presets.loadError`, `presets.retry` "Try again", `presets.search` "Search area or mall", `presets.hidden` "{count} selected, not shown", `presets.clearSearch` "Clear", `presets.noMatch` "No neighbourhood matches “{query}”.", `presets.badge.added` "Added", `presets.badge.update` "Update", `presets.badge.inList` "In your list", `presets.rowSub` "{count} · {places}", `presets.morePlaces` "+{count}".

- [ ] **Step 1: Write the failing tests.** Stub `fetch` to serve a fixture index with 2 cities, 3 districts and 9 presets, so search and chips both show. A second fixture has 2 presets in 1 city.
  - `shows Loading, then the list grouped by district, with districts and rows sorted by name in the current language`
  - `a failed or malformed index shows the error and Retry; Retry fetches again` (Review Focus 5)
  - `row subtitle shows count, the first two places and +rest`
  - `search and chips are hidden with 2 presets in 1 city`
  - `search matches name, district and places in en and th, across all cities while typed, and highlights the matched place`
  - `chips filter districts by city; switching chip keeps the selection`
  - `ticked rows hidden by search or chip show "{n} selected, not shown"; Clear empties the search and selects the first hidden ticked row's city`
  - `no match shows the no-match line`
  - `in Add mode, an added preset is ticked, disabled and badged Added; an update preset is tickable and badged Update`
  - `a recorded preset whose ids are all gone is tickable with no badge` (Review Focus 1)
  - `a back link points to ${base}settings`
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the loading and list half: no switch, no button actions yet. Highlighting wraps the matched substring of a place in `<mark>`. "Current language" sorting uses `localeCompare` with `getLang()`.
- [ ] **Step 4: Run** the tests: PASS, then the full list.
- [ ] **Step 5: Commit** `feat(components): preset-picker list with search and city filter`.

### Task 6: `<preset-picker>`: mode, add, replace, undo

**Files:**
- Modify: `src/components/preset-picker.ts`, `src/lib/i18n.ts`
- Test: `tests/components/preset-picker.test.ts`

**Interfaces:**
- Consumes: `addPresets`, `replaceWithPresets`, `fetchPresetFiles`, `loadAddedPresets`, `saveAddedPresets` (Task 2); `saveRestaurants` and `isMemoryOnly` (`#lib/store`); `<app-toast>` (Task 4).
- Produces: `@state() mode: "add" | "replace"`, `@state() confirming: boolean`. Controls: `input[name="preset-mode"][value="add|replace"]`, `button[data-action="apply"]`, `a[data-action="go-picker"]`, `button[data-action="replace-confirm"]`, `button[data-action="replace-cancel"]`.
- i18n keys, with copy verbatim from the spec:
  - `presets.mode.label` "When adding", `presets.mode.add` "Add to my list", `presets.mode.replace` "Replace my list"
  - `presets.add` "Add {areas} · {count}", where `{areas}` and `{count}` come from `presets.areas.one/other` ("1 area" / "{n} areas") and `presets.restaurants.one/other`
  - `presets.replace` "Replace with {count}"
  - `presets.goPicker` "Go to picker"
  - `presets.replaceWarning` "Your {count} saved restaurants will be removed."
  - `presets.replacePrompt` "Replace your {saved} restaurants with {count} from {names}? Your history and groups stay."
  - `presets.added` "Added {count} restaurants", `presets.replaced` "Replaced with {count} restaurants", `presets.nothingNew` "Nothing new to add. These restaurants are already in your list."
  - `presets.undo` "Undo", `presets.undone` "Undone."
  - `presets.sessionOnly` "Added for this session only"
  - `presets.filesError` "The selected neighbourhoods could not be loaded. Nothing was changed. Try again."

- [ ] **Step 1: Write the failing tests** (the spec's "Mode switch and pinned button", "Add", "Replace", "Undo message" and "After saving"):
  - `the switch is hidden with no saved restaurants; the mode is Add`
  - `the mode starts as Add on every mount, and changing it clears the selection`
  - `arrow keys move between the two mode options`
  - `with nothing ticked the button is a Go to picker link to ${base}`
  - `in Add mode, the label sums ticked counts, skipping Added rows: "Add 2 areas · 127 restaurants"` (fixture counts 55 and 72)
  - `singular label "Add 1 area · 1 restaurant"`
  - `Add merges, records the presets, clears the selection, and shows "Added {k} restaurants" with Undo`
  - `Add with nothing new shows the nothing-new message with no Undo, and still records the presets`
  - `in Replace mode, Added rows unlock and show In your list; the warning line and the danger button show`
  - `Replace opens the confirm with the counts and names; Cancel returns focus to the button; confirming saves only the ticked restaurants and keeps history and groups`
  - `Undo restores the list and whattoeat:presets from before, then shows Undone.`
  - `one file failing leaves storage untouched, keeps the selection, and shows the files error` (Review Focus 3)
  - `a refused write shows the storage warning and "Added for this session only"; Undo after Replace still restores the in-memory list` (Review Focus 4; stub `localStorage.setItem` to throw)
  - `an aria-live region announces the button label after a change`
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Snapshot `loadRestaurants()` and `loadAddedPresets()` before saving, and keep it in a private field for Undo. The pinned area is `position: sticky; bottom: var(--tab-bar-height)`, in the same style as Home's `.pinned`. The confirm card reuses data-transfer's `.group.confirm` pattern and its focus handling.
- [ ] **Step 4: Run** the tests: PASS, then the full list.
- [ ] **Step 5: Commit** `feat(components): add or replace neighbourhood presets with undo`.

### Task 7: `/settings/presets` route

**Files:**
- Create: `src/routes/settings/presets.html`
- Modify: `tests/routes/pages.test.ts`

**Interfaces:**
- Consumes: `<app-header current="presets" base="../">` (Task 3), `<preset-picker base="../">` (Tasks 5–6).

- [ ] **Step 1: Update the test.** Add `"settings/presets.html"` to `PINNED_PAGES`. Add `settings/presets links its assets one folder deeper`: every `src`/`href` starts with `../../`, except `#main`.
- [ ] **Step 2: Run** `bun test tests/routes/pages.test.ts`. Expected: FAIL, because the page doesn't exist.
- [ ] **Step 3: Create the page** from `src/routes/settings.html`'s head, with every path one `../` deeper, `<html lang="en" class="has-pinned">`, `<title>Neighbourhoods · What to Eat</title>`, and the narrow `<main id="main" tabindex="-1">`. Load `app-header.ts`, `preset-picker.ts` and `app-toast.ts`.
- [ ] **Step 4: Run** `bun run build && bun run preview`. Check that `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/settings/presets` returns 200, and that the page's JS chunk URLs return 200. Then stop the preview.
- [ ] **Step 5: Commit** `feat(routes): neighbourhoods page under settings`.

### Task 8: Settings row and Home empty link; remove PR #28's preset rows

**Files:**
- Modify: `src/components/data-transfer.ts` (remove `loadPreset`, the `PRESETS` rows, the `restaurantsOnly` option and its import; add the link row)
- Modify: `src/lib/transfer.ts` (remove `"import.error.fetch"`)
- Modify: `src/lib/i18n.ts` (remove `settings.presetCount`, `preset.ladprao`, `preset.ratchayothin` and `import.error.fetch`; add `settings.presets` "Neighbourhood presets", `settings.presetsAdded` "{added} of {total} added", and `picker.presetsLink` "Start with a neighbourhood")
- Modify: `src/components/random-picker.ts` (empty card)
- Test: `tests/components/data-transfer.test.ts` (replace PR #28's preset tests), `tests/components/random-picker.test.ts`

**Interfaces:**
- Consumes: `fetchIndex`, `presetState`, `loadAddedPresets` (Task 2).

- [ ] **Step 1: Write the failing tests:**
  - `Import starts with a Neighbourhood presets link row to ./settings/presets`
  - `its subtitle reads "1 of 2 added" once the index loads` (stub fetch; record one preset whose ids are saved)
  - `with the index failing, the row shows no subtitle and still links`
  - `the empty home card links "Start with a neighbourhood" to ./settings/presets as the primary link, above "Add some restaurants"`
  - `the home card is unchanged when restaurants exist` (no presets link)
  - Delete PR #28's `stubFetch` and `presetFile` preset tests and the `readImport` restaurants-only test.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.** "Added" in the subtitle counts presets whose `presetState` is not `"new"`. The secondary home link keeps its `button-link` class; the new primary link gets `button-link primary`, styled in `ui.ts` if that class is missing.
- [ ] **Step 4: Run** the tests, then the full list. Run `grep -rn "presetCount\|import.error.fetch\|restaurantsOnly" src tests`; expected: nothing.
- [ ] **Step 5: Commit** `feat(components): settings and empty home link to neighbourhood presets`.

### Task 9: Docs, push, preview

**Files:**
- Modify: `README.md` (the `/settings` row, a new `/settings/presets` row, `whattoeat:presets` in the storage table, and the layout tree's `assets/data/presets/`)

- [ ] **Step 1: Update `README.md`.** Run `bun run format && bun run check`.
- [ ] **Step 2: Commit** `docs(readme): neighbourhood presets page and data`.
- [ ] **Step 3: Push and update PR #28's title and body:**
  - title: `feat: neighbourhood presets page`
  - body: summary bullets, test plan, preview checks:
    - empty home link
    - tick 2 and add, then Undo
    - Replace with confirm
    - Settings subtitle
    - header tabs from `/settings/presets`

  Use `GH_TOKEN=$(gh auth token --user kamontat) gh pr edit 28 …`.
- [ ] **Step 4: Wait for the deploy check.** Run `gh pr checks 28 --watch`, then confirm `https://pr-28-whattoeat.kcinth.workers.dev/settings/presets` and `/data/presets/index.json` return 200.
