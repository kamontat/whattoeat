# Random Restaurant Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static three-page site (`/`, `/restaurants`, `/settings`) that picks a random restaurant from a user-maintained list stored in `localStorage`, with EN/TH UI and JSON import/export.

**Architecture:** Pure TypeScript logic in `src/lib/` (model, store, transfer, random, i18n), Lit components in `src/components/` that read the store and re-render on store and language change events, and three static HTML pages in `src/routes/`. No backend.

**Tech Stack:** Bun 1.4, Lit 3.3, `@kctools/bun-server` (dev/build), `bun test` with happy-dom, Biome, TypeScript (strict preset), Cloudflare Workers static assets.

**Spec:** `docs/superpowers/specs/2026-10-12-random-restaurant-design.md`

## Global Constraints

- Work in worktree `.claude/worktrees/random-restaurant` on branch `worktree-random-restaurant`; never edit `main`.
- Test first: write the test, run it, see it fail for the right reason, then implement.
- Tests live in `tests/` mirroring `src/` (`src/lib/store.ts` → `tests/lib/store.test.ts`).
- Imports use aliases `#lib/*`, `#components/*`, `#styles/*`; no `.ts` extension; type-only imports use `import type`.
- Components: Lit `LitElement`, reactive fields as plain class fields with `@property()` / `@state()` (never `accessor`), every overridden member marked `override`, tag registered in `src/types/global.d.ts`.
- TS strictness: `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` (use `obj["key"]` on `Record<string, unknown>`), `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. No `!` outside test files.
- `localStorage` keys: `whattoeat:restaurants` (restaurant array), `whattoeat:lang` (`"en"` or `"th"`).
- Window events: `whattoeat:restaurants-changed`, `whattoeat:lang-changed`.
- Export envelope: `{ "app": "whattoeat", "version": 1, "exportedAt": <ISO>, "restaurants": [...] }`; file name `whattoeat-YYYY-MM-DD.json` (local date).
- Pages: `src/routes/index.html`, `src/routes/restaurants.html`, `src/routes/settings.html`. Links between pages: `./`, `./restaurants`, `./settings` (no trailing slash, never root-relative).
- Every page sits directly in `src/routes/` and loads `../lib/gtm.ts`, `../styles/global.css`, `../components/app-header.ts` plus its own component, with the same relative paths as the existing `index.html`.
- Before each commit: `bun run format && bun run check && bun run test && bun run build` all pass; then `git add -A` and check `git status` for stray files.
- Commits: conventional, lower case, scoped (`feat(lib): ...`, `feat(components): ...`, `feat(routes): ...`), ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Do not touch `CHANGELOG.md`.

## Review Focus

1. A `location` such as `javascript:alert(1)` (typed or imported) must render as plain text, never as a link — only `http://` / `https://` become `<a>`. Tested in Task 6 (picker) and Task 7 (manager).
2. Tag input with stray commas, spaces and duplicates (`" thai, ,noodle ,thai,"`) must store `["thai", "noodle"]`. Tested in Task 1 and Task 7.
3. A restaurant deleted (in another page or tab) while it is shown as the current pick must disappear from the picker, not linger. Tested in Task 6.
4. An import file with a whitespace-only name, a missing `tags` array or a non-object entry must be rejected with the entries error and leave the stored list untouched. Tested in Task 3 and Task 8.
5. Deleting the restaurant currently open in the edit form must reset the form, so a following Save cannot write to a missing id. Tested in Task 7.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/restaurant.ts` | `Restaurant` / `RestaurantInput` types, `parseTags`, `normalizeInput`, `isRestaurant`, `isLink` |
| `src/lib/random.ts` | `pickRandom` |
| `src/lib/store.ts` | localStorage persistence, CRUD, change events |
| `src/lib/transfer.ts` | export envelope, file name, import parse/validate, merge |
| `src/lib/i18n.ts` | EN/TH dictionaries, `getLang` / `setLang` / `t`, `LangController` |
| `src/styles/global.css` | reset + theme custom properties + page layout (light DOM) |
| `src/styles/ui.ts` | shared shadow-DOM styles (buttons, inputs, cards, chips) |
| `src/components/app-header.ts` | nav + language toggle |
| `src/components/random-picker.ts` | random button + result card |
| `src/components/restaurant-manager.ts` | add/edit form + list with delete confirm |
| `src/components/data-transfer.ts` | count, export, import with replace/merge |
| `src/routes/{index,restaurants,settings}.html` | pages |
| `src/types/global.d.ts` | tag registrations |

Delete: `src/components/hello-world.ts`, `tests/components/hello-world.test.ts`.

---

### Task 1: Restaurant model and random pick

**Files:**
- Create: `src/lib/restaurant.ts`, `src/lib/random.ts`
- Test: `tests/lib/restaurant.test.ts`, `tests/lib/random.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Restaurant = { id: string; name: string; tags: string[]; location: string; notes: string; createdAt: string; updatedAt: string }`
  - `type RestaurantInput = { name: string; tags: string[]; location: string; notes: string }`
  - `parseTags(text: string): string[]`
  - `normalizeInput(input: RestaurantInput): RestaurantInput`
  - `isRestaurant(value: unknown): value is Restaurant`
  - `isLink(text: string): boolean`
  - `pickRandom(list: readonly Restaurant[], previousId?: string, rng?: () => number): Restaurant | undefined`

- [ ] **Step 1: Write the failing tests**

`tests/lib/restaurant.test.ts`:

```ts
import { expect, test } from "bun:test";
import { isLink, isRestaurant, normalizeInput, parseTags, type Restaurant } from "#lib/restaurant";

const valid: Restaurant = {
	id: "a1",
	name: "Som Tam Nua",
	tags: ["thai", "spicy"],
	location: "Siam Square",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
};

test("parseTags trims, drops empties and de-duplicates in order", () => {
	expect(parseTags(" thai, ,noodle ,thai,")).toEqual(["thai", "noodle"]);
});

test("parseTags returns [] for blank text", () => {
	expect(parseTags("   ")).toEqual([]);
});

test("parseTags keeps different casing as different tags", () => {
	expect(parseTags("Thai, thai")).toEqual(["Thai", "thai"]);
});

test("normalizeInput trims every field and cleans tags", () => {
	expect(normalizeInput({ name: "  Jay Fai ", tags: [" street ", "", "street"], location: " Bangkok ", notes: " ok " })).toEqual({
		name: "Jay Fai",
		tags: ["street"],
		location: "Bangkok",
		notes: "ok",
	});
});

test("isRestaurant accepts a valid restaurant", () => {
	expect(isRestaurant(valid)).toBe(true);
});

test.each([
	["null", null],
	["string", "x"],
	["empty id", { ...valid, id: "" }],
	["blank name", { ...valid, name: "   " }],
	["missing tags", { ...valid, tags: undefined }],
	["non-string tag", { ...valid, tags: ["ok", 1] }],
	["numeric location", { ...valid, location: 5 }],
	["missing notes", { ...valid, notes: undefined }],
	["missing createdAt", { ...valid, createdAt: undefined }],
	["missing updatedAt", { ...valid, updatedAt: undefined }],
])("isRestaurant rejects %s", (_label, value) => {
	expect(isRestaurant(value)).toBe(false);
});

test.each([
	["https://maps.app.goo.gl/abc", true],
	["HTTP://example.com", true],
	["Siam Square", false],
	["javascript:alert(1)", false],
	["", false],
])("isLink(%p) is %p", (text, expected) => {
	expect(isLink(text)).toBe(expected);
});
```

`tests/lib/random.test.ts`:

```ts
import { expect, test } from "bun:test";
import { pickRandom } from "#lib/random";
import type { Restaurant } from "#lib/restaurant";

const make = (id: string): Restaurant => ({
	id,
	name: id,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

test("returns undefined for an empty list", () => {
	expect(pickRandom([])).toBeUndefined();
});

test("returns the only item even when it was the previous pick", () => {
	expect(pickRandom([make("a")], "a")?.id).toBe("a");
});

test("uses rng to choose the index", () => {
	const list = [make("a"), make("b"), make("c")];
	expect(pickRandom(list, undefined, () => 0)?.id).toBe("a");
	expect(pickRandom(list, undefined, () => 0.5)?.id).toBe("b");
	expect(pickRandom(list, undefined, () => 0.99)?.id).toBe("c");
});

test("never returns the previous pick when the list has 2+ items", () => {
	const list = [make("a"), make("b"), make("c")];
	for (const value of [0, 0.34, 0.67, 0.99]) {
		expect(pickRandom(list, "b", () => value)?.id).not.toBe("b");
	}
});

test("with two items always switches", () => {
	const list = [make("a"), make("b")];
	expect(pickRandom(list, "a", () => 0.99)?.id).toBe("b");
	expect(pickRandom(list, "b", () => 0)?.id).toBe("a");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/lib/restaurant.test.ts tests/lib/random.test.ts`
Expected: FAIL — `Cannot find module '#lib/restaurant'` / `'#lib/random'`.

- [ ] **Step 3: Implement**

`src/lib/restaurant.ts`:

```ts
export type Restaurant = {
	id: string;
	name: string;
	tags: string[];
	location: string;
	notes: string;
	createdAt: string;
	updatedAt: string;
};

export type RestaurantInput = {
	name: string;
	tags: string[];
	location: string;
	notes: string;
};

/** Split comma-separated text into trimmed, non-empty, de-duplicated tags, keeping first-seen order. */
export const parseTags = (text: string): string[] => {
	const tags = new Set<string>();
	for (const raw of text.split(",")) {
		const tag = raw.trim();
		if (tag !== "") tags.add(tag);
	}
	return [...tags];
};

export const normalizeInput = (input: RestaurantInput): RestaurantInput => ({
	name: input.name.trim(),
	tags: parseTags(input.tags.join(",")),
	location: input.location.trim(),
	notes: input.notes.trim(),
});

const isString = (value: unknown): value is string => typeof value === "string";

export const isRestaurant = (value: unknown): value is Restaurant => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Record<string, unknown>;
	const id = item["id"];
	const name = item["name"];
	const tags = item["tags"];
	return (
		isString(id) &&
		id !== "" &&
		isString(name) &&
		name.trim() !== "" &&
		Array.isArray(tags) &&
		tags.every(isString) &&
		isString(item["location"]) &&
		isString(item["notes"]) &&
		isString(item["createdAt"]) &&
		isString(item["updatedAt"])
	);
};

/** Only http(s) URLs are rendered as links; anything else (including `javascript:`) stays text. */
export const isLink = (text: string): boolean => /^https?:\/\//i.test(text);
```

`src/lib/random.ts`:

```ts
import type { Restaurant } from "#lib/restaurant";

/**
 * Pick one restaurant uniformly at random. With two or more restaurants the previous pick is
 * excluded, so pressing the button again always shows a different one.
 */
export const pickRandom = (
	list: readonly Restaurant[],
	previousId?: string,
	rng: () => number = Math.random,
): Restaurant | undefined => {
	const pool = list.length > 1 ? list.filter((item) => item.id !== previousId) : list;
	return pool[Math.floor(rng() * pool.length)];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/lib/restaurant.test.ts tests/lib/random.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A && git status
git commit -m "feat(lib): add restaurant model and random pick

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Restaurant store

**Files:**
- Create: `src/lib/store.ts`
- Test: `tests/lib/store.test.ts`

**Interfaces:**
- Consumes: `Restaurant`, `RestaurantInput`, `isRestaurant`, `normalizeInput` from `#lib/restaurant`.
- Produces:
  - `STORAGE_KEY = "whattoeat:restaurants"`, `CHANGE_EVENT = "whattoeat:restaurants-changed"`
  - `loadRestaurants(): Restaurant[]`
  - `saveRestaurants(list: Restaurant[]): void`
  - `addRestaurant(input: RestaurantInput, now?: Date): Restaurant[]`
  - `updateRestaurant(id: string, input: RestaurantInput, now?: Date): Restaurant[]`
  - `removeRestaurant(id: string): Restaurant[]`
  - `onRestaurantsChanged(callback: () => void): () => void`

- [ ] **Step 1: Write the failing test**

`tests/lib/store.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	addRestaurant,
	CHANGE_EVENT,
	loadRestaurants,
	onRestaurantsChanged,
	removeRestaurant,
	STORAGE_KEY,
	saveRestaurants,
	updateRestaurant,
} from "#lib/store";

const input = { name: " Jay Fai ", tags: ["street", " street "], location: "Bangkok", notes: "" };

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
});

test("loads [] when nothing is stored", () => {
	expect(loadRestaurants()).toEqual([]);
});

test("loads [] for unparseable data", () => {
	localStorage.setItem(STORAGE_KEY, "{not json");
	expect(loadRestaurants()).toEqual([]);
});

test("loads [] when stored data is not an array", () => {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: "x" }));
	expect(loadRestaurants()).toEqual([]);
});

test("drops invalid entries and keeps valid ones", () => {
	const [kept] = addRestaurant(input);
	const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown[];
	localStorage.setItem(STORAGE_KEY, JSON.stringify([...raw, { name: "broken" }, null]));
	expect(loadRestaurants()).toEqual([kept!]);
});

test("addRestaurant normalizes, stamps and saves", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	const list = addRestaurant(input, now);
	expect(list).toHaveLength(1);
	expect(list[0]).toMatchObject({
		name: "Jay Fai",
		tags: ["street"],
		location: "Bangkok",
		notes: "",
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
	});
	expect(list[0]!.id).not.toBe("");
	expect(loadRestaurants()).toEqual(list);
});

test("addRestaurant gives every restaurant its own id", () => {
	addRestaurant(input);
	const list = addRestaurant(input);
	expect(new Set(list.map((item) => item.id)).size).toBe(2);
});

test("addRestaurant throws on a blank name and saves nothing", () => {
	expect(() => addRestaurant({ ...input, name: "   " })).toThrow();
	expect(loadRestaurants()).toEqual([]);
});

test("updateRestaurant changes fields and updatedAt only", () => {
	const created = new Date("2026-10-12T10:00:00.000Z");
	const edited = new Date("2026-10-13T10:00:00.000Z");
	const [first] = addRestaurant(input, created);
	const list = updateRestaurant(first!.id, { name: "Jay Fai 2", tags: [], location: "", notes: "star" }, edited);
	expect(list[0]).toEqual({
		id: first!.id,
		name: "Jay Fai 2",
		tags: [],
		location: "",
		notes: "star",
		createdAt: created.toISOString(),
		updatedAt: edited.toISOString(),
	});
	expect(loadRestaurants()).toEqual(list);
});

test("updateRestaurant throws on a blank name", () => {
	const [first] = addRestaurant(input);
	expect(() => updateRestaurant(first!.id, { ...input, name: "" })).toThrow();
	expect(loadRestaurants()[0]!.name).toBe("Jay Fai");
});

test("removeRestaurant removes by id", () => {
	const [first] = addRestaurant(input);
	addRestaurant({ ...input, name: "Other" });
	const list = removeRestaurant(first!.id);
	expect(list.map((item) => item.name)).toEqual(["Other"]);
	expect(loadRestaurants()).toEqual(list);
});

test("every save notifies subscribers until unsubscribed", () => {
	let calls = 0;
	const unsubscribe = onRestaurantsChanged(() => {
		calls += 1;
	});
	addRestaurant(input);
	saveRestaurants([]);
	unsubscribe();
	addRestaurant(input);
	expect(calls).toBe(2);
});

test("a storage event for the restaurants key notifies subscribers", () => {
	let calls = 0;
	const unsubscribe = onRestaurantsChanged(() => {
		calls += 1;
	});
	window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
	window.dispatchEvent(new StorageEvent("storage", { key: null }));
	unsubscribe();
	expect(calls).toBe(2);
});

test("save dispatches the change event on window", () => {
	let fired = false;
	const listener = (): void => {
		fired = true;
	};
	window.addEventListener(CHANGE_EVENT, listener);
	saveRestaurants([]);
	window.removeEventListener(CHANGE_EVENT, listener);
	expect(fired).toBe(true);
});

test("falls back to memory when localStorage throws", () => {
	const setItem = Storage.prototype.setItem;
	Storage.prototype.setItem = () => {
		throw new Error("QuotaExceededError");
	};
	try {
		const list = addRestaurant(input);
		expect(loadRestaurants()).toEqual(list);
	} finally {
		Storage.prototype.setItem = setItem;
	}
	// A successful save leaves memory mode again.
	saveRestaurants([]);
	expect(loadRestaurants()).toEqual([]);
	expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/store.test.ts`
Expected: FAIL — `Cannot find module '#lib/store'`.

- [ ] **Step 3: Implement**

`src/lib/store.ts`:

```ts
import { isRestaurant, normalizeInput, type Restaurant, type RestaurantInput } from "#lib/restaurant";

export const STORAGE_KEY = "whattoeat:restaurants";
export const CHANGE_EVENT = "whattoeat:restaurants-changed";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: Restaurant[] | undefined;

export const loadRestaurants = (): Restaurant[] => {
	if (memory !== undefined) return memory;
	let raw: string | null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		return [];
	}
	if (raw === null) return [];
	try {
		const data: unknown = JSON.parse(raw);
		return Array.isArray(data) ? data.filter(isRestaurant) : [];
	} catch {
		return [];
	}
};

export const saveRestaurants = (list: Restaurant[]): void => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const requireName = (input: RestaurantInput): RestaurantInput => {
	const clean = normalizeInput(input);
	if (clean.name === "") throw new Error("Restaurant name is required");
	return clean;
};

export const addRestaurant = (input: RestaurantInput, now: Date = new Date()): Restaurant[] => {
	const clean = requireName(input);
	const stamp = now.toISOString();
	const list = [...loadRestaurants(), { id: crypto.randomUUID(), ...clean, createdAt: stamp, updatedAt: stamp }];
	saveRestaurants(list);
	return list;
};

export const updateRestaurant = (id: string, input: RestaurantInput, now: Date = new Date()): Restaurant[] => {
	const clean = requireName(input);
	const list = loadRestaurants().map((item) =>
		item.id === id ? { ...item, ...clean, updatedAt: now.toISOString() } : item,
	);
	saveRestaurants(list);
	return list;
};

export const removeRestaurant = (id: string): Restaurant[] => {
	const list = loadRestaurants().filter((item) => item.id !== id);
	saveRestaurants(list);
	return list;
};

/** Call `callback` after every save in this tab and every change from another tab. Returns an unsubscribe function. */
export const onRestaurantsChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === STORAGE_KEY || event.key === null) callback();
	};
	window.addEventListener(CHANGE_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(CHANGE_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};
```

(`event.key === null` is what `localStorage.clear()` in another tab sends.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A && git status
git commit -m "feat(lib): add localStorage restaurant store

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Import / export

**Files:**
- Create: `src/lib/transfer.ts`
- Test: `tests/lib/transfer.test.ts`

**Interfaces:**
- Consumes: `Restaurant`, `isRestaurant` from `#lib/restaurant`.
- Produces:
  - `EXPORT_VERSION = 1`
  - `type ExportFile = { app: "whattoeat"; version: number; exportedAt: string; restaurants: Restaurant[] }`
  - `type ImportError = "import.error.json" | "import.error.format" | "import.error.version" | "import.error.entries"`
  - `type ImportResult = { ok: true; restaurants: Restaurant[] } | { ok: false; error: ImportError }`
  - `toExportFile(restaurants: Restaurant[], now?: Date): ExportFile`
  - `exportFileName(now?: Date): string`
  - `parseImport(text: string): ImportResult`
  - `mergeRestaurants(existing: Restaurant[], incoming: Restaurant[]): Restaurant[]`

- [ ] **Step 1: Write the failing test**

`tests/lib/transfer.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { Restaurant } from "#lib/restaurant";
import { exportFileName, mergeRestaurants, parseImport, toExportFile } from "#lib/transfer";

const make = (id: string, name = id): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

test("toExportFile wraps restaurants in the versioned envelope", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	expect(toExportFile([make("a")], now)).toEqual({
		app: "whattoeat",
		version: 1,
		exportedAt: "2026-10-12T10:00:00.000Z",
		restaurants: [make("a")],
	});
});

test("exportFileName uses the local date, zero padded", () => {
	expect(exportFileName(new Date(2026, 0, 5, 23, 30))).toBe("whattoeat-2026-01-05.json");
});

test("an exported file imports back unchanged", () => {
	const list = [make("a"), make("b", "ร้านข้าวมันไก่")];
	expect(parseImport(JSON.stringify(toExportFile(list)))).toEqual({ ok: true, restaurants: list });
});

test("an empty restaurants array is a valid import", () => {
	expect(parseImport(JSON.stringify(toExportFile([])))).toEqual({ ok: true, restaurants: [] });
});

test.each([
	["not JSON", "{oops", "import.error.json"],
	["JSON null", "null", "import.error.format"],
	["a bare array", "[]", "import.error.format"],
	["wrong app", JSON.stringify({ app: "other", version: 1, restaurants: [] }), "import.error.format"],
	["missing restaurants", JSON.stringify({ app: "whattoeat", version: 1 }), "import.error.format"],
	["future version", JSON.stringify({ app: "whattoeat", version: 2, restaurants: [] }), "import.error.version"],
	[
		"blank name entry",
		JSON.stringify({ app: "whattoeat", version: 1, restaurants: [make("a"), { ...make("b"), name: "  " }] }),
		"import.error.entries",
	],
	[
		"entry without tags",
		JSON.stringify({ app: "whattoeat", version: 1, restaurants: [{ ...make("a"), tags: undefined }] }),
		"import.error.entries",
	],
	["non-object entry", JSON.stringify({ app: "whattoeat", version: 1, restaurants: ["x"] }), "import.error.entries"],
])("rejects %s", (_label, text, error) => {
	expect(parseImport(text)).toEqual({ ok: false, error });
});

test("merge replaces same id in place and appends new ids", () => {
	const existing = [make("a", "A old"), make("b")];
	const incoming = [make("c"), make("a", "A new")];
	expect(mergeRestaurants(existing, incoming)).toEqual([make("a", "A new"), make("b"), make("c")]);
});

test("merge does not mutate its inputs", () => {
	const existing = [make("a")];
	const incoming = [make("b")];
	mergeRestaurants(existing, incoming);
	expect(existing).toEqual([make("a")]);
	expect(incoming).toEqual([make("b")]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/transfer.test.ts`
Expected: FAIL — `Cannot find module '#lib/transfer'`.

- [ ] **Step 3: Implement**

`src/lib/transfer.ts`:

```ts
import { isRestaurant, type Restaurant } from "#lib/restaurant";

export const EXPORT_VERSION = 1;

export type ExportFile = {
	app: "whattoeat";
	version: number;
	exportedAt: string;
	restaurants: Restaurant[];
};

/** Each error is an i18n message key, so the UI can show it directly with `t(error)`. */
export type ImportError = "import.error.json" | "import.error.format" | "import.error.version" | "import.error.entries";

export type ImportResult = { ok: true; restaurants: Restaurant[] } | { ok: false; error: ImportError };

export const toExportFile = (restaurants: Restaurant[], now: Date = new Date()): ExportFile => ({
	app: "whattoeat",
	version: EXPORT_VERSION,
	exportedAt: now.toISOString(),
	restaurants,
});

const pad = (value: number): string => String(value).padStart(2, "0");

export const exportFileName = (now: Date = new Date()): string =>
	`whattoeat-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;

/** Validate an export file. All or nothing: one invalid entry rejects the whole file. */
export const parseImport = (text: string): ImportResult => {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: "import.error.json" };
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return { ok: false, error: "import.error.format" };
	}
	const file = data as Record<string, unknown>;
	const restaurants = file["restaurants"];
	if (file["app"] !== "whattoeat" || !Array.isArray(restaurants)) {
		return { ok: false, error: "import.error.format" };
	}
	if (file["version"] !== EXPORT_VERSION) return { ok: false, error: "import.error.version" };
	if (!restaurants.every(isRestaurant)) return { ok: false, error: "import.error.entries" };
	return { ok: true, restaurants };
};

/** Incoming restaurants replace existing ones with the same id (keeping their position); new ids are appended. */
export const mergeRestaurants = (existing: Restaurant[], incoming: Restaurant[]): Restaurant[] => {
	const byId = new Map(existing.map((item) => [item.id, item]));
	for (const item of incoming) byId.set(item.id, item);
	return [...byId.values()];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/transfer.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A && git status
git commit -m "feat(lib): add json import and export

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Internationalization

**Files:**
- Create: `src/lib/i18n.ts`
- Test: `tests/lib/i18n.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Lang = "en" | "th"`, `LANGS: readonly Lang[]`
  - `en` (const object), `th: Record<MessageKey, string>`, `type MessageKey = keyof typeof en`
  - `LANG_KEY = "whattoeat:lang"`, `LANG_EVENT = "whattoeat:lang-changed"`
  - `detectLang(): Lang`, `getLang(): Lang`, `setLang(lang: Lang): void`
  - `t(key: MessageKey, params?: Record<string, string | number>): string` — replaces `{name}` placeholders
  - `class LangController implements ReactiveController` — `new LangController(host)` re-renders the host on language change

- [ ] **Step 1: Write the failing test**

`tests/lib/i18n.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { detectLang, en, getLang, LANG_EVENT, LANG_KEY, setLang, t, th } from "#lib/i18n";

const setNavigatorLanguage = (value: string): void => {
	Object.defineProperty(navigator, "language", { value, configurable: true });
};

beforeEach(() => {
	localStorage.clear();
	setNavigatorLanguage("en-US");
});

afterEach(() => {
	setLang("en");
	localStorage.clear();
	setNavigatorLanguage("en-US");
});

test("th has exactly the same keys as en", () => {
	expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
});

test("no translation is empty", () => {
	for (const value of [...Object.values(en), ...Object.values(th)]) expect(value.trim()).not.toBe("");
});

test("detectLang prefers the stored language", () => {
	localStorage.setItem(LANG_KEY, "th");
	expect(detectLang()).toBe("th");
});

test("detectLang ignores an unknown stored value", () => {
	localStorage.setItem(LANG_KEY, "fr");
	setNavigatorLanguage("th-TH");
	expect(detectLang()).toBe("th");
});

test("detectLang uses Thai for a Thai browser", () => {
	setNavigatorLanguage("th");
	expect(detectLang()).toBe("th");
});

test("detectLang falls back to English", () => {
	setNavigatorLanguage("ja-JP");
	expect(detectLang()).toBe("en");
});

test("setLang saves, updates html lang and notifies", () => {
	let detail: unknown;
	const listener = (event: Event): void => {
		detail = (event as CustomEvent).detail;
	};
	window.addEventListener(LANG_EVENT, listener);
	setLang("th");
	window.removeEventListener(LANG_EVENT, listener);
	expect(getLang()).toBe("th");
	expect(localStorage.getItem(LANG_KEY)).toBe("th");
	expect(document.documentElement.lang).toBe("th");
	expect(detail).toBe("th");
});

test("t returns the current language text", () => {
	setLang("en");
	expect(t("nav.home")).toBe("Home");
	setLang("th");
	expect(t("nav.home")).toBe("หน้าแรก");
});

test("t fills placeholders and leaves unknown ones", () => {
	setLang("en");
	expect(t("settings.count", { count: 3 })).toBe("Restaurants saved: 3");
	expect(t("settings.count")).toBe("Restaurants saved: {count}");
});

test("setLang still works when localStorage throws", () => {
	const setItem = Storage.prototype.setItem;
	Storage.prototype.setItem = () => {
		throw new Error("blocked");
	};
	try {
		setLang("th");
		expect(getLang()).toBe("th");
	} finally {
		Storage.prototype.setItem = setItem;
	}
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/i18n.test.ts`
Expected: FAIL — `Cannot find module '#lib/i18n'`.

- [ ] **Step 3: Implement**

`src/lib/i18n.ts`:

```ts
import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Lang = "en" | "th";
export const LANGS: readonly Lang[] = ["en", "th"];

export const LANG_KEY = "whattoeat:lang";
export const LANG_EVENT = "whattoeat:lang-changed";

export const en = {
	"app.title": "What to Eat",
	"nav.label": "Main",
	"nav.home": "Home",
	"nav.restaurants": "Restaurants",
	"nav.settings": "Settings",
	"lang.label": "Language",
	"picker.button": "What should I eat?",
	"picker.again": "Pick again",
	"picker.empty": "No restaurants yet.",
	"picker.addLink": "Add some restaurants",
	"field.name": "Name",
	"field.tags": "Tags",
	"field.tagsHint": "Comma-separated, e.g. thai, noodle",
	"field.location": "Location or map link",
	"field.notes": "Notes",
	"manager.title": "Restaurants",
	"manager.add": "Add",
	"manager.save": "Save",
	"manager.cancel": "Cancel",
	"manager.edit": "Edit",
	"manager.delete": "Delete",
	"manager.confirmDelete": "Confirm delete",
	"manager.empty": "No restaurants yet. Add your first one above.",
	"manager.nameRequired": "Name is required.",
	"settings.title": "Settings",
	"settings.count": "Restaurants saved: {count}",
	"settings.exportTitle": "Export",
	"settings.export": "Download JSON",
	"settings.importTitle": "Import",
	"settings.importFile": "Choose a JSON file",
	"settings.importFound": "{count} restaurants found in the file.",
	"settings.replace": "Replace all",
	"settings.merge": "Merge",
	"settings.cancel": "Cancel",
	"settings.imported": "Import complete. {count} restaurants saved.",
	"import.error.json": "The file is not valid JSON.",
	"import.error.format": "The file is not a What to Eat export.",
	"import.error.version": "This file version is not supported.",
	"import.error.entries": "The file contains invalid restaurant data.",
} as const;

export type MessageKey = keyof typeof en;

export const th: Record<MessageKey, string> = {
	"app.title": "กินอะไรดี",
	"nav.label": "เมนูหลัก",
	"nav.home": "หน้าแรก",
	"nav.restaurants": "ร้านอาหาร",
	"nav.settings": "ตั้งค่า",
	"lang.label": "ภาษา",
	"picker.button": "กินอะไรดี?",
	"picker.again": "สุ่มใหม่",
	"picker.empty": "ยังไม่มีร้านอาหาร",
	"picker.addLink": "เพิ่มร้านอาหาร",
	"field.name": "ชื่อร้าน",
	"field.tags": "แท็ก",
	"field.tagsHint": "คั่นด้วยจุลภาค เช่น ไทย, ก๋วยเตี๋ยว",
	"field.location": "ที่ตั้งหรือลิงก์แผนที่",
	"field.notes": "บันทึก",
	"manager.title": "ร้านอาหาร",
	"manager.add": "เพิ่ม",
	"manager.save": "บันทึก",
	"manager.cancel": "ยกเลิก",
	"manager.edit": "แก้ไข",
	"manager.delete": "ลบ",
	"manager.confirmDelete": "ยืนยันการลบ",
	"manager.empty": "ยังไม่มีร้านอาหาร เพิ่มร้านแรกด้านบนได้เลย",
	"manager.nameRequired": "กรุณาใส่ชื่อร้าน",
	"settings.title": "ตั้งค่า",
	"settings.count": "ร้านอาหารที่บันทึกไว้: {count}",
	"settings.exportTitle": "ส่งออก",
	"settings.export": "ดาวน์โหลด JSON",
	"settings.importTitle": "นำเข้า",
	"settings.importFile": "เลือกไฟล์ JSON",
	"settings.importFound": "พบร้านอาหาร {count} ร้านในไฟล์",
	"settings.replace": "แทนที่ทั้งหมด",
	"settings.merge": "รวมรายการ",
	"settings.cancel": "ยกเลิก",
	"settings.imported": "นำเข้าสำเร็จ มีร้านอาหาร {count} ร้าน",
	"import.error.json": "ไฟล์นี้ไม่ใช่ JSON ที่ถูกต้อง",
	"import.error.format": "ไฟล์นี้ไม่ใช่ไฟล์ส่งออกของ กินอะไรดี",
	"import.error.version": "ไม่รองรับไฟล์เวอร์ชันนี้",
	"import.error.entries": "ไฟล์มีข้อมูลร้านอาหารที่ไม่ถูกต้อง",
};

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, th };

const isLang = (value: unknown): value is Lang => value === "en" || value === "th";

/** Stored choice first, then Thai for a Thai browser, else English. */
export const detectLang = (): Lang => {
	try {
		const stored = localStorage.getItem(LANG_KEY);
		if (isLang(stored)) return stored;
	} catch {
		// Storage blocked: fall through to browser detection.
	}
	return navigator.language.toLowerCase().startsWith("th") ? "th" : "en";
};

let current: Lang | undefined;

export const getLang = (): Lang => {
	if (current === undefined) {
		current = detectLang();
		document.documentElement.lang = current;
	}
	return current;
};

export const setLang = (lang: Lang): void => {
	current = lang;
	try {
		localStorage.setItem(LANG_KEY, lang);
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
	document.documentElement.lang = lang;
	window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
};

export const t = (key: MessageKey, params: Record<string, string | number> = {}): string =>
	dictionaries[getLang()][key].replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));

/** Re-render the host component whenever the language changes. */
export class LangController implements ReactiveController {
	private readonly host: ReactiveControllerHost;

	private readonly onChange = (): void => {
		this.host.requestUpdate();
	};

	constructor(host: ReactiveControllerHost) {
		this.host = host;
		host.addController(this);
	}

	hostConnected(): void {
		window.addEventListener(LANG_EVENT, this.onChange);
	}

	hostDisconnected(): void {
		window.removeEventListener(LANG_EVENT, this.onChange);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A && git status
git commit -m "feat(lib): add english and thai translations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Theme, shared styles and `<app-header>`

**Files:**
- Modify: `src/styles/global.css`, `src/types/global.d.ts`
- Create: `src/styles/ui.ts`, `src/components/app-header.ts`
- Test: `tests/components/app-header.test.ts`

**Interfaces:**
- Consumes: `getLang`, `setLang`, `t`, `LANGS`, `LangController`, `type MessageKey` from `#lib/i18n`.
- Produces:
  - `uiStyles` (Lit `CSSResult`) from `#styles/ui`
  - `<app-header current="home|restaurants|settings">` (`AppHeader`, property `current: Page`)

- [ ] **Step 1: Write the failing test**

`tests/components/app-header.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-header";
import { setLang } from "#lib/i18n";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	setLang("en");
	localStorage.clear();
});

const mount = async (current?: "home" | "restaurants" | "settings") => {
	const el = document.createElement("app-header");
	if (current) el.current = current;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("renders nav links to the three pages", async () => {
	const el = await mount();
	const links = [...el.shadowRoot!.querySelectorAll("nav a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual(["./", "./restaurants", "./settings"]);
	expect(links.map((a) => a.textContent?.trim())).toEqual(["Home", "Restaurants", "Settings"]);
});

test("marks the current page", async () => {
	const el = await mount("restaurants");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./restaurants");
});

test("switching to Thai re-renders text and marks the button", async () => {
	const el = await mount();
	const th = el.shadowRoot!.querySelector<HTMLButtonElement>('button[data-lang="th"]')!;
	th.click();
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector("nav a")?.textContent?.trim()).toBe("หน้าแรก");
	expect(th.getAttribute("aria-pressed")).toBe("true");
	expect(el.shadowRoot!.querySelector('button[data-lang="en"]')?.getAttribute("aria-pressed")).toBe("false");
	expect(document.documentElement.lang).toBe("th");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components/app-header.test.ts`
Expected: FAIL — `Cannot find module '#components/app-header'`.

- [ ] **Step 3: Implement styles**

`src/styles/global.css` (replace whole file):

```css
@import "@kcstyles/reset.css";

:root {
	--color-bg: #fff8f0;
	--color-surface: #ffffff;
	--color-text: #2b2118;
	--color-muted: #7a6a5c;
	--color-primary: #d9480f;
	--color-primary-text: #ffffff;
	--color-border: #eaded2;
	--color-danger: #c0392b;
	--color-success: #2b8a3e;
	--radius: 12px;
	--font: system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", "Sarabun", "Leelawadee UI", Tahoma, sans-serif;

	font-family: var(--font);
	color: var(--color-text);
	background: var(--color-bg);
}

body {
	min-height: 100vh;
}

main {
	width: 100%;
	max-width: 40rem;
	margin: 0 auto;
	padding: 1.5rem 1rem 3rem;
}
```

`src/styles/ui.ts`:

```ts
import { css } from "lit";

/** Shared look for buttons, form fields, cards and tag chips inside component shadow roots. */
export const uiStyles = css`
	:host {
		display: block;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	a {
		color: var(--color-primary);
	}

	button {
		font: inherit;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
	}

	button.primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-primary-text);
	}

	button.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
	}

	input,
	textarea {
		font: inherit;
		box-sizing: border-box;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: inherit;
	}

	.card {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		padding: 0.125rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-bg);
		font-size: 0.875rem;
	}

	.muted,
	.hint {
		color: var(--color-muted);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.error {
		color: var(--color-danger);
	}

	.success {
		color: var(--color-success);
	}
`;
```

- [ ] **Step 4: Implement `<app-header>`**

`src/components/app-header.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getLang, LangController, LANGS, type MessageKey, setLang, t } from "#lib/i18n";
import { uiStyles } from "#styles/ui";

export type Page = "home" | "restaurants" | "settings";

const LINKS: readonly { page: Page; href: string; label: MessageKey }[] = [
	{ page: "home", href: "./", label: "nav.home" },
	{ page: "restaurants", href: "./restaurants", label: "nav.restaurants" },
	{ page: "settings", href: "./settings", label: "nav.settings" },
];

@customElement("app-header")
export class AppHeader extends LitElement {
	static override styles = [
		uiStyles,
		css`
			header {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				max-width: 40rem;
				margin: 0 auto;
				padding: 1rem;
			}

			.brand {
				font-size: 1.25rem;
				font-weight: 700;
				color: var(--color-text);
				text-decoration: none;
			}

			nav {
				display: flex;
				flex-wrap: wrap;
				gap: 1rem;
			}

			nav a {
				color: var(--color-muted);
				text-decoration: none;
			}

			nav a[aria-current="page"] {
				color: var(--color-primary);
				font-weight: 700;
			}

			.lang {
				display: flex;
			}

			.lang button {
				padding: 0.25rem 0.625rem;
				font-size: 0.875rem;
			}

			.lang button:first-child {
				border-radius: var(--radius) 0 0 var(--radius);
			}

			.lang button:last-child {
				border-radius: 0 var(--radius) var(--radius) 0;
			}

			.lang button[aria-pressed="true"] {
				background: var(--color-text);
				border-color: var(--color-text);
				color: var(--color-surface);
			}
		`,
	];

	@property()
	current: Page = "home";

	protected readonly langController = new LangController(this);

	override render() {
		const lang = getLang();
		return html`
			<header>
				<a class="brand" href="./">${t("app.title")}</a>
				<nav aria-label=${t("nav.label")}>
					${LINKS.map(
						(link) =>
							html`<a href=${link.href} aria-current=${this.current === link.page ? "page" : nothing}>${t(link.label)}</a>`,
					)}
				</nav>
				<div class="lang" role="group" aria-label=${t("lang.label")}>
					${LANGS.map(
						(code) =>
							html`<button
								type="button"
								data-lang=${code}
								aria-pressed=${code === lang ? "true" : "false"}
								@click=${() => setLang(code)}
							>
								${code.toUpperCase()}
							</button>`,
					)}
				</div>
			</header>
		`;
	}
}
```

`src/types/global.d.ts` — add the import and map entry (keep `hello-world` until Task 6 removes it):

```ts
import type { AppHeader } from "#components/app-header";
import type { HelloWorld } from "#components/hello-world";

declare global {
	interface HTMLElementTagNameMap {
		"app-header": AppHeader;
		"hello-world": HelloWorld;
	}
}
```

(Keep the existing `declare module "bun"` block below unchanged.)

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/components/app-header.test.ts`
Expected: PASS.

- [ ] **Step 6: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A && git status
git commit -m "feat(components): add app header with language toggle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `<random-picker>` and the home page

**Files:**
- Create: `src/components/random-picker.ts`, `tests/components/random-picker.test.ts`
- Modify: `src/routes/index.html`, `src/types/global.d.ts`, `tests/routes/pages.test.ts`
- Delete: `src/components/hello-world.ts`, `tests/components/hello-world.test.ts`

**Interfaces:**
- Consumes: `loadRestaurants`, `onRestaurantsChanged`, `saveRestaurants`, `addRestaurant`, `removeRestaurant` (`#lib/store`); `pickRandom` (`#lib/random`); `isLink`, `type Restaurant` (`#lib/restaurant`); `t`, `setLang`, `LangController` (`#lib/i18n`); `uiStyles` (`#styles/ui`).
- Produces: `<random-picker>` (`RandomPicker`).

- [ ] **Step 1: Write the failing tests**

`tests/components/random-picker.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/random-picker";
import { setLang } from "#lib/i18n";
import { addRestaurant, removeRestaurant } from "#lib/store";

const base = { tags: [], location: "", notes: "" };

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("random-picker");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const pickButton = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLButtonElement>("button.pick");
const pickedName = (el: HTMLElement) => el.shadowRoot!.querySelector(".result h2")?.textContent;

test("empty list shows a link to the restaurants page and no button", async () => {
	const el = await mount();
	expect(pickButton(el)).toBeNull();
	expect(el.shadowRoot!.querySelector('a[href="./restaurants"]')?.textContent?.trim()).toBe("Add some restaurants");
});

test("clicking the button shows a restaurant with its details", async () => {
	addRestaurant({ name: "Jay Fai", tags: ["street", "crab"], location: "https://maps.example/jayfai", notes: "Queue early" });
	const el = await mount();
	expect(pickButton(el)?.textContent?.trim()).toBe("What should I eat?");
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).toBe("Jay Fai");
	expect([...el.shadowRoot!.querySelectorAll(".result .chip")].map((c) => c.textContent)).toEqual(["street", "crab"]);
	const link = el.shadowRoot!.querySelector<HTMLAnchorElement>(".result a");
	expect(link?.getAttribute("href")).toBe("https://maps.example/jayfai");
	expect(link?.getAttribute("target")).toBe("_blank");
	expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
	expect(el.shadowRoot!.querySelector(".result .notes")?.textContent).toBe("Queue early");
	expect(pickButton(el)?.textContent?.trim()).toBe("Pick again");
});

test("a non-http location renders as text, not a link", async () => {
	addRestaurant({ ...base, name: "Sneaky", location: "javascript:alert(1)" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector(".result a")).toBeNull();
	expect(el.shadowRoot!.querySelector(".result .location")?.textContent?.trim()).toBe("javascript:alert(1)");
});

test("picking again with two restaurants always changes the result", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const first = pickedName(el);
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).not.toBe(first);
});

test("updates when restaurants are added after mount", async () => {
	const el = await mount();
	addRestaurant({ ...base, name: "New" });
	await el.updateComplete;
	expect(pickButton(el)).not.toBeNull();
});

test("clears the result when the picked restaurant is deleted", async () => {
	addRestaurant({ ...base, name: "A" });
	const list = addRestaurant({ ...base, name: "B" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const picked = list.find((r) => r.name === pickedName(el))!;
	removeRestaurant(picked.id);
	await el.updateComplete;
	expect(pickedName(el)).toBeUndefined();
	expect(pickButton(el)?.textContent?.trim()).toBe("What should I eat?");
});

test("re-renders in Thai when the language changes", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(pickButton(el)?.textContent?.trim()).toBe("กินอะไรดี?");
});
```

Extend `tests/routes/pages.test.ts` — append:

```ts
test.each(pages)("%s loads the global stylesheet and the app header", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toMatch(/<link rel="stylesheet" href="(\.\.\/)+styles\/global\.css" \/>/);
	expect(html).toMatch(/<script type="module" src="(\.\.\/)+components\/app-header\.ts"><\/script>/);
	expect(html).toContain("<app-header");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/components/random-picker.test.ts tests/routes/pages.test.ts`
Expected: FAIL — `Cannot find module '#components/random-picker'`, and `index.html loads the global stylesheet and the app header` fails on the missing `app-header` script.

- [ ] **Step 3: Implement `<random-picker>`**

`src/components/random-picker.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { LangController, t } from "#lib/i18n";
import { pickRandom } from "#lib/random";
import { isLink, type Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged } from "#lib/store";
import { uiStyles } from "#styles/ui";

@customElement("random-picker")
export class RandomPicker extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.5rem;
				justify-items: center;
				padding-top: 2rem;
				text-align: center;
			}

			.pick {
				padding: 1.25rem 2rem;
				font-size: 1.5rem;
				font-weight: 700;
				border-radius: 999px;
			}

			.result,
			.empty {
				width: 100%;
				justify-items: center;
			}

			.result h2 {
				font-size: 1.75rem;
			}

			.result .chips {
				justify-content: center;
			}

			.notes {
				white-space: pre-wrap;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private restaurants: Restaurant[] = [];

	@state()
	private picked: Restaurant | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			const pickedId = this.picked?.id;
			this.picked = this.restaurants.find((item) => item.id === pickedId);
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private readonly pick = (): void => {
		this.picked = pickRandom(this.restaurants, this.picked?.id);
	};

	override render() {
		if (this.restaurants.length === 0) {
			return html`
				<div class="card empty">
					<p>${t("picker.empty")}</p>
					<a href="./restaurants">${t("picker.addLink")}</a>
				</div>
			`;
		}
		return html`
			<button type="button" class="primary pick" @click=${this.pick}>
				${this.picked ? t("picker.again") : t("picker.button")}
			</button>
			<div aria-live="polite">${this.picked ? this.renderResult(this.picked) : nothing}</div>
		`;
	}

	private renderResult(item: Restaurant) {
		return html`
			<article class="card result">
				<h2>${item.name}</h2>
				${
					item.tags.length > 0
						? html`<ul class="chips">${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}</ul>`
						: nothing
				}
				${
					item.location
						? html`<p class="location">
								${
									isLink(item.location)
										? html`<a href=${item.location} target="_blank" rel="noopener noreferrer">${item.location}</a>`
										: item.location
								}
							</p>`
						: nothing
				}
				${item.notes ? html`<p class="notes">${item.notes}</p>` : nothing}
			</article>
		`;
	}
}
```

- [ ] **Step 4: Replace the home page and remove `hello-world`**

`src/routes/index.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>What to Eat</title>
		<script type="module" src="../lib/gtm.ts"></script>
		<link rel="stylesheet" href="../styles/global.css" />
		<script type="module" src="../components/app-header.ts"></script>
		<script type="module" src="../components/random-picker.ts"></script>
	</head>
	<body>
		<app-header current="home"></app-header>
		<main>
			<random-picker></random-picker>
		</main>
	</body>
</html>
```

```bash
git rm src/components/hello-world.ts tests/components/hello-world.test.ts
```

`src/types/global.d.ts` top part becomes:

```ts
import type { AppHeader } from "#components/app-header";
import type { RandomPicker } from "#components/random-picker";

declare global {
	interface HTMLElementTagNameMap {
		"app-header": AppHeader;
		"random-picker": RandomPicker;
	}
}
```

(Keep the existing `declare module "bun"` block.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/components/random-picker.test.ts tests/routes/pages.test.ts`
Expected: PASS.

- [ ] **Step 6: Full checks, quick browser look, commit**

```bash
bun run format && bun run check && bun run test && bun run build
```

Run `bun run dev`, open the logged URL, confirm the header and the empty state render styled. Stop the server.

```bash
git add -A && git status
git commit -m "feat(components): add random picker home page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `<restaurant-manager>` and the restaurants page

**Files:**
- Create: `src/components/restaurant-manager.ts`, `src/routes/restaurants.html`
- Modify: `src/types/global.d.ts`
- Test: `tests/components/restaurant-manager.test.ts`

**Interfaces:**
- Consumes: `addRestaurant`, `updateRestaurant`, `removeRestaurant`, `loadRestaurants`, `onRestaurantsChanged` (`#lib/store`); `parseTags`, `isLink`, `type Restaurant`, `type RestaurantInput` (`#lib/restaurant`); `getLang`, `t`, `setLang`, `LangController` (`#lib/i18n`); `uiStyles`.
- Produces: `<restaurant-manager>` (`RestaurantManager`). DOM hooks used by tests: inputs `#name`, `#tags`, `#location`, `#notes`; `form`; `#name-error`; `button[data-action="cancel-edit"]`; list rows `li[data-id]` containing `.name` and buttons `data-action="edit" | "delete" | "confirm-delete" | "cancel-delete"`; `.empty` when no restaurants.

- [ ] **Step 1: Write the failing test**

`tests/components/restaurant-manager.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/restaurant-manager";
import type { RestaurantManager } from "#components/restaurant-manager";
import { setLang } from "#lib/i18n";
import { addRestaurant, loadRestaurants } from "#lib/store";

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("restaurant-manager");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: RestaurantManager, selector: string) => el.shadowRoot!.querySelector<T>(selector);

const type = (el: RestaurantManager, selector: string, value: string): void => {
	const input = $<HTMLInputElement | HTMLTextAreaElement>(el, selector)!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};

const submit = async (el: RestaurantManager): Promise<void> => {
	$<HTMLFormElement>(el, "form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	await el.updateComplete;
};

const rowNames = (el: RestaurantManager) =>
	[...el.shadowRoot!.querySelectorAll("li[data-id] .name")].map((n) => n.textContent);

const click = async (el: RestaurantManager, selector: string): Promise<void> => {
	$<HTMLButtonElement>(el, selector)!.click();
	await el.updateComplete;
};

test("shows the empty message with no restaurants", async () => {
	const el = await mount();
	expect($(el, ".empty")?.textContent?.trim()).toBe("No restaurants yet. Add your first one above.");
});

test("a blank name shows an error and saves nothing", async () => {
	const el = await mount();
	type(el, "#name", "   ");
	await submit(el);
	expect($(el, "#name-error")?.textContent?.trim()).toBe("Name is required.");
	expect($(el, "#name")?.getAttribute("aria-invalid")).toBe("true");
	expect(loadRestaurants()).toEqual([]);
});

test("typing in the name clears the error", async () => {
	const el = await mount();
	await submit(el);
	type(el, "#name", "x");
	await el.updateComplete;
	expect($(el, "#name-error")).toBeNull();
});

test("adds a restaurant with cleaned tags and resets the form", async () => {
	const el = await mount();
	type(el, "#name", " Jay Fai ");
	type(el, "#tags", " thai, ,noodle ,thai,");
	type(el, "#location", "Bangkok");
	type(el, "#notes", "Queue early");
	await submit(el);
	expect(loadRestaurants()).toMatchObject([
		{ name: "Jay Fai", tags: ["thai", "noodle"], location: "Bangkok", notes: "Queue early" },
	]);
	expect(rowNames(el)).toEqual(["Jay Fai"]);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect($<HTMLInputElement>(el, "#tags")?.value).toBe("");
});

test("lists restaurants sorted by name", async () => {
	addRestaurant({ name: "Zab", tags: [], location: "", notes: "" });
	addRestaurant({ name: "Ant", tags: [], location: "", notes: "" });
	const el = await mount();
	expect(rowNames(el)).toEqual(["Ant", "Zab"]);
});

test("a non-http location in the list renders as text", async () => {
	addRestaurant({ name: "Sneaky", tags: [], location: "javascript:alert(1)", notes: "" });
	const el = await mount();
	expect(el.shadowRoot!.querySelector("li[data-id] a")).toBeNull();
	expect($(el, "li[data-id] .location")?.textContent?.trim()).toBe("javascript:alert(1)");
});

test("edit fills the form and save updates the restaurant", async () => {
	addRestaurant({ name: "Old", tags: ["a", "b"], location: "Here", notes: "n" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Old");
	expect($<HTMLInputElement>(el, "#tags")?.value).toBe("a, b");
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Save");
	type(el, "#name", "New");
	await submit(el);
	expect(loadRestaurants()).toMatchObject([{ name: "New", tags: ["a", "b"], location: "Here", notes: "n" }]);
	expect(loadRestaurants()).toHaveLength(1);
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
});

test("cancel edit resets the form without saving", async () => {
	addRestaurant({ name: "Keep", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	type(el, "#name", "Changed");
	await click(el, 'button[data-action="cancel-edit"]');
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect(loadRestaurants()[0]?.name).toBe("Keep");
});

test("delete needs confirmation", async () => {
	addRestaurant({ name: "Bye", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="delete"]');
	expect(loadRestaurants()).toHaveLength(1);
	await click(el, 'button[data-action="cancel-delete"]');
	expect($(el, 'button[data-action="confirm-delete"]')).toBeNull();
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect(loadRestaurants()).toEqual([]);
	expect($(el, ".empty")).not.toBeNull();
});

test("deleting the restaurant being edited resets the form", async () => {
	addRestaurant({ name: "Editing", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
	type(el, "#name", "Fresh");
	await submit(el);
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Fresh"]);
});

test("re-renders labels in Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("เพิ่ม");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: FAIL — `Cannot find module '#components/restaurant-manager'`.

- [ ] **Step 3: Implement**

`src/components/restaurant-manager.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getLang, LangController, t } from "#lib/i18n";
import { isLink, parseTags, type Restaurant } from "#lib/restaurant";
import { addRestaurant, loadRestaurants, onRestaurantsChanged, removeRestaurant, updateRestaurant } from "#lib/store";
import { uiStyles } from "#styles/ui";

type FormState = { name: string; tags: string; location: string; notes: string };

const EMPTY_FORM: FormState = { name: "", tags: "", location: "", notes: "" };

@customElement("restaurant-manager")
export class RestaurantManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.5rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			.list {
				display: grid;
				gap: 0.75rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.name {
				font-size: 1.125rem;
				font-weight: 700;
			}

			.notes {
				white-space: pre-wrap;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private restaurants: Restaurant[] = [];

	@state()
	private form: FormState = EMPTY_FORM;

	@state()
	private editingId: string | undefined;

	@state()
	private confirmingId: string | undefined;

	@state()
	private nameError = false;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			if (this.editingId !== undefined && !this.restaurants.some((item) => item.id === this.editingId)) {
				this.resetForm();
			}
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private resetForm(): void {
		this.form = EMPTY_FORM;
		this.editingId = undefined;
		this.nameError = false;
	}

	private setField(field: keyof FormState, value: string): void {
		this.form = { ...this.form, [field]: value };
		if (field === "name") this.nameError = false;
	}

	private readonly onInput = (event: Event): void => {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		this.setField(target.name as keyof FormState, target.value);
	};

	private readonly submit = (event: Event): void => {
		event.preventDefault();
		if (this.form.name.trim() === "") {
			this.nameError = true;
			return;
		}
		const input = {
			name: this.form.name,
			tags: parseTags(this.form.tags),
			location: this.form.location,
			notes: this.form.notes,
		};
		const editingId = this.editingId;
		this.resetForm();
		if (editingId === undefined) addRestaurant(input);
		else updateRestaurant(editingId, input);
	};

	private startEdit(item: Restaurant): void {
		this.editingId = item.id;
		this.confirmingId = undefined;
		this.nameError = false;
		this.form = { name: item.name, tags: item.tags.join(", "), location: item.location, notes: item.notes };
		void this.updateComplete.then(() => {
			this.renderRoot.querySelector<HTMLInputElement>("#name")?.focus();
		});
	}

	private confirmDelete(id: string): void {
		this.confirmingId = undefined;
		removeRestaurant(id);
	}

	override render() {
		const sorted = [...this.restaurants].sort((a, b) => a.name.localeCompare(b.name, getLang()));
		return html`
			<h1>${t("manager.title")}</h1>
			${this.renderForm()}
			${
				sorted.length === 0
					? html`<p class="muted empty">${t("manager.empty")}</p>`
					: html`<ul class="list">${sorted.map((item) => this.renderRow(item))}</ul>`
			}
		`;
	}

	private renderForm() {
		const editing = this.editingId !== undefined;
		return html`
			<form class="card" novalidate @submit=${this.submit}>
				<label>
					${t("field.name")}
					<input
						id="name"
						name="name"
						autocomplete="off"
						required
						aria-invalid=${this.nameError ? "true" : "false"}
						aria-describedby=${this.nameError ? "name-error" : nothing}
						.value=${this.form.name}
						@input=${this.onInput}
					/>
				</label>
				${this.nameError ? html`<p id="name-error" class="error" role="alert">${t("manager.nameRequired")}</p>` : nothing}
				<label>
					${t("field.tags")}
					<input id="tags" name="tags" autocomplete="off" .value=${this.form.tags} @input=${this.onInput} />
					<span class="hint">${t("field.tagsHint")}</span>
				</label>
				<label>
					${t("field.location")}
					<input id="location" name="location" autocomplete="off" .value=${this.form.location} @input=${this.onInput} />
				</label>
				<label>
					${t("field.notes")}
					<textarea id="notes" name="notes" rows="2" .value=${this.form.notes} @input=${this.onInput}></textarea>
				</label>
				<div class="actions">
					<button type="submit" class="primary">${editing ? t("manager.save") : t("manager.add")}</button>
					${
						editing
							? html`<button type="button" data-action="cancel-edit" @click=${() => this.resetForm()}>
									${t("manager.cancel")}
								</button>`
							: nothing
					}
				</div>
			</form>
		`;
	}

	private renderRow(item: Restaurant) {
		const confirming = this.confirmingId === item.id;
		return html`
			<li class="card" data-id=${item.id}>
				<span class="name">${item.name}</span>
				${
					item.tags.length > 0
						? html`<ul class="chips">${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}</ul>`
						: nothing
				}
				${
					item.location
						? html`<span class="location muted">
								${
									isLink(item.location)
										? html`<a href=${item.location} target="_blank" rel="noopener noreferrer">${item.location}</a>`
										: item.location
								}
							</span>`
						: nothing
				}
				${item.notes ? html`<span class="notes muted">${item.notes}</span>` : nothing}
				<div class="actions">
					${
						confirming
							? html`
									<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(item.id)}>
										${t("manager.confirmDelete")}
									</button>
									<button type="button" data-action="cancel-delete" @click=${() => {
										this.confirmingId = undefined;
									}}>
										${t("manager.cancel")}
									</button>
								`
							: html`
									<button type="button" data-action="edit" @click=${() => this.startEdit(item)}>${t("manager.edit")}</button>
									<button type="button" class="danger" data-action="delete" @click=${() => {
										this.confirmingId = item.id;
									}}>
										${t("manager.delete")}
									</button>
								`
					}
				</div>
			</li>
		`;
	}
}
```

Notes for the implementer:
- `submit` calls `resetForm()` *before* saving, so the store's change callback sees no `editingId` and the form is already clear when the list re-renders.
- The test for "deleting the restaurant being edited" relies on the `onRestaurantsChanged` callback resetting the form.

`src/routes/restaurants.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Restaurants · What to Eat</title>
		<script type="module" src="../lib/gtm.ts"></script>
		<link rel="stylesheet" href="../styles/global.css" />
		<script type="module" src="../components/app-header.ts"></script>
		<script type="module" src="../components/restaurant-manager.ts"></script>
	</head>
	<body>
		<app-header current="restaurants"></app-header>
		<main>
			<restaurant-manager></restaurant-manager>
		</main>
	</body>
</html>
```

`src/types/global.d.ts`: add `import type { RestaurantManager } from "#components/restaurant-manager";` and `"restaurant-manager": RestaurantManager;` to the map.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/components/restaurant-manager.test.ts tests/routes/pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks, preview check, commit**

```bash
bun run format && bun run check && bun run test && bun run build
bun run preview
```

Open `http://127.0.0.1:4000/restaurants` (read the logged port), add a restaurant, confirm the page is styled and the nav link back to Home works. Stop the server.

```bash
git add -A && git status
git commit -m "feat(components): add restaurant manager page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `<data-transfer>` and the settings page

**Files:**
- Create: `src/components/data-transfer.ts`, `src/routes/settings.html`
- Modify: `src/types/global.d.ts`
- Test: `tests/components/data-transfer.test.ts`

**Interfaces:**
- Consumes: `loadRestaurants`, `saveRestaurants`, `onRestaurantsChanged`, `addRestaurant` (`#lib/store`); `toExportFile`, `exportFileName`, `parseImport`, `mergeRestaurants`, `type ImportError` (`#lib/transfer`); `type Restaurant` (`#lib/restaurant`); `t`, `setLang`, `LangController` (`#lib/i18n`); `uiStyles`.
- Produces: `<data-transfer>` with class `DataTransferPanel` (not `DataTransfer`, which would shadow the DOM global). Public method `readImport(text: string): void`. DOM hooks: `.count`, `button[data-action="export"]`, `input[type="file"]`, `[role="alert"]` error, `.found`, `button[data-action="replace" | "merge" | "cancel-import"]`, `.success`.

- [ ] **Step 1: Write the failing test**

`tests/components/data-transfer.test.ts`:

```ts
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/data-transfer";
import type { DataTransferPanel } from "#components/data-transfer";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { addRestaurant, loadRestaurants } from "#lib/store";
import { toExportFile } from "#lib/transfer";

const make = (id: string, name = id): Restaurant => ({
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
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("data-transfer");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = (el: DataTransferPanel, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector);

const click = async (el: DataTransferPanel, selector: string): Promise<void> => {
	$(el, selector)!.click();
	await el.updateComplete;
};

test("shows the saved restaurant count and keeps it current", async () => {
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
	const el = await mount();
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 1");
	addRestaurant({ name: "B", tags: [], location: "", notes: "" });
	await el.updateComplete;
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 2");
});

test("export downloads a json file of the stored list", async () => {
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
	const blobs: Blob[] = [];
	const create = spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
		blobs.push(blob as Blob);
		return "blob:test";
	});
	let downloaded = "";
	const anchorClick = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
		this: HTMLAnchorElement,
	) {
		downloaded = this.download;
	});
	try {
		const el = await mount();
		$(el, 'button[data-action="export"]')!.click();
		expect(downloaded).toMatch(/^whattoeat-\d{4}-\d{2}-\d{2}\.json$/);
		const file = JSON.parse(await blobs[0]!.text());
		expect(file).toMatchObject({ app: "whattoeat", version: 1, restaurants: loadRestaurants() });
	} finally {
		create.mockRestore();
		anchorClick.mockRestore();
	}
});

test("an invalid file shows an error and changes nothing", async () => {
	addRestaurant({ name: "Keep", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport("{oops");
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe("The file is not valid JSON.");
	expect($(el, 'button[data-action="replace"]')).toBeNull();
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Keep"]);
});

test("a file with a bad entry is rejected", async () => {
	const el = await mount();
	el.readImport(JSON.stringify({ app: "whattoeat", version: 1, restaurants: [{ ...make("a"), name: " " }] }));
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe("The file contains invalid restaurant data.");
	expect(loadRestaurants()).toEqual([]);
});

test("replace swaps the whole list", async () => {
	addRestaurant({ name: "Old", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X"), make("y", "Y")])));
	await el.updateComplete;
	expect($(el, ".found")?.textContent?.trim()).toBe("2 restaurants found in the file.");
	await click(el, 'button[data-action="replace"]');
	expect(loadRestaurants()).toEqual([make("x", "X"), make("y", "Y")]);
	expect($(el, ".success")?.textContent?.trim()).toBe("Import complete. 2 restaurants saved.");
	expect($(el, 'button[data-action="replace"]')).toBeNull();
});

test("merge keeps existing restaurants and adds new ones", async () => {
	addRestaurant({ name: "Old", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X")])));
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Old", "X"]);
	expect($(el, ".success")?.textContent?.trim()).toBe("Import complete. 2 restaurants saved.");
});

test("cancel import discards the pending file", async () => {
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x")])));
	await el.updateComplete;
	await click(el, 'button[data-action="cancel-import"]');
	expect($(el, ".found")).toBeNull();
	expect(loadRestaurants()).toEqual([]);
});

test("choosing a file reads and validates it", async () => {
	const el = await mount();
	const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
	const file = new File([JSON.stringify(toExportFile([make("x")]))], "list.json", { type: "application/json" });
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	input.dispatchEvent(new Event("change"));
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
	expect($(el, ".found")?.textContent?.trim()).toBe("1 restaurants found in the file.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components/data-transfer.test.ts`
Expected: FAIL — `Cannot find module '#components/data-transfer'`.

- [ ] **Step 3: Implement**

`src/components/data-transfer.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { LangController, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged, saveRestaurants } from "#lib/store";
import { exportFileName, type ImportError, mergeRestaurants, parseImport, toExportFile } from "#lib/transfer";
import { uiStyles } from "#styles/ui";

@customElement("data-transfer")
export class DataTransferPanel extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.5rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			h2 {
				font-size: 1.125rem;
			}

			input[type="file"] {
				padding: 0.5rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private count = 0;

	@state()
	private pending: Restaurant[] | undefined;

	@state()
	private error: ImportError | undefined;

	@state()
	private imported: number | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.count = loadRestaurants().length;
		this.unsubscribe = onRestaurantsChanged(() => {
			this.count = loadRestaurants().length;
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	/** Validate an export file's text and hold it until the user picks Replace or Merge. */
	readImport(text: string): void {
		const result = parseImport(text);
		this.imported = undefined;
		if (result.ok) {
			this.pending = result.restaurants;
			this.error = undefined;
		} else {
			this.pending = undefined;
			this.error = result.error;
		}
	}

	private readonly onFile = async (event: Event): Promise<void> => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		this.readImport(await file.text());
		// Clear so choosing the same file again fires another change event.
		input.value = "";
	};

	private readonly exportData = (): void => {
		const now = new Date();
		const json = JSON.stringify(toExportFile(loadRestaurants(), now), null, 2);
		const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = exportFileName(now);
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	private apply(mode: "replace" | "merge"): void {
		if (this.pending === undefined) return;
		const list = mode === "replace" ? this.pending : mergeRestaurants(loadRestaurants(), this.pending);
		saveRestaurants(list);
		this.pending = undefined;
		this.imported = list.length;
	}

	override render() {
		return html`
			<h1>${t("settings.title")}</h1>
			<p class="count">${t("settings.count", { count: this.count })}</p>
			<section class="card">
				<h2>${t("settings.exportTitle")}</h2>
				<div class="actions">
					<button type="button" class="primary" data-action="export" @click=${this.exportData}>
						${t("settings.export")}
					</button>
				</div>
			</section>
			<section class="card">
				<h2>${t("settings.importTitle")}</h2>
				<label>
					${t("settings.importFile")}
					<input type="file" accept="application/json,.json" @change=${this.onFile} />
				</label>
				${this.error ? html`<p class="error" role="alert">${t(this.error)}</p>` : nothing}
				${
					this.pending
						? html`
								<p class="found">${t("settings.importFound", { count: this.pending.length })}</p>
								<div class="actions">
									<button type="button" class="danger" data-action="replace" @click=${() => this.apply("replace")}>
										${t("settings.replace")}
									</button>
									<button type="button" class="primary" data-action="merge" @click=${() => this.apply("merge")}>
										${t("settings.merge")}
									</button>
									<button type="button" data-action="cancel-import" @click=${() => {
										this.pending = undefined;
									}}>
										${t("settings.cancel")}
									</button>
								</div>
							`
						: nothing
				}
				${
					this.imported === undefined
						? nothing
						: html`<p class="success" role="status">${t("settings.imported", { count: this.imported })}</p>`
				}
			</section>
		`;
	}
}
```

`src/routes/settings.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Settings · What to Eat</title>
		<script type="module" src="../lib/gtm.ts"></script>
		<link rel="stylesheet" href="../styles/global.css" />
		<script type="module" src="../components/app-header.ts"></script>
		<script type="module" src="../components/data-transfer.ts"></script>
	</head>
	<body>
		<app-header current="settings"></app-header>
		<main>
			<data-transfer></data-transfer>
		</main>
	</body>
</html>
```

`src/types/global.d.ts`: add `import type { DataTransferPanel } from "#components/data-transfer";` and `"data-transfer": DataTransferPanel;` to the map.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/components/data-transfer.test.ts tests/routes/pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks, preview round trip, commit**

```bash
bun run format && bun run check && bun run test && bun run build
bun run preview
```

In the browser: add two restaurants on `/restaurants`, export on `/settings`, delete one, import the file with Merge, confirm both are back; switch to TH and confirm every page's text changes. Stop the server.

```bash
git add -A && git status
git commit -m "feat(components): add settings page with json import and export

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: README, push, pull request, preview URL

**Files:**
- Modify: `README.md` (title and a short "What it does" section at the top; keep the template sections below)

- [ ] **Step 1: Update README**

Replace the first heading and intro paragraph with:

```markdown
# What to Eat

Can't decide where to eat? Add the restaurants you like, press one button, and get a random
pick. The list lives in your browser (`localStorage`); move it between devices with JSON
export and import on the Settings page. The interface is available in English and Thai.

| Page           | What it does                                   |
| -------------- | ---------------------------------------------- |
| `/`            | Random pick, never the same one twice in a row |
| `/restaurants` | Add, edit and delete restaurants               |
| `/settings`    | Export to JSON, import with replace or merge   |

Built from [bun-lit-template](https://github.com/kamontat/bun-lit-template).
```

Remove the README's "Writing components" mention of `hello-world` if present (`grep -n hello README.md`), pointing to `app-header` instead.

- [ ] **Step 2: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A && git status
git commit -m "docs: describe the what to eat app in readme

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "feat: random restaurant picker with en/th and json import/export" --body "## Summary
- Home page picks a random restaurant (never the same twice in a row)
- Restaurants page to add, edit and delete restaurants (name, tags, location, notes)
- Settings page exports the list to JSON and imports it with replace or merge
- English and Thai UI with a header toggle, remembered per browser
- Data stored in localStorage; no backend

## Test plan
- [x] bun run check
- [x] bun run test
- [x] bun run build
- [ ] Preview: pages are styled and readable on a phone-width screen
- [ ] Preview: add, pick, edit, delete work
- [ ] Preview: export, then import with Merge and with Replace
- [ ] Preview: EN/TH toggle changes all pages and persists after reload

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: Wait for the preview deploy and report**

```bash
gh pr checks <number> --watch
```

Read `environment.url` in `.github/workflows/deploy-preview.yml`, fill in the PR number, and report the PR link and preview URL only after the `deploy` check passes. If it contains `<TODO>`, tell the user the template was never customized (see `GET_START.md`).
