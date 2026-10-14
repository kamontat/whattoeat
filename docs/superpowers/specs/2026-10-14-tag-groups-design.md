# Tag groups — design

Date: 2026-10-14

## Goal

Cuisine, area, type and tags are all labels on a restaurant. Make them one consistent model:

- Cuisine and area can hold more than one value, like `thai` and `japanese`.
- People can make their own groups, like "price" or "vibe", and filter by them.
- A new Tags page manages groups and their values: usage counts, rename, merge, move and
  delete. This replaces the "Rename or merge a tag" item in `IDEAS.md`.

## Decisions (from brainstorming)

| Topic                 | Decision                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Built-in groups       | Type, Cuisine and Area always exist; they cannot be renamed, reordered or deleted             |
| Type values           | Stay the fixed `KINDS` list with translated names                                             |
| Values per group      | Every group except Type takes several values                                                  |
| Custom groups         | Created, renamed, reordered and deleted on the new Tags page                                  |
| Deleting a group      | Its values become plain tags on each restaurant; nothing is lost                              |
| Plain tags            | Keep their meaning; still shown but not filtered                                              |
| Custom group filter   | Every custom group is a filter row on the home page, like Cuisine and Area                    |
| Storage shape         | `kinds` and `tags` stay; a new `groups` map holds cuisine, area and custom values by group id |
| Group definitions     | Their own localStorage key and a new field in the export file                                 |
| Export format         | Version 4; versions 1–3 still import                                                          |
| Delivery              | One spec and plan, shipped in two stages (data model, then the Tags page)                     |

## Data model

`src/lib/restaurant.ts`

```ts
export type Restaurant = {
	id: string;
	name: string;
	location: string;
	notes: string;
	kinds: Kind[];
	/** Plain tags: shown, not filtered. */
	tags: string[];
	/** Values by group id: "cuisine", "area" or a custom group's id. A key exists only when it has values. */
	groups: Record<string, string[]>;
	createdAt: string;
	updatedAt: string;
};
```

- The top-level `cuisine` and `area` strings are removed.
- Every value in `tags` and `groups` goes through `normalizeTag` and is de-duplicated in
  first-seen order, the same rule as tags today.
- The same text may appear in two groups (cuisine `thai` and tag `thai`); they are separate
  values.
- `groupValues(item, groupId)` returns `item.kinds` for `kind`, `item.tags` for `tags`, and
  `item.groups[groupId] ?? []` for anything else.

`src/lib/groups.ts` (new)

```ts
export type GroupDef = { id: string; name: string };
export const BUILT_IN_GROUPS = ["kind", "cuisine", "area"] as const;
export const GROUPS_KEY = "whattoeat:groups";
export const GROUPS_EVENT = "whattoeat:groups-changed";
```

- `loadGroups(): GroupDef[]` and `saveGroups(list)`, with the same memory fallback and
  change event pattern as `store.ts`. Unreadable entries are skipped.
- Built-in groups are not stored. Their labels come from i18n (`group.kind`, `group.cuisine`,
  `group.area`).
- `allGroupIds(defs)` returns `["kind", "cuisine", "area", ...custom ids in stored order]`;
  this is the order everywhere groups are listed.
- `groupLabel(id, defs)` returns the translated label for a built-in group, otherwise the
  stored name.
- Custom ids come from `newId`, never equal to a built-in id or `tags`.
- A custom name is trimmed, not empty, and unique ignoring case among custom names and the
  built-in labels in both languages (`Cuisine`, `สัญชาติอาหาร` and so on).

## Migration and cleaning

`StoredRestaurant` accepts the old shape (`cuisine?: string`, `area?: string`) and the new one
(`groups?: Record<string, string[]>`). `isRestaurant` accepts both; `groups`, when present, must
be an object whose values are string arrays.

`cleanStored(item, knownIds)`:

1. Starts from `item.groups ?? {}`.
2. Adds a non-empty old `cuisine` or `area` string to `groups.cuisine` or `groups.area`.
3. Moves values under an id not in `knownIds` (a group deleted in another tab, or a file
   without that group's definition) into `tags`.
4. Normalizes and de-duplicates every list, and drops empty keys.

`loadRestaurants` passes the ids from `loadGroups()`. The cleaned form is written on the next
save; no separate migration step.

## Export and import

`src/lib/transfer.ts`

- `EXPORT_VERSION = 4`. The file gains `groups: GroupDef[]`.
- Versions 1–3 have no `groups` field; their restaurants are cleaned as above, with old
  `cuisine` and `area` strings moved into `groups`.
- A version 4 file must have a `groups` array of valid `GroupDef`s with unique ids, or the
  import fails with `import.error.entries`.
- Merging group definitions into the existing ones:
  - Same id: the file's name replaces the existing name. If that name is now taken by another
    group, the two are merged into the existing one (below).
  - New id whose name matches an existing group ignoring case: merged into the existing
    group. The file's restaurants have that id rewritten to the existing id before they are
    merged.
  - Otherwise: appended, keeping the file's order.
- Restaurants are merged as today (same id replaces, names made unique).

## Restaurant form

`src/components/restaurant-manager.ts`

- Type stays as checkboxes.
- Cuisine, Area and each custom group, in `allGroupIds` order, get a `<tag-input>` labelled with
  `groupLabel`. Suggestions are that group's values by usage.
- Plain Tags stays last.
- On submit the form calls `commit()` on every `<tag-input>` before reading values.
- `RestaurantInput` takes `groups: Record<string, readonly string[]>` instead of `cuisine` and
  `area`; `normalizeInput` cleans it the same way as `cleanStored`.
- The form re-renders when groups change (`GROUPS_EVENT` or another tab's storage event).

## Filter

`src/lib/filter.ts`

- `Filter` becomes `Record<string, GroupFilter>`, keyed by group id. Plain tags are never a key.
- `applyFilter(list, filter)` checks every key in the filter with the same rule as today: in
  each group any included value matches (all when none is included), any excluded value
  removes, and a restaurant must pass every group.
- `loadFilter` reads every key with string-array lists; `kind` values must be known kinds. The
  saved shape `{ kind, cuisine, area }` loads unchanged.
- `pruneFilter(filter, list, groupIds)` drops keys not in `groupIds` and values no restaurant
  uses.
- `renameFilterValue`, `moveFilterValue` and `dropFilterValue` keep the saved filter in step
  with Tags page operations (see below).

## Home filter and display

`src/components/random-picker.ts`

- Filter rows are `allGroupIds` order; a row shows only when some restaurant has a value in it.
- Row labels and the "Filter active" summary use `groupLabel`.

Display (restaurant list and home result card):

- `metaLine` keeps `Type · Cuisine · Area`, joining several values with `, `:
  `Food · thai, japanese · siam`.
- Custom group values show as chips labelled `<group name>: <value>`, before plain tag chips.

## Tags page

`src/routes/tags.html` renders `<tag-manager>` (`src/components/tag-manager.ts`). The header
gains a "Tags" link (EN "Tags", TH "แท็ก") between Restaurants and History.

Every operation is a pure function in `src/lib/groups.ts` that takes the restaurant list (and
group list where needed) and returns the new lists; the component saves them and the filter.

Layout: one card per group in this order: Type, Cuisine, Area, custom groups, Tags.

- Card header: the label. Custom groups also have Rename, Move up, Move down and Delete.
- Card body: each value with the number of restaurants that have it, most used first, ties by
  name. Each value has Rename, Move to… and Delete. Type shows counts only.
- Below the cards: an "Add group" form with a name field and an error message for an empty or
  taken name.
- With no restaurants: a message linking to Restaurants; adding groups still works.
- Confirmations are inline, like the reset in `data-transfer`; no browser dialogs.

| Operation    | Effect on restaurants                                                                     | Effect on saved filter                                      |
| ------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Rename value | Replaces the value in that group. If the new name already exists there, this is a merge, confirmed inline with the count | Value replaced in that group's include and exclude lists    |
| Move value   | Removes it from the group and adds it to the target (Cuisine, Area, a custom group or Tags; not Type), once | Moved to the target group's lists; dropped when the target is Tags |
| Delete value | Removes it from every restaurant, after an inline confirmation with the count             | Removed                                                     |
| Add group    | None                                                                                      | None                                                        |
| Rename group | None (restaurants refer to the id)                                                        | None                                                        |
| Reorder      | None                                                                                      | None                                                        |
| Delete group | Its values become plain tags, after an inline confirmation with the count; restaurants are saved before the group list, so a failure in between leaves values that the next load moves into tags | Key removed                                                 |

A merge or move that gives a restaurant the same value twice keeps one copy. Every operation
that changes restaurants sets their `updatedAt`.

The page re-renders on restaurant changes and group changes from this or another tab.

## i18n

New EN and TH keys for the nav link, page title, card actions, the Add group form, its errors,
the confirmations and the empty state. `field.cuisineHint` and `field.areaHint` change to say
several values are allowed.

## Delivery

1. **Stage 1, data model:** `groups` map, migration, export version 4 with group definitions,
   multi-value Cuisine and Area in the form, the filter keyed by group id, display changes.
   Custom groups exist in the model and import, with no UI to create them yet.
2. **Stage 2, Tags page:** the page, header link, group and value operations, filter sync,
   and removing "Rename or merge a tag" from `IDEAS.md`.

Each stage is its own pull request.

## Testing

- `tests/lib/restaurant.test.ts`: `cleanStored` migration from old strings, values under
  unknown ids moving to tags, normalization, `groupValues`.
- `tests/lib/groups.test.ts`: load and save, name rules, `allGroupIds`, `groupLabel`, and every
  Tags page operation including merges and duplicates.
- `tests/lib/filter.test.ts`: string-keyed filter, old saved shape, pruning by group ids, the
  rename, move and drop helpers.
- `tests/lib/transfer.test.ts`: import of versions 1–4, group definition merging by id and by
  name, export version 4.
- `tests/components/restaurant-manager.test.ts`: one `<tag-input>` per group, every input
  committed on submit, custom group chips.
- `tests/components/random-picker.test.ts`: custom group rows and summary.
- `tests/components/tag-manager.test.ts`: cards, counts, inline confirmations, each operation,
  Add group errors, empty state.
- `tests/routes/pages.test.ts` and `tests/components/app-header.test.ts`: the new page and link.

## Out of scope

- Single-value custom groups.
- Filtering by plain tags.
- Drag-and-drop reordering.
- Redesigning the phone header, which gains a fifth link (`IDEAS.md` keeps that item).
