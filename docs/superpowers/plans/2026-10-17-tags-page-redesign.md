# Tags page redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/settings/tags` as a sibling of `/restaurants`: a group picker (pills on phone and small desktop, a groups column on large desktop), one group's values at a time, search across groups and values, read-only Type, and form-based editing in a sheet (phone) or side panel (wide).

**Architecture:** Pure helpers in a new `src/lib/tags.ts` (group summaries, search entries, value edit/merge, remembered pick). Four small presentational parts under `src/components/tags/` (`tag-picker`, `tag-list`, `tag-value-form`, `tag-group-form`) that draw what they are given and report events. `tag-manager` owns state, storage, layout stage, sheet/panel and focus, the way `restaurant-manager` does. `restaurant-search` gains a `labels` property so the tags page reuses it.

**Tech Stack:** Lit 3, Bun (`bun test` + happy-dom), Biome, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-17-tags-page-redesign-design.md`. Mockup: `.superpowers/brainstorm/26789-1792226712/content/layout-v3.html` (layouts) and `layout-v2.html` (forms, lower half).

## Global Constraints

- Work in the worktree `.claude/worktrees/tags-in-settings` on branch `worktree-tags-in-settings`; never edit `main`.
- Test first for every task: write the failing test, run it, watch it fail for the right reason, then code.
- Imports through `#components/*`, `#lib/*`, `#styles/*`. Register every new element in `src/types/global.d.ts`.
- No change to data behaviour in `src/lib/groups.ts` or `src/lib/filter.ts`; call their existing functions.
- Every user-visible string through `t()`; every new key in both `en` and `th` of `src/lib/i18n.ts`. Remove keys that end up unused.
- Breakpoints: phone below `48rem` (`WIDE`), small desktop `48rem`–`64rem`, large desktop from `64rem` (new `WIDER = "(min-width: 64rem)"` in `src/lib/media.ts`). Same values in CSS.
- Tests: default viewport 1024px = large desktop; use 900px for small desktop and 390px for phone (the `setWidth` helper already in `tests/components/tag-manager.test.ts`).
- Tokens from `src/styles/global.css` and classes from `src/styles/ui.ts` only (`.card`, `.group`, `.item`, `.grow`, `.trail`, `.primary`, `.danger`, `.quiet`, `.page-title`, `.page-sub`, `.warning`, `.status`); no new colours.
- Row look: copy `restaurant-list`'s `.list .row` styles (name bold, muted sub line, chevron trail, `aria-current="true"` highlight).
- Before each commit: `bun run format && bun run check && bun run test && bun run build`; `git add -A` after `format`.
- Conventional commits, lower case, scoped. End every commit message with exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md`.

## Review Focus

- **Rename that also moves onto a value already in the target group** (e.g. edit Cuisine "thai" to name "Thai" in Area where "Thai" exists). Expected: merge prompt names the target, merging leaves one copy per restaurant and the filter follows. Pinned in Task 1 (`editValue`) and Task 4.
- **Remembered pick that no longer exists** (group deleted in another tab, or stale `sessionStorage`). Expected: falls back to Cuisine, no crash, no empty page. Pinned in Task 1 and Task 6.
- **Value text with `"`, `\` or Thai combining marks.** Expected: rows found by walking `data-*` attributes not selectors; search highlight keeps tone marks inside `<mark>`. Pinned in Task 3 and Task 6.
- **Resize across 48rem and 64rem with a form open.** Expected: the form moves between sheet and panel with its draft intact, focus lands inside it or on its opener, never `body`. Pinned in Task 6.
- **Search open while the searched value is renamed or deleted** (in the form or another tab). Expected: results update, an open form whose value is gone closes. Pinned in Task 6.

---

### Task 1: Tag helpers and the wider breakpoint

**Files:**
- Modify: `src/lib/media.ts`
- Create: `src/lib/tags.ts`
- Test: `tests/lib/tags.test.ts`, `tests/lib/media.test.ts`

**Interfaces:**
- Consumes: `valueCounts`, `groupLabel`, `valueLabel`, `renameValue`, `moveValue`, `GroupDef` from `#lib/groups`; `renameFilterValue`, `moveFilterValue`, `Filter` from `#lib/filter`; `BUILT_IN_GROUPS`, `VALUE_GROUPS`, `Restaurant` from `#lib/restaurant`.
- Produces:
  - `WIDER = "(min-width: 64rem)"` in `#lib/media`.
  - `type GroupKind = "fixed" | "built-in" | "custom" | "tags"`.
  - `type TagGroup = { id: string; label: string; kind: GroupKind; values: number; restaurants: number }`.
  - `tagGroups(list: readonly Restaurant[], defs: readonly GroupDef[]): TagGroup[]` — order `kind`, `cuisine`, `area`, custom (stored order), `tags`. `kind` is `"fixed"`, cuisine/area `"built-in"`. `restaurants` = restaurants with at least one value in that group.
  - `type TagEntry = { type: "group"; group: string; name: string } | { type: "value"; group: string; value: string; name: string; count: number }`.
  - `tagEntries(list, defs): TagEntry[]` — every group entry (name = label) first, then every value entry in group order, each group's values in `valueCounts` order (name = `valueLabel`).
  - `valueTargets(defs): string[]` — `[...VALUE_GROUPS, ...custom ids, "tags"]` (Type never a target).
  - `wouldMerge(list, from: { group: string; value: string }, to: { group: string; value: string }): boolean` — true when `to` differs from `from` and `to.value` already exists in `to.group`.
  - `editValue(list, filter, from, to, now: Date): { restaurants: Restaurant[]; filter: Filter }` — rename within `from.group` to `to.value`, then move to `to.group` (each a no-op when unchanged), applying the matching filter helpers in the same order.
  - `PICK_KEY = "whattoeat:tags-group"`; `loadPick(ids: readonly string[]): string` (sessionStorage value if in `ids`, else `"cuisine"`; storage that throws counts as empty); `savePick(id: string): void` (swallows storage errors).

- [ ] **Step 1: Write the failing tests** in `tests/lib/tags.test.ts`:
  - `tagGroups lists Type, built-ins, custom groups, then plain tags with counts` — two restaurants (`kind` food on both, cuisine `["thai","lao"]` on one, custom `g1` `["$"]`, tags `["spicy"]`), defs `[{id:"g1",name:"Price"}]`; expect ids `["kind","cuisine","area","g1","tags"]`, kinds `["fixed","built-in","built-in","custom","tags"]`, cuisine `{values: 2, restaurants: 1}`, area `{values: 0, restaurants: 0}`, label of `g1` `"Price"`.
  - `tagEntries puts groups first, then values most used first` — expect first five entries are groups, then `kind/food` before cuisine values, cuisine `thai` (count 2) before `lao` (count 1).
  - `valueTargets never offers Type` — `["cuisine","area","g1","tags"]`.
  - `wouldMerge only when the target already has the value` — false for same from/to; true for cuisine `lao` → cuisine `thai`; true for cuisine `thai` → area `thai` when area has `thai`; false when area lacks it.
  - `editValue renames then moves, keeping one copy and following the filter` — restaurant with cuisine `["thai"]` and area `["Thai"]`, filter `{cuisine:{include:["thai"],exclude:[]}}`; `editValue(list, filter, {group:"cuisine",value:"thai"}, {group:"area",value:"Thai"}, now)`; expect cuisine `[]`, area `["Thai"]`, filter `{area:{include:["Thai"],exclude:[]}}` (compare against `moveFilterValue(renameFilterValue(...))` if the exact pruned shape differs).
  - `loadPick falls back to cuisine for a missing or unknown group` — empty storage → `"cuisine"`; `savePick("g1")` then `loadPick(["cuisine","g1"])` → `"g1"`; `loadPick(["cuisine"])` → `"cuisine"`.
  - In `tests/lib/media.test.ts`: `WIDER is the 64rem query` → `expect(WIDER).toBe("(min-width: 64rem)")`.
- [ ] **Step 2: Run** `bun test tests/lib/tags.test.ts tests/lib/media.test.ts` — expect FAIL: module `#lib/tags` not found / `WIDER` undefined.
- [ ] **Step 3: Implement** `src/lib/tags.ts` and `WIDER` with the signatures above. `sessionStorage` access in `try/catch`.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(lib): tag group summaries, search entries and value edit helpers`.

---

### Task 2: Reusable search labels

**Files:**
- Modify: `src/components/restaurant/search.ts`
- Test: `tests/components/restaurant/search.test.ts`

**Interfaces:**
- Produces:
  - `export type SearchLabels = { open: string; placeholder: string; count: (query: string) => string; noMatch: (query: string) => string }`.
  - `RestaurantSearch.restaurants` widened to `readonly { name: string }[]` (restaurant callers unchanged).
  - `@property({ attribute: false }) labels: SearchLabels | undefined` — `undefined` keeps today's restaurant strings.
  - `search-pick` detail is the matched item (whatever was passed in).
  - New public `close(): void` — ends search without emitting `search-cancel` (still emits `search-change`).

- [ ] **Step 1: Write the failing tests**:
  - `custom labels replace the field's name, placeholder, count and no-match text` — mount with `[{name:"thai"},{name:"lao"}]` and labels `{open:"Search tags", placeholder:"Search groups and values", count:(q)=>\`count:${q}\`, noMatch:(q)=>\`none:${q}\`}`; `open()`, type `"th"`; expect input `aria-label` `"Search tags"`, placeholder `"Search groups and values"`, `.search-count` text `"count:th"`; type `"zz"`, advance 500 ms; `.search-announce` text `"none:zz"`.
  - `close ends search without a cancel event` — open, listen for `search-cancel` (expect not fired) and `search-change` (expect `{searching:false, query:""}`).
- [ ] **Step 2: Run** `bun test tests/components/restaurant/search.test.ts` — expect the two new tests FAIL; existing tests pass.
- [ ] **Step 3: Implement**: every hard-coded `t("search.open")`, `t("search.placeholder")`, `countText(...)`, `t("search.noMatch", …)` goes through the labels when set; `close()` calls the private `end()`.
- [ ] **Step 4: Run** the file — all PASS; also `bun test tests/components/restaurant-manager.test.ts` still PASS.
- [ ] **Step 5: Commit** `feat(components): let restaurant-search take its labels from the page`.

---

### Task 3: `tag-picker` and `tag-list`

**Files:**
- Create: `src/components/tags/picker.ts`, `src/components/tags/list.ts`
- Modify: `src/types/global.d.ts`, `src/lib/i18n.ts`
- Test: `tests/components/tags/picker.test.ts`, `tests/components/tags/list.test.ts`

**Interfaces:**
- Consumes: `TagGroup`, `TagEntry` from Task 1; `MatchRange` from `#lib/search`.
- Produces:
  - `<tag-picker>` (`TagPicker`): `groups: TagGroup[]`, `picked: string`, `variant: "pills" | "column"` (reflected attribute), `wrap: boolean` (reflected; pills wrap instead of scrolling). Renders `<div role="group" aria-label=${t("tags.pickerLabel")}>` of `<button data-group=… aria-pressed>`; pill text `"{label} {values}"`, column row: label + sub (`t("tags.fixed")` for `kind === "fixed"`, else nothing) + value count on the right. Emits `group-pick` (detail: id, bubbles, composed). Picking scrolls the pressed pill into view (`scrollIntoView({ block: "nearest", inline: "nearest" })`, guarded for happy-dom). Public `focusPicked(): void`.
  - `type ListRow = { group: string; value?: string; name: string; sub: string; ranges?: readonly MatchRange[]; readonly?: boolean }` exported from `list.ts`.
  - `<tag-list>` (`TagList`): `rows: ListRow[]`, `currentGroup?: string`, `currentValue?: string`. `<ul class="group list">` of `<li data-group data-value>`; a normal row is `<button class="item row" data-action="open">` (name with `<mark>` ranges, sub line, chevron, `aria-current="true"` when it matches current); a `readonly` row is `<div class="item row static">` with no chevron, and the list gets class `readonly` (dashed border, muted text). Emits `tag-open` (detail: the `ListRow`). Public `focusRow(group: string, value?: string): boolean` walks `li` attributes (never a selector built from text).
  - i18n keys (en / th): `tags.pickerLabel` "Groups" / "กลุ่ม"; `tags.fixed` "fixed" / "คงที่".

- [ ] **Step 1: Write the failing tests**:
  - picker: `pills show each group with its value count and mark the picked one` — groups from `tagGroups` with one custom; expect button texts `["Type 3"… ]` shape `label + " " + values`, only the `cuisine` button has `aria-pressed="true"`.
  - picker: `clicking a pill reports group-pick` — click `g1`, expect event detail `"g1"`.
  - picker: `column variant marks Type as fixed` — `variant="column"`; Type row sub text `"fixed"`; attribute `variant="column"` reflected.
  - picker: `renders in Thai` — `setLang("th")`; group container `aria-label` `"กลุ่ม"`.
  - list: `rows are buttons with name, sub line and chevron; readonly rows are not` — rows `[{group:"cuisine",value:"thai",name:"thai",sub:"2 restaurants"},{group:"kind",value:"food",name:"Food",sub:"3 restaurants",readonly:true}]` (separate mounts for mixed lists is fine); expect `button[data-action="open"]` for thai with `.sub` `"2 restaurants"`, none for food, `ul.readonly` when all rows are readonly.
  - list: `highlights matched ranges` — `ranges:[{start:0,end:2}]` on `"thai"` → `mark` text `"th"`.
  - list: `marks the current row and reports tag-open` — `currentGroup="cuisine"`, `currentValue="thai"` → `aria-current="true"`; click → detail `{group:"cuisine", value:"thai", …}`.
  - list: `focusRow finds a value with a quote or backslash` — value `'a"b\\c'`; `focusRow("cuisine", 'a"b\\c')` returns `true` and focuses that button.
- [ ] **Step 2: Run** `bun test tests/components/tags/` — expect FAIL: elements not defined.
- [ ] **Step 3: Implement** both elements with the interfaces above; register `tag-picker` and `tag-list` in `src/types/global.d.ts`. Pills: one row with `overflow-x: auto` by default; `:host([wrap]) .pills { flex-wrap: wrap; overflow: visible }`.
- [ ] **Step 4: Run** `bun test tests/components/tags/` — PASS.
- [ ] **Step 5: Commit** `feat(components): tag picker and tag list`.

---

### Task 4: `tag-value-form`

**Files:**
- Create: `src/components/tags/value-form.ts`
- Modify: `src/types/global.d.ts`, `src/lib/i18n.ts`
- Test: `tests/components/tags/value-form.test.ts`

**Interfaces:**
- Consumes: `checkValue`, `groupLabel`, `GroupDef`, `ValueError` from `#lib/groups`; `valueTargets`, `wouldMerge` from Task 1.
- Produces:
  - `export type ValueDraft = { name: string; target: string; step: "edit" | "merge" | "delete"; error?: ValueError }` and `valueDraft(group: string, value: string): ValueDraft` (`{name: value, target: group, step: "edit"}`).
  - `<tag-value-form>` (`TagValueForm`): `restaurants: readonly Restaurant[]`, `defs: GroupDef[]`, `group: string`, `value: string`, `draft: ValueDraft`. The draft is owned by the caller (the manager), because the sheet and the panel are different element instances and a resize must not lose what was typed. Every edit, step change or error emits `draft-change` (detail: the new `ValueDraft`); the form renders only from `draft`.
  - Markup: `<form class="value-form">` with label "Name" + `<input name="name">`, label "Group" + `<select name="group">` of `valueTargets(defs)` (current group selected), buttons `data-action="save"` (primary), `data-action="cancel"`, `data-action="delete"` (danger).
  - Save: `checkValue(name)`; error → `<p class="error" role="alert">` with `t(error)`. If `wouldMerge` → step `"merge"`: `<div role="alert">` with `tags.mergePrompt.one/other` (`from`, `to`, `count` = restaurants using the source value) and buttons `data-action="confirm-merge"` / `data-action="cancel-merge"`. Otherwise emit `value-save` (detail `{ from: {group, value}, to: {group: target, value: checked} }`).
  - Delete → step `"delete"`: `tags.deleteValuePrompt.one/other` with `data-action="confirm-delete"` / `data-action="cancel-delete"`; confirm emits `value-delete` (detail `{group, value}`).
  - Cancel emits `form-cancel`. All events bubble and are composed.
  - Public `focusFirst(): void` (focuses the name input, or the open prompt's confirm button).
  - i18n keys (en / th): `tags.name` "Name" / "ชื่อ"; `tags.group` "Group" / "กลุ่ม".

- [ ] **Step 1: Write the failing tests**:
  - `starts with the value's name and its group selected; Type is never offered` — group `cuisine`, value `thai`, one custom `g1`; input value `"thai"`; select options `["cuisine","area","g1","tags"]`, selected `cuisine`.
  - `save reports the new name and group` — type `"Thai food"`, pick `area`, click save → `value-save` detail `{from:{group:"cuisine",value:"thai"},to:{group:"area",value:"Thai food"}}`.
  - `blank or comma names show an error and report nothing` — `""` → error text `"Value is required."`; `"a,b"` → `"A value cannot contain a comma."`; no event.
  - `a name that already exists asks to merge first` — restaurants with cuisine `thai` (1) and `lao`; rename `lao` → `thai`; expect alert text `t("tags.mergePrompt.one", {from:"lao",to:"thai"})`; `confirm-merge` emits `value-save`; `cancel-merge` returns to the fields with `"thai"` still typed.
  - `delete asks first, then reports value-delete` — click delete → prompt text with count; confirm → detail `{group:"cuisine", value:"thai"}`.
  - `renders from the draft it is given` — set `draft = {name:"x", target:"area", step:"edit"}` → input `"x"`, select `area`; `step:"delete"` → delete prompt shown.
  - (Test harness: a tiny wrapper in the test that listens for `draft-change` and writes `el.draft = event.detail` back, so the other tests drive the form like the manager will.)
  - `renders in Thai` — labels `"ชื่อ"`, `"กลุ่ม"`.
- [ ] **Step 2: Run** `bun test tests/components/tags/value-form.test.ts` — FAIL: element not defined.
- [ ] **Step 3: Implement** per the interface; style like `restaurant-form` (stacked labelled fields, `.actions` row, delete prompt like its `.delete-zone`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(components): tag value form`.

---

### Task 5: `tag-group-form`

**Files:**
- Create: `src/components/tags/group-form.ts`
- Modify: `src/types/global.d.ts`, `src/lib/i18n.ts`
- Test: `tests/components/tags/group-form.test.ts`

**Interfaces:**
- Consumes: `addGroup`, `renameGroup`, `moveGroup`, `usingGroup`, `groupLabel`, `GroupDef`, `NameError` from `#lib/groups`.
- Produces:
  - `export type GroupDraft = { name: string; step: "edit" | "delete"; error?: NameError }`.
  - `<tag-group-form>` (`TagGroupForm`): `defs: GroupDef[]`, `restaurants: readonly Restaurant[]`, `groupId: string | undefined` (`undefined` = new group), `draft: GroupDraft` owned by the caller, `draft-change` on every edit (same reason and test harness as Task 4).
  - New: label "Name" + `<input name="name">`, `data-action="save"` with text `t("tags.addGroup")`, `data-action="cancel"`. Save runs `addGroup`; error → `.error` alert (`tags.nameRequired` / `tags.nameTaken`); ok → emit `group-save` (detail `{ groups: GroupDef[], id: string }`, `id` = the new def's id).
  - Edit: same name field, save text `t("tags.save")`, `renameGroup` → `group-save`. A Position row: `data-action="move-up"` / `data-action="move-down"` with `aria-disabled="true"` and the existing reason text (`tags.firstGroup` / `tags.lastGroup`) at the ends, plus hint `t("tags.orderHint")`; each emits `group-move` (detail `{ groups: moveGroup(defs, id, step) }`) immediately. `data-action="delete"` (text `t("tags.deleteGroup")`) → prompt with `tags.deleteGroupPrompt.one/other` (`usingGroup` count), `data-action="confirm-delete"` emits `group-delete` (detail `{ id }`), `data-action="cancel-delete"` returns.
  - `form-cancel` on Cancel. Public `focusFirst(): void`; after a move keeps focus on the pressed arrow, or the other arrow once it is disabled (today's rule).
  - i18n keys (en / th): `tags.newGroup` "New group" / "กลุ่มใหม่"; `tags.addGroup` "Add group" / "เพิ่มกลุ่ม"; `tags.position` "Position" / "ลำดับ"; `tags.orderHint` "Order saves right away" / "ลำดับบันทึกทันที"; `tags.deleteGroup` "Delete group" / "ลบกลุ่ม"; `tags.up` "Up" / "ขึ้น"; `tags.down` "Down" / "ลง".

- [ ] **Step 1: Write the failing tests**:
  - `new: adding reports the new list and id; blank and taken names show errors` — defs `[{id:"g1",name:"Price"}]`; `""` → `"Name is required."`; `"price"` → `"A group with this name already exists."`; `"Mood"` → `group-save` with `groups.length === 2` and `id === groups[1].id`.
  - `edit: renaming reports the renamed list` — `groupId="g1"`, type `"Cost"` → `groups[0].name === "Cost"`.
  - `edit: moves apply at once and are disabled at the ends with a reason` — defs `g1,g2`; on `g1` move-up has `aria-disabled="true"` and reason `"Already the first group"`, clicking it emits nothing; move-down emits `group-move` with ids `["g2","g1"]`; hint text `"Order saves right away"`.
  - `edit: cancel never undoes a move` — after move-down, click cancel → only `form-cancel` fired, no further `group-move`.
  - `edit: delete asks first with the restaurant count` — restaurant using `g1`; prompt text `t("tags.deleteGroupPrompt.one",{group:"Price"})`; confirm → `group-delete` `{id:"g1"}`.
  - `moving keeps focus on the pressed arrow, or the other one at an end` — port the existing manager test of that name to the form.
- [ ] **Step 2: Run** `bun test tests/components/tags/group-form.test.ts` — FAIL.
- [ ] **Step 3: Implement** per the interface.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(components): tag group form`.

---

### Task 6: Rebuild `tag-manager`

**Files:**
- Modify (rewrite): `src/components/tag-manager.ts`
- Modify: `src/lib/i18n.ts`, `README.md` (the `/settings/tags` row: "Pick a group from pills or a column; search groups and values; add, rename, reorder and delete groups; rename, merge, move and delete values in a form")
- Test (rewrite): `tests/components/tag-manager.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5; `restaurant-search` with `labels`; `app-sheet`; `MediaController`, `WIDE`, `WIDER`; store, groups and filter save/load/subscribe functions as today.
- Produces (state, for the implementer's own use and tests):
  - `stage: "phone" | "small" | "large"` from two `MediaController`s, reflected as `data-stage` on the `.layout` wrapper.
  - `picked: string` (init `loadPick(ids)`, `savePick` on change).
  - `form: { kind: "value"; group: string; value: string } | { kind: "new-group" } | { kind: "group"; id: string } | undefined` — one slot.
  - `searching`, `query` as reported by `search-change`.
  - `status: string` live text (clear, then set after render, like `restaurant-manager`).
  - i18n keys (en / th): `tags.summary` "{groups} · {values}"; `tags.groups.one/other` "1 group" / "{count} groups" — "1 กลุ่ม" / "{count} กลุ่ม"; `tags.values.one/other` "1 value" / "{count} values" — "1 ค่า" / "{count} ค่า"; `tags.kind.built-in` "Built-in group" / "กลุ่มพื้นฐาน"; `tags.kind.custom` "Custom group" / "กลุ่มที่สร้างเอง"; `tags.kind.tags` "Shown on restaurants, not used by the home filter" / "แสดงที่ร้านแต่ไม่ใช้กรองหน้าแรก"; `tags.fixedNote` "Type is fixed. Set it on each restaurant." / "ประเภทเปลี่ยนไม่ได้ ตั้งค่าที่แต่ละร้าน"; `tags.editGroup` "Edit group" / "แก้ไขกลุ่ม"; `tags.groupSub` "Custom group · {values} · {count}" / "กลุ่มที่สร้างเอง · {values} · {count}"; `tags.searchOpen` "Search tags" / "ค้นหาแท็ก"; `tags.searchPlaceholder` "Search groups and values" / "ค้นหากลุ่มและค่า"; `tags.searchCount` "{shown} of {total} tags" / "{shown} จาก {total} แท็ก"; `tags.noMatch` `No tags match "{query}".` / `ไม่มีแท็กที่ตรงกับ “{query}”`; `tags.added` "Added {group}" / "เพิ่ม {group} แล้ว"; `tags.saved` "Saved {name}" / "บันทึก {name} แล้ว"; `tags.removed` "Removed {value}" / "ลบ {value} แล้ว". Remove `tags.intro`, `tags.pickHint`, `tags.addTitle`, `tags.groupOptions`, `tags.anotherGroup`, `tags.move`, `tags.moveLabel`, `tags.renameLabel`, `tags.rename*Label`, `tags.moveValueLabel`, `tags.deleteValueLabel`, `tags.deleteGroupLabel`, `tags.confirmMove` and any other key no longer referenced (grep before deleting).

**Render outline** (top to bottom):
1. `a.back` to `${base}settings` (unchanged).
2. `.top` (sticky on phone with the header, search row, picker and group head inside it; static from 48rem): `header.head` with `h1.page-title` "Tags" and `p.count.page-sub` (`tags.summary`; visually hidden while searching like restaurants), `.head-actions` with `button.search-open[data-action="search"]` and, from 48rem, `button.primary.add[data-action="add"]` (aria-label `t("tags.newGroup")`); `<restaurant-search>` with `restaurants = tagEntries(...)` and labels from the keys above; then on phone/small and not searching: `<tag-picker variant="pills" ?wrap=${stage === "small"}>` and the group head.
3. Warnings (`.warning`, `.skipped`) and the no-restaurants `.card.empty` with `a.button-link` to `${base}restaurants` — unchanged.
4. `p.status.success[role="status"]`.
5. `.layout[data-stage]`: on large and not searching, `<tag-picker variant="column">` column first, then a values column (group head + list); then `section#edit-panel.card.edit-panel` when wide and a form is open (heading `h2#form-title[tabindex=-1]`, sub line, `button.close[data-action="close-panel"]`, the form element).
6. On phone: `div.pinned` with `button.primary.add[data-action="add"]`, and one `<app-sheet class="form-sheet">` (heading/subheading of the open form; keeps the last form while sliding away, as today).

**Group head** (`div.group-head[data-group]`): kind text (`tags.kind.*`, or `tags.fixedNote` for Type) · restaurant total (`tags.count.*`); for custom groups `button[data-action="edit-group"]` (text `t("tags.editGroup")`). **Values**: `<tag-list>` rows from `valueCounts(picked)` (`sub` = `tags.count.*`, `readonly` for `kind`), or `p.muted` `tags.noValues`. **Search**: rows from `searchByName(tagEntries, query)`; group rows sub `t("tags.kind.*")`, value rows sub `"{group label} · {count}"` (`tags.valueSub`); Type values readonly; no match → `.card.empty.no-match` with `tags.noMatch` and `button[data-action="clear-search-empty"]`.

**Behaviour:**
- `group-pick` → `picked = id`, `savePick`. Form stays open.
- `tag-open` on a value row → `form = {kind:"value",…}`; on a group row (search) → `search.close()`, `picked = group`, then `picker.focusPicked()`.
- `search-pick` (Enter with one match) → same as `tag-open`.
- `edit-group` → `form = {kind:"group", id}`; `add` → `form = {kind:"new-group"}`. Opening any form replaces the open one.
- Wide: opening a form focuses its first control (`focusFirst()`); phone: the sheet focuses its title.
- `value-save` → `editValue` → `saveFilter`, `saveRestaurants`; form closes; status `tags.saved` with the new value label; focus the edited row (`list.focusRow(to.group === picked ? …)`) or else `picker.focusPicked()`.
- `value-delete` → `dropFilterValue` + `deleteValue`; close; status `tags.removed`; focus `picker.focusPicked()` (large: the column picker; while searching: the search field).
- `group-save` → `saveGroups(groups)`; new: `picked = id`, status `tags.added`; edit: status `tags.saved`; close; focus the picked pill.
- `group-move` → `saveGroups(groups)`; form stays open.
- `group-delete` → as today's `confirmDeleteGroup` (filter, restaurants first, then groups); close; `picked = "cuisine"`; focus the picked pill.
- `form-cancel`, sheet close, panel close → `form = undefined`; focus returns to the opener (row, Edit group or Add) — never `body`.
- The manager holds `draft: ValueDraft | GroupDraft` next to `form`, sets it fresh whenever a form opens (`valueDraft(group, value)`, or `{name: label or "", step: "edit"}`) and writes back every `draft-change`.
- Stage crossing with a form open: phone→wide moves focus into the panel's first control; wide→phone opens the sheet and focuses the opener row first so the sheet returns focus there (today's `updated()` logic, generalised to the one form slot). The draft survives because the manager owns it.
- `reload()` on store/groups change: drop a value form whose value is gone, a group form whose group is gone; `picked` falls back via `loadPick`.

- [ ] **Step 1: Rewrite the failing tests** in `tests/components/tag-manager.test.ts`. Keep the helpers (`mount`, `$`, `typeIn`, `setWidth`, `settle`, `focused`); replace `card`/`openValue`/`openGroup` with `picker(el)`, `pick(el, id)`, `rows(el)`, `openValue(el, group, value)` (picks the group, clicks the row in `tag-list`, returns the `tag-value-form`), `openGroup(el, id)` (clicks `edit-group`, returns `tag-group-form`). Tests (each pins an existing behaviour or a spec line):
  - `large: groups column, values column, no pills` — default width; `tag-picker[variant="column"]` present, no `tag-picker[variant="pills"]`, `.layout[data-stage="large"]`.
  - `small: wrapping pills and a two-column list` — 900px; `tag-picker[variant="pills"][wrap]`, `data-stage="small"`.
  - `phone: pills in the sticky top, pinned add, one form sheet` — 390px; picker inside `.top`, `.pinned button.add`, no `section#edit-panel`.
  - `the picker lists groups in order, ending with plain tags` — `["kind","cuisine","area","g1","tags"]`.
  - `count line shows groups and values` — `"5 groups · 3 values"` for the seed used.
  - `Cuisine is picked first and the pick is remembered for the session` — pick `g1`, unmount, remount → `g1` pressed; `sessionStorage` `"whattoeat:tags-group"` holding `"gone"` → cuisine.
  - `values show how many restaurants use them, most used first` — port.
  - `Type values are read-only with the fixed note` — pick `kind`; no `button` in `tag-list`, `ul.readonly`, group head text `"Type is fixed. Set it on each restaurant."`.
  - `only custom groups have Edit group` — cuisine: no `[data-action="edit-group"]`; `g1`: present.
  - `plain tags explain they are not filtered` — pick `tags`; head contains `"Shown on restaurants, not used by the home filter"`.
  - `adding a group picks it and says so` — click add, type `"Mood"`, save → picker pressed id is the new id, `.status` `"Added Mood"`, `loadGroups().length` grew.
  - `renaming a group saves the new name` — port through `openGroup`.
  - `moving a group reorders at once and keeps the form open` — port.
  - `deleting a group turns its values into tags, drops its filter and picks Cuisine` — port + `picked === "cuisine"`.
  - `editing a value renames it everywhere and in the saved filter` — port (`FILTER_KEY` check).
  - `editing a value's group moves it` — port of the move test (target list never has Type).
  - `renaming onto an existing value asks to merge, and merging keeps one copy` — port.
  - `deleting a value asks first, then removes it everywhere` — port.
  - `search finds groups and values across groups and highlights them` — restaurants with cuisine `japanese` and tags `jazz`, custom group `Jam`; open search, type `"ja"`; picker hidden; rows: group `Jam` first, then `japanese` (sub `"Cuisine · 1 restaurant"`), `jazz`; each has a `mark`.
  - `a group result ends search and picks that group` — click the `Jam` row → not searching, `g1` pressed, focus on the `g1` pill.
  - `a value result opens its form and search stays open` — click `japanese` → value form for `cuisine/japanese`, search row still visible.
  - `no match offers to clear the search` — type `"zz"` → `.no-match` text `No tags match "zz".`; click `clear-search-empty` → field empty.
  - `opening another form replaces the open one` — open value thai, type in name, click add → `tag-group-form` with no `groupId`, no `tag-value-form`.
  - `picking another group leaves the open form alone` — open thai, pick area → `tag-value-form` still `thai`.
  - Focus and resize: port `focus follows a value whose text has a double quote or backslash`, `narrow to wide with a value's sheet open moves focus into the panel`, `wide to narrow with a value selected returns focus to its row, not body, when the sheet closes`, `phone: opening a value focuses the sheet's heading`, `wide: opening a value focuses the form's name field`, `phone: deleting the selected value closes its sheet and focuses the picked pill`, and add `small to large with a form open keeps its typed name` (900px, open thai, type `"x"`, resize to 1024 → name input `"x"`).
  - Cross-tab: port `follows restaurant and group changes from elsewhere`, `another tab removing the selected value closes the form`, `another tab deleting the open group closes its form and picks Cuisine`.
  - Port unchanged: `with no restaurants, links to the restaurants page and still allows adding groups`, `renders in Thai`, `warns about stored restaurants that could not be read`, `warns when the browser refuses to save restaurants or groups`, `the page has a back link to Settings and a large title`, `base prefixes the back link and the restaurants link`.
  - Drop tests whose subject no longer exists (action lists, pick-hint panel, group options sheet, label-in-name of "Move to…").
- [ ] **Step 2: Run** `bun test tests/components/tag-manager.test.ts` — expect most new tests FAIL against the old component (old selectors gone).
- [ ] **Step 3: Rewrite** `src/components/tag-manager.ts` per the outline and behaviour above; update i18n keys and `README.md`.
- [ ] **Step 4: Run** `bun test tests/components/tag-manager.test.ts` — PASS; then the full pre-commit list.
- [ ] **Step 5: Check by eye** with `bun run dev` at 390px, 900px and 1200px against `layout-v3.html`: sticky top on phone, pills scroll sideways on phone and wrap on small desktop, Type rows dashed and muted, panel sticky on wide, dark theme. Fix anything off.
- [ ] **Step 6: Commit** `feat(components): rebuild the tags page around a group picker`.
