# Tags page redesign

Date: 2026-10-17. Page: `/settings/tags`, component `tag-manager`.

## Why

The tags page has drifted from the restaurants page and gets hard to use as groups grow:

- It does not look like the restaurants page (no count line, no search, no pinned `+`, actions as
  button lists instead of a form).
- Every group is a card stacked down one long page, so finding one group or one value means
  scrolling. "Add a group" sits at the very bottom.
- Type values render in the same row style as clickable values, so they look tappable but are not.

Success: the page reads as a sibling of `/restaurants`, any group or value is one tap (pill or
search) away no matter how many groups exist, and nothing read-only looks clickable.

## Goals

- Same page chrome as `restaurant-manager`: back link to Settings, large title with a count line,
  a search icon button, a `+` button (top right on wide screens, pinned bottom right above the tab
  bar on phones), edit UI in a bottom sheet on phones and a side panel on wide screens.
- Show one group's values at a time, picked from a group picker.
- Search across every group's name and every value.
- Type stays visible with a restaurant count per value, clearly read-only.
- Edit through forms (fields + Save / Cancel / Delete) like `restaurant-form`, not action lists.

## Non-goals

- No change to what the operations do: add, rename, reorder and delete custom groups; rename,
  merge, move and delete values all keep today's data behaviour in `#lib/groups` and `#lib/filter`.
- Values are still only created from restaurants; this page does not add values.
- Type values stay fixed (not renamable, movable or deletable).
- No change to other pages.

## Anti-goals

- Type values looking or behaving like buttons.
- A layout that only works with a handful of groups (e.g. pills that wrap into many rows on a phone).
- Losing any current accessibility behaviour: every action reachable by keyboard, focus never lands
  on `body` after an action, labels in accessible names, live warnings.

## Layout (decided by the user)

Three stages by viewport width.

### Phone: below 48rem (`WIDE` in `#lib/media`)

Top to bottom:

1. Back link "‹ Settings".
2. Header row: title "Tags" with count line under it (`6 groups · 48 values`), search icon button
   on the right. Header stays sticky like the restaurants page.
3. Group pill strip: one pill per group in the order Type, Cuisine, Area, custom groups (stored
   order), plain Tags. Each pill shows the group name and its value count. One row, scrolls
   sideways; the selected pill is scrolled into view.
4. Group header line for the picked group (see "Picked group" below).
   The header row, the pill strip and the group header line stay pinned together under the sticky
   top while the values scroll, so switching groups never needs scrolling back up (decided by the
   user). On wide screens they scroll away as on restaurants; the side panel is the sticky part.
5. The picked group's values as a list of rows in the restaurants list style: value name, sub line
   `N restaurants`, chevron. Tapping a row opens the edit-value form in a bottom sheet.
6. `+` pinned bottom right (as on restaurants). Opens the new-group form in a sheet.

### Small desktop: 48rem to below 64rem

Same as phone (pills + values) but:

- `+` sits next to the search icon in the header.
- Pills wrap onto more lines instead of scrolling.
- Below the pills: two columns, values list on the left, side panel on the right with whichever
  form is open.

### Large desktop: 64rem and up

Three columns, no pills:

1. Groups column: one row per group (same order as pills) with name and value count; the picked
   group row is marked current (same highlight as the current restaurant row). Type's row says
   "fixed".
2. Values column: group header line + values list for the picked group.
3. Side panel with the open form.

64rem is my call for the cut-off (main is capped at 65rem). Add a second media constant next to
`WIDE` for it.

## Type (decided by the user)

Type is a group in the picker like any other (a pill on phone and small desktop, a row on large
desktop). When Type is picked its values (Food, Drinks, Dessert) show as read-only rows: dashed
outline instead of the card surface, muted text, `N restaurants` on the right, no chevron, not
buttons. A note above them: "Type is fixed. Set it on each restaurant."

## Picked group

- A line above the values: group kind and restaurant total (e.g. `Custom group · 11 restaurants`).
  For custom groups it also has an "Edit group" button that opens the edit-group form.
  Cuisine, Area and plain Tags cannot be renamed or deleted, so they get no button.
- When plain Tags is picked, the line carries what today's intro says: plain tags show on
  restaurants but are not used by the home filter. The intro paragraph under the title goes away;
  the count line replaces it. (My call.)
- Default pick: the first group that can be edited (Cuisine). The pick is remembered in
  `sessionStorage` so returning to the page in the same session lands on the same group; a
  remembered group that no longer exists falls back to the default. (My call.)
- A group with no values shows "No values yet." in place of the list.

## Search

Works like the restaurants page search (`restaurant-search`): icon opens a field in the header row,
Cancel closes it, `/` shortcut, same accent and Thai folding (`#lib/search`).

While searching:

- The picker (pills, or the groups column on large desktop) is hidden; one result list replaces the
  values list.
- Results: every group whose name matches, then every value whose text matches, across all groups
  including Type. Value results show the group name in their sub line (`Cuisine · 8 restaurants`).
  Matched text is highlighted with `<mark>` as on restaurants.
- Tapping a group result ends search and picks that group. Tapping a value result opens its
  edit-value form (search stays open, like editing a restaurant from search). A Type value result is
  read-only like everywhere else.
- No matches: "No tags match "{query}"." with a Clear search button.

Whether `restaurant-search` is generalised or a new `tag-search` is written is left to the builder.

## Forms

All forms open in a bottom sheet on phones (`app-sheet`) and in the side panel on wide screens.
The panel has a heading and a close button like the restaurants edit panel. As on restaurants, the
panel only shows while a form is open; until then the list takes the space. (My call.)

There is one form slot. On wide screens the panel is not modal: picking another group leaves an
open form alone, but opening another form (tapping a value, Edit group, `+`) replaces it and drops
its unsaved edits, as tapping another restaurant does today. Starting a search also leaves it
open. No dirty tracking. (My call, matching restaurants.)

### New group (`+`)

- Field: Name.
- Buttons: Add group (primary), Cancel.
- Errors as today (`tags.nameRequired`, `tags.nameTaken`).
- On add: the form closes, the new group becomes the picked group, a status line says it was added.

### Edit value (tap a value row)

- Heading: the value. Sub line: `{group} · N restaurants`.
- Fields: Name (text), Group (select of every group but Type, plus plain Tags; current group
  selected).
- Buttons: Save (primary), Cancel, Delete.
- Save applies the rename and the move together. If the resulting name already exists in the
  resulting group, Save first shows the merge prompt in place
  (`Merge X into Y? N restaurants`) with Merge / Cancel. Value errors as today (`tags.valueRequired`,
  `tags.valueComma`).
- Delete shows the confirm in place (`Remove X from N restaurants?`) with Delete / Cancel, like the
  restaurant form's delete.
- Filter updates (`renameFilterValue`, `moveFilterValue`, `dropFilterValue`) happen as today.
- After save the form closes and a status line says what happened.

### Edit group (custom groups only)

- Heading: the group. Sub line: `Custom group · N values · N restaurants`.
- Field: Name. Position: Move up / Move down buttons that apply immediately (disabled with reason at
  the ends, as today). They save right away, with a hint "Order saves right away"; Cancel only drops
  a name edit and never undoes a move. (My call.)
- Buttons: Save (primary), Cancel, Delete group.
- Delete group shows the current confirm text in place (values become plain tags), then the form
  closes and the pick falls back to the default group.

## Kept as is

- Storage warnings (memory-only, skipped entries).
- Empty state when there are no restaurants (card linking to restaurants); adding groups still works.
- `base` attribute for the nested route.
- Follows restaurant and group changes from other tabs: an open form whose value or group
  disappears closes, as today.
- English and Thai strings for everything new.

## Left to the builder

- Splitting `tag-manager` into parts (e.g. `src/components/tags/` with search, list and form, as
  `src/components/restaurant/` does).
- Exact component, event and i18n key names.
- Picker semantics for assistive tech (tabs vs. pressed buttons), as long as it is keyboard
  operable and announces the picked group.
- Focus rules after each action, following `restaurant-manager` patterns (never `body`).
- Rewriting `tests/components/tag-manager.test.ts` to the new structure while keeping coverage of
  every behaviour it tests today.
