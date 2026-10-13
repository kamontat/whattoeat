# Ideas

Features left out of the first release on purpose, to refine later. Each one says what it
would give and what makes it more than a small change. Pick one up by moving it into a
design spec under `docs/superpowers/specs/`, then delete it here when it ships.

## Picking

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
- **Rename or merge a tag.** Change a tag everywhere at once, or fold one tag into another
  (e.g. `noodles` into `noodle`). Needs a tag management view and a rule for updating the
  filter saved on the home page.
- **Recover invalid entries in the app.** Show what is in `whattoeat:restaurants:invalid`
  on the Settings page and let the user fix or discard each entry, instead of using browser
  developer tools.

## Look and feel

- **Dark mode.** A dark palette that follows the system setting, with an optional toggle.
  The colours are already custom properties in `src/styles/global.css`, so most of the work
  is choosing the palette and checking contrast.
