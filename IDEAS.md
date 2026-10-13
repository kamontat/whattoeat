# Ideas

Features left out of the first release on purpose, to refine later. Each one says what it
would give and what makes it more than a small change. Pick one up by moving it into a
design spec under `docs/superpowers/specs/`, then delete it here when it ships.

## Picking

- **Filter by tag before picking.** Choose one or more tags (e.g. `noodle`, `cheap`) and
  pick only among matching restaurants. Needs a tag picker on the home page and a rule for
  when no restaurant matches.
- **Weighted random.** Favourites come up more often, or recently picked places less often.
  Needs a weight or "last picked" field on each restaurant, so the export format version
  goes up.
- **Pick history.** A short list of past picks with dates, so "we had this yesterday" is
  visible. Adds a second stored list and decides how long history is kept.

## Data

- **Cloud sync or a shared list.** One list for a group or across devices without manual
  export and import. Needs a backend (for example Cloudflare KV or D1 behind the Worker),
  sign-in or share links, and conflict handling; the biggest change on this list.
- **CSV import and export.** Edit the list in a spreadsheet. Needs a rule for tags inside one
  cell (for example `;`-separated) and quoting.
- **Separate English and Thai names.** Show the name that matches the interface language,
  falling back to the other. Changes the data model and the export format.
- **Recover invalid entries in the app.** Show what is in `whattoeat:restaurants:invalid`
  on the Settings page and let the user fix or discard each entry, instead of using browser
  developer tools.

## Look and feel

- **Rethink the phone header.** The two-row header (name and switches on top, links below)
  works but looks odd. Options: a menu button that hides the links and switches, a bottom
  tab bar for the three pages, or one compact settings button that opens language and
  theme choices.
