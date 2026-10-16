# Ideas

Features left out of the first release on purpose, to refine later. Each one says what it
would give and what makes it more than a small change. Pick one up by moving it into a
design spec under `docs/superpowers/specs/`, then delete it here when it ships.

## Picking

- **Weighted random.** Favourites come up more often, or recently picked places less often.
  Needs a weight or "last picked" field on each restaurant, so the export format version
  goes up.

## Data

- **Cloud sync or a shared list.** One list for a group or across devices without manual
  export and import. Needs a backend (for example Cloudflare KV or D1 behind the Worker),
  sign-in or share links, and conflict handling; the biggest change on this list.

