# Tag rework — design

Date: 2026-10-13

## Goal

Make tags reliable and useful for picking:

- Tags are case-insensitive, so `Thai` and `thai` are one tag.
- The tag field suggests tags that already exist.
- The random picker can be limited by tags, both to include and to exclude.

## Decisions (from brainstorming)

| Topic             | Decision                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| Case handling     | Store tags as lowercase canonical text; no separate display casing               |
| Existing data     | Normalized when loaded and when imported; export format stays `version: 1`       |
| Tag field         | New chip input component (`<tag-input>`) with a suggestion dropdown              |
| Suggestion order  | Most-used tags first, ties by name                                               |
| Filter semantics  | Include and exclude: any included tag matches (OR), any excluded tag removes     |
| Filter UI         | One row of tri-state chips on the home page: off, include, exclude               |
| Filter memory     | Remembered in `localStorage`, with a visible "Filter active · Clear" line        |
| No match          | Pick button disabled, message with a Clear button                                |
| Rename/merge tag  | Out of scope; recorded in `IDEAS.md`                                             |

## Tag data rule

`src/lib/restaurant.ts`

- `normalizeTag(text: string): string` — Unicode NFC, trim, collapse any run of
  whitespace into one space, then `toLocaleLowerCase()`. Thai text has no case, so
  only the whitespace rules affect it.
- `parseTags(text)` uses `normalizeTag` on each comma-separated part, drops empty
  results and de-duplicates, keeping first-seen order. `normalizeInput` already
  calls `parseTags`, so typed input and imported files are both covered.
- `tagCounts(list: readonly Restaurant[]): string[]` — every tag in the list,
  most-used first, ties sorted by `localeCompare`. Used for suggestions and for
  the filter chips.

`src/lib/store.ts`

- `loadRestaurants` returns entries with tags passed through `parseTags`
  (`parseTags(item.tags.join(","))`), so old data such as `["Thai", "thai"]`
  reads as `["thai"]`. It is written back in that form on the next save; no
  separate migration step and no export version change, since tags remain
  `string[]`.

## `<tag-input>` component

`src/components/tag-input.ts`, registered in `src/types/global.d.ts`.

- Properties: `value: string[]` (current tags), `suggestions: string[]` (all
  known tags, already ordered), `label`/`hint` text from the parent.
- Emits a `change` event (`CustomEvent<string[]>` detail) whenever the tag list
  changes.
- Each tag renders as a chip with a remove (×) button that has an accessible
  label naming the tag.
- Typing text, then pressing Enter or typing a comma, adds the normalized text
  as a tag. Duplicates and empty text are ignored. Pasting `a, b` adds both.
- Backspace in an empty text box removes the last tag.
- Dropdown: tags from `suggestions` whose text contains the normalized typed
  text, minus tags already added, at most 8. Shown while the text box has focus
  and text. ArrowDown/ArrowUp move the active option, Enter adds the active
  option (or the typed text when none is active), Escape closes the dropdown.
  Clicking an option adds it. Uses the ARIA combobox pattern
  (`role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant`, `role="listbox"`/`role="option"`).
- Text still in the box when the form is submitted counts as a tag: the
  component exposes a `commit()` method that adds pending text, and the parent
  calls it before reading `value`.

`restaurant-manager` changes:

- Form state `tags` becomes `string[]`; editing an item copies its tags array.
- The comma text field is replaced by `<tag-input>` with suggestions from
  `tagCounts` over the current list.
- `field.tagsHint` changes to say "Press Enter or comma to add" (EN and TH).

## Tag filter

`src/lib/filter.ts`

```ts
export type TagFilter = { include: string[]; exclude: string[] };
export const EMPTY_FILTER: TagFilter = { include: [], exclude: [] };
export const FILTER_KEY = "whattoeat:filter";
```

- `applyFilter(list, filter)`: when `include` is non-empty, keep restaurants
  having at least one included tag; then remove restaurants having any excluded
  tag. An empty filter returns the list unchanged.
- `isFilterActive(filter)`: true when either list is non-empty.
- `cycleTag(filter, tag)`: off → include → exclude → off. A tag is never in both
  lists.
- `pruneFilter(filter, knownTags)`: drops tags that no longer exist.
- `loadFilter()` / `saveFilter(filter)`: read and write `FILTER_KEY` with the
  same try/catch style as `store.ts`. Invalid JSON or wrong shape gives
  `EMPTY_FILTER`; tags read back are passed through `normalizeTag`.

`src/lib/random.ts` is unchanged; the picker passes it the filtered list.

### Picker UI (`random-picker`)

- Above the pick button, when at least one tag exists: a row of chips from
  `tagCounts`. Each chip is a `<button>` with `aria-pressed` ("mixed" is not
  used); state is shown by both a symbol (✓ include, ✕ exclude) and colour, and
  the accessible name includes the state ("thai, included").
- Tapping a chip calls `cycleTag`, saves the filter and recomputes the pool.
- When the filter is active, a line shows "Filter active: ✓ thai, ✓ japanese,
  ✕ spicy" and a Clear button that resets to `EMPTY_FILTER`.
- When the filtered pool is empty, the pick button is disabled and a message
  "No restaurant matches this filter." shows with a Clear button.
- Picking uses `pickRandom(pool, previousId)`. If the current pick is no longer
  in the pool after a filter or data change, the result is hidden.
- On load and on every restaurant change, the filter is pruned to existing tags
  and saved if pruning changed it.
- New i18n keys, EN and TH, for: filter label, include/exclude state names,
  "Filter active", Clear, and the no-match message.

## Testing

Unit (`tests/lib/`):

- `normalizeTag`: case, whitespace collapse, NFC, Thai text unchanged.
- `parseTags`: case-only duplicates merge, order kept.
- `loadRestaurants`: stored mixed-case tags come back normalized.
- `parseImport`: imported tags normalized.
- `tagCounts`: ordering by count then name.
- `applyFilter`: empty, include only, exclude only, both, nothing matches.
- `cycleTag`, `pruneFilter`, `loadFilter` (missing, bad JSON, wrong shape,
  mixed case), `saveFilter` when storage throws.

Component (`tests/components/`):

- `tag-input`: Enter and comma add, duplicates ignored, Backspace removes,
  × removes, suggestions filtered and exclude existing tags, arrow keys plus
  Enter pick, Escape closes, `commit()` adds pending text, `change` event fires.
- `restaurant-manager`: saving tags from the chip input, editing keeps tags.
- `random-picker`: chips cycle states, pick only comes from the filtered pool,
  active-filter line and Clear, no-match state disables the button, filter
  survives a remount, unknown tags are pruned.

Preview checks (not testable in happy-dom): chip colours and wrapping at
phone width, dropdown position.

## Docs

- `IDEAS.md`: remove "Filter by tag before picking"; add "Rename or merge a
  tag".
- `CHANGELOG.md`: entry added when the change lands.
