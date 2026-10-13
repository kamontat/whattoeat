# Lock and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user lock one of the two picked restaurants with **Eat here**, keep every
lock with its date and time on a new `/history` page with stats, and delete locks there.

**Architecture:** A new `#lib/history` module owns the `whattoeat:history` list, with the same
load/save/memory-fallback/cross-tab contract as `#lib/store`. `<random-picker>` writes locks,
a new `<lock-history>` component on `src/routes/history.html` reads and deletes them, and
`#lib/transfer` / `<data-transfer>` carry history in export version 2.

**Tech Stack:** Bun, TypeScript, Lit 3 (decorators), happy-dom tests with `bun:test`, Biome.

**Spec:** `docs/superpowers/specs/2026-10-13-lock-history-design.md`

## Global Constraints

- Storage key `whattoeat:history`; change event `whattoeat:history-changed`.
- Entry shape `{ id, restaurantId, name, lockedAt }`, `lockedAt` ISO 8601, ids from `newId`.
- History lists are always newest first by `lockedAt`.
- Export `version: 2` adds `history`; `version: 1` files still import; any other version is
  `import.error.version`.
- Every user-visible string goes through `t()` with both `en` and `th` entries in
  `src/lib/i18n.ts` (`th` is typed `Record<MessageKey, string>`, so a missing Thai key fails
  `bun run check`).
- Dates use `Intl.DateTimeFormat(getLang(), …)`: lock label `{ hour: "2-digit", minute: "2-digit" }`,
  list `{ dateStyle: "medium", timeStyle: "short" }`, stats `{ dateStyle: "medium" }`.
- Imports use the `#components/*`, `#lib/*`, `#styles/*` aliases. Tabs for indentation;
  run `bun run format` before committing.
- Every change is test-first: write the test, run it, watch it fail, then code.
- Commits: conventional, lower case, scoped (`feat(lib): …`), ending with
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md` (that happens when landing).

## Review Focus

1. Double-tapping **Eat here** before the re-render must save one lock, not two
   (Task 4, test "a double press saves one lock").
2. Storage blocked or full: locking still works for the session and History still shows it
   (Task 1, test "addLock falls back to memory when localStorage throws").
3. A restaurant renamed after it was locked: stats show the current name, the lock list
   keeps the name it had when locked (Task 1 `summarize` test, Task 5 list test).
4. Stored or imported history out of order still lists newest first
   (Task 1 "loads newest first", Task 2 "imported history is sorted newest first").
5. History page open in one tab while another tab locks or deletes: it updates without a
   reload (Task 5, test "follows changes from another tab").

---

## File map

| File | Change |
| --- | --- |
| `src/lib/history.ts` | **Create.** Entry type, validation, load/save, add/remove, listener, `summarize`, `forgetHistoryMemory` |
| `src/lib/store.ts` | `resetStorage` calls `forgetHistoryMemory()` |
| `src/lib/transfer.ts` | Version 2, `history` in export and import, `mergeHistory` |
| `src/components/data-transfer.ts` | Export/copy/replace/merge carry history |
| `src/components/random-picker.ts` | **Eat here** button, locked state and label |
| `src/components/lock-history.ts` | **Create.** History page component |
| `src/components/app-header.ts` | `history` page and nav link |
| `src/routes/history.html` | **Create.** The `/history` route |
| `src/types/global.d.ts` | Register `lock-history` |
| `src/lib/i18n.ts` | New keys (en + th), new reset prompt text |
| `README.md` | Page table row and intro |
| `tests/lib/history.test.ts` | **Create.** |
| `tests/components/lock-history.test.ts` | **Create.** |
| `tests/lib/transfer.test.ts`, `tests/components/data-transfer.test.ts`, `tests/components/random-picker.test.ts`, `tests/components/app-header.test.ts`, `tests/lib/store.test.ts` | Extend |

---

### Task 1: History store (`#lib/history`)

**Files:**
- Create: `src/lib/history.ts`
- Modify: `src/lib/store.ts` (`resetStorage`)
- Test: `tests/lib/history.test.ts`, `tests/lib/store.test.ts`

**Interfaces:**
- Consumes: `newId(taken: Iterable<string>): string` and `type Restaurant` from `#lib/restaurant`.
- Produces:
  - `HISTORY_KEY: "whattoeat:history"`, `HISTORY_EVENT: "whattoeat:history-changed"`
  - `type HistoryEntry = { id: string; restaurantId: string; name: string; lockedAt: string }`
  - `type HistoryStat = { restaurantId: string; name: string; count: number; lastLockedAt: string; deleted: boolean }`
  - `isHistoryEntry(value: unknown): value is HistoryEntry`
  - `cleanEntry(entry: HistoryEntry): HistoryEntry` (known fields only)
  - `newestFirst(list: readonly HistoryEntry[]): HistoryEntry[]`
  - `loadHistory(): HistoryEntry[]`
  - `saveHistory(list: HistoryEntry[]): boolean`
  - `addLock(restaurant: Pick<Restaurant, "id" | "name">, now?: Date): HistoryEntry`
  - `removeLock(id: string): HistoryEntry[]`
  - `onHistoryChanged(callback: () => void): () => void`
  - `summarize(history: readonly HistoryEntry[], restaurants: readonly Restaurant[]): HistoryStat[]`
  - `forgetHistoryMemory(): void`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/history.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	addLock,
	HISTORY_EVENT,
	HISTORY_KEY,
	type HistoryEntry,
	isHistoryEntry,
	loadHistory,
	onHistoryChanged,
	removeLock,
	saveHistory,
	summarize,
} from "#lib/history";
import type { Restaurant } from "#lib/restaurant";

const entry = (
	id: string,
	restaurantId: string,
	name: string,
	lockedAt: string,
): HistoryEntry => ({ id, restaurantId, name, lockedAt });

const restaurant = (id: string, name: string): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

beforeEach(() => {
	localStorage.clear();
	saveHistory([]);
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
});

test("loads [] when nothing is stored", () => {
	expect(loadHistory()).toEqual([]);
});

test.each([
	["not json", "{oops"],
	["not an array", JSON.stringify({ id: "a" })],
])("loads [] for stored text that is %s", (_label, raw) => {
	localStorage.setItem(HISTORY_KEY, raw);
	expect(loadHistory()).toEqual([]);
});

test("skips entries that are not valid and drops unknown fields", () => {
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([
			{ ...entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"), extra: 1 },
			{ id: "b", restaurantId: "r1", name: " ", lockedAt: "2026-10-13T05:00:00.000Z" },
			{ id: "c", restaurantId: "r1", name: "C", lockedAt: "yesterday" },
			{ id: "", restaurantId: "r1", name: "D", lockedAt: "2026-10-13T05:00:00.000Z" },
			null,
		]),
	);
	expect(loadHistory()).toEqual([entry("a", "r1", "A", "2026-10-13T05:00:00.000Z")]);
});

test("isHistoryEntry needs ids, a name and a readable time", () => {
	expect(isHistoryEntry(entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"))).toBe(true);
	expect(isHistoryEntry({ id: "a", restaurantId: "", name: "A", lockedAt: "2026-10-13T05:00:00.000Z" })).toBe(false);
	expect(isHistoryEntry("a")).toBe(false);
});

test("loads newest first even when stored out of order", () => {
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([
			entry("old", "r1", "A", "2026-10-01T05:00:00.000Z"),
			entry("new", "r2", "B", "2026-10-13T05:00:00.000Z"),
			entry("mid", "r1", "A", "2026-10-07T05:00:00.000Z"),
		]),
	);
	expect(loadHistory().map((item) => item.id)).toEqual(["new", "mid", "old"]);
});

test("addLock saves the restaurant id, its name and the time, newest first", () => {
	addLock(restaurant("r1", "Jay Fai"), new Date("2026-10-12T12:00:00.000Z"));
	const added = addLock(
		restaurant("r2", "Thipsamai"),
		new Date("2026-10-13T12:30:00.000Z"),
	);
	expect(added).toMatchObject({
		restaurantId: "r2",
		name: "Thipsamai",
		lockedAt: "2026-10-13T12:30:00.000Z",
	});
	expect(added.id).toMatch(/^[0-9A-Za-z]{8}$/);
	const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
	expect(stored.map((item: HistoryEntry) => item.name)).toEqual([
		"Thipsamai",
		"Jay Fai",
	]);
	expect(loadHistory()).toEqual(stored);
});

test("addLock gives every entry a different id", () => {
	const ids = new Set(
		Array.from({ length: 20 }, () => addLock(restaurant("r1", "A")).id),
	);
	expect(ids.size).toBe(20);
});

test("removeLock deletes only that entry", () => {
	saveHistory([
		entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"),
		entry("b", "r1", "A", "2026-10-12T05:00:00.000Z"),
	]);
	expect(removeLock("a").map((item) => item.id)).toEqual(["b"]);
	expect(loadHistory().map((item) => item.id)).toEqual(["b"]);
});

test("addLock falls back to memory when localStorage throws", () => {
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		const added = addLock(restaurant("r1", "A"));
		expect(loadHistory()).toEqual([added]);
		expect(saveHistory(loadHistory())).toBe(false);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	// A successful save leaves memory mode again.
	expect(saveHistory([])).toBe(true);
	expect(localStorage.getItem(HISTORY_KEY)).toBe("[]");
});

test("onHistoryChanged fires for saves here, other tabs and a cleared storage", () => {
	let calls = 0;
	const off = onHistoryChanged(() => {
		calls += 1;
	});
	saveHistory([]);
	window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: null }));
	window.dispatchEvent(new StorageEvent("storage", { key: "whattoeat:theme" }));
	expect(calls).toBe(3);
	off();
	window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
	expect(calls).toBe(3);
});

test("summarize counts per restaurant, most first, ties by latest", () => {
	const stats = summarize(
		[
			entry("1", "r1", "A", "2026-10-13T05:00:00.000Z"),
			entry("2", "r2", "B", "2026-10-12T05:00:00.000Z"),
			entry("3", "r1", "A", "2026-10-10T05:00:00.000Z"),
			entry("4", "r3", "C", "2026-10-11T05:00:00.000Z"),
		],
		[restaurant("r1", "A"), restaurant("r2", "B"), restaurant("r3", "C")],
	);
	expect(stats).toEqual([
		{ restaurantId: "r1", name: "A", count: 2, lastLockedAt: "2026-10-13T05:00:00.000Z", deleted: false },
		{ restaurantId: "r2", name: "B", count: 1, lastLockedAt: "2026-10-12T05:00:00.000Z", deleted: false },
		{ restaurantId: "r3", name: "C", count: 1, lastLockedAt: "2026-10-11T05:00:00.000Z", deleted: false },
	]);
});

test("summarize uses the current name, or the newest locked name for a deleted restaurant", () => {
	const stats = summarize(
		[
			entry("1", "r1", "Old name", "2026-10-13T05:00:00.000Z"),
			entry("2", "gone", "Newest", "2026-10-12T05:00:00.000Z"),
			entry("3", "gone", "Older", "2026-10-01T05:00:00.000Z"),
		],
		[restaurant("r1", "New name")],
	);
	expect(stats.map(({ name, deleted }) => ({ name, deleted }))).toEqual([
		{ name: "Newest", deleted: true },
		{ name: "New name", deleted: false },
	]);
});

test("summarize of no history is empty", () => {
	expect(summarize([], [restaurant("r1", "A")])).toEqual([]);
});
```

Add to `tests/lib/store.test.ts` (extend the `#lib/store` import with nothing new; add the
history import at the top):

```ts
import { addLock, HISTORY_KEY, loadHistory } from "#lib/history";
```

```ts
test("resetStorage also forgets history kept in memory", () => {
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
			clear: () => {},
		},
		configurable: true,
	});
	try {
		addLock({ id: "r1", name: "A" });
		expect(loadHistory()).toHaveLength(1);
		resetStorage();
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	expect(loadHistory()).toEqual([]);
	expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/history.test.ts tests/lib/store.test.ts`
Expected: FAIL — `Cannot find module '#lib/history'`.

- [ ] **Step 3: Write `src/lib/history.ts`**

```ts
import { newId, type Restaurant } from "#lib/restaurant";

export const HISTORY_KEY = "whattoeat:history";
export const HISTORY_EVENT = "whattoeat:history-changed";

/** One "Eat here" press: which restaurant, its name at that moment, and when. */
export type HistoryEntry = {
	id: string;
	restaurantId: string;
	name: string;
	lockedAt: string;
};

/** One row of the History page's stats table. */
export type HistoryStat = {
	restaurantId: string;
	name: string;
	count: number;
	lastLockedAt: string;
	deleted: boolean;
};

/** Set when localStorage refused a write; history then lives in memory for this session. */
let memory: HistoryEntry[] | undefined;

const isFilled = (value: unknown): value is string =>
	typeof value === "string" && value.trim() !== "";

export const isHistoryEntry = (value: unknown): value is HistoryEntry => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof HistoryEntry, unknown>>;
	return (
		isFilled(item.id) &&
		isFilled(item.restaurantId) &&
		isFilled(item.name) &&
		typeof item.lockedAt === "string" &&
		!Number.isNaN(Date.parse(item.lockedAt))
	);
};

/** Keep only the known fields, so stored and imported data stays small and predictable. */
export const cleanEntry = (entry: HistoryEntry): HistoryEntry => ({
	id: entry.id,
	restaurantId: entry.restaurantId,
	name: entry.name,
	lockedAt: entry.lockedAt,
});

export const newestFirst = (list: readonly HistoryEntry[]): HistoryEntry[] =>
	[...list].sort((a, b) => Date.parse(b.lockedAt) - Date.parse(a.lockedAt));

/** Unreadable stored history is skipped without a warning; the next save drops it. */
export const loadHistory = (): HistoryEntry[] => {
	if (memory !== undefined) return memory;
	let data: unknown;
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		if (raw === null) return [];
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	return newestFirst(data.filter(isHistoryEntry).map(cleanEntry));
};

/** Returns `false` when localStorage refused the write and history is only kept in memory. */
export const saveHistory = (list: HistoryEntry[]): boolean => {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
	return memory === undefined;
};

/** Drop the in-memory fallback; `resetStorage` calls this when it wipes everything. */
export const forgetHistoryMemory = (): void => {
	memory = undefined;
};

export const addLock = (
	restaurant: Pick<Restaurant, "id" | "name">,
	now: Date = new Date(),
): HistoryEntry => {
	const existing = loadHistory();
	const entry: HistoryEntry = {
		id: newId(existing.map((item) => item.id)),
		restaurantId: restaurant.id,
		name: restaurant.name,
		lockedAt: now.toISOString(),
	};
	saveHistory(newestFirst([entry, ...existing]));
	return entry;
};

export const removeLock = (id: string): HistoryEntry[] => {
	const list = loadHistory().filter((item) => item.id !== id);
	saveHistory(list);
	return list;
};

/**
 * Call `callback` after every save in this tab and every change from another tab (a `null` key is
 * what `localStorage.clear()` sends). Returns an unsubscribe function.
 */
export const onHistoryChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === HISTORY_KEY || event.key === null) callback();
	};
	window.addEventListener(HISTORY_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(HISTORY_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};

/**
 * One row per restaurant: most locked first, ties by the latest lock. A restaurant that still
 * exists shows its current name; a deleted one shows the name from its newest lock.
 */
export const summarize = (
	history: readonly HistoryEntry[],
	restaurants: readonly Restaurant[],
): HistoryStat[] => {
	const rows = new Map<string, HistoryStat>();
	for (const entry of newestFirst(history)) {
		const row = rows.get(entry.restaurantId);
		if (row) {
			row.count += 1;
			continue;
		}
		const current = restaurants.find((item) => item.id === entry.restaurantId);
		rows.set(entry.restaurantId, {
			restaurantId: entry.restaurantId,
			name: current?.name ?? entry.name,
			count: 1,
			lastLockedAt: entry.lockedAt,
			deleted: current === undefined,
		});
	}
	return [...rows.values()].sort(
		(a, b) =>
			b.count - a.count ||
			Date.parse(b.lastLockedAt) - Date.parse(a.lastLockedAt),
	);
};
```

In `src/lib/store.ts`, add the import and the call (first line inside `resetStorage`'s body,
before `try`):

```ts
import { forgetHistoryMemory } from "#lib/history";
```

```ts
export const resetStorage = (): void => {
	forgetHistoryMemory();
	try {
```

and extend its doc comment: "…so restaurants, history, theme and language listeners reset in
this tab too."

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/history.test.ts tests/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Format, check, commit**

```bash
bun run format && bun run check
git add src/lib/history.ts src/lib/store.ts tests/lib/history.test.ts tests/lib/store.test.ts
git commit -m "feat(lib): add lock history store" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Export version 2 with history (`#lib/transfer`)

**Files:**
- Modify: `src/lib/transfer.ts`
- Test: `tests/lib/transfer.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry`, `isHistoryEntry`, `cleanEntry`, `newestFirst` from `#lib/history` (Task 1).
- Produces:
  - `EXPORT_VERSION = 2`
  - `ExportFile` gains `history: HistoryEntry[]`
  - `toExportFile(restaurants: Restaurant[], history?: HistoryEntry[] /* default [] */, now?: Date): ExportFile`
  - `exportJson(restaurants: Restaurant[], history: HistoryEntry[], now: Date, { pretty }: { pretty: boolean }): string`
  - `ImportResult` ok case: `{ ok: true; restaurants: Restaurant[]; history: HistoryEntry[] | undefined }` (`undefined` for a version 1 file)
  - `mergeHistory(existing: HistoryEntry[], incoming: HistoryEntry[]): HistoryEntry[]`

- [ ] **Step 1: Update and add tests**

In `tests/lib/transfer.test.ts`:

1. Add imports: `import type { HistoryEntry } from "#lib/history";` and `mergeHistory` to the
   `#lib/transfer` import list. Add a helper below `make`:

```ts
const lock = (id: string, lockedAt: string, restaurantId = "a"): HistoryEntry => ({
	id,
	restaurantId,
	name: restaurantId,
	lockedAt,
});
```

2. Replace the first two tests with:

```ts
test("exportJson gives indented or one-line json that imports back", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	const history = [lock("h1", "2026-10-12T09:00:00.000Z")];
	const pretty = exportJson([make("a"), make("b")], history, now, { pretty: true });
	const compact = exportJson([make("a"), make("b")], history, now, { pretty: false });
	expect(pretty).toContain("\n  ");
	expect(compact).not.toContain("\n");
	expect(JSON.parse(pretty)).toEqual(
		toExportFile([make("a"), make("b")], history, now),
	);
	for (const text of [pretty, compact])
		expect(parseImport(text)).toEqual({
			ok: true,
			restaurants: [make("a"), make("b")],
			history,
		});
});

test("toExportFile wraps restaurants and history in the versioned envelope", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	expect(
		toExportFile([make("a")], [lock("h1", "2026-10-12T09:00:00.000Z")], now),
	).toEqual({
		app: "whattoeat",
		version: 2,
		exportedAt: "2026-10-12T10:00:00.000Z",
		restaurants: [make("a")],
		history: [lock("h1", "2026-10-12T09:00:00.000Z")],
	});
	expect(toExportFile([], undefined, now).history).toEqual([]);
});
```

3. In the `test.each` of rejected files, change the "future version" case's JSON to
   `version: 3`. Leave the other cases at `version: 1` (still a readable version).

4. Add:

```ts
test("a version 1 file imports with no history", () => {
	expect(
		parseImport(
			JSON.stringify({ app: "whattoeat", version: 1, restaurants: [make("a")] }),
		),
	).toEqual({ ok: true, restaurants: [make("a")], history: undefined });
});

test.each([
	["missing", undefined, "import.error.format"],
	["not an array", { id: "h1" }, "import.error.format"],
	["with a bad entry", [{ id: "h1", restaurantId: "a", name: "A", lockedAt: "never" }], "import.error.entries"],
	[
		"with duplicate ids",
		[lock("h1", "2026-10-12T09:00:00.000Z"), lock("h1", "2026-10-11T09:00:00.000Z")],
		"import.error.entries",
	],
])("a version 2 file with history %s is rejected", (_label, history, error) => {
	expect(
		parseImport(
			JSON.stringify({ app: "whattoeat", version: 2, restaurants: [], history }),
		),
	).toEqual({ ok: false, error: error as ImportError });
});

test("imported history is sorted newest first and loses unknown fields", () => {
	const result = parseImport(
		JSON.stringify({
			app: "whattoeat",
			version: 2,
			restaurants: [],
			history: [
				{ ...lock("old", "2026-10-01T09:00:00.000Z"), extra: true },
				lock("new", "2026-10-12T09:00:00.000Z", "deleted-restaurant"),
			],
		}),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [],
		history: [
			lock("new", "2026-10-12T09:00:00.000Z", "deleted-restaurant"),
			lock("old", "2026-10-01T09:00:00.000Z"),
		],
	});
});

test("mergeHistory keeps both sides, incoming wins on the same id, newest first", () => {
	const existing = [
		lock("a", "2026-10-10T09:00:00.000Z"),
		{ ...lock("b", "2026-10-05T09:00:00.000Z"), name: "old" },
	];
	const incoming = [
		{ ...lock("b", "2026-10-05T09:00:00.000Z"), name: "new" },
		lock("c", "2026-10-12T09:00:00.000Z"),
	];
	expect(mergeHistory(existing, incoming)).toEqual([
		lock("c", "2026-10-12T09:00:00.000Z"),
		lock("a", "2026-10-10T09:00:00.000Z"),
		{ ...lock("b", "2026-10-05T09:00:00.000Z"), name: "new" },
	]);
	expect(existing).toHaveLength(2);
});
```

5. Any other existing test that calls `exportJson(list, now, opts)` or
   `toExportFile(list, now)` gets the history argument: `exportJson(list, [], now, opts)`,
   `toExportFile(list, [], now)`. (Find them with `grep -n "exportJson(\|toExportFile(" tests/lib/transfer.test.ts`.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/transfer.test.ts`
Expected: FAIL — `mergeHistory` is not exported, version is `1`, `history` missing.

- [ ] **Step 3: Update `src/lib/transfer.ts`**

```ts
import {
	cleanEntry,
	type HistoryEntry,
	isHistoryEntry,
	newestFirst,
} from "#lib/history";
import { isRestaurant, normalizeInput, type Restaurant } from "#lib/restaurant";

export const EXPORT_VERSION = 2;

/** Version 1 files predate history; they still import, with no history. */
const READABLE_VERSIONS: readonly unknown[] = [1, EXPORT_VERSION];

export type ExportFile = {
	app: "whattoeat";
	version: number;
	exportedAt: string;
	restaurants: Restaurant[];
	history: HistoryEntry[];
};
```

`ImportResult`:

```ts
export type ImportResult =
	| {
			ok: true;
			restaurants: Restaurant[];
			/** `undefined` for a version 1 file, which has no history. */
			history: HistoryEntry[] | undefined;
	  }
	| { ok: false; error: ImportError };
```

`toExportFile` and `exportJson`:

```ts
export const toExportFile = (
	restaurants: Restaurant[],
	history: HistoryEntry[] = [],
	now: Date = new Date(),
): ExportFile => ({
	app: "whattoeat",
	version: EXPORT_VERSION,
	exportedAt: now.toISOString(),
	restaurants,
	history,
});

/** Export as JSON text: indented for a downloaded file, one line for the clipboard. */
export const exportJson = (
	restaurants: Restaurant[],
	history: HistoryEntry[],
	now: Date,
	{ pretty }: { pretty: boolean },
): string =>
	JSON.stringify(
		toExportFile(restaurants, history, now),
		null,
		pretty ? 2 : undefined,
	);
```

In `parseImport`, replace the version check and the final `return`:

```ts
	if (!READABLE_VERSIONS.includes(file.version))
		return { ok: false, error: "import.error.version" };
	if (
		!restaurants.every(isRestaurant) ||
		new Set(restaurants.map((item) => item.id)).size !== restaurants.length
	)
		return { ok: false, error: "import.error.entries" };
	let history: HistoryEntry[] | undefined;
	if (file.version !== 1) {
		const entries = file.history;
		if (!Array.isArray(entries))
			return { ok: false, error: "import.error.format" };
		if (
			!entries.every(isHistoryEntry) ||
			new Set(entries.map((item) => item.id)).size !== entries.length
		)
			return { ok: false, error: "import.error.entries" };
		history = newestFirst(entries.map(cleanEntry));
	}
	// Clean imported text the same way as typed input, and keep only known fields.
	return {
		ok: true,
		restaurants: restaurants.map((item) => ({
			id: item.id,
			...normalizeInput(item),
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
		})),
		history,
	};
```

Add below `mergeRestaurants`:

```ts
/** Incoming locks replace existing ones with the same id; the result is newest first. */
export const mergeHistory = (
	existing: HistoryEntry[],
	incoming: HistoryEntry[],
): HistoryEntry[] => {
	const byId = new Map(existing.map((item) => [item.id, item]));
	for (const item of incoming) byId.set(item.id, item);
	return newestFirst([...byId.values()]);
};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/transfer.test.ts`
Expected: PASS. (`bun run check` will still fail in `data-transfer.ts` until Task 3; that
is expected — Task 3 is committed right after.)

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/lib/transfer.ts tests/lib/transfer.test.ts
git commit -m "feat(lib): export and import lock history as version 2" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Settings carries history (`<data-transfer>`)

**Files:**
- Modify: `src/components/data-transfer.ts`, `src/lib/i18n.ts` (`settings.resetPrompt` en + th)
- Test: `tests/components/data-transfer.test.ts`

**Interfaces:**
- Consumes: `loadHistory`, `saveHistory`, `HistoryEntry` (Task 1); `exportJson(restaurants, history, now, opts)`, `mergeHistory`, `ImportResult` (Task 2).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Update and add tests**

In `tests/components/data-transfer.test.ts` add the import
`import { HISTORY_KEY, type HistoryEntry, loadHistory, saveHistory } from "#lib/history";`
and a helper:

```ts
const lock = (id: string, lockedAt: string): HistoryEntry => ({
	id,
	restaurantId: "x",
	name: "X",
	lockedAt,
});
```

In "export downloads a json file of the stored list", add
`saveHistory([lock("h1", "2026-10-12T09:00:00.000Z")]);` as its second line and change the
`toMatchObject` expectation to:

```ts
		expect(file).toMatchObject({
			app: "whattoeat",
			version: 2,
			restaurants: loadRestaurants(),
			history: [lock("h1", "2026-10-12T09:00:00.000Z")],
		});
```

Change the reset prompt expectation in "reset asks for confirmation and can be cancelled" to:

```ts
		"Delete all 1 restaurants, your history and settings saved in this browser? This cannot be undone.",
```

Add:

```ts
test("replace with a version 2 file replaces history too", async () => {
	saveHistory([lock("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile([make("x", "X")], [lock("theirs", "2026-10-12T09:00:00.000Z")]),
		),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadHistory().map((item) => item.id)).toEqual(["theirs"]);
});

test("replace with a version 1 file keeps the current history", async () => {
	saveHistory([lock("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(
		JSON.stringify({ app: "whattoeat", version: 1, restaurants: [make("x", "X")] }),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadRestaurants()).toEqual([make("x", "X")]);
	expect(loadHistory().map((item) => item.id)).toEqual(["mine"]);
});

test("merge combines history newest first", async () => {
	saveHistory([lock("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile([make("x", "X")], [lock("theirs", "2026-10-12T09:00:00.000Z")]),
		),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadHistory().map((item) => item.id)).toEqual(["theirs", "mine"]);
});

test("confirming reset deletes the history too", async () => {
	saveHistory([lock("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	await click(el, 'button[data-action="reset-confirm"]');
	expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
	expect(loadHistory()).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/components/data-transfer.test.ts`
Expected: FAIL — reset text differs, history not exported or imported. (`tsc` also reports
the old `exportJson` call shape.)

- [ ] **Step 3: Update `src/components/data-transfer.ts` and the reset text**

Imports: add

```ts
import {
	type HistoryEntry,
	loadHistory,
	saveHistory,
} from "#lib/history";
```

and `mergeHistory` to the `#lib/transfer` import.

Pending state:

```ts
	/** A checked import waiting for Replace or Merge; `history` is `undefined` for a version 1 file. */
	@state()
	private pending:
		| { restaurants: Restaurant[]; history: HistoryEntry[] | undefined }
		| undefined;
```

In `readImport`, the ok branch:

```ts
			this.pending = { restaurants: result.restaurants, history: result.history };
```

`exportData` and `copyData` pass history:

```ts
		const json = exportJson(loadRestaurants(), loadHistory(), now, { pretty: true });
```

```ts
		const json = exportJson(restaurants, loadHistory(), new Date(), {
			pretty: false,
		});
```

`apply`:

```ts
	private apply(mode: "replace" | "merge"): void {
		if (this.pending === undefined) return;
		const { restaurants, history } = this.pending;
		const list =
			mode === "replace"
				? restaurants
				: mergeRestaurants(loadRestaurants(), restaurants);
		let persisted = saveRestaurants(list);
		// A version 1 file has no history, so the saved history stays as it is.
		if (history !== undefined) {
			const locks =
				mode === "replace" ? history : mergeHistory(loadHistory(), history);
			persisted = saveHistory(locks) && persisted;
		}
		this.pending = undefined;
		this.pasteText = "";
		this.imported = persisted ? list.length : undefined;
	}
```

In `render`, the "found" line uses `this.pending.restaurants.length` instead of
`this.pending.length`.

In `src/lib/i18n.ts`:

```ts
	"settings.resetPrompt":
		"Delete all {count} restaurants, your history and settings saved in this browser? This cannot be undone.",
```

```ts
	"settings.resetPrompt":
		"ลบร้านอาหาร {count} ร้าน ประวัติ และการตั้งค่าทั้งหมดที่บันทึกไว้ในเบราว์เซอร์นี้หรือไม่ การลบนี้ย้อนกลับไม่ได้",
```

- [ ] **Step 4: Run tests and checks**

Run: `bun test tests/components/data-transfer.test.ts tests/lib && bun run check`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/components/data-transfer.ts src/lib/i18n.ts tests/components/data-transfer.test.ts
git commit -m "feat(components): carry lock history through settings export and import" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: **Eat here** in the picker (`<random-picker>`)

**Files:**
- Modify: `src/components/random-picker.ts`, `src/lib/i18n.ts` (`picker.lock`, `picker.locked`)
- Test: `tests/components/random-picker.test.ts`

**Interfaces:**
- Consumes: `addLock(restaurant, now?) => HistoryEntry`, `loadHistory()` (Task 1).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/random-picker.test.ts` (import
`import { loadHistory } from "#lib/history";` and `getLang` from `#lib/i18n`):

```ts
const lockButtons = (el: HTMLElement) => [
	...root(el).querySelectorAll<HTMLButtonElement>("button.lock"),
];
const pickOnce = async (el: HTMLElement & { updateComplete: Promise<boolean> }) => {
	pickButton(el)!.click();
	await el.updateComplete;
};

test("each picked card has an Eat here button", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	expect(lockButtons(el)).toHaveLength(0);
	await pickOnce(el);
	expect(lockButtons(el).map((b) => b.textContent?.trim())).toEqual([
		"Eat here",
		"Eat here",
	]);
});

test("Eat here saves a lock and marks only that card", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	await pickOnce(el);
	const chosen = pickedNames(el)[1];
	lockButtons(el)[1]!.click();
	await el.updateComplete;
	const history = loadHistory();
	expect(history).toHaveLength(1);
	expect(history[0]!.name).toBe(chosen);
	const time = new Intl.DateTimeFormat(getLang(), {
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(history[0]!.lockedAt));
	const locked = root(el).querySelectorAll(".result.locked");
	expect(locked).toHaveLength(1);
	expect(locked[0]!.querySelector("h2")?.textContent).toBe(chosen);
	expect(locked[0]!.querySelector(".locked-label")?.textContent?.trim()).toBe(
		`✓ Locked at ${time}`,
	);
	expect(lockButtons(el)).toHaveLength(0);
	expect(pickedNames(el)).toHaveLength(2);
});

test("a double press saves one lock", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	await pickOnce(el);
	const [first, second] = lockButtons(el);
	first!.click();
	second!.click();
	await el.updateComplete;
	expect(loadHistory()).toHaveLength(1);
});

test("focus moves to the locked label", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	await pickOnce(el);
	lockButtons(el)[0]!.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement?.classList.contains("locked-label")).toBe(true);
});

test("Pick again brings the Eat here buttons back", async () => {
	for (const name of ["A", "B", "C", "D"]) addRestaurant({ ...base, name });
	const el = await mount();
	await pickOnce(el);
	lockButtons(el)[0]!.click();
	await el.updateComplete;
	await pickOnce(el);
	expect(lockButtons(el)).toHaveLength(2);
	expect(root(el).querySelector(".locked-label")).toBeNull();
	expect(loadHistory()).toHaveLength(1);
});

test("deleting the locked restaurant clears the label but keeps the lock", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const list = addRestaurant({ ...base, name: "C" });
	const el = await mount();
	await pickOnce(el);
	const [first = ""] = pickedNames(el);
	lockButtons(el)[0]!.click();
	await el.updateComplete;
	removeRestaurant(list.find((r) => r.name === first)!.id);
	await el.updateComplete;
	expect(root(el).querySelector(".locked-label")).toBeNull();
	expect(lockButtons(el)).toHaveLength(1);
	expect(loadHistory()[0]!.name).toBe(first);
});

test("Eat here renders in Thai", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	setLang("th");
	await pickOnce(el);
	expect(lockButtons(el)[0]?.textContent?.trim()).toBe("กินร้านนี้");
});
```

The existing `beforeEach` already clears `localStorage`, which empties history too. In
"deleting the locked restaurant…", the one remaining **Eat here** button is expected: the
spec clears `locked` together with the card, so the other card can be locked.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/components/random-picker.test.ts`
Expected: FAIL — no `button.lock`.

- [ ] **Step 3: Implement**

`src/lib/i18n.ts`, after `"picker.countFiltered"` in `en`:

```ts
	"picker.lock": "Eat here",
	"picker.locked": "✓ Locked at {time}",
```

and in `th`:

```ts
	"picker.lock": "กินร้านนี้",
	"picker.locked": "✓ เลือกแล้วเวลา {time}",
```

`src/components/random-picker.ts`:

Imports: `import { addLock } from "#lib/history";` and add `getLang` to the `#lib/i18n` import.

CSS (append inside the component's `css`):

```css
			.result.locked {
				border-color: var(--color-success);
				box-shadow: 0 0 0 1px var(--color-success);
			}

			.locked-label {
				color: var(--color-success);
				font-weight: 700;
			}

			.locked-label:focus {
				outline: none;
			}
```

State, below `picked`:

```ts
	/** The card the user chose with "Eat here" for this pick, and when. */
	@state()
	private locked: { id: string; at: Date } | undefined;
```

`keepPickInPool` — add as its last line:

```ts
		if (!this.picked.some((item) => item.id === this.locked?.id))
			this.locked = undefined;
```

`pick` — first line of the arrow body:

```ts
		this.locked = undefined;
```

New method:

```ts
	private lock(item: Restaurant): void {
		// A second press before the re-render must not save a second lock.
		if (this.locked !== undefined) return;
		const entry = addLock(item);
		this.locked = { id: item.id, at: new Date(entry.lockedAt) };
		// The pressed button is gone after the render, so move focus to the label that replaced it.
		void this.updateComplete.then(() => {
			this.renderRoot.querySelector<HTMLElement>(".locked-label")?.focus();
		});
	}

	private renderLock(item: Restaurant) {
		if (this.locked === undefined)
			return html`<button type="button" class="primary lock" data-id=${item.id} @click=${() => this.lock(item)}>
				${t("picker.lock")}
			</button>`;
		if (this.locked.id !== item.id) return nothing;
		const time = new Intl.DateTimeFormat(getLang(), {
			hour: "2-digit",
			minute: "2-digit",
		}).format(this.locked.at);
		return html`<p class="locked-label" tabindex="-1">${t("picker.locked", { time })}</p>`;
	}
```

`renderResult`: the opening tag becomes

```ts
			<article class="card result ${this.locked?.id === item.id ? "locked" : ""}">
```

and add `${this.renderLock(item)}` as the last child, after the notes line.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/components/random-picker.test.ts && bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/components/random-picker.ts src/lib/i18n.ts tests/components/random-picker.test.ts
git commit -m "feat(components): lock a picked restaurant with eat here" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: History page (`<lock-history>`, `/history`, header link)

**Files:**
- Create: `src/components/lock-history.ts`, `src/routes/history.html`, `tests/components/lock-history.test.ts`
- Modify: `src/components/app-header.ts`, `src/types/global.d.ts`, `src/lib/i18n.ts`, `tests/components/app-header.test.ts`

**Interfaces:**
- Consumes: `loadHistory`, `saveHistory`, `removeLock`, `onHistoryChanged`, `summarize`, `HistoryEntry`, `HistoryStat`, `HISTORY_KEY` (Task 1); `loadRestaurants`, `onRestaurantsChanged`, `saveRestaurants` from `#lib/store`.
- Produces: custom element `lock-history` (class `LockHistory`), page `"history"` in `app-header`'s `Page`.

Read `.claude/skills/adding-a-page/SKILL.md` before creating the route.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/lock-history.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/lock-history";
import type { LockHistory } from "#components/lock-history";
import {
	HISTORY_KEY,
	type HistoryEntry,
	loadHistory,
	saveHistory,
} from "#lib/history";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { saveRestaurants } from "#lib/store";

const restaurant = (id: string, name: string): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
});

const lock = (
	id: string,
	restaurantId: string,
	name: string,
	lockedAt: string,
): HistoryEntry => ({ id, restaurantId, name, lockedAt });

const sample = (): HistoryEntry[] => [
	lock("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z"),
	lock("h2", "r4", "Ramen Champion", "2026-10-11T12:42:00.000Z"),
	lock("h3", "r2", "Som Tam Nua", "2026-10-09T05:05:00.000Z"),
	lock("h4", "gone", "Pad Thai Fai Ta Lu", "2026-10-06T11:30:00.000Z"),
];

beforeEach(() => {
	localStorage.clear();
	setLang("en");
	saveRestaurants([restaurant("r2", "Som Tam Nua"), restaurant("r4", "Ramen Champion")]);
	saveHistory(sample());
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("lock-history");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const root = (el: LockHistory) => el.shadowRoot!;
const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();
const rows = (el: LockHistory) =>
	[...root(el).querySelectorAll("tbody tr")].map((tr) =>
		[...tr.querySelectorAll("td")].map((td) => text(td)),
	);
const lockRow = (el: LockHistory, id: string) =>
	root(el).querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
const action = (el: LockHistory, id: string, name: string) =>
	lockRow(el, id)?.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

const day = (iso: string) =>
	new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));
const dayTime = (iso: string) =>
	new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(iso),
	);

test("shows the page heading, the total and one stats row per restaurant", async () => {
	const el = await mount();
	expect(text(root(el).querySelector("h1"))).toBe("History");
	expect(text(root(el).querySelector(".total"))).toBe("4 locks in total");
	expect(
		[...root(el).querySelectorAll("thead th")].map((th) => text(th)),
	).toEqual(["Restaurant", "Times", "Last time"]);
	expect(rows(el)).toEqual([
		["Som Tam Nua", "2", day("2026-10-12T05:18:00.000Z")],
		["Ramen Champion", "1", day("2026-10-11T12:42:00.000Z")],
		["Pad Thai Fai Ta Lu (deleted)", "1", day("2026-10-06T11:30:00.000Z")],
	]);
});

test("uses the singular for one lock", async () => {
	saveHistory([lock("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z")]);
	const el = await mount();
	expect(text(root(el).querySelector(".total"))).toBe("1 lock in total");
});

test("lists every lock newest first with its date and time", async () => {
	const el = await mount();
	const items = [...root(el).querySelectorAll("li[data-id]")];
	expect(items.map((li) => li.getAttribute("data-id"))).toEqual(["h1", "h2", "h3", "h4"]);
	const first = items[0]!;
	expect(text(first.querySelector(".name"))).toBe("Som Tam Nua");
	const time = first.querySelector("time");
	expect(time?.getAttribute("datetime")).toBe("2026-10-12T05:18:00.000Z");
	expect(text(time)).toBe(dayTime("2026-10-12T05:18:00.000Z"));
});

test("the lock list keeps the name a restaurant had when it was locked", async () => {
	saveRestaurants([restaurant("r2", "Som Tam Nua Siam"), restaurant("r4", "Ramen Champion")]);
	const el = await mount();
	expect(text(lockRow(el, "h1")?.querySelector(".name"))).toBe("Som Tam Nua");
	expect(rows(el)[0]![0]).toBe("Som Tam Nua Siam");
});

test("delete asks first and can be cancelled", async () => {
	const el = await mount();
	action(el, "h2", "delete")!.click();
	await el.updateComplete;
	expect(action(el, "h2", "delete")).toBeNull();
	expect(text(action(el, "h2", "confirm-delete"))).toBe("Delete this lock");
	await el.updateComplete;
	expect(root(el).activeElement).toBe(action(el, "h2", "confirm-delete")!);
	action(el, "h2", "cancel-delete")!.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement).toBe(action(el, "h2", "delete")!);
	expect(loadHistory()).toHaveLength(4);
});

test("confirming delete removes the lock and updates the stats", async () => {
	const el = await mount();
	action(el, "h2", "delete")!.click();
	await el.updateComplete;
	action(el, "h2", "confirm-delete")!.click();
	await el.updateComplete;
	expect(lockRow(el, "h2")).toBeNull();
	expect(loadHistory().map((item) => item.id)).toEqual(["h1", "h3", "h4"]);
	expect(text(root(el).querySelector(".total"))).toBe("3 locks in total");
	expect(rows(el).map((row) => row[0])).toEqual([
		"Som Tam Nua",
		"Pad Thai Fai Ta Lu (deleted)",
	]);
});

test("with no locks shows a link to pick and no stats", async () => {
	saveHistory([]);
	const el = await mount();
	expect(text(root(el).querySelector(".empty p"))).toBe("No locks yet.");
	const link = root(el).querySelector(".empty a");
	expect(link?.getAttribute("href")).toBe("./");
	expect(text(link)).toBe("Pick a restaurant");
	expect(root(el).querySelector("table")).toBeNull();
});

test("follows changes from another tab", async () => {
	const el = await mount();
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([lock("x", "r4", "Ramen Champion", "2026-10-13T05:00:00.000Z")]),
	);
	window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_KEY }));
	await el.updateComplete;
	expect([...root(el).querySelectorAll("li[data-id]")].map((li) => li.getAttribute("data-id"))).toEqual(["x"]);
});

test("follows restaurant renames and deletes", async () => {
	const el = await mount();
	saveRestaurants([restaurant("r2", "Som Tam Nua")]);
	await el.updateComplete;
	expect(rows(el)[1]![0]).toBe("Ramen Champion (deleted)");
});

test("renders in Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(text(root(el).querySelector("h1"))).toBe("ประวัติ");
	expect(text(root(el).querySelector(".total"))).toBe("เลือกไปแล้ว 4 ครั้ง");
	expect(text(action(el, "h1", "delete"))).toBe("ลบ");
});
```

In `tests/components/app-header.test.ts`, change "renders nav links to the three pages" to
four pages:

```ts
test("renders nav links to the four pages", async () => {
	const el = await mount();
	const links = [...el.shadowRoot!.querySelectorAll("nav a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"./",
		"./restaurants",
		"./history",
		"./settings",
	]);
	expect(links.map((a) => a.textContent?.trim())).toEqual([
		"Home",
		"Restaurants",
		"History",
		"Settings",
	]);
});

test("titles the history page", async () => {
	await mount("history");
	expect(document.title).toBe("History · What to Eat");
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/components/lock-history.test.ts tests/components/app-header.test.ts`
Expected: FAIL — `Cannot find module '#components/lock-history'`; header has three links.

- [ ] **Step 3: Implement**

`src/lib/i18n.ts` — in `en` after `"nav.restaurants"`:

```ts
	"nav.history": "History",
```

and, after the `picker.*` keys:

```ts
	"history.title": "History",
	"history.statsTitle": "Stats",
	"history.total.one": "1 lock in total",
	"history.total.other": "{count} locks in total",
	"history.colRestaurant": "Restaurant",
	"history.colTimes": "Times",
	"history.colLast": "Last time",
	"history.deleted": "(deleted)",
	"history.listTitle": "Locks",
	"history.delete": "Delete",
	"history.confirmDelete": "Delete this lock",
	"history.cancel": "Cancel",
	"history.empty": "No locks yet.",
	"history.emptyLink": "Pick a restaurant",
```

`th`, same positions:

```ts
	"nav.history": "ประวัติ",
```

```ts
	"history.title": "ประวัติ",
	"history.statsTitle": "สถิติ",
	"history.total.one": "เลือกไปแล้ว 1 ครั้ง",
	"history.total.other": "เลือกไปแล้ว {count} ครั้ง",
	"history.colRestaurant": "ร้าน",
	"history.colTimes": "จำนวนครั้ง",
	"history.colLast": "ครั้งล่าสุด",
	"history.deleted": "(ลบแล้ว)",
	"history.listTitle": "รายการที่เลือก",
	"history.delete": "ลบ",
	"history.confirmDelete": "ลบรายการนี้",
	"history.cancel": "ยกเลิก",
	"history.empty": "ยังไม่มีประวัติ",
	"history.emptyLink": "สุ่มร้านอาหาร",
```

`src/components/app-header.ts`:

```ts
export type Page = "home" | "restaurants" | "history" | "settings";
```

```ts
const LINKS: readonly { page: Page; href: string; label: MessageKey }[] = [
	{ page: "home", href: "./", label: "nav.home" },
	{ page: "restaurants", href: "./restaurants", label: "nav.restaurants" },
	{ page: "history", href: "./history", label: "nav.history" },
	{ page: "settings", href: "./settings", label: "nav.settings" },
];
```

Create `src/components/lock-history.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
	type HistoryEntry,
	loadHistory,
	onHistoryChanged,
	removeLock,
	summarize,
} from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged } from "#lib/store";
import { uiStyles } from "#styles/ui";

@customElement("lock-history")
export class LockHistory extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 2rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			section {
				display: grid;
				gap: 0.75rem;
			}

			section > h2 {
				font-size: 1.125rem;
			}

			.table-wrap {
				overflow-x: auto;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
			}

			table {
				width: 100%;
				border-collapse: collapse;
				font-variant-numeric: tabular-nums;
			}

			th,
			td {
				padding: 0.625rem 0.875rem;
				text-align: left;
				border-bottom: 1px solid var(--color-border);
			}

			tbody tr:last-child td {
				border-bottom: 0;
			}

			th {
				font-size: 0.75rem;
				letter-spacing: 0.05em;
				text-transform: uppercase;
				color: var(--color-muted);
				font-weight: 600;
			}

			.num {
				text-align: right;
			}

			.locks {
				display: grid;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.lock {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 1rem;
			}

			.lock .what {
				flex: 1 1 12rem;
				display: grid;
				gap: 0.125rem;
			}

			.lock .name {
				font-weight: 600;
			}

			time {
				font-variant-numeric: tabular-nums;
			}

			.empty {
				justify-items: center;
				text-align: center;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private history: HistoryEntry[] = [];

	@state()
	private restaurants: Restaurant[] = [];

	/** The lock whose Delete was pressed and now waits for confirmation. */
	@state()
	private confirmingId: string | undefined;

	private unsubscribe: (() => void)[] = [];

	override connectedCallback(): void {
		super.connectedCallback();
		this.history = loadHistory();
		this.restaurants = loadRestaurants();
		this.unsubscribe = [
			onHistoryChanged(() => {
				this.history = loadHistory();
			}),
			onRestaurantsChanged(() => {
				this.restaurants = loadRestaurants();
			}),
		];
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		for (const off of this.unsubscribe) off();
		this.unsubscribe = [];
	}

	/** Swapping a row's buttons removes the focused one, so move focus to its replacement. */
	private focusAfterRender(id: string, action: string): void {
		void this.updateComplete.then(() => {
			this.renderRoot
				.querySelector<HTMLElement>(`li[data-id="${id}"] [data-action="${action}"]`)
				?.focus();
		});
	}

	private askDelete(id: string): void {
		this.confirmingId = id;
		this.focusAfterRender(id, "confirm-delete");
	}

	private cancelDelete(id: string): void {
		this.confirmingId = undefined;
		this.focusAfterRender(id, "delete");
	}

	private confirmDelete(id: string): void {
		this.confirmingId = undefined;
		removeLock(id);
	}

	override render() {
		const heading = html`<h1>${t("history.title")}</h1>`;
		if (this.history.length === 0)
			return html`
				${heading}
				<div class="card empty">
					<p>${t("history.empty")}</p>
					<a href="./">${t("history.emptyLink")}</a>
				</div>
			`;
		const lang = getLang();
		const day = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
		const dayTime = new Intl.DateTimeFormat(lang, {
			dateStyle: "medium",
			timeStyle: "short",
		});
		const total = this.history.length;
		return html`
			${heading}
			<section aria-labelledby="stats-title">
				<h2 id="stats-title">${t("history.statsTitle")}</h2>
				<p class="total">
					${total === 1 ? t("history.total.one") : t("history.total.other", { count: total })}
				</p>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th scope="col">${t("history.colRestaurant")}</th>
								<th scope="col" class="num">${t("history.colTimes")}</th>
								<th scope="col">${t("history.colLast")}</th>
							</tr>
						</thead>
						<tbody>
							${summarize(this.history, this.restaurants).map(
								(row) => html`<tr>
									<td>${row.name}${row.deleted ? html` <span class="muted">${t("history.deleted")}</span>` : nothing}</td>
									<td class="num">${row.count}</td>
									<td>${day.format(new Date(row.lastLockedAt))}</td>
								</tr>`,
							)}
						</tbody>
					</table>
				</div>
			</section>
			<section aria-labelledby="locks-title">
				<h2 id="locks-title">${t("history.listTitle")}</h2>
				<ul class="locks">
					${this.history.map((entry) => this.renderLock(entry, dayTime))}
				</ul>
			</section>
		`;
	}

	private renderLock(entry: HistoryEntry, format: Intl.DateTimeFormat) {
		const confirming = this.confirmingId === entry.id;
		return html`
			<li class="card lock" data-id=${entry.id}>
				<div class="what">
					<span class="name">${entry.name}</span>
					<time class="muted" datetime=${entry.lockedAt}>${format.format(new Date(entry.lockedAt))}</time>
				</div>
				<div class="actions">
					${
						confirming
							? html`
									<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(entry.id)}>
										${t("history.confirmDelete")}
									</button>
									<button type="button" data-action="cancel-delete" @click=${() => this.cancelDelete(entry.id)}>
										${t("history.cancel")}
									</button>
								`
							: html`<button type="button" data-action="delete" @click=${() => this.askDelete(entry.id)}>
									${t("history.delete")}
								</button>`
					}
				</div>
			</li>
		`;
	}
}
```

`src/types/global.d.ts`: add
`import type { LockHistory } from "#components/lock-history";` (keep imports sorted) and
`"lock-history": LockHistory;` in `HTMLElementTagNameMap` (sorted, after `"data-transfer"`).

Create `src/routes/history.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>History · What to Eat</title>
		<script type="module" src="../lib/gtm.ts"></script>
		<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
		<script type="module" src="../lib/theme.ts"></script>
		<link rel="stylesheet" href="../styles/global.css" />
		<script type="module" src="../components/app-header.ts"></script>
		<script type="module" src="../components/app-footer.ts"></script>
		<script type="module" src="../components/lock-history.ts"></script>
	</head>
	<body>
		<app-header current="history"></app-header>
		<main>
			<lock-history></lock-history>
		</main>
		<app-footer></app-footer>
	</body>
</html>
```

- [ ] **Step 4: Run tests and checks**

Run: `bun test && bun run check && bun run build`
Expected: all tests PASS (including `tests/routes/pages.test.ts` for `history.html`), no type
errors, and `dist/history.html` in the build output.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/components/lock-history.ts src/components/app-header.ts src/routes/history.html src/types/global.d.ts src/lib/i18n.ts tests/components/lock-history.test.ts tests/components/app-header.test.ts
git commit -m "feat(routes): add history page with lock stats and delete" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: README, full verification, pull request

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

In the page table add a row after `/restaurants`:

```markdown
| `/history`     | Every lock with its date and time, stats per restaurant, delete a lock |
```

Change the `/` row to: `Two random options; press Eat here to lock one into History`.
In the intro, after "get two random options." add the sentence:
"Press **Eat here** on one to save it to your history with the date and time."
Also mention that export and import carry the history if the README describes the export.

- [ ] **Step 2: Full check list**

```bash
bun run format
bun run check
bun run test
bun run build
git status
```

Expected: all pass, no stray files.

- [ ] **Step 3: Commit, push, PR (per `shipping-a-change`)**

```bash
git add README.md
git commit -m "docs(readme): describe eat here and history" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push -u origin HEAD
gh pr create --base main --title "feat: lock a pick and keep a history" --body "<Summary bullets + Test plan, ending with the Claude Code attribution line>"
gh pr checks <number> --watch
```

Preview checks to list unticked in the PR: locked card's green border, stats table on a
phone, four header links fitting on a phone, Thai dates in the Buddhist year.
