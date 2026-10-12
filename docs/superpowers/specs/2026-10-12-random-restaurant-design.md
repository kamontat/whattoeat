# Random restaurant website — design

Date: 2026-10-12

## Goal

A small static website that answers "what should I eat?" by picking a random
restaurant from a list the user maintains. Three pages, UI available in English
and Thai. Keep it simple: no accounts, no backend.

## Decisions (from brainstorming)

| Topic            | Decision                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| Storage          | Browser `localStorage` only. Each device has its own list.               |
| Fields           | `name` (required), `tags`, `location`, `notes`                           |
| Import/export    | JSON file with a versioned envelope                                      |
| Import behaviour | User chooses **Replace** or **Merge** after picking a file               |
| Language         | EN/TH toggle in the header, saved in `localStorage`, same URLs           |
| Restaurant name  | Single free-text field; only UI text is translated                       |
| Random           | Uniform random; never repeat the previous pick when the list has 2+ items |
| Routes           | `/`, `/restaurants`, `/settings` (three static HTML pages)               |

## Architecture

- Static site built by `@kctools/bun-server`, deployed to Cloudflare Workers
  static assets (unchanged from the template).
- Pages:
  - `src/routes/index.html` — random picker
  - `src/routes/restaurants.html` — manage the list (`/restaurants`)
  - `src/routes/settings.html` — import / export (`/settings`)
- UI as Lit components in `src/components/`, registered in
  `src/types/global.d.ts`.
- Logic as plain TypeScript in `src/lib/`, with no DOM dependency except
  `localStorage` access, which is isolated in `store.ts`.
- The template's `hello-world` component and its test are removed.

## Data model

```ts
type Restaurant = {
	id: string; // crypto.randomUUID()
	name: string; // trimmed, non-empty
	tags: string[]; // trimmed, non-empty, de-duplicated, order kept
	location: string; // free text or URL, may be empty
	notes: string; // may be empty
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
};
```

Stored under `localStorage` key `whattoeat:restaurants` as a JSON array.

Export file (`whattoeat-YYYY-MM-DD.json`):

```json
{
	"app": "whattoeat",
	"version": 1,
	"exportedAt": "2026-10-12T10:00:00.000Z",
	"restaurants": []
}
```

## Units

### `src/lib/restaurant.ts`

- `Restaurant` type and `RestaurantInput` (`name`, `tags`, `location`, `notes`).
- `normalizeInput(input)` — trims fields, cleans tags.
- `parseTags(text)` — splits a comma-separated string into clean tags.
- `isRestaurant(value)` — runtime type guard used by store load and import.

### `src/lib/store.ts`

- `loadRestaurants()` — reads and validates storage. Invalid JSON or invalid
  entries: invalid entries are dropped, the rest is kept; unparseable data
  returns `[]`.
- `saveRestaurants(list)`.
- `addRestaurant(input)`, `updateRestaurant(id, input)`, `removeRestaurant(id)`
  — return the new list and save it. `addRestaurant`/`updateRestaurant` throw
  on empty name.
- Every save dispatches a `whattoeat:restaurants-changed` event on `window`.
  The store also forwards the browser `storage` event for its key, so other
  tabs stay in sync.
- `onRestaurantsChanged(callback)` returns an unsubscribe function.

### `src/lib/transfer.ts`

- `toExportFile(list, now)` — builds the envelope.
- `exportFileName(now)` — `whattoeat-YYYY-MM-DD.json`.
- `parseImport(text)` — returns `{ ok: true, restaurants }` or
  `{ ok: false, error }` where `error` is an i18n key: `import.error.json`
  (not JSON), `import.error.format` (wrong `app`/missing array),
  `import.error.version` (unsupported version), `import.error.entries`
  (any entry fails `isRestaurant`). All-or-nothing: one bad entry rejects the
  file.
- `mergeRestaurants(existing, incoming)` — by `id`; an incoming item replaces
  the existing one with the same id, new ids are appended.

### `src/lib/random.ts`

- `pickRandom(list, previousId?, rng = Math.random)` — returns a restaurant or
  `undefined` for an empty list. With 2+ items it never returns `previousId`.

### `src/lib/i18n.ts`

- `en` dictionary (source of truth) and `th` dictionary typed as
  `Record<keyof typeof en, string>`, so a missing Thai key is a type error.
- `getLang()`, `setLang(lang)`, `t(key)`.
- Initial language: stored value under `whattoeat:lang`, else `th` when
  `navigator.language` starts with `th`, else `en`.
- `setLang` saves, sets `document.documentElement.lang`, and dispatches
  `whattoeat:lang-changed`.
- `LangController` — a Lit reactive controller that calls `requestUpdate()`
  on the host when the language changes. Every component that shows text uses it.

## Components

### `<app-header>`

Site title, nav links (Home / Restaurants / Settings, current page marked with
`aria-current="page"`), and an EN | TH toggle (two buttons, active one
`aria-pressed="true"`).

### `<random-picker>` (on `/`)

- Big button "What should I eat?".
- Result card: name, tags as chips, location (rendered as a link opening in a
  new tab when it starts with `http://` or `https://`, otherwise text), notes.
- Empty list: message with link to `/restaurants` instead of the button.
- Subscribes to store changes.

### `<restaurant-manager>` (on `/restaurants`)

- Form at the top: name (required), tags (comma-separated), location, notes.
  "Add" in create mode; "Save" and "Cancel" in edit mode.
- Empty name shows an inline error and does not save.
- List below, sorted by name (locale-aware, `localeCompare`), each row with
  Edit and Delete. Delete swaps the row's buttons for "Confirm delete" /
  "Cancel" inline (no `window.confirm`).
- Empty list shows a short message.

### `<data-transfer>` (on `/settings`)

- Shows current restaurant count.
- Export button: downloads the JSON file via a Blob URL.
- Import: file input (`accept="application/json,.json"`). After a valid file is
  read, shows "N restaurants found" with **Replace** and **Merge** buttons and
  Cancel. After applying, shows a success message. An invalid file shows the
  translated error and nothing is changed.

## Styling

Shared tokens and base styles in `src/styles/global.css`; component styles in
each component. Mobile-first single column, readable on phones. Font stack
includes a Thai-capable system font fallback.

## Error handling

- Corrupt storage never crashes a page; worst case is an empty list.
- `localStorage` unavailable (throws): store falls back to an in-memory list for
  the session; language falls back to detection.
- Import errors are shown in the UI, never thrown to the console only.

## Testing

`bun test` with happy-dom:

- `tests/lib/restaurant.test.ts` — tag parsing, normalisation, type guard.
- `tests/lib/store.test.ts` — CRUD, validation, corrupt storage, change event.
- `tests/lib/transfer.test.ts` — envelope, file name, each import error,
  merge vs replace.
- `tests/lib/random.test.ts` — empty, single, no-repeat with injected rng.
- `tests/lib/i18n.test.ts` — detection, persistence, `t`, `html lang`.
- `tests/components/*.test.ts` — header toggle switches text; picker empty and
  filled states; manager add/edit/delete and empty-name error; data-transfer
  invalid file error and replace/merge.

Then `bun run check`, `bun run build`, and a manual check in the dev server.
Layout and colour are preview checks in the PR.

## Out of scope

Shared/cloud sync, accounts, filters or weighted random, maps, CSV, per-language
restaurant names, history of picks.
