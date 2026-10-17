# Restaurant search

Date: 2026-10-16
Status: approved design, awaiting spec review

## Purpose

The restaurant list is long (well over 100 places) and sorted by name only, so on a phone
reaching one restaurant to edit it means a lot of scrolling. Search is for **finding one place
you already know, to edit it**: type part of its name, tap it. It is not a way to browse a slice
of the list (by cuisine, area or tags); that stays with the Home filter.

Preview (interactive mockup): <https://claude.ai/code/artifact/ab61105b-a125-42db-8f7e-2cab0f41fdb1>

## Decisions made with the user

- Search matches the **name only**.
- Search lives behind a **magnifier button in the header**, beside the Tags link, not as an
  always-visible field.
- Tapping it turns the **title row into a search field with Cancel** (iOS search mode), not a
  field below the header and not a separate sheet.

## Behaviour

### Entering and leaving search

1. The header gets an icon button named "Search restaurants" (Thai: "ค้นหาร้านอาหาร"), placed
   before the Tags link. It only renders when there is at least one restaurant.
2. Pressing it replaces the title row (title and count line) with:
   - a field: magnifier icon, `<input type="search">` with placeholder "Search by name"
     ("ค้นหาด้วยชื่อ") and an accessible name "Search restaurants";
   - a clear button (⊗, "Clear search" / "ล้างการค้นหา"), shown only while the field has text;
   - a text button "Cancel" ("ยกเลิก").
   Below it, a count line (see Feedback).
3. Focus moves into the field **synchronously inside the click handler**: the input is always
   rendered (hidden until search mode) or rendered and focused before the handler returns, so
   iOS opens the keyboard. A focus set after an `await` does not open the iOS keyboard.
4. Typing filters the list on every `input` event; there is no submit step. Enter (the
   keyboard's Search key, `enterkeyhint="search"`) opens the restaurant when exactly one
   matches; otherwise it only puts the keyboard away so every result is in view.
5. Clear (⊗) empties the field, keeps search mode and keeps focus in the field.
6. Cancel, or `Escape` while focus is in the field, empties the query, leaves search mode,
   restores the title row and the full list, and focuses the magnifier button.
7. On wide screens (from 48rem, any pointer) `/` opens search mode when focus is not in an
   `input`, `textarea`, `select` or contenteditable element, and no sheet is open.
8. The query is never stored. Reloading or leaving the page starts at the full list.

### Matching

A pure helper in `src/lib/search.ts`:

```ts
/** The query split into folded words; empty when there is nothing to search for. */
export const searchWords = (query: string): string[];
/**
 * Whether every word occurs in the name, and if so the ranges of the name to highlight
 * (start/end indices into the original string, merged and sorted); `undefined` when it does
 * not match.
 */
export const matchName = (
	name: string,
	words: readonly string[],
): { start: number; end: number }[] | undefined;
```

- Folding: NFC, lower-case, and Latin combining accents (U+0300–U+036F after NFD) removed.
  Thai vowel and tone marks are **not** removed (they are combining marks too, and stripping
  them would make different Thai words equal).
- Words: the folded query split on whitespace, empties dropped. A query of only spaces means
  "no search" (full list, count shows the total).
- A name matches when **every** word is a substring of the folded name, in any order.
- Highlight ranges map back to the original name's characters, so "Café" highlights "Café"
  for the query "cafe".
- Results keep the list's existing order (A–Z by name with the current language's collation).

### Feedback

- When nothing matches, the count line is dropped (the no-match card says it) and screen
  readers hear the no-match message instead of "0 of N".
- While searching with at least one word, the count line reads "{shown} of {total}
  restaurants" ("{shown} จาก {total} ร้าน"); with no words yet it shows the usual total.
- The count line is a polite live region updated **after typing pauses for 500 ms**, so a
  screen reader announces the result count once rather than on every key.
- Each result row shows the name with the matched ranges wrapped in `<mark>`: bold weight on
  the soft primary tint (`--color-primary-soft`), text colour unchanged so contrast holds in
  both themes. The row's accessible name stays "Edit {name}" (unaffected by the marks).
- No match: the list is replaced by one empty-state card (`.card.empty`):
  - text: No restaurants match "{query}". (ไม่มีร้านที่ตรงกับ “{query}”)
  - primary button **Add "{query}"** (เพิ่ม “{query}”): opens the new-restaurant form (sheet on
    phones, side panel when wide) with the name field set to the trimmed query;
  - button **Clear search**: same as ⊗.

### Editing from results

- Tapping a result opens its edit sheet or side panel as today.
- Saving, cancelling or deleting returns to the same filtered list; the query and search mode
  stay until Cancel.
- A save that renames a restaurant so it no longer matches removes it from the results; the
  "Saved {name}" status still confirms the save.
- On wide screens the side panel keeps showing the selected restaurant even when the query
  hides its row.
- Another tab adding, renaming or deleting restaurants re-filters the results.

### Phone layout

- On phones the title row, and the search row while searching, stay stuck to the top of the
  screen, so search is one tap away in a long list and results scroll under the field. From
  48rem the side panel is the sticky part and the top row scrolls normally.
- While the keyboard is up it covers the pinned Add button and the tab bar (normal iOS
  behaviour); the empty-state Add button covers the "search, then add" path.

## Accessibility

- Native `<input type="search">` with `aria-label`, `autocomplete="off"`, `autocorrect="off"`,
  `autocapitalize="off"`, `spellcheck="false"`, 16 px text (no iOS zoom). The browser's own
  clear control is hidden so there is one clear button.
- Every button is at least `--tap` tall; the magnifier button has the same shape as the Tags
  link.
- Focus order in search mode: field, clear (when shown), Cancel, then the results.
- The results list keeps its `<ul>` of row buttons; `<mark>` adds no announcement noise.
- Visible focus ring on every control; reduced motion turns off the search row's fade-in.

## i18n keys

| Key | English | Thai |
| --- | --- | --- |
| `search.open` | Search restaurants | ค้นหาร้านอาหาร |
| `search.placeholder` | Search by name | ค้นหาด้วยชื่อ |
| `search.clear` | Clear search | ล้างการค้นหา |
| `search.cancel` | Cancel | ยกเลิก |
| `search.count` | {shown} of {total} restaurants | {shown} จาก {total} ร้าน |
| `search.noMatch` | No restaurants match "{query}". | ไม่มีร้านที่ตรงกับ “{query}” |
| `search.add` | Add "{query}" | เพิ่ม “{query}” |

## Files

- `src/lib/search.ts` (new): `searchWords`, `matchName`; tests in `tests/lib/search.test.ts`.
- `src/components/restaurant-manager.ts`: search state (`searching`, `query`), header swap,
  filtered rows with marks, no-match card, Add prefilled name, `/` shortcut, debounced count.
- `src/lib/icons.ts`: a `search` icon.
- `src/lib/i18n.ts`: the keys above.
- `tests/components/restaurant-manager.test.ts`: behaviour tests.

## Testing

- `search.ts`: case, spaces, Latin accents ("cafe" ↔ "Café"), Thai kept as typed (a Thai name
  with tone marks does not match the same letters without them), several words in any order,
  ranges merged when words overlap, empty and whitespace queries.
- Component: button only with restaurants; opening focuses the field synchronously; filtering
  and marks; count text and its delay; clear keeps mode and focus; Cancel and Escape restore
  the header and focus the button; no-match card; Add prefills the name (phone and wide);
  edit from results keeps the query; rename out of the query drops the row; another tab's
  change re-filters; `/` opens only on wide screens and not while typing elsewhere; Thai
  strings.

## Out of scope

- Searching cuisine, area, tags, location or notes.
- Search on the Tags page (still in `TODO.md`).
- Fuzzy or typo-tolerant matching and recent searches.
