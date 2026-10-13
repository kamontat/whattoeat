# Lock and history — design

Date: 2026-10-13

## Goal

Turn a random pick into a decision that is remembered:

- After a pick, the user chooses one of the two cards with **Eat here**. That saves a
  _lock_: the restaurant and the date and time.
- A new **History** page lists every lock, newest first, with stats on top.
- Any lock can be deleted from the History page.

Approved preview: <https://claude.ai/code/artifact/fcf47c45-821a-48b8-a1c0-1da96528031f>

## Decisions (from brainstorming)

| Topic             | Decision                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| Purpose           | A log plus stats; the picker does not use history to avoid repeats                    |
| Storage           | Own `localStorage` key `whattoeat:history`, separate from restaurants                 |
| Entry content     | Restaurant id plus a copy of its name, so a deleted restaurant still shows            |
| Lock control      | An **Eat here** button inside each result card, not a clickable card                  |
| After locking     | Locked card shows "✓ Locked at 12:30"; other card stays; both buttons hide            |
| Locks per pick    | One; **Pick again** starts a new pair with buttons                                    |
| Stats             | Total locks, plus a table of restaurant, times locked and last date                   |
| Delete            | Per lock, with an inline confirm step like the restaurant list                        |
| Export / import   | Export version `2` adds `history`; version `1` files still import                     |
| Clear all history | Out of scope; Settings **Delete all data** already removes it                         |

Rejected: storing lock times on each restaurant. Deleting a restaurant would erase its history,
and the restaurant format and its validation would have to change.

## Data

`src/lib/history.ts`

```ts
export type HistoryEntry = {
	id: string; // newId() from #lib/restaurant, unique within history
	restaurantId: string;
	name: string; // the restaurant's name when it was locked
	lockedAt: string; // ISO 8601
};
```

- `HISTORY_KEY = "whattoeat:history"`, `HISTORY_EVENT = "whattoeat:history-changed"`.
- `isHistoryEntry(value): value is HistoryEntry` — `id`, `restaurantId` and `name` are
  non-empty strings, `lockedAt` is a string `Date.parse` accepts.
- `loadHistory(): HistoryEntry[]` — reads the key; text that is not JSON, not an array, or
  entries that fail `isHistoryEntry` are skipped without a warning. Returned newest first by
  `lockedAt`.
- `saveHistory(list): boolean` — same contract as `saveRestaurants`: falls back to an
  in-memory list for the session when storage refuses the write, dispatches
  `HISTORY_EVENT`, returns `false` when only in memory.
- `addLock(restaurant, now = new Date()): HistoryEntry` — prepends an entry and saves.
- `removeLock(id): HistoryEntry[]` — removes one entry and saves.
- `onHistoryChanged(callback)` — like `onRestaurantsChanged`: this tab's event plus `storage`
  events for `HISTORY_KEY` or a `null` key (another tab's `localStorage.clear()`).
- `summarize(history, restaurants): HistoryStat[]` with
  `{ restaurantId, name, count, lastLockedAt, deleted }`. One row per `restaurantId`. `name`
  is the restaurant's current name when it still exists (`deleted: false`), else the name
  from its newest entry (`deleted: true`). Sorted by `count` descending, then `lastLockedAt`
  descending.
- `forgetHistoryMemory()` — drops the in-memory fallback list.

`resetStorage` in `store.ts` calls `forgetHistoryMemory()` before it dispatches its events
(`history.ts` imports only `#lib/restaurant`, so there is no import cycle). Its `null`-key
`storage` event already reaches `onHistoryChanged` listeners.

## Picker (`<random-picker>`)

- New state: `locked: { id: string; at: Date } | undefined`, cleared by every pick.
- Each result card, while `locked` is `undefined`, ends with
  `<button class="primary lock" data-id=…>Eat here</button>`. Pressing it calls
  `addLock(restaurant)` and sets `locked`.
- When `locked` is set, no card has the button. The locked card gets class `locked` (success
  border) and a `<p class="locked-label">✓ Locked at {time}</p>`, time formatted with
  `Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" })`.
- If the locked restaurant leaves the shown pair (deleted, filtered out), `locked` is cleared
  with it; the saved lock stays in history.
- Locking is not remembered across page loads; the shown pair is not either.

## History page

`src/routes/history.html` (same head as the other pages) with `<app-header current="history">`
and a new `<lock-history>` component in `src/components/lock-history.ts`, registered in
`src/types/global.d.ts`. `app-header` gains `"history"` in `Page` and a **History** link
between Restaurants and Settings.

`<lock-history>` renders:

1. `<h1>History</h1>`.
2. **Stats** section: "{count} locks in total" (singular form for 1), then a table with
   columns Restaurant, Times, Last time (date only). A deleted restaurant's name is followed
   by "(deleted)". The table sits in an `overflow-x: auto` wrapper.
3. **Locks** section: a list, newest first. Each row shows the name and the full date and
   time (`Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" })`, in a
   `<time datetime=…>`), and a **Delete** button. Delete swaps to **Delete this lock** and
   **Cancel**; confirm calls `removeLock`. Focus moves to the confirm button and back on
   cancel, like `restaurant-manager`.
4. With no locks: a card "No locks yet." and a link "Pick a restaurant" to `./`; no stats.

The component reloads on `onHistoryChanged` and `onRestaurantsChanged` (names and the
"(deleted)" mark depend on the restaurant list), and re-renders on language change.

## Export and import

`src/lib/transfer.ts`

- `EXPORT_VERSION = 2`; `ExportFile` gains `history: HistoryEntry[]`.
  `exportJson(restaurants, history, now, { pretty })`.
- `parseImport` accepts version `1` (no `history`; result `history: undefined`) and version
  `2` (`history` must be an array of valid entries with unique ids, else
  `import.error.entries`). Other versions stay `import.error.version`.
- `ImportResult` ok case: `{ ok: true; restaurants; history: HistoryEntry[] | undefined }`.
- `mergeHistory(existing, incoming)` — by id, incoming wins, result newest first.

`<data-transfer>`:

- Export and Copy include history.
- **Replace**: restaurants replaced; history replaced when the file has `history`, kept as is
  for a version 1 file.
- **Merge**: restaurants merged as today; history merged with `mergeHistory` when present.
- Reset prompt text mentions history: "Delete all {count} restaurants, your history and
  settings saved in this browser? This cannot be undone." (and Thai).

## Text (English / Thai)

| Key                     | English                               | Thai                              |
| ----------------------- | ------------------------------------- | --------------------------------- |
| `nav.history`           | History                               | ประวัติ                            |
| `picker.lock`           | Eat here                              | กินร้านนี้                          |
| `picker.locked`         | ✓ Locked at {time}                    | ✓ เลือกแล้วเวลา {time}              |
| `history.title`         | History                               | ประวัติ                            |
| `history.statsTitle`    | Stats                                 | สถิติ                              |
| `history.total.one`     | 1 lock in total                       | เลือกไปแล้ว 1 ครั้ง                  |
| `history.total.other`   | {count} locks in total                | เลือกไปแล้ว {count} ครั้ง             |
| `history.colRestaurant` | Restaurant                            | ร้าน                               |
| `history.colTimes`      | Times                                 | จำนวนครั้ง                          |
| `history.colLast`       | Last time                             | ครั้งล่าสุด                          |
| `history.deleted`       | (deleted)                             | (ลบแล้ว)                           |
| `history.listTitle`     | Locks                                 | รายการที่เลือก                      |
| `history.delete`        | Delete                                | ลบ                                 |
| `history.confirmDelete` | Delete this lock                      | ลบรายการนี้                         |
| `history.cancel`        | Cancel                                | ยกเลิก                             |
| `history.empty`         | No locks yet.                         | ยังไม่มีประวัติ                      |
| `history.emptyLink`     | Pick a restaurant                     | สุ่มร้านอาหาร                       |

The page `<title>` is "History · What to Eat", like the other pages.

Thai dates use the `th` locale, so years show in the Buddhist era (2569), which Thai readers
expect.

## Testing (test-first)

- `tests/lib/history.test.ts`: load skips bad data; newest-first order; `addLock` and
  `removeLock` save and notify; memory fallback when storage throws; `summarize` counting,
  current vs. deleted names, sort order; `onHistoryChanged` for this tab, other tabs and
  `null` key.
- `tests/components/random-picker.test.ts`: each card has **Eat here**; pressing saves one
  entry with the right name and time; label shows; buttons gone; **Pick again** brings them
  back; deleted locked restaurant clears the label.
- `tests/components/lock-history.test.ts`: empty state; stats total, table rows and
  "(deleted)"; list order and `<time>`; delete with confirm and cancel; updates on changes
  from elsewhere; Thai text.
- `tests/components/app-header.test.ts`: History link and `aria-current`.
- `tests/lib/transfer.test.ts` and `tests/components/data-transfer.test.ts`: version 2
  round trip, version 1 still imports and leaves history alone on Replace, invalid history
  rejected, merge by id, reset text.
- `tests/routes/pages.test.ts` already checks every page's head, so `history.html` is
  covered by adding it.

Preview checks (not testable in happy-dom): locked card's green border, table layout on a
phone, header row fitting four links.
