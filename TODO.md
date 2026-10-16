# TODO

Features planned for later. Each one says what it would give and what makes it more than a
small change. Pick one up by moving it into a design spec under `docs/superpowers/specs/`,
then delete it here when it ships.

## Picking

- **Weighted random.** Favourites come up more often, or recently picked places less often.
  Needs a weight or "last picked" field on each restaurant, so the export format version
  goes up.
- **Filter by tags.** Redesign the filter so it can narrow the pool by tags as well, not only
  by the current fields. Needs a filter layout that still fits on a phone once tags and tag
  groups are added.
- **Filter by buffet.** Some way to include or leave out buffet places when picking. Needs a
  decision on where "buffet" lives: a new restaurant field (so the export format version
  goes up) or a tag the filter knows about.

## Data

- **Location as a link.** The location field accepts only a link (for example a map URL),
  not free text. When a restaurant has a link, its name becomes clickable on the random
  result and in the restaurant list. Needs URL validation in the form and a decision on
  existing free-text locations.
- **Cloud sync or a shared list.** One list for a group or across devices without manual
  export and import. Needs a backend (for example Cloudflare KV or D1 behind the Worker),
  sign-in or share links, and conflict handling; the biggest change on this list.

## Look and feel

- **Floating tab bar on phones.** Replace the Material-style bottom navigation with an
  iOS-style floating island. Needs new tab bar styles, safe-area handling and a check that
  page content still clears it.
- **Search lists.** A search box on the restaurant list and the tag list. Needs matching on
  both English and Thai text, and an empty state when nothing matches.
