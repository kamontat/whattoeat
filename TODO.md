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

- **Cloud sync or a shared list.** One list for a group or across devices without manual
  export and import. Needs a backend (for example Cloudflare KV or D1 behind the Worker),
  sign-in or share links, and conflict handling; the biggest change on this list.

## Neighbourhood presets

None of these can happen with today's two presets in one city; each matters once the list
grows.

- **Show the matched mall in search.** A row's subtitle shows only the first two places and
  "+N", so a search that matches a later place (for example "Soi 15" in Ladprao) shows the
  row with nothing visible explaining why. While searching, show the matching place in place
  of the second one. Search only appears above 7 presets.
- **No chip for an empty city.** City chips come from the index's `cities` map, so a city
  listed there with no presets gets a chip that shows an empty list. Build chips only from
  cities that have presets, and add a test that flags a city or district no preset uses.
  Chips only appear with 2 or more cities.
- **Closer total for an Update row.** Ticking an "Update" preset counts its whole `count` in
  the button ("Add 1 area · 144 restaurants") even when only a few are new; the message after
  saving already gives the real number. Subtract the preset's recorded ids that are still
  saved.

## Look and feel

- **Work offline.** The installed app opens without a connection. Needs a service worker
  that caches the hashed build files and pages, and a way to pick up a new deploy without
  serving a stale page.

- **Floating tab bar on phones.** Replace the Material-style bottom navigation with an
  iOS-style floating island. Needs new tab bar styles, safe-area handling and a check that
  page content still clears it.
