# Preset Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applying neighbourhood presets always replaces the active profile's list, a preset the
profile already uses gets a per-row Update button when its bundled file changed, city chips
only list cities that have presets, and search shows the place that matched.

**Architecture:** The pure logic lives in `src/lib/presets.ts`: a new `updatePreset` sync
function (with its own restaurant comparison), `presetCities` for the chips and `shownPlaces`
for the row subtitle; `addPresets` goes away. `src/components/preset-picker.ts` loses the
Add / Replace switch and gains the Update button, wiring those functions to storage, the
existing Undo snapshot and the page toast.

**Tech Stack:** TypeScript, Lit 3, Bun (test runner with happy-dom), Biome.

**Spec:** `docs/superpowers/specs/2026-10-25-profiles-design.md`, the "Presets" part. The
"Profiles" part already shipped in PR #50; `#lib/profiles` (`activeProfile()`) and per-profile
`presetsKey()` exist.

## Global Constraints

- No Add (merge) mode for presets. File and paste import keep their own Replace / Merge choice (do not touch `data-transfer`).
- No automatic updates, no "update all" button. Update syncs one preset, with no confirm step, and offers Undo.
- Replacing rewrites the profile's applied-preset record to exactly the ticked presets (`replaceWithPresets` already does).
- A recorded preset with none of its ids still saved counts as "not used" (`presetState` → `"new"`); an Update button only shows for `presetState` `"update"`.
- Pick history is never touched by Replace or Update.
- `whattoeat:presets` is written only after the restaurant list write succeeded (existing rule in `save()`/`undo()`; Update follows it too).
- Every message exists in `en` and `th` in `src/lib/i18n.ts`.
- Build with the existing design system (`uiStyles`, `.group`, `.item`, `.grow`, `.badge`, `.primary`, `.danger`, `.quiet`), not the brainstorm prototype's styling.
- Every change follows `shipping-a-change`: worktree `worktree-preset-rework` (already created), test first, `bun run format && bun run check && bun run test && bun run build` before each commit, conventional lower-case commits scoped by area. No `CHANGELOG.md` edit until landing.

## Review Focus

1. **Update when the file adds an id the user already has from an import.** The saved copy is replaced in place, not duplicated, and the list keeps its order. Test in Task 1.
2. **Update after the user edited a preset restaurant but nothing in the file changed for it.** It is reverted and counted in "reverted"; an untouched copy is not counted. Comparison must not depend on object key order (an edited restaurant is rebuilt by `normalizeInput`, so its keys may come out in another order). Test in Task 1.
3. **Update while the preset file fails to load.** Nothing in storage changes, the row keeps its Update button, and a message says so. Test in Task 3.
4. **Clicking Update does not tick or untick the row.** The button sits outside the row's `<label>`. Test in Task 3.
5. **Undo after Update restores the list and the record exactly**, including the other presets' records. Test in Task 3.

---

### Task 1: Preset sync, city and subtitle logic

**Files:**
- Modify: `src/lib/presets.ts` (add `sameRestaurant`, `updatePreset`, `presetCities`, `shownPlaces`)
- Test: `tests/lib/presets-logic.test.ts` (add the tests below)
- Test: `tests/lib/presets.test.ts` (bundled index check)

**Interfaces:**
- Consumes: `PresetFile`, `PresetEntry`, `PresetIndex`, `AddedPreset`, the private `recordAdded` and `toAddedPreset` in `src/lib/presets.ts`; `Restaurant` from `#lib/restaurant`.
- Produces:
  - `sameRestaurant(a: Restaurant, b: Restaurant): boolean` — deep equality that ignores object key order (compare a JSON serialisation with keys sorted at every depth; array order matters).
  - `type UpdateCounts = { added: number; removed: number; reverted: number }`
  - `updatePreset(saved: readonly Restaurant[], file: PresetFile, added: readonly AddedPreset[]): { list: Restaurant[]; added: AddedPreset[]; counts: UpdateCounts }`
  - `presetCities(index: PresetIndex): string[]` — the keys of `index.cities`, in their order, that at least one preset's `city` uses.
  - `shownPlaces(places: readonly string[], query: string): string[]` — the (at most two) places the row subtitle shows.

`updatePreset` rules, with `recorded` = ids of `added`'s record for `file.entry.id` (empty when there is none), `file` = `file.restaurants`:

1. Walk `saved` in order. An id in `file`: emit the file's version in that position; count `reverted` when `!sameRestaurant(savedCopy, fileCopy)`. An id in `recorded` but not in `file`: drop it, count `removed`. Anything else: keep as is.
2. Append, in file order, each file restaurant whose id is in neither `recorded` nor `saved`; count `added`. (In `recorded`, in `file`, not in `saved` = user deleted it: stays deleted.)
3. `added` result = `recordAdded(added, [file])` (this preset's record becomes the entry's `updatedAt` and the file's ids; other records untouched, order kept).

`shownPlaces` rule: `first = places.slice(0, 2)`. When `query` (trimmed, lower-cased) is empty, or a place in `first` contains it, or `first.length < 2`, return `first`. Otherwise, if some place after index 1 contains it, return `[first[0], thatPlace]` (the first such place); else `first`.

- [ ] **Step 1: Write the failing tests** in `tests/lib/presets-logic.test.ts` (use the file's existing restaurant factory; give "edited" copies a different `notes`):
  - `"updatePreset reverts an edited recorded restaurant in place and counts it"`: saved `[a(edited), x]`, recorded `[a]`, file `[a]` → list ids `["a", "x"]`, `list[0]` equals the file's `a`, counts `{ added: 0, removed: 0, reverted: 1 }`.
  - `"updatePreset does not count an unchanged copy as reverted, whatever its key order"`: saved `a` rebuilt with its keys in reverse order (`Object.fromEntries(Object.entries(a).reverse())`), file `[a]` → `reverted: 0`.
  - `"updatePreset adds restaurants new in the file, after the saved list, in file order"`: saved `[a]`, recorded `[a]`, file `[a, b, c]` → ids `["a", "b", "c"]`, `added: 2`.
  - `"updatePreset removes restaurants the file dropped"`: saved `[a, b, x]`, recorded `[a, b]`, file `[a]` → ids `["a", "x"]`, `removed: 1`.
  - `"updatePreset leaves a restaurant the user deleted deleted"`: saved `[x]`, recorded `[a]`, file `[a]` → ids `["x"]`, counts all `0`.
  - `"updatePreset takes over an unrecorded saved copy in place, never duplicating it"`: saved `[x, b(edited), y]`, recorded `[a]`, file `[a, b]` → ids `["x", "b", "y"]` (no `a`: user-deleted), `list[1]` equals file `b`, counts `{ added: 0, removed: 0, reverted: 1 }`.
  - `"updatePreset with no record treats every saved file id as a takeover and adds the rest"`: added `[]`, saved `[b]`, file `[a, b]` → ids `["b", "a"]`, `added: 1`.
  - `"updatePreset rewrites only this preset's record"`: added `[{ id: "other", updatedAt: "2026-01-01", ids: ["o"] }, { id: "p", updatedAt: "2026-01-01", ids: ["a"] }]`, file entry `p` with `updatedAt: "2026-10-25"` and restaurants `[a, b]` → added equals `[{ id: "other", … unchanged }, { id: "p", updatedAt: "2026-10-25", ids: ["a", "b"] }]`.
  - `"presetCities lists only cities a preset uses, in index order"`: index with cities `{ a, b, c }` and presets in `c` and `a` → `["a", "c"]`.
  - `"shownPlaces"`: `shownPlaces(["P1", "P2", "Mall X"], "")` → `["P1", "P2"]`; `(…, "mall")` → `["P1", "Mall X"]`; `(…, "p2")` → `["P1", "P2"]`; `(["P1"], "mall")` → `["P1"]`; `(["P1", "P2", "Q"], "zzz")` → `["P1", "P2"]`.
  - In `tests/lib/presets.test.ts`, `"every city and district in the index is used by a preset"`: for the bundled index, `Object.keys(index.cities)` and `Object.keys(index.districts)` each equal the set of `city` / `district` values across `index.presets` (report the unused ids in the failure).

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/lib/presets-logic.test.ts tests/lib/presets.test.ts`
Expected: the `updatePreset`, `presetCities` and `shownPlaces` tests fail with an import/"not a function" error; the bundled-index test passes (the index is clean today — it is a guard).

- [ ] **Step 3: Implement** `sameRestaurant`, `updatePreset`, `presetCities`, `shownPlaces` in `src/lib/presets.ts` per the rules above. Leave `addPresets` and its tests alone: `preset-picker.ts` still imports it, and Task 2 deletes both with the Add mode.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/lib/presets-logic.test.ts tests/lib/presets.test.ts`
Expected: PASS

- [ ] **Step 5: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(lib): preset update sync, used cities and matched place helpers"
```

---

### Task 2: Replace-only apply

**Files:**
- Modify: `src/components/preset-picker.ts`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/presets.ts` (delete `addPresets`)
- Test: `tests/components/preset-picker.test.ts`, `tests/lib/presets-logic.test.ts`

**Interfaces:**
- Consumes: `activeProfile(): Profile` from `#lib/profiles`; `replaceWithPresets`, `presetState`, `loadAddedPresets`, `saveAddedPresets`, `fetchPresetFiles` from `#lib/presets`.
- Produces: the picker with no `mode` property and no `Mode`/`MODES`/`MODE_KEYS`/`renderSwitch`/`onModeKey`/`setMode`/`modeInput`. `confirming` stays a public `@state()`. Badge for both `"added"` and `"update"` rows is "In your list" (`data-state="in-list"`) in this task; Task 3 swaps the update one for a button.

Behaviour:
- No ticked rows: the Go to picker link, as today.
- Ticked rows and the profile has saved restaurants (`savedIds.size > 0`): button `class="action danger" data-action="apply"`, label `presets.replace` = "Replace with {areas} · {count}" (e.g. "Replace with 2 areas · 138 restaurants"); a `.replace-warning` line `presets.replaceWarning` = "Replaces the {count} restaurants in {profile}." with `profile` = `activeProfile().name`; pressing it opens the existing confirm card, confirming saves.
- Ticked rows and an empty profile: button `class="action primary" data-action="apply"`, label `presets.use` = "Use {areas} · {count}"; no warning line; pressing it saves at once (no confirm card).
- Saving always uses `replaceWithPresets`. Message: non-empty before → `presets.replaced` ("Replaced with {count} restaurants"); empty before → `presets.added` ("Added {count} restaurants"); refused write → `presets.replacedSessionOnly` / `presets.sessionOnly` respectively. Undo snapshot and focus handling unchanged.
- Rows are never locked: a `"added"` row's checkbox starts unticked and enabled.

i18n (`en` / `th`):
- Remove: `presets.mode.label`, `presets.mode.add`, `presets.mode.replace`, `presets.add`, `presets.nothingNew`, `presets.badge.added`, `presets.badge.update`.
- Change `presets.replace`: `"Replace with {areas} · {count}"` / `"แทนที่ด้วย {areas} · {count}"`.
- Change `presets.replaceWarning`: `"Replaces the {count} restaurants in {profile}."` / `"แทนที่ร้าน {count} ร้านใน {profile}"`.
- Add `presets.use`: `"Use {areas} · {count}"` / `"ใช้ {areas} · {count}"`.

- [ ] **Step 1: Rewrite the picker tests.** Delete the mode tests (`"in Add mode, an added preset is ticked…"`, `"the switch is hidden…"`, `"the mode starts as Add…"`, `"arrow keys move…"`, the Add label/save/nothing-new tests, `"in Replace mode, Added rows unlock…"`) and drop every `el.mode = "replace"` / mode-switch step from the remaining ones (they now reach the Replace path by having saved restaurants). Remove the Add halves of `"when only the restaurant list write is refused…"` and `"focus moves to the pinned action after Add, after Undo, and after a confirmed Replace"` (keep Use, Undo and Replace). Add:
  - `"there is no Add / Replace switch"`: with saved restaurants, `$(el, "[name='preset-mode']")` is `null`.
  - `"an applied preset is tickable and badged In your list, whether or not its file changed"`: the old Add-mode fixture (ladprao current, ratchayothin stale) → both checkboxes unchecked and enabled, both `.badge` text `"In your list"`.
  - `'with saved restaurants the button reads "Replace with 2 areas · 27 restaurants", is danger, and the warning names the count and profile'`: 3 saved, tick ladprao (12) and ratchayothin (15) → `[data-action="apply"]` text `"Replace with 2 areas · 27 restaurants"`, has class `danger`, `.replace-warning` text `"Replaces the 3 restaurants in Personal."`.
  - `'with an empty profile the button reads "Use 1 area · 12 restaurants", is primary, has no warning, and saves without a confirm'`: tick ladprao, click apply → no `[data-action="replace-confirm"]` ever renders, `loadRestaurants()` holds the file's restaurants, `loadAddedPresets()` is exactly `[ladprao's record]`, toast text `"Added 12 restaurants"` with an Undo action; Undo leaves the list empty and `loadAddedPresets()` `[]`.
  - `"replacing rewrites the record to exactly the ticked presets"`: record `[kaset, ladprao]`, saved ids from both, tick ratchayothin, confirm → `loadAddedPresets().map((r) => r.id)` is `["ratchayothin"]`.
  - `"the Thai labels"`: `setLang("th")`, empty profile, tick ladprao → label `"ใช้ 1 ย่าน · 12 ร้าน"`.

  In `tests/lib/presets-logic.test.ts`, delete the three `addPresets` tests.

- [ ] **Step 2: Run to verify they fail**

Run: `bun test tests/components/preset-picker.test.ts`
Expected: the new tests fail (switch still renders, "Add 1 area…" label, badges "Added"/"Update").

- [ ] **Step 3: Implement** the behaviour above in `preset-picker.ts`, update `i18n.ts`, delete `addPresets` from `presets.ts`. Shrink `PINNED_FALLBACK`'s comment to "the warning line and the button" (keep a value that fits both). Update the class doc comment (no Add / Replace switch).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/preset-picker.test.ts tests/lib/presets-logic.test.ts`
Expected: PASS

- [ ] **Step 5: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): presets always replace the active profile's list"
```

---

### Task 3: Per-row Update button

**Files:**
- Modify: `src/components/preset-picker.ts`
- Modify: `src/lib/i18n.ts`
- Test: `tests/components/preset-picker.test.ts`

**Interfaces:**
- Consumes: `updatePreset`, `UpdateCounts` (Task 1); `fetchPresetFiles(base, [entry])`; the picker's `snapshot`, `undo`, `busy`, `toast()` and `focusAfterRender` from Task 2.
- Produces: rows marked up as `<div class="item preset" data-preset=ID><label class="pick"><input type="checkbox">…<span class="grow">…</span>[badge]</label>[update button]</div>` — the Update button is a sibling of the label, `type="button" class="quiet" data-action="update"`, text `presets.update`, `aria-label` `presets.updateLabel` with the preset's localized name. `.pick` takes the row's flex layout and remaining width (`display: flex; flex: 1; align-items: center; gap` like `.item`, `min-height: var(--tap)`).

Behaviour:
- `"update"` rows show the Update button and no badge; `"added"` rows keep "In your list"; `"new"` rows show neither. The row stays tickable.
- Clicking Update (ignored while `busy`): `busy = true`, fetch that one file. On failure: nothing saved, `busy = false`, toast `presets.updateError` with `{ name }`, no Undo. On success: `before = { list: loadRestaurants(), added: loadAddedPresets() }`, `result = updatePreset(before.list, file, before.added)`; if `saveRestaurants(result.list)` then `saveAddedPresets(result.added)` and toast `presets.updated` with `{ name, added, removed, reverted }`, else toast `presets.updatedSessionOnly` with `{ name }`; either way `snapshot = before` and the toast carries Undo (`this.undo`). `selected` is not changed. After render, focus that row's checkbox (the button is gone).
- `name` is `localize(entry.name)`.

i18n (`en` / `th`):
- `presets.update`: `"Update"` / `"อัปเดต"`
- `presets.updateLabel`: `"Update {name}"` / `"อัปเดต {name}"`
- `presets.updated`: `"{name} updated: {added} added, {removed} removed, {reverted} reverted."` / `"อัปเดต {name} แล้ว: เพิ่ม {added} ลบ {removed} คืนค่า {reverted}"`
- `presets.updatedSessionOnly`: `"{name} updated for this session only"` / `"อัปเดต {name} ไว้เฉพาะครั้งนี้เท่านั้น"`
- `presets.updateError`: `"Couldn't load {name}. Nothing changed."` / `"ไม่สามารถโหลด {name} ได้ ไม่มีการเปลี่ยนแปลงใด ๆ"`

Tests need a fetch stub that answers the index URL with the index and `…/presets/<id>.json` with a preset file (reuse the helper the existing save tests use for files, or extend `stubFetch` to route by URL).

- [ ] **Step 1: Write the failing tests**:
  - `"a stale applied preset shows an Update button named for it, and no badge"`: record ratchayothin `updatedAt: "2026-10-01"`, `ids: ["r2"]`, `r2` saved → `[data-preset="ratchayothin"] [data-action="update"]` text `"Update"`, `aria-label` `"Update Ratchayothin"`, no `.badge` in the row; ladprao recorded current → badge, no button; kaset unrecorded → neither.
  - `"a not-used preset never shows Update, even when recorded with an old date"`: record kaset stale with `ids: ["gone"]` → no button.
  - `"clicking Update does not tick the row or change the selection"`: tick ladprao, click ratchayothin's Update → ratchayothin's checkbox still unchecked, ladprao's still checked, apply label unchanged.
  - `"Update syncs the preset, rewrites its record, and reports the counts with Undo"`: saved `[r1 (edited notes), r2, mine]`, record ratchayothin `{ updatedAt: "2026-10-01", ids: ["r1", "r2"] }`, file for ratchayothin (entry `updatedAt: "2026-10-16"`) `[r1, r3]` → after click: `loadRestaurants()` ids `["r1", "mine", "r3"]`, `r1` equals the file's; `loadAddedPresets()` has ratchayothin `{ updatedAt: "2026-10-16", ids: ["r1", "r3"] }`; toast text `"Ratchayothin updated: 1 added, 1 removed, 1 reverted."` with an Undo action; the row now shows "In your list" and focus is on its checkbox.
  - `"Undo after Update restores the list and every record exactly"`: as above plus a ladprao record → after Undo, `localStorage` values at `restaurantsKey()` and `presetsKey()` equal their pre-Update strings; toast `"Undone."`.
  - `"a failed file load on Update changes nothing and says so"`: file request returns 404 → storage strings unchanged, Update button still there and enabled, toast `"Couldn't load Ratchayothin. Nothing changed."` with no action.
  - `"a refused write on Update shows the session-only message and keeps the record"`: spy `localStorage.setItem` to throw for `restaurantsKey()` → toast `"Ratchayothin updated for this session only"`, `presetsKey()` string unchanged.
  - `"the Thai Update message"`: `setLang("th")` → toast `"อัปเดต รัชโยธิน แล้ว: เพิ่ม 1 ลบ 1 คืนค่า 1"`.
  - `"Update buttons are disabled while a save or update is in flight"`.

- [ ] **Step 2: Run to verify they fail**

Run: `bun test tests/components/preset-picker.test.ts`
Expected: new tests fail (no `[data-action="update"]`).

- [ ] **Step 3: Implement** the row markup, `.pick` style, the Update handler and the i18n keys in `preset-picker.ts` and `i18n.ts`. Existing selectors `[data-preset="x"] input` keep working with the new markup.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/preset-picker.test.ts`
Expected: PASS

- [ ] **Step 5: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): update an applied preset from its row"
```

---

### Task 4: City chips from used cities, matched place in the subtitle

**Files:**
- Modify: `src/components/preset-picker.ts` (`loadIndex`, `renderChips`, `renderSubtitle`)
- Test: `tests/components/preset-picker.test.ts`

**Interfaces:**
- Consumes: `presetCities(index)`, `shownPlaces(places, query)` (Task 1).
- Produces: nothing new for other tasks.

Behaviour:
- `loadIndex` sets `this.city = presetCities(index)[0]`. `renderChips` renders one chip per `presetCities(index)` id and hides when there are fewer than 2.
- `renderSubtitle` shows `shownPlaces(entry.places, query)` in place of `entry.places.slice(0, 2)`; each shown place is highlighted while searching, as today. The `+N` count stays `entry.places.length - 2` (when positive).

- [ ] **Step 1: Write the failing tests**:
  - `"city chips list only cities that have presets"`: `INDEX9` plus a third city `phuket` with no preset → chips `data-city` are `["bangkok", "chiangmai"]`.
  - `"with only one used city the chips are hidden"`: `INDEX2` plus an unused city → no `.chip`.
  - `"search shows a matched place that is past the first two, highlighted, in place of the second"`: `INDEX9`, search `"lotus"` → ladprao row `.sub` text `"12 · Central Ladprao, Lotus Ladprao +3"` and its `mark` text `"Lotus"`.
  - `"search matching one of the first two places leaves the subtitle as it is"`: search `"union"` → `"12 · Central Ladprao, Union Mall +3"`.

- [ ] **Step 2: Run to verify they fail**

Run: `bun test tests/components/preset-picker.test.ts`
Expected: the unused-city chip renders; the ladprao subtitle still shows "Union Mall".

- [ ] **Step 3: Implement** the three changes in `preset-picker.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/preset-picker.test.ts`
Expected: PASS

- [ ] **Step 5: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): chips for used cities and the matched place in search"
```
