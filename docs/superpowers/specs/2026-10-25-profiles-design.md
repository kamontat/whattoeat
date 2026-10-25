# Profiles, and presets that replace and update — design

Date: 2026-10-25

## Goal

Let one person keep several completely separate restaurant worlds on one device ("Personal",
"Couple", "Family") and switch between them for the occasion. Then rework neighbourhood presets
to fit that model: applying a preset always replaces the active profile's list, and a preset
the profile already uses can be brought up to date when the bundled file changes.

The owner approved a clickable phone prototype from the brainstorm session (Settings → Profile,
the profile Settings tab, and the preset page with Replace and per-row Update). It was a
throwaway and is not in the repo; where it and this document differ, this document wins. Its
look is not a reference either: everything is built with the app's existing design system
(`src/styles/`, the current group, row, chip, badge, button and toast styles), not the
prototype's styling.

### Why

The owner eats in different groups, and each group has different places and different history.
Today there is one list, so switching occasion means editing or replacing it. A local preset
was the first idea; the owner chose profiles instead, because a group's list should keep its
own edits and history, not be reloaded from a template each time.

## Shipping order

Two pull requests, in this order:

1. **Profiles.** Everything under "Profiles" below.
2. **Presets rework.** Everything under "Presets" below, built on per-profile storage.

Each one ships through the normal workflow (worktree, test first, PR, preview URL).

## Profiles

### What a profile holds

A profile is a separate set of everything the user curates or that records their picks:

- restaurants (`whattoeat:restaurants`)
- tag groups (`whattoeat:groups`)
- pick history (`whattoeat:history`)
- the Home filter and the Restaurants list filter (`whattoeat:filter`, `whattoeat:list-filter`)
- the pick count (`whattoeat:pick-count`)
- the applied-preset record (`whattoeat:presets`)
- the session's selected tag group (`whattoeat:tags-group`, in sessionStorage)

Nothing leaks across profiles: deleting a restaurant in "Family" leaves "Personal" alone.

Shared across profiles, because they belong to the device: language (`whattoeat:lang`) and
theme (`whattoeat:theme`).

### Storage

- `whattoeat:profiles` holds the list of profiles: `{ id, name }[]`, in creation order. `id` is
  a random short string, never shown.
- `whattoeat:profile` holds the active profile's id.
- Each per-profile key gets the profile id in it, e.g. `whattoeat:<id>:restaurants`. The exact
  key shape is the builder's call, as long as it is one function every store uses.
- **Default name.** The first profile is named "Personal" in the language active when it is
  created ("ส่วนตัว" in Thai). After that it is ordinary stored data and is not re-translated.
- **Upgrade.** On first load after this ships, when `whattoeat:profiles` is missing, create one
  profile with the default name and move the existing unprefixed keys into it, then delete the old
  keys. A brand-new user gets the same single default-named profile, empty. There is always at
  least one profile.
- Missing or unreadable profile list, or an active id that is not in the list: fall back to the
  first profile (creating a default-named one if there is none). Per the project's "not public yet"
  rule, no extra handling for odd legacy shapes.

### Switching and other tabs

- Switching changes `whattoeat:profile`, and every page reloads its stores from the new
  profile's keys: the restaurant list, history, filters, tags and pick count all follow.
- Another open tab sees the change through the existing `storage` event plumbing and reloads
  the same way. Builder's call how, as long as no tab keeps showing or writing the old
  profile's data after a switch.

### UI

**Settings** gets one "Profile" row at the top, above everything else: the active profile's
avatar and name, and its restaurant count, linking to the profiles page. Switching does not
happen on Settings itself.

**The profiles page, `/settings/profiles`**, is a new page like `/settings/presets` and
`/settings/tags`, with the same back link to Settings:

The page uses the same layout as the Restaurants page:

- **Adding.** An icon-only "+" button (accessible name "New profile"). On phones it is pinned
  at the bottom right and opens the profile form in a sheet that slides up from the bottom; on
  wide screens it sits at the top right beside the title and opens the form in a side panel next
  to the list.
- **The profile form** asks for a name. "New profile" creates the profile **empty** (no
  restaurants, default tag groups, no history, default filters and pick count) and switches to
  it. "Rename Family" uses the same form in the same sheet or panel.
- **One row per profile:** an initial avatar, the name, its restaurant count, and a tick on the
  active one. Tapping the row switches to it and shows a short "Switched to Family" message.
  Each row has three icon-only buttons with accessible names that include the profile:
  - **Rename** opens the profile form for that profile.
  - **Copy** makes a new profile with everything in that profile **except pick history**
    (restaurants, tag groups, filters, pick count and applied-preset record). The copy is named
    `<name> - <n>`, with `n` the smallest number from 1 that makes the name unique ("Family -
    1", then "Family - 2"); when that would pass 24 characters the original name is shortened
    to fit. The current profile stays active, and a message says "Copied Family to Family - 1".
  - **Delete** removes that profile after **one confirm step**: "Delete Family? This removes
    its 42 restaurants and 12 history entries." Deleting the active profile adds "You'll switch
    to Personal." and then switches to the first remaining profile; deleting another profile
    leaves the active one as it is. Delete is disabled while only one profile exists.
- **Names.** Required, trimmed, unique (case-insensitive), at most 24 characters. Errors show
  inline under the field ("Give it a name.", "Another profile has that name.").
- The rest of Settings that acts on profile data is grouped under "Data in <name>": presets,
  tags, export/import. Language and theme go under "This device".

**The Settings tab is the profile indicator.** On phones the Settings tab in the bottom bar
shows the active profile's initial in a round avatar and the profile's name as its label (cut
with an ellipsis when long), instead of the gear and "Settings". Its accessible name is
"Settings, profile Family". On wide screens, where the tabs are header links, the Settings
link shows the same avatar and name. It still goes to Settings, where the Profile row leads on
to `/settings/profiles`.

### Export, import and reset

- Export and import act on the **active profile only**. Importing into "Family" never touches
  "Personal".
- The export file carries the profile's applied-preset record, so an imported profile keeps
  its "In your list" and "Update" states. This bumps the export format from version 7 to 8,
  with a new `presets` list (the same `{ id, updatedAt, ids }` shape as `whattoeat:presets`).
- Importing a version 8 file: **Replace** takes the file's preset record as the profile's.
  **Merge** adds the file's record for each preset the profile has no record of yet, and keeps
  the profile's own record where both have one.
- Importing a version 1–7 file reads as having no preset record: Replace leaves the profile
  with none, Merge keeps the profile's. The Update rules under "Presets" still cope with preset
  ids that arrive without a record.
- Bundled preset files stay valid as they are; they are read with the same parser and have no
  preset record of their own.
- "Clear restaurants" and "Clear history" act on the active profile.
- "Reset everything" stays device-wide: it wipes every profile, language and theme, and the
  app comes back with one empty profile with the default name.

### Non-goals

- No syncing profiles across devices.
- No per-profile language or theme.
- No profile pictures or colours; the initial is the only avatar.

## Presets

### Replace only

- The Add / Replace switch goes away. Ticking presets and pressing the action replaces the
  active profile's whole list with the ticked presets' restaurants.
- With restaurants saved, the button reads "Replace with 2 areas · 138 restaurants", the
  warning line says it replaces the N restaurants in <profile>, and the existing confirm card
  runs before saving. Undo works as today.
- With an empty profile there is nothing to lose: the button reads "Use 2 areas · 138
  restaurants", there is no warning line, and there is no confirm card. Undo still offered.
- Replacing rewrites the profile's applied-preset record to exactly the ticked presets.
- The "Start with a neighbourhood" entry on an empty Home and in Settings stays and leads here.

### Row states

For each preset, against the active profile's applied-preset record:

- **Not used:** no badge.
- **In your list:** the profile applied this preset and its `updatedAt` matches. Shows the "In
  your list" badge. It can still be ticked for a replace.
- **Update:** the profile applied this preset, and the index's `updatedAt` differs from the one
  recorded. Shows an **Update** button in place of the badge. The row can still be ticked.

The existing rule that a recorded preset with none of its ids still saved counts as "not used"
stays. An Update button only ever shows on a preset the active profile has applied; a "Not used"
row never offers Update, however its file has changed.

### Update

Tapping a row's Update button syncs that one preset into the active profile, without a confirm
step, then shows a message with Undo, e.g. "Siam updated: 3 added, 2 removed, 1 reverted." It
does not change the ticked selection.

Let `recorded` be the ids the profile recorded for this preset, `file` the restaurants in the
preset's current file, and `saved` the profile's list:

| Restaurant | What update does |
|---|---|
| In `file` and in `saved`, and in `recorded` | Replace the saved copy with the file's version (the user's edits are reverted). |
| In `file`, not in `recorded`, not in `saved` (new in the preset) | Add it. |
| In `file` and in `saved`, not in `recorded` (e.g. it came in through an import) | Treat it as this preset's: replace the saved copy with the file's version, keeping its place in the list. Never add a second copy of an id. |
| In `recorded`, not in `file` (the preset dropped it) | Remove it from `saved` if present. |
| In `recorded` and in `file`, not in `saved` (the user deleted it) | Leave it deleted. |
| In `saved`, not in `recorded` and not in `file` (the user's own, or from another preset) | Leave it alone. |

Afterwards the profile's record for this preset becomes the file's `updatedAt` and the file's
ids. "Reverted" in the message counts saved copies that actually differed from the file's
version. Records for other presets are untouched.

If a restaurant id is shared with another preset the profile also uses, a preset dropping it
still removes it; preset ids are unique across files, so this should not happen.

Pick history keeps entries for removed restaurants, as it does today after a delete.

### Picker fixes folded in

- **City chips only for cities with presets.** Chips come from the cities that at least one
  preset uses, not from every key in the index's `cities` map. A test flags any city or
  district in the index that no preset uses.
- **Search shows why a row matched.** While searching, if the match is a place that is not one
  of the two shown in the subtitle, show that place in place of the second one, highlighted.
- The old over-count on the Add button and the "keep the selection when switching Add and
  Replace" request both go away with the Add mode.

### Non-goals

- No automatic updates; the user always taps Update.
- No "update all" button.
- No Add (merge) mode for presets. File and paste import keep their own Replace / Merge choice.

## Left to the builder

- The exact per-profile key format and how stores read the active profile.
- How the profiles page is split into components.
- Message wording beyond the examples above, in English and Thai, following `src/lib/i18n.ts`.
- Test layout, following the repo's test-first workflow.
