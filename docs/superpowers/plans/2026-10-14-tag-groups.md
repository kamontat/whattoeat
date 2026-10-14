# Tag Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn type, cuisine, area and tags into one group model. Cuisine and area take
several values, people can add their own filterable groups, and a new Tags page manages groups
and values.

**Architecture:** Restaurants keep `kinds` and `tags` and gain a `groups` map keyed by group
id (`cuisine`, `area`, custom ids). Custom group definitions live in their own localStorage
key (`whattoeat:groups`) and in export version 4. Every operation is a pure function in
`src/lib/` with its own tests. Components only load, call and save.

**Tech Stack:** Bun 1.x, TypeScript, Lit 3, happy-dom tests via `bun test`, Biome.

**Spec:** `docs/superpowers/specs/2026-10-14-tag-groups-design.md`

## Global Constraints

- Work happens in the worktree `.claude/worktrees/tag-groups` on branch `worktree-tag-groups`
  (see the `shipping-a-change` skill). Never edit `main`.
- Test first: write the failing test, run `bun test <file>`, watch it fail, then implement.
- Before every commit: `bun run format && bun run check && bun run test && bun run build`.
  All must pass. `format` rewrites files; `git add -A` after it.
- Commits: conventional, lower case, scoped (`feat(lib): ...`, `feat(components): ...`), with
  the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md` (that happens when landing).
- Imports go through `#lib/*`, `#components/*`, `#styles/*`. New components are registered
  in `src/types/global.d.ts`.
- `src/lib/restaurant.ts` must never import `src/lib/groups.ts` (no cycles):
  `groups.ts` → `restaurant.ts`, `i18n.ts`; `store.ts` → `groups.ts`, `restaurant.ts`.
- Values are cleaned with `normalizeTag` (NFC, trim, single spaces, lowercase) and
  de-duplicated in first-seen order.
- Group ids: built-ins `kind`, `cuisine`, `area`; plain tags use the pseudo id `tags`. These four
  are reserved; a custom id is never one of them.
- Every user-visible string has an `en` and a `th` entry in `src/lib/i18n.ts`
  (`tests/lib/i18n.test.ts` enforces matching keys).
- No browser dialogs (`confirm`, `alert`); confirmations are inline buttons.
- Use `Object.hasOwn` and `Object.fromEntries` for `groups` maps, never `obj[id] ?? ...` on
  their own, so an id like `constructor` cannot read a prototype member.
- Stage 1 (Tasks 1–8) is its own pull request; stage 2 (Tasks 9–14) is a second one on the
  same branch after stage 1 lands, or a follow-up branch from the updated `main`.

## Review Focus

1. A restaurant form open while another tab renames a custom group: the input's label should
   update and values already typed into it should stay. Test in Task 6.
2. A restaurant form open while another tab deletes a custom group: saving should move that
   group's values into plain tags, not keep values under an id with no definition. Test in
   Task 3.
3. An imported file whose custom group is called "Cuisine" or "สัญชาติอาหาร" should merge into the
   built-in Cuisine group, not create a second group with the same label. Test in Task 5.
4. The home page open in another tab while a value is renamed on the Tags page: the home filter
   should keep the renamed value selected, not drop it as unused. Test in Task 13.
5. Renaming a value to blank text, to text with a comma, or to a value the same restaurant
   already has: refused with a message for blank or comma, and one copy kept for a duplicate.
   Tests in Tasks 9 and 12.

---

# Stage 1 — data model

### Task 1: Restaurant model with a `groups` map

**Files:**
- Modify: `src/lib/restaurant.ts`
- Test: `tests/lib/restaurant.test.ts`
- Modify fixtures (mechanical, `area: ""` / `cuisine: ""` → `groups: {}`):
  `tests/lib/filter.test.ts`, `tests/lib/transfer.test.ts`, `tests/lib/history.test.ts`,
  `tests/lib/random.test.ts`, `tests/components/visit-history.test.ts`,
  `tests/components/data-transfer.test.ts`

**Interfaces:**
- Produces:
  - `BUILT_IN_GROUPS: readonly ["kind", "cuisine", "area"]`, `type BuiltInGroup`
  - `VALUE_GROUPS: readonly ["cuisine", "area"]`
  - `RESERVED_GROUP_IDS: readonly string[]` (`kind`, `cuisine`, `area`, `tags`)
  - `type GroupValues = Record<string, string[]>`
  - `Restaurant` with `groups: GroupValues` and no `area` / `cuisine`
  - `StoredRestaurant` (old or new shape), `RestaurantInput` with `groups?`
  - `normalizeInput(input, customIds?: readonly string[]): CleanInput`
  - `cleanStored(item, customIds?: readonly string[]): Restaurant`
  - `groupValues(item, group: string): string[]`
  - `valuesByUsage(list, group: string): string[]`
  - `metaLine(item)` joining several values with `, `
  - Removed: `GROUPS`, `Group`, `ValueGroup`

- [ ] **Step 1: Write the failing tests**

In `tests/lib/restaurant.test.ts`, change the `valid` fixture to the new shape and replace the
tests that mention `area` / `cuisine` (`normalizeInput cleans area and cuisine…`,
`isRestaurant accepts an older restaurant…`, `cleanStored fills missing…`,
`valuesByUsage lists one group's values…`, and the `area: ""`/`cuisine: ""` lines in
`normalizeInput trims every field…`) with these:

```ts
const valid: Restaurant = {
	id: "a1",
	name: "Som Tam Nua",
	tags: ["thai", "spicy"],
	location: "Siam Square",
	notes: "",
	groups: { area: ["siam"], cuisine: ["thai"] },
	kinds: ["food"],
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
};

test("normalizeInput trims every field and cleans tags", () => {
	expect(
		normalizeInput({
			name: "  Jay Fai ",
			tags: [" street ", "", "street"],
			location: " Bangkok ",
			notes: " ok ",
		}),
	).toEqual({
		name: "Jay Fai",
		tags: ["street"],
		location: "Bangkok",
		notes: "ok",
		groups: {},
		kinds: [],
	});
});

test("normalizeInput cleans group values like tags, drops empty groups and keeps known kinds in order", () => {
	expect(
		normalizeInput({
			name: "Cafe",
			tags: [],
			location: "",
			notes: "",
			groups: {
				area: ["  Old   Town ", "old town"],
				cuisine: [" JAPANESE ", "Thai"],
				g1: ["  "],
			},
			kinds: ["dessert", "pizza", "drinks", "dessert"],
		}, ["g1"]),
	).toMatchObject({
		groups: { area: ["old town"], cuisine: ["japanese", "thai"] },
		kinds: ["drinks", "dessert"],
	});
});

test("normalizeInput moves values of unknown groups into tags", () => {
	expect(
		normalizeInput({
			name: "Cafe",
			tags: ["spicy"],
			location: "",
			notes: "",
			groups: { gone: ["Cheap"], kind: ["food"], g1: ["cosy"] },
		}, ["g1"]),
	).toMatchObject({ tags: ["spicy", "cheap", "food"], groups: { g1: ["cosy"] } });
});

test("isRestaurant accepts the old shape with area and cuisine strings and no kinds", () => {
	const { groups: _g, kinds: _k, ...rest } = valid;
	expect(isRestaurant({ ...rest, area: "siam", cuisine: "thai" })).toBe(true);
	expect(isRestaurant(rest)).toBe(true);
});

test.each([
	["groups is an array", []],
	["groups is null", null],
	["a group is not an array", { cuisine: "thai" }],
	["a group holds a number", { cuisine: [1] }],
])("isRestaurant rejects a restaurant whose %s", (_label, groups) => {
	expect(isRestaurant({ ...valid, groups })).toBe(false);
});

test("cleanStored moves old area and cuisine strings into groups", () => {
	const { groups: _g, kinds: _k, ...rest } = valid;
	expect(
		cleanStored({ ...rest, tags: ["Thai", "THAI"], area: " Ari ", cuisine: "" }),
	).toEqual({ ...valid, tags: ["thai"], groups: { area: ["ari"] }, kinds: [] });
});

test("cleanStored keeps known custom groups and moves unknown ones into tags", () => {
	expect(
		cleanStored({ ...valid, groups: { ...valid.groups, g1: ["cheap"], gone: ["cosy"] } }, ["g1"]),
	).toEqual({
		...valid,
		tags: ["thai", "spicy", "cosy"],
		groups: { ...valid.groups, g1: ["cheap"] },
	});
});

test("cleanStored keeps only known fields and trims text", () => {
	expect(
		cleanStored({ ...valid, name: " Som ", extra: 1 } as StoredRestaurant),
	).toEqual({ ...valid, name: "Som" });
});

test("groupValues reads kinds, tags and any group, and never a prototype member", () => {
	expect(groupValues(valid, "kind")).toEqual(["food"]);
	expect(groupValues(valid, "tags")).toEqual(["thai", "spicy"]);
	expect(groupValues(valid, "cuisine")).toEqual(["thai"]);
	expect(groupValues(valid, "g1")).toEqual([]);
	expect(groupValues(valid, "constructor")).toEqual([]);
});

test("valuesByUsage lists one group's values, most used first, kinds in their fixed order", () => {
	const list = [
		{ ...valid, id: "1", groups: { area: ["ari"] }, kinds: ["dessert"] },
		{ ...valid, id: "2", groups: { area: ["siam"], cuisine: ["thai", "japanese"] }, kinds: ["drinks", "dessert"] },
		{ ...valid, id: "3", groups: { area: ["siam"], cuisine: ["japanese"] }, kinds: [] },
	] satisfies Restaurant[];
	expect(valuesByUsage(list, "area")).toEqual(["siam", "ari"]);
	expect(valuesByUsage(list, "cuisine")).toEqual(["japanese", "thai"]);
	expect(valuesByUsage(list, "kind")).toEqual(["drinks", "dessert"]);
	expect(valuesByUsage(list, "tags")).toEqual(["spicy", "thai"]);
});

test("metaLine joins several cuisines and areas with commas", () => {
	expect(
		metaLine({ ...valid, kinds: ["food", "drinks"], groups: { cuisine: ["thai", "japanese"], area: ["siam"] } }),
	).toBe("Food, Drinks · thai, japanese · siam");
	expect(metaLine({ ...valid, kinds: [], groups: {} })).toBe("");
});
```

Add `groupValues`, `metaLine` and `type StoredRestaurant` to the import list. `metaLine` reads
translations, so add `import { setLang } from "#lib/i18n";` and call `setLang("en")` at the top
of the metaLine test.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/restaurant.test.ts`
Expected: FAIL (`groups` is missing from cleaned restaurants, `groupValues` is not exported).

- [ ] **Step 3: Implement**

In `src/lib/restaurant.ts`, replace the types and helpers from `export type Restaurant` down to
`cleanStored`, plus `isRestaurant`, `groupValues`, `valuesByUsage` and `metaLine`:

```ts
/** Groups every restaurant has, in display order. Type's values are `KINDS`; the rest are free text. */
export const BUILT_IN_GROUPS = ["kind", "cuisine", "area"] as const;
export type BuiltInGroup = (typeof BUILT_IN_GROUPS)[number];
/** Built-in groups whose values live in `Restaurant.groups`. */
export const VALUE_GROUPS = ["cuisine", "area"] as const;
/** Ids a custom group may never take; `tags` stands for plain tags. */
export const RESERVED_GROUP_IDS: readonly string[] = [...BUILT_IN_GROUPS, "tags"];

/** Values by group id: "cuisine", "area" or a custom group's id. A key exists only when it has values. */
export type GroupValues = Record<string, string[]>;

export type Restaurant = {
	id: string;
	name: string;
	location: string;
	notes: string;
	kinds: Kind[];
	/** Plain tags: shown, not filtered. */
	tags: string[];
	groups: GroupValues;
	createdAt: string;
	updatedAt: string;
};

/**
 * A restaurant as stored or imported: the old shape with `area` and `cuisine` strings, the new
 * shape with `groups`, or a mix. Kinds may be missing or unknown.
 */
export type StoredRestaurant = Omit<Restaurant, "kinds" | "groups"> & {
	area?: string;
	cuisine?: string;
	kinds?: string[];
	groups?: Record<string, string[]>;
};

export type RestaurantInput = {
	name: string;
	tags: readonly string[];
	location: string;
	notes: string;
	kinds?: readonly string[];
	groups?: Readonly<Record<string, readonly string[]>>;
};

export type CleanInput = Omit<Restaurant, "id" | "createdAt" | "updatedAt">;
```

Keep `normalizeTag`, `parseTags`, `isKind`, `cleanKinds` as they are. Then:

```ts
/**
 * Keep the groups in `VALUE_GROUPS` and `customIds`, cleaned like tags and without empty ones;
 * values of any other id become plain tags so nothing is lost.
 */
const cleanGroups = (
	groups: Readonly<Record<string, readonly string[]>>,
	tags: readonly string[],
	customIds: readonly string[],
): Pick<Restaurant, "groups" | "tags"> => {
	const known = new Set<string>([...VALUE_GROUPS, ...customIds]);
	const kept: [string, string[]][] = [];
	const orphans: string[] = [];
	for (const [id, values] of Object.entries(groups)) {
		if (!known.has(id)) {
			orphans.push(...values);
			continue;
		}
		const clean = parseTags(values.join(","));
		if (clean.length > 0) kept.push([id, clean]);
	}
	return {
		groups: Object.fromEntries(kept),
		tags: parseTags([...tags, ...orphans].join(",")),
	};
};

/** `customIds` are the ids of the custom groups that exist; values under any other id become tags. */
export const normalizeInput = (
	input: RestaurantInput,
	customIds: readonly string[] = [],
): CleanInput => ({
	name: input.name.trim(),
	location: input.location.trim(),
	notes: input.notes.trim(),
	kinds: cleanKinds(input.kinds),
	...cleanGroups(input.groups ?? {}, input.tags, customIds),
});

/**
 * A stored or imported restaurant in canonical form: old `area` and `cuisine` strings join their
 * group, values of unknown groups become tags, and only known fields are kept.
 */
export const cleanStored = (
	item: StoredRestaurant,
	customIds: readonly string[] = [],
): Restaurant => {
	const groups: Record<string, readonly string[]> = { ...item.groups };
	for (const id of VALUE_GROUPS) {
		const old = item[id];
		const current = item.groups && Object.hasOwn(item.groups, id) ? item.groups[id] : undefined;
		if (old) groups[id] = [old, ...(current ?? [])];
	}
	return {
		id: item.id,
		...normalizeInput(
			{
				name: item.name,
				location: item.location,
				notes: item.notes,
				tags: item.tags,
				kinds: item.kinds,
				groups,
			},
			customIds,
		),
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	};
};
```

`isRestaurant`: widen the record type and check `groups`:

```ts
const isGroupValues = (value: unknown): boolean =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every(
		(list) => Array.isArray(list) && list.every(isString),
	);

/** Accepts the old shape (area and cuisine strings) and the new one (a groups map). */
export const isRestaurant = (value: unknown): value is StoredRestaurant => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<
		Record<keyof Restaurant | "area" | "cuisine", unknown>
	>;
	// ...existing checks unchanged...
	// add:
	//	(item.groups === undefined || isGroupValues(item.groups)) &&
};
```

```ts
/** The values a restaurant has in one group; `kind` is its kinds and `tags` its plain tags. */
export const groupValues = (item: Restaurant, group: string): string[] => {
	if (group === "kind") return item.kinds;
	if (group === "tags") return item.tags;
	return Object.hasOwn(item.groups, group) ? (item.groups[group] ?? []) : [];
};
```

`valuesByUsage(list, group: string)`: same body as today with the parameter type changed.

```ts
/** "Drinks, Dessert · thai, japanese · ari": kinds in the current language, then cuisines and areas. */
export const metaLine = (item: Restaurant): string =>
	[
		item.kinds.map((kind) => t(`kind.${kind}`)).join(", "),
		groupValues(item, "cuisine").join(", "),
		groupValues(item, "area").join(", "),
	]
		.filter((part) => part !== "")
		.join(" · ");
```

Delete `GROUPS`, `Group` and `ValueGroup`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/restaurant.test.ts`
Expected: PASS.

- [ ] **Step 5: Update fixtures in other test files**

In each fixture file listed above, replace `area: "",` and `cuisine: "",` on a `Restaurant`
object with one `groups: {},` line. Where a fixture sets a value (`area: "siam"`), write
`groups: { area: ["siam"] }`. Do not change test logic yet; callers that break at type level
(`filter.ts`, components, `store.ts`, `transfer.ts`) are fixed in Tasks 3–7, so `bun run check`
is expected to fail until Task 7. Run only `bun test tests/lib/restaurant.test.ts` and
`bun run format` here.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lib): restaurants keep cuisine, area and custom values in a groups map"
```

(Stage 1 is one PR; intermediate commits may fail `bun run check` until Task 7. The full check
list runs before pushing in Task 8.)

---

### Task 2: Group definitions (`src/lib/groups.ts`)

**Files:**
- Create: `src/lib/groups.ts`
- Test: `tests/lib/groups.test.ts`

**Interfaces:**
- Consumes: `BUILT_IN_GROUPS`, `RESERVED_GROUP_IDS`, `groupValues`, `isKind`, `nameKey`,
  `newId`, `parseTags`, `Restaurant` from `#lib/restaurant`; `en`, `th`, `t` from `#lib/i18n`.
- Produces:
  - `type GroupDef = { id: string; name: string }`
  - `GROUPS_KEY = "whattoeat:groups"`, `GROUPS_EVENT = "whattoeat:groups-changed"`
  - `isGroupDef(value): value is GroupDef`
  - `loadGroups(): GroupDef[]`, `saveGroups(list): boolean`, `onGroupsChanged(cb): () => void`,
    `isGroupsMemoryOnly(): boolean`, `forgetGroupsMemory(): void`
  - `customGroupIds(defs): string[]`, `allGroupIds(defs): string[]`
  - `groupLabel(id, defs): string`, `valueLabel(group, value): string`
  - `builtInGroupNamed(name): "kind" | "cuisine" | "area" | "tags" | undefined`
  - `isGroupNameTaken(defs, name, exceptId?): boolean`
  - `customChips(item, defs): string[]`
  - `type GroupMerge = { groups: GroupDef[]; remap: Record<string, string> }`
  - `mergeGroupDefs(existing, incoming): GroupMerge`
  - `remapGroups(list, remap): Restaurant[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	allGroupIds,
	builtInGroupNamed,
	customChips,
	customGroupIds,
	GROUPS_EVENT,
	GROUPS_KEY,
	groupLabel,
	isGroupDef,
	isGroupNameTaken,
	isGroupsMemoryOnly,
	loadGroups,
	mergeGroupDefs,
	onGroupsChanged,
	remapGroups,
	saveGroups,
	valueLabel,
} from "#lib/groups";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

const make = (id: string, groups: Restaurant["groups"] = {}): Restaurant => ({
	id,
	name: id,
	tags: [],
	location: "",
	notes: "",
	groups,
	kinds: [],
	createdAt: "2026-10-14T00:00:00.000Z",
	updatedAt: "2026-10-14T00:00:00.000Z",
});

const price = { id: "g1", name: "Price" };
const vibe = { id: "g2", name: "Vibe" };

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});
afterEach(() => localStorage.clear());

test("loadGroups gives [] when nothing or junk is stored", () => {
	expect(loadGroups()).toEqual([]);
	localStorage.setItem(GROUPS_KEY, "{");
	expect(loadGroups()).toEqual([]);
	localStorage.setItem(GROUPS_KEY, "{}");
	expect(loadGroups()).toEqual([]);
});

test("loadGroups skips invalid entries and repeated ids, and trims names", () => {
	localStorage.setItem(
		GROUPS_KEY,
		JSON.stringify([
			{ id: "g1", name: " Price " },
			{ id: "g1", name: "Again" },
			{ id: "cuisine", name: "Mine" },
			{ id: "", name: "Blank id" },
			{ id: "g3", name: "  " },
			"junk",
		]),
	);
	expect(loadGroups()).toEqual([price]);
});

test("isGroupDef rejects reserved ids", () => {
	for (const id of ["kind", "cuisine", "area", "tags"])
		expect(isGroupDef({ id, name: "X" })).toBe(false);
	expect(isGroupDef(price)).toBe(true);
});

test("saveGroups round-trips, notifies, and falls back to memory when storage refuses", () => {
	const seen: string[] = [];
	const stop = onGroupsChanged(() => seen.push("x"));
	expect(saveGroups([price])).toBe(true);
	expect(loadGroups()).toEqual([price]);
	const spy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("full");
	});
	expect(saveGroups([price, vibe])).toBe(false);
	expect(isGroupsMemoryOnly()).toBe(true);
	expect(loadGroups()).toEqual([price, vibe]);
	spy.mockRestore();
	saveGroups([]);
	stop();
	saveGroups([price]);
	expect(seen).toEqual(["x", "x", "x"]);
});

test("a storage event for the groups key notifies, other keys do not", () => {
	let count = 0;
	const stop = onGroupsChanged(() => count++);
	window.dispatchEvent(new StorageEvent("storage", { key: GROUPS_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
	window.dispatchEvent(new StorageEvent("storage", { key: null }));
	stop();
	expect(count).toBe(2);
	expect(GROUPS_EVENT).toBe("whattoeat:groups-changed");
});

test("allGroupIds lists built-ins first, then custom groups in stored order", () => {
	expect(allGroupIds([vibe, price])).toEqual(["kind", "cuisine", "area", "g2", "g1"]);
	expect(customGroupIds([vibe, price])).toEqual(["g2", "g1"]);
});

test("groupLabel translates built-ins and tags, and uses the stored name otherwise", () => {
	expect(groupLabel("cuisine", [price])).toBe("Cuisine");
	expect(groupLabel("tags", [price])).toBe("Tags");
	expect(groupLabel("g1", [price])).toBe("Price");
	setLang("th");
	expect(groupLabel("area", [price])).toBe("ย่าน");
});

test("valueLabel translates kinds only", () => {
	expect(valueLabel("kind", "drinks")).toBe("Drinks");
	expect(valueLabel("cuisine", "drinks")).toBe("drinks");
});

test("builtInGroupNamed matches the labels of both languages, ignoring case and spaces", () => {
	expect(builtInGroupNamed(" cuisine ")).toBe("cuisine");
	expect(builtInGroupNamed("สัญชาติอาหาร")).toBe("cuisine");
	expect(builtInGroupNamed("TYPE")).toBe("kind");
	expect(builtInGroupNamed("แท็ก")).toBe("tags");
	expect(builtInGroupNamed("Price")).toBeUndefined();
});

test("isGroupNameTaken checks custom names and built-in labels, and lets a group keep its name", () => {
	expect(isGroupNameTaken([price], "price")).toBe(true);
	expect(isGroupNameTaken([price], "Price", "g1")).toBe(false);
	expect(isGroupNameTaken([price], "Area")).toBe(true);
	expect(isGroupNameTaken([price], "ย่าน")).toBe(true);
	expect(isGroupNameTaken([price], "Vibe")).toBe(false);
});

test("customChips labels each custom value with its group, in group order", () => {
	expect(
		customChips(make("a", { cuisine: ["thai"], g1: ["cheap"], g2: ["cosy", "quiet"] }), [vibe, price]),
	).toEqual(["Vibe: cosy", "Vibe: quiet", "Price: cheap"]);
});

test("mergeGroupDefs appends new groups in file order", () => {
	expect(mergeGroupDefs([price], [vibe])).toEqual({ groups: [price, vibe], remap: {} });
});

test("mergeGroupDefs renames by id unless the new name is taken", () => {
	expect(mergeGroupDefs([price, vibe], [{ id: "g1", name: "Cost" }]).groups).toEqual([
		{ id: "g1", name: "Cost" },
		vibe,
	]);
	expect(mergeGroupDefs([price, vibe], [{ id: "g1", name: "vibe" }]).groups).toEqual([price, vibe]);
});

test("mergeGroupDefs merges a new id into a custom group with the same name", () => {
	expect(mergeGroupDefs([price], [{ id: "x9", name: " PRICE " }])).toEqual({
		groups: [price],
		remap: { x9: "g1" },
	});
});

test("mergeGroupDefs merges a group named like Cuisine or Area into the built-in", () => {
	expect(
		mergeGroupDefs([], [
			{ id: "x1", name: "Cuisine" },
			{ id: "x2", name: "ย่าน" },
		]),
	).toEqual({ groups: [], remap: { x1: "cuisine", x2: "area" } });
});

test("mergeGroupDefs keeps a group named like Type or Tags under a free suffixed name", () => {
	expect(
		mergeGroupDefs([{ id: "g1", name: "Type - 1" }], [
			{ id: "x1", name: "Type" },
			{ id: "x2", name: "tags" },
		]).groups,
	).toEqual([
		{ id: "g1", name: "Type - 1" },
		{ id: "x1", name: "Type - 2" },
		{ id: "x2", name: "tags - 1" },
	]);
});

test("mergeGroupDefs merges a file's own repeated names", () => {
	expect(mergeGroupDefs([], [price, { id: "x1", name: "price" }])).toEqual({
		groups: [price],
		remap: { x1: "g1" },
	});
});

test("remapGroups moves values to the new id and keeps one copy of each", () => {
	expect(
		remapGroups([make("a", { x1: ["cheap", "fast"], g1: ["cheap"], area: ["siam"] })], { x1: "g1" }),
	).toEqual([make("a", { g1: ["cheap", "fast"], area: ["siam"] })]);
});
```

Note on the expected `remapGroups` output: values are gathered per target id in the order the
source keys appear; `x1` comes first, so `g1` is `["cheap", "fast"]`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/groups.test.ts`
Expected: FAIL (`Cannot find module '#lib/groups'`).

- [ ] **Step 3: Implement `src/lib/groups.ts`**

```ts
import { en, t, th } from "#lib/i18n";
import {
	BUILT_IN_GROUPS,
	groupValues,
	isKind,
	nameKey,
	parseTags,
	RESERVED_GROUP_IDS,
	type Restaurant,
} from "#lib/restaurant";

/** A group people made themselves, like "price". Built-in groups are never stored. */
export type GroupDef = { id: string; name: string };

export const GROUPS_KEY = "whattoeat:groups";
export const GROUPS_EVENT = "whattoeat:groups-changed";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: GroupDef[] | undefined;

export const isGroupDef = (value: unknown): value is GroupDef => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof GroupDef, unknown>>;
	return (
		typeof item.id === "string" &&
		item.id !== "" &&
		!RESERVED_GROUP_IDS.includes(item.id) &&
		typeof item.name === "string" &&
		item.name.trim() !== ""
	);
};

/** Unreadable entries and repeated ids are skipped; names are trimmed. */
export const loadGroups = (): GroupDef[] => {
	if (memory !== undefined) return memory;
	let data: unknown;
	try {
		data = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "[]");
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	const seen = new Set<string>();
	const list: GroupDef[] = [];
	for (const item of data) {
		if (!isGroupDef(item) || seen.has(item.id)) continue;
		seen.add(item.id);
		list.push({ id: item.id, name: item.name.trim() });
	}
	return list;
};

export const isGroupsMemoryOnly = (): boolean => memory !== undefined;

/** Drop the in-memory fallback; `resetStorage` calls this when it wipes everything. */
export const forgetGroupsMemory = (): void => {
	memory = undefined;
};

/** Returns `false` when localStorage refused the write and the list is only kept in memory. */
export const saveGroups = (list: GroupDef[]): boolean => {
	try {
		localStorage.setItem(GROUPS_KEY, JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(GROUPS_EVENT));
	return memory === undefined;
};

/** Call `callback` after every save here and every change from another tab. Returns an unsubscribe function. */
export const onGroupsChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === GROUPS_KEY || event.key === null) callback();
	};
	window.addEventListener(GROUPS_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(GROUPS_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};

export const customGroupIds = (defs: readonly GroupDef[]): string[] =>
	defs.map((def) => def.id);

/** Every filterable group in display order: Type, Cuisine, Area, then custom groups. */
export const allGroupIds = (defs: readonly GroupDef[]): string[] => [
	...BUILT_IN_GROUPS,
	...customGroupIds(defs),
];

const LABELLED = [...BUILT_IN_GROUPS, "tags"] as const;
type Labelled = (typeof LABELLED)[number];

const isLabelled = (id: string): id is Labelled =>
	(LABELLED as readonly string[]).includes(id);

export const groupLabel = (id: string, defs: readonly GroupDef[]): string =>
	isLabelled(id)
		? t(`group.${id}`)
		: (defs.find((def) => def.id === id)?.name ?? id);

/** Kinds show in the current language; other values show as typed. */
export const valueLabel = (group: string, value: string): string =>
	group === "kind" && isKind(value) ? t(`kind.${value}`) : value;

/** The built-in group (or plain tags) a name stands for in either language. */
export const builtInGroupNamed = (name: string): Labelled | undefined =>
	LABELLED.find((id) =>
		[en, th].some((dict) => nameKey(dict[`group.${id}`]) === nameKey(name)),
	);

/** A name is taken by a built-in label in either language or by another custom group, ignoring case. */
export const isGroupNameTaken = (
	defs: readonly GroupDef[],
	name: string,
	exceptId?: string,
): boolean =>
	builtInGroupNamed(name) !== undefined ||
	defs.some((def) => def.id !== exceptId && nameKey(def.name) === nameKey(name));

/** "Price: cheap" for every custom group value, groups in their stored order. */
export const customChips = (
	item: Restaurant,
	defs: readonly GroupDef[],
): string[] =>
	defs.flatMap((def) =>
		groupValues(item, def.id).map((value) => `${def.name}: ${value}`),
	);

export type GroupMerge = {
	groups: GroupDef[];
	/** Incoming ids that were folded into another group, and the id they now use. */
	remap: Record<string, string>;
};

const freeName = (defs: readonly GroupDef[], name: string): string => {
	let count = 1;
	while (isGroupNameTaken(defs, `${name} - ${count}`)) count++;
	return `${name} - ${count}`;
};

/** Fold `incoming` group definitions into `existing`; see the spec's "Export and import" rules. */
export const mergeGroupDefs = (
	existing: readonly GroupDef[],
	incoming: readonly GroupDef[],
): GroupMerge => {
	const groups = existing.map((def) => ({ ...def }));
	const remap: Record<string, string> = {};
	for (const def of incoming) {
		const name = def.name.trim();
		const same = groups.find((item) => item.id === def.id);
		if (same !== undefined) {
			if (!isGroupNameTaken(groups, name, def.id)) same.name = name;
			continue;
		}
		const builtIn = builtInGroupNamed(name);
		if (builtIn === "cuisine" || builtIn === "area") {
			remap[def.id] = builtIn;
			continue;
		}
		const match = groups.find((item) => nameKey(item.name) === nameKey(name));
		if (match !== undefined) {
			remap[def.id] = match.id;
			continue;
		}
		groups.push({
			id: def.id,
			name: builtIn === undefined ? name : freeName(groups, name),
		});
	}
	return { groups, remap };
};

/** Rewrite group ids by `remap`; values that meet in one group keep one copy. */
export const remapGroups = (
	list: readonly Restaurant[],
	remap: Readonly<Record<string, string>>,
): Restaurant[] =>
	list.map((item) => {
		const merged = new Map<string, string[]>();
		for (const [id, values] of Object.entries(item.groups)) {
			const target = Object.hasOwn(remap, id) ? (remap[id] ?? id) : id;
			merged.set(target, [...(merged.get(target) ?? []), ...values]);
		}
		return {
			...item,
			groups: Object.fromEntries(
				[...merged].map(([id, values]) => [id, parseTags(values.join(","))]),
			),
		};
	});
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "feat(lib): custom group definitions with labels, name rules and import merging"
```

---

### Task 3: Store knows custom group ids

**Files:**
- Modify: `src/lib/store.ts`
- Test: `tests/lib/store.test.ts`

**Interfaces:**
- Consumes: `loadGroups`, `customGroupIds`, `forgetGroupsMemory` (Task 2); `cleanStored`,
  `normalizeInput` with `customIds` (Task 1).
- Produces: `loadRestaurants()` cleans with stored custom ids; `addRestaurant` and
  `updateRestaurant` accept `groups` in `RestaurantInput`; `resetStorage()` also forgets
  groups held in memory.

- [ ] **Step 1: Write the failing tests**

Replace the test `restaurants stored before area, cuisine and kinds load with them empty` and
add the others:

```ts
import { GROUPS_KEY, loadGroups, saveGroups } from "#lib/groups";

test("restaurants stored before groups load with old area and cuisine moved into groups", () => {
	const old = {
		id: "a1",
		name: "Old",
		tags: ["thai"],
		location: "",
		notes: "",
		area: "Siam",
		cuisine: "",
		createdAt: "2026-10-12T00:00:00.000Z",
		updatedAt: "2026-10-12T00:00:00.000Z",
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify([old]));
	const { area: _a, cuisine: _c, ...rest } = old;
	expect(loadRestaurants()).toEqual([
		{ ...rest, groups: { area: ["siam"] }, kinds: [] },
	]);
	expect(skippedCount()).toBe(0);
});

test("values of a stored custom group load, values of a missing group load as tags", () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const [item] = addRestaurant({ ...input, tags: [] });
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify([{ ...item, groups: { g1: ["cheap"], gone: ["cosy"] } }]),
	);
	expect(loadRestaurants()[0]).toMatchObject({
		groups: { g1: ["cheap"] },
		tags: ["street", "cosy"],
	});
});

test("saving values for a group deleted meanwhile keeps them as tags", () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const formGroups = { g1: ["cheap"], cuisine: ["thai"] };
	saveGroups([]); // another tab deleted the group while the form was open
	const [item] = addRestaurant({ ...input, groups: formGroups });
	expect(item).toMatchObject({ groups: { cuisine: ["thai"] }, tags: ["street", "cheap"] });
});

test("resetStorage also clears stored groups", () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	resetStorage();
	expect(localStorage.getItem(GROUPS_KEY)).toBeNull();
	expect(loadGroups()).toEqual([]);
});
```

Also update the expectations in `addRestaurant normalizes, stamps and saves` and
`updateRestaurant changes fields and updatedAt only` from `area: "", cuisine: ""` to
`groups: {}`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/store.test.ts`
Expected: FAIL (custom values dropped into tags; deleted-group case keeps `g1`).

- [ ] **Step 3: Implement**

In `src/lib/store.ts`:

```ts
import { customGroupIds, forgetGroupsMemory, loadGroups } from "#lib/groups";
```

- In `loadRestaurants`, replace the last line with:

```ts
	// Older data may hold tags that differ only in case, area and cuisine strings, or values of
	// a group deleted since; cleaning fixes all three.
	const ids = customGroupIds(loadGroups());
	return valid.map((item) => cleanStored(item, ids));
```

- In `requireName`, use `normalizeInput(input, customGroupIds(loadGroups()))`.
- In `resetStorage`, call `forgetGroupsMemory();` next to `forgetHistoryMemory();`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "feat(lib): store cleans restaurants with the stored custom groups"
```

---

### Task 4: Filter keyed by group id

**Files:**
- Modify: `src/lib/filter.ts`
- Test: `tests/lib/filter.test.ts`

**Interfaces:**
- Consumes: `groupValues`, `valuesByUsage`, `isKind`, `normalizeTag` from `#lib/restaurant`.
- Produces:
  - `type Filter = Record<string, GroupFilter>`; `EMPTY_FILTER: Filter = {}`
  - `applyFilter(list, filter)`, `isFilterActive(filter)`, `tagState(filter, group, value)`,
    `cycleTag(filter, group, value)` with `group: string`
  - `pruneFilter(filter, list, groupIds: readonly string[]): Filter`
  - `loadFilter()`, `saveFilter(filter)` unchanged names

- [ ] **Step 1: Write the failing tests**

Change the `make` fixture to `groups: {}` (done in Task 1). Replace
`the filter has type, cuisine and area groups, not tags` and
`pruneFilter drops values no restaurant uses in that group any more`, and add:

```ts
test("the empty filter has no groups", () => {
	expect(EMPTY_FILTER).toEqual({});
});

test("a custom group filters like a built-in one", () => {
	const items = [
		make("A", { groups: { g1: ["cheap"] } }),
		make("B", { groups: { g1: ["fancy"] } }),
		make("C"),
	];
	expect(names(applyFilter(items, { g1: { include: ["cheap"], exclude: [] } }))).toEqual(["A"]);
	expect(names(applyFilter(items, { g1: { include: [], exclude: ["cheap"] } }))).toEqual(["B", "C"]);
});

test("cycleTag works on a group missing from the filter", () => {
	expect(cycleTag({}, "g1", "cheap")).toEqual({ g1: { include: ["cheap"], exclude: [] } });
	expect(tagState({}, "g1", "cheap")).toBe("off");
});

test("pruneFilter drops unknown groups, tags, unused values and empty groups", () => {
	const items = [make("A", { kinds: ["food"], groups: { g1: ["cheap"] } })];
	expect(
		pruneFilter(
			{
				kind: { include: ["food", "drinks"], exclude: [] },
				g1: { include: [], exclude: ["cheap", "gone"] },
				gone: { include: ["x"], exclude: [] },
				tags: { include: ["thai"], exclude: [] },
				area: { include: [], exclude: [] },
			},
			items,
			["kind", "cuisine", "area", "g1"],
		),
	).toEqual({
		kind: { include: ["food"], exclude: [] },
		g1: { include: [], exclude: ["cheap"] },
	});
});

test("loadFilter keeps any group id except tags", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({
			kind: { include: ["food"], exclude: [] },
			g1: { include: [" Cheap "], exclude: [] },
			tags: { include: ["thai"], exclude: [] },
		}),
	);
	expect(loadFilter()).toEqual({
		kind: { include: ["food"], exclude: [] },
		g1: { include: ["cheap"], exclude: [] },
	});
});

test("a saved filter of the old shape loads with its empty groups dropped", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({
			kind: { include: [], exclude: [] },
			cuisine: { include: ["thai"], exclude: [] },
			area: { include: [], exclude: [] },
		}),
	);
	expect(loadFilter()).toEqual({ cuisine: { include: ["thai"], exclude: [] } });
});
```

Update the remaining tests that build filters with `...EMPTY_FILTER, area: {...}` — they keep
working because spreading `{}` is harmless. Update any expectation that compares a whole
loaded filter to `EMPTY_FILTER` plus groups, so empty groups are absent.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/filter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Rewrite the top half of `src/lib/filter.ts`:

```ts
import {
	groupValues,
	isKind,
	normalizeTag,
	type Restaurant,
	valuesByUsage,
} from "#lib/restaurant";

export type GroupFilter = { include: string[]; exclude: string[] };
/** Include and exclude lists by group id. Plain tags are never filtered, so `tags` is never a key. */
export type Filter = Record<string, GroupFilter>;
export type TagState = "off" | "include" | "exclude";

const EMPTY_GROUP: GroupFilter = { include: [], exclude: [] };

export const EMPTY_FILTER: Filter = {};
export const FILTER_KEY = "whattoeat:filter";

const groupFilter = (filter: Filter, group: string): GroupFilter =>
	Object.hasOwn(filter, group) ? (filter[group] ?? EMPTY_GROUP) : EMPTY_GROUP;

const isEmptyGroup = (filter: GroupFilter): boolean =>
	filter.include.length === 0 && filter.exclude.length === 0;

const matchesGroup = (values: string[], filter: GroupFilter): boolean =>
	(filter.include.length === 0 ||
		values.some((value) => filter.include.includes(value))) &&
	!values.some((value) => filter.exclude.includes(value));

/**
 * In each group, keep restaurants with any included value (all when none is included), then
 * drop any with an excluded value. A restaurant must pass every group.
 */
export const applyFilter = (
	list: readonly Restaurant[],
	filter: Filter,
): Restaurant[] =>
	list.filter((item) =>
		Object.entries(filter).every(([group, value]) =>
			matchesGroup(groupValues(item, group), value),
		),
	);

export const isFilterActive = (filter: Filter): boolean =>
	Object.values(filter).some((group) => !isEmptyGroup(group));

export const tagState = (
	filter: Filter,
	group: string,
	value: string,
): TagState => {
	const current = groupFilter(filter, group);
	if (current.include.includes(value)) return "include";
	if (current.exclude.includes(value)) return "exclude";
	return "off";
};

/** Move one value to its next state: off, include, exclude, then off again. */
export const cycleTag = (
	filter: Filter,
	group: string,
	value: string,
): Filter => {
	const current = groupFilter(filter, group);
	const include = current.include.filter((item) => item !== value);
	const exclude = current.exclude.filter((item) => item !== value);
	const next = ((): GroupFilter => {
		switch (tagState(filter, group, value)) {
			case "off":
				return { include: [...include, value], exclude };
			case "include":
				return { include, exclude: [...exclude, value] };
			case "exclude":
				return { include, exclude };
		}
	})();
	return { ...filter, [group]: next };
};

/** Keep only groups in `groupIds` (never tags), values some restaurant still uses, and non-empty groups. */
export const pruneFilter = (
	filter: Filter,
	list: readonly Restaurant[],
	groupIds: readonly string[],
): Filter =>
	Object.fromEntries(
		Object.entries(filter)
			.filter(([group]) => group !== "tags" && groupIds.includes(group))
			.map(([group, value]): [string, GroupFilter] => {
				const known = valuesByUsage(list, group);
				const keep = (item: string): boolean => known.includes(item);
				return [
					group,
					{ include: value.include.filter(keep), exclude: value.exclude.filter(keep) },
				];
			})
			.filter(([, value]) => !isEmptyGroup(value)),
	);
```

In the bottom half, change `toValues(value, group: Group)` and `toGroup(value, group: Group)` to
`group: string`, and replace the loop in `loadFilter`:

```ts
	const raw = data as Record<string, unknown>;
	const entries: [string, GroupFilter][] = [];
	for (const [group, value] of Object.entries(raw)) {
		if (group === "tags") continue;
		const clean = toGroup(value, group);
		if (!isEmptyGroup(clean)) entries.push([group, clean]);
	}
	return Object.fromEntries(entries);
```

Update the doc comment of `loadFilter`: "Any group id but `tags`; empty groups are dropped."

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "feat(lib): filter keyed by any group id"
```

---

### Task 5: Export version 4 with group definitions

**Files:**
- Modify: `src/lib/transfer.ts`, `src/components/data-transfer.ts`
- Test: `tests/lib/transfer.test.ts`, `tests/components/data-transfer.test.ts`

**Interfaces:**
- Consumes: `GroupDef`, `isGroupDef`, `mergeGroupDefs`, `remapGroups`, `loadGroups`,
  `saveGroups` (Task 2); `cleanStored` (Task 1).
- Produces:
  - `EXPORT_VERSION = 4`; `ExportFile.groups: GroupDef[]`
  - `toExportFile(restaurants, history?, groups?, now?)`
  - `exportJson(restaurants, history, groups, now, { pretty })`
  - `ImportResult` ok branch gains `groups: GroupDef[] | undefined` (undefined for 1–3)

- [ ] **Step 1: Write the failing tests**

In `tests/lib/transfer.test.ts`, update `exportJson(...)` and `toExportFile(...)` calls to pass a
groups argument (`[]` where none is needed), change the envelope expectation to
`version: 4` with `groups: []`, and add:

```ts
const price = { id: "g1", name: "Price" };

const file = (version: number, restaurants: unknown[], extra: object = {}) =>
	JSON.stringify({
		app: "whattoeat",
		version,
		exportedAt: "2026-10-14T00:00:00.000Z",
		restaurants,
		history: [],
		...extra,
	});

test("a version 4 file round-trips its groups", () => {
	const item = { ...make("a"), groups: { g1: ["cheap"] } };
	const result = parseImport(exportJson([item], [], [price], new Date(), { pretty: false }));
	expect(result).toEqual({ ok: true, restaurants: [item], history: [], groups: [price] });
});

test("a version 3 file imports with old area and cuisine moved into groups and no groups list", () => {
	const { groups: _g, ...old } = make("a");
	const result = parseImport(file(3, [{ ...old, cuisine: "Thai", area: "" }]));
	expect(result).toMatchObject({
		ok: true,
		restaurants: [{ id: "a", groups: { cuisine: ["thai"] } }],
		groups: undefined,
	});
});

test.each([
	["groups is missing", {}, "import.error.format"],
	["groups is not an array", { groups: {} }, "import.error.format"],
	["a group has a reserved id", { groups: [{ id: "area", name: "X" }] }, "import.error.entries"],
	["a group has a blank name", { groups: [{ id: "g1", name: " " }] }, "import.error.entries"],
	["two groups share an id", { groups: [price, { id: "g1", name: "Other" }] }, "import.error.entries"],
])("a version 4 file is rejected when %s", (_label, extra, error) => {
	expect(parseImport(file(4, [], extra))).toEqual({ ok: false, error });
});

test("values of a group the file does not define import as tags", () => {
	const result = parseImport(file(4, [{ ...make("a"), groups: { gone: ["cosy"] } }], { groups: [] }));
	expect(result).toMatchObject({ ok: true, restaurants: [{ tags: ["cosy"], groups: {} }] });
});

test("a file group named like a built-in merges into it", () => {
	const result = parseImport(
		file(4, [{ ...make("a"), groups: { x1: ["Thai"], cuisine: ["thai", "lao"] } }], {
			groups: [{ id: "x1", name: "สัญชาติอาหาร" }],
		}),
	);
	expect(result).toMatchObject({
		ok: true,
		groups: [],
		restaurants: [{ groups: { cuisine: ["thai", "lao"] } }],
	});
});
```

(Adjust the expected `cuisine` order in the last test to what `remapGroups` gives for the
key order `x1, cuisine`: `["thai", "lao"]`.)

In `tests/components/data-transfer.test.ts` add:

```ts
import { loadGroups, saveGroups } from "#lib/groups";

test("replace with a version 4 file replaces the groups and keeps their values", async () => {
	saveGroups([{ id: "old", name: "Old" }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 4,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [{ ...entry("a"), groups: { g1: ["cheap"] } }],
			history: [],
			groups: [{ id: "g1", name: "Price" }],
		}),
	);
	await el.updateComplete;
	await click(el, '[data-action="replace"]');
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
	expect(loadRestaurants()[0]?.groups).toEqual({ g1: ["cheap"] });
});

test("merge folds a file group into an existing one with the same name", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 4,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [{ ...entry("b"), groups: { x9: ["cheap"] } }],
			history: [],
			groups: [{ id: "x9", name: "price" }],
		}),
	);
	await el.updateComplete;
	await click(el, '[data-action="merge"]');
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
	expect(loadRestaurants().find((item) => item.id === "b")?.groups).toEqual({ g1: ["cheap"] });
});

test("replace with a version 3 file keeps the current groups", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 3,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [],
			history: [],
		}),
	);
	await el.updateComplete;
	await click(el, '[data-action="replace"]');
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
});
```

Use the existing helpers in that file (`mount`, `click`, and the restaurant fixture — rename
`entry` to whatever the file already calls it). Check the data-action names of the Replace and
Merge buttons in `src/components/data-transfer.ts` and use those.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/transfer.test.ts tests/components/data-transfer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/transfer.ts`**

```ts
import { type GroupDef, isGroupDef, mergeGroupDefs, remapGroups } from "#lib/groups";
import {
	cleanStored,
	isRestaurant,
	nameKey,
	type Restaurant,
} from "#lib/restaurant";

export const EXPORT_VERSION = 4;

/**
 * Version 1 files predate history; they still import, with no history. Version 2 files call
 * each visit's time `lockedAt`. Versions 1–3 have no group list and keep area and cuisine as
 * single strings.
 */
const READABLE_VERSIONS: readonly unknown[] = [1, 2, 3, EXPORT_VERSION];

export type ExportFile = {
	app: "whattoeat";
	version: number;
	exportedAt: string;
	restaurants: Restaurant[];
	history: HistoryEntry[];
	groups: GroupDef[];
};
```

`ImportResult` ok branch:

```ts
	| {
			ok: true;
			restaurants: Restaurant[];
			/** `undefined` for a version 1 file, which has no history. */
			history: HistoryEntry[] | undefined;
			/** `undefined` for versions 1–3, which have no group list; the current groups stay. */
			groups: GroupDef[] | undefined;
	  }
```

```ts
export const toExportFile = (
	restaurants: Restaurant[],
	history: HistoryEntry[] = [],
	groups: GroupDef[] = [],
	now: Date = new Date(),
): ExportFile => ({
	app: "whattoeat",
	version: EXPORT_VERSION,
	exportedAt: now.toISOString(),
	restaurants,
	history,
	groups,
});

export const exportJson = (
	restaurants: Restaurant[],
	history: HistoryEntry[],
	groups: GroupDef[],
	now: Date,
	{ pretty }: { pretty: boolean },
): string =>
	JSON.stringify(
		toExportFile(restaurants, history, groups, now),
		null,
		pretty ? 2 : undefined,
	);
```

In `parseImport`, after the history block and before the return:

```ts
	let groups: GroupDef[] | undefined;
	if (file.version === EXPORT_VERSION) {
		if (!Array.isArray(file.groups))
			return { ok: false, error: "import.error.format" };
		if (
			!file.groups.every(isGroupDef) ||
			new Set(file.groups.map((item) => item.id)).size !== file.groups.length
		)
			return { ok: false, error: "import.error.entries" };
		groups = file.groups.map(({ id, name }) => ({ id, name: name.trim() }));
	}
	// A file's own repeated names, or names of built-in groups, fold into one group.
	const own = mergeGroupDefs([], groups ?? []);
	const ids = (groups ?? []).map((item) => item.id);
	return {
		ok: true,
		restaurants: renameTaken(
			remapGroups(
				restaurants.map((item) => cleanStored(item, ids)),
				own.remap,
			),
			new Set(),
		),
		history,
		groups: groups === undefined ? undefined : own.groups,
	};
```

`ExportFile` keys are read through `file` typed as
`Partial<Record<keyof ExportFile, unknown>>`, so `file.groups` is already `unknown`.

- [ ] **Step 4: Implement `src/components/data-transfer.ts`**

- Import `loadGroups`, `mergeGroupDefs`, `remapGroups`, `saveGroups`, `type GroupDef` from
  `#lib/groups`.
- `pending` gains `groups: GroupDef[] | undefined`; `readImport` stores `result.groups`.
- `exportData` and `copyData` pass `loadGroups()` as the third argument of `exportJson`.
- `apply(mode)` becomes:

```ts
	private apply(mode: "replace" | "merge"): void {
		if (this.pending === undefined) return;
		const { restaurants, history, groups } = this.pending;
		let incoming = restaurants;
		let persisted = true;
		// Groups first, so loading restaurants after the save already knows every group id.
		// A file without a group list (versions 1–3) keeps the current groups.
		if (groups !== undefined) {
			const next =
				mode === "replace"
					? { groups, remap: {} }
					: mergeGroupDefs(loadGroups(), groups);
			incoming = remapGroups(restaurants, next.remap);
			persisted = saveGroups(next.groups);
		}
		const list =
			mode === "replace"
				? incoming
				: mergeRestaurants(loadRestaurants(), incoming);
		persisted = saveRestaurants(list) && persisted;
		// ...history block unchanged...
	}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `bun test tests/lib/transfer.test.ts tests/components/data-transfer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format && git add -A
git commit -m "feat(lib): export version 4 carries custom groups; imports merge them"
```

---

### Task 6: Restaurant form with a chip input per group

**Files:**
- Modify: `src/components/restaurant-manager.ts`, `src/lib/i18n.ts`
- Test: `tests/components/restaurant-manager.test.ts`

**Interfaces:**
- Consumes: `loadGroups`, `onGroupsChanged`, `groupLabel`, `customChips`, `type GroupDef`
  (Task 2); `VALUE_GROUPS`, `valuesByUsage`, `metaLine` (Task 1).
- Produces: `<tag-input data-group="<id>">` for `cuisine`, `area`, each custom group, and
  `tags` (last). Restaurant rows show `li.chip.group-chip` items (`"Price: cheap"`) before plain
  tag chips.

- [ ] **Step 1: Write the failing tests**

Change the helper so existing tag tests keep targeting plain tags:

```ts
const groupInput = (el: RestaurantManager, group: string) =>
	$<TagInput>(el, `tag-input[data-group="${group}"]`)!;
const tagInput = (el: RestaurantManager) => groupInput(el, "tags");

const typeInto = async (el: RestaurantManager, group: string, text: string) => {
	const field = groupInput(el, group);
	const box = field.shadowRoot!.querySelector<HTMLInputElement>("input")!;
	box.value = text;
	box.dispatchEvent(new Event("input"));
	await field.updateComplete;
	await el.updateComplete;
};
const typeTags = (el: RestaurantManager, text: string) => typeInto(el, "tags", text);
```

Replace `adds a restaurant with its type, cuisine and area`,
`suggests cuisines and areas already used, most used first`,
`edit fills type, cuisine and area` and
`the form asks for name, type, cuisine and area, location, then tags and notes` with:

```ts
test("adds a restaurant with several cuisines and areas, committing text left in each box", async () => {
	const el = await mount();
	type(el, "#name", "Cafe");
	await typeInto(el, "cuisine", "Thai, Japanese");
	await typeInto(el, "area", "Siam");
	await submit(el);
	expect(loadRestaurants()[0]?.groups).toEqual({
		cuisine: ["thai", "japanese"],
		area: ["siam"],
	});
});

test("each custom group gets its own input, in stored order, before plain tags", async () => {
	saveGroups([{ id: "g2", name: "Vibe" }, { id: "g1", name: "Price" }]);
	const el = await mount();
	const groups = [...el.shadowRoot!.querySelectorAll("tag-input")].map((input) => [
		input.dataset.group,
		input.label,
	]);
	expect(groups).toEqual([
		["cuisine", "Cuisine"],
		["area", "Area"],
		["g2", "Vibe"],
		["g1", "Price"],
		["tags", "Tags"],
	]);
});

test("saves custom group values and shows them as labelled chips", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	type(el, "#name", "Cafe");
	await typeInto(el, "g1", "cheap");
	await typeTags(el, "spicy");
	await submit(el);
	expect(loadRestaurants()[0]).toMatchObject({ groups: { g1: ["cheap"] }, tags: ["spicy"] });
	const chips = [...el.shadowRoot!.querySelectorAll("li[data-id] .chip")].map((c) => c.textContent);
	expect(chips).toEqual(["Price: cheap", "spicy"]);
});

test("suggests each group's values, most used first", async () => {
	addRestaurant({ ...blank, name: "A", groups: { cuisine: ["thai"], area: ["siam"] } });
	addRestaurant({ ...blank, name: "B", groups: { cuisine: ["thai", "lao"], area: ["ari"] } });
	const el = await mount();
	expect(groupInput(el, "cuisine").suggestions).toEqual(["thai", "lao"]);
	expect(groupInput(el, "area").suggestions).toEqual(["ari", "siam"]);
});

test("edit fills type and every group", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...blank, name: "A", kinds: ["food"], groups: { cuisine: ["thai"], g1: ["cheap"] } });
	const el = await mount();
	await click(el, '[data-action="edit"]');
	expect(groupInput(el, "cuisine").value).toEqual(["thai"]);
	expect(groupInput(el, "g1").value).toEqual(["cheap"]);
	expect(groupInput(el, "area").value).toEqual([]);
});

test("a group added in another tab shows up in the open form", async () => {
	const el = await mount();
	saveGroups([{ id: "g1", name: "Price" }]);
	await el.updateComplete;
	expect(groupInput(el, "g1")).not.toBeNull();
});

test("a group renamed in another tab relabels its input and keeps the values typed so far", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await typeInto(el, "g1", "cheap,");
	saveGroups([{ id: "g1", name: "Cost" }]);
	await el.updateComplete;
	expect(groupInput(el, "g1").label).toBe("Cost");
	expect(groupInput(el, "g1").value).toEqual(["cheap"]);
});

test("the form asks for name, type, groups, location, then tags and notes", async () => {
	const el = await mount();
	const order = [...el.shadowRoot!.querySelectorAll("#name, fieldset.kinds, tag-input, #location, #notes")].map(
		(node) => (node instanceof HTMLElement && node.dataset.group) || node.id || node.className,
	);
	expect(order).toEqual(["name", "kinds", "cuisine", "area", "location", "tags", "notes"]);
});
```

Import `saveGroups` from `#lib/groups`. Update the Thai label test so it checks
`groupInput(el, "cuisine").label` is `"สัญชาติอาหาร"` and `groupInput(el, "area").label` is
`"ย่าน"`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/i18n.ts`: change and add (EN / TH):

```ts
	"field.cuisineHint": "Press Enter or comma to add, e.g. thai, japanese",
	"field.areaHint": "Short area names to filter by, e.g. siam, ari",
	"field.groupHint": "Press Enter or comma to add",
```

```ts
	"field.cuisineHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ญี่ปุ่น",
	"field.areaHint": "ชื่อย่านสั้น ๆ สำหรับกรอง เช่น สยาม, อารีย์",
	"field.groupHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม",
```

`src/components/restaurant-manager.ts`:

```ts
type FormState = {
	name: string;
	location: string;
	notes: string;
	kinds: Kind[];
	tags: string[];
	/** Values by group id: cuisine, area and custom groups. */
	groups: Record<string, string[]>;
};

const EMPTY_FORM: FormState = {
	name: "",
	location: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
};

const HINTS: Record<string, MessageKey> = {
	cuisine: "field.cuisineHint",
	area: "field.areaHint",
};
```

- New state: `@state() private defs: GroupDef[] = [];`, loaded in `connectedCallback`
  (`this.defs = loadGroups();`) and refreshed by a second subscription
  `onGroupsChanged(() => { this.defs = loadGroups(); this.restaurants = loadRestaurants(); })`.
  Keep both unsubscribe functions and call both in `disconnectedCallback`.
- Replace the `tagInput` getter with:

```ts
	private get tagInputs(): TagInput[] {
		return [...this.renderRoot.querySelectorAll("tag-input")];
	}
```

- `resetForm`: `for (const input of this.tagInputs) input.clearText();`
- `startEdit`: same loop instead of `this.tagInput?.clearText()`.
- `onInput`: the field type becomes `"name" | "location" | "notes"`.
- Replace `onTagsChange` with:

```ts
	private onValuesChange(group: string, values: string[]): void {
		this.form =
			group === "tags"
				? { ...this.form, tags: values }
				: { ...this.form, groups: { ...this.form.groups, [group]: values } };
	}
```

- `submit`:

```ts
		// Text still in a box counts as a value, the same as pressing Enter.
		let tags = this.form.tags;
		const groups: Record<string, string[]> = {};
		for (const input of this.tagInputs) {
			const group = input.dataset.group ?? "tags";
			const values = input.commit();
			if (group === "tags") tags = values;
			else groups[group] = values;
		}
		// ...name checks unchanged...
		const input = {
			name: this.form.name,
			location: this.form.location,
			notes: this.form.notes,
			kinds: this.form.kinds,
			tags,
			groups,
		};
```

- `fillForm`: `tags: item.tags, groups: { ...item.groups }` instead of area/cuisine.
- In `renderForm`, replace the `.pair` block with:

```ts
				<div class="pair">
					${[...VALUE_GROUPS, ...this.defs.map((def) => def.id)].map((group) => this.renderGroupInput(group))}
				</div>
```

  and the plain tags `<tag-input>` with `this.renderGroupInput("tags")`.
- Replace `renderSuggestedField` with:

```ts
	/** A chip input for one group, suggesting the values other restaurants already use. */
	private renderGroupInput(group: string) {
		const hint =
			group === "tags"
				? t("field.tagsHint")
				: t(HINTS[group] ?? "field.groupHint");
		const value =
			group === "tags" ? this.form.tags : (this.form.groups[group] ?? []);
		return html`<tag-input
			data-group=${group}
			.label=${groupLabel(group, this.defs)}
			.hint=${hint}
			.value=${value}
			.suggestions=${valuesByUsage(this.restaurants, group)}
			@change=${(event: CustomEvent<string[]>) => this.onValuesChange(group, event.detail)}
		></tag-input>`;
	}
```

  `HINTS[group]` is `MessageKey | undefined` under `noUncheckedIndexedAccess`; the `??` keeps the
  type `MessageKey`. Import `type MessageKey` from `#lib/i18n`.
- In `renderRow`, replace the tag chip block with:

```ts
				${(() => {
					const chips = customChips(item, this.defs);
					return chips.length + item.tags.length > 0
						? html`<ul class="chips">
								${chips.map((chip) => html`<li class="chip group-chip">${chip}</li>`)}
								${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}
							</ul>`
						: nothing;
				})()}
```

- Remove the now-unused `.field` CSS block and the `tagsByUsage` import.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/components/restaurant-manager.test.ts tests/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "feat(components): one chip input per group in the restaurant form"
```

---

### Task 7: Home filter rows for every group

**Files:**
- Modify: `src/components/random-picker.ts`
- Test: `tests/components/random-picker.test.ts`

**Interfaces:**
- Consumes: `allGroupIds`, `groupLabel`, `valueLabel`, `customChips`, `loadGroups`,
  `onGroupsChanged`, `type GroupDef` (Task 2); `pruneFilter(filter, list, groupIds)` (Task 4).
- Produces: a `.filter-group` row per group id in `allGroupIds` order that has values; chip
  buttons carry `data-group` / `data-tag` as today.

- [ ] **Step 1: Write the failing tests**

Update fixtures that pass `area: "siam"` / `cuisine: "thai"` to `addRestaurant` into
`groups: { area: ["siam"] }` etc., and change `emptyFilter` to `{}`. Wherever a test compares
the saved filter, expect only non-empty groups (for example `{ area: { include: ["siam"],
exclude: [] } }`). Then add:

```ts
import { saveGroups } from "#lib/groups";

test("custom groups get filter rows after the built-ins, labelled with their names", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"], g1: ["cheap"] } });
	addRestaurant({ ...base, name: "B", groups: { g1: ["fancy"] } });
	const el = await mount();
	const titles = [...root(el).querySelectorAll(".filter-group h3")].map((h) => h.textContent);
	expect(titles).toEqual(["Area", "Price"]);
	await cycle(el, "cheap", "g1");
	expect(activeLine(el)).toContain("Price: ✓ cheap");
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedNames(el)).toEqual(["A"]);
});

test("a restaurant with several cuisines matches each of them", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai", "lao"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await cycle(el, "lao", "cuisine");
	expect(root(el).querySelector(".count")?.textContent).toContain("1 of 2");
});

test("a filter on a deleted group is dropped", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	localStorage.setItem(FILTER_KEY, JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }));
	const el = await mount();
	saveGroups([]);
	await el.updateComplete;
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	expect(root(el).querySelector(".filter-group")).toBeNull();
});

test("a picked card shows custom values as labelled chips before tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", tags: ["spicy"], groups: { g1: ["cheap"] } });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const chips = [...root(el).querySelectorAll(".result .chip")].map((c) => c.textContent);
	expect(chips).toEqual(["Price: cheap", "spicy"]);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/components/random-picker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Drop the local `valueLabel` and the `GROUPS`, `Group`, `isKind` imports; import
  `allGroupIds`, `customChips`, `groupLabel`, `loadGroups`, `onGroupsChanged`, `valueLabel`,
  `type GroupDef` from `#lib/groups`.
- New state `@state() private defs: GroupDef[] = [];`. In `connectedCallback`, load it before
  `this.pruneFilter()`, and add a second subscription:

```ts
		this.unsubscribeGroups = onGroupsChanged(() => {
			this.defs = loadGroups();
			this.restaurants = loadRestaurants();
			this.pruneFilter();
			this.keepPickInPool();
		});
```

  Unsubscribe it in `disconnectedCallback`.
- `pruneFilter()` uses `pruneFilter(this.filter, this.restaurants, allGroupIds(this.defs))`.
- In `render`, `const groups = allGroupIds(this.defs).map(...)` with `group: string`.
- In `renderFilter`, type `groups` as `{ group: string; values: string[] }[]`; the summary maps
  over `allGroupIds(this.defs)` and reads `this.filter[group]` through
  `Object.hasOwn(this.filter, group) ? this.filter[group] : undefined` (skip when undefined);
  every `t(\`group.${group}\`)` becomes `groupLabel(group, this.defs)`.
- In `renderResult`, render chips like Task 6 (`customChips` first with class `group-chip`,
  then tags).

- [ ] **Step 4: Run the full check list**

```bash
bun run format && bun run check && bun run test && bun run build
```

Expected: all pass. This is the first point where `tsc` passes again; fix any leftover caller
of `area` / `cuisine` / `GROUPS` it reports (search: `grep -rn "\.cuisine\|\.area\b\|GROUPS\b" src tests`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(components): home filter rows for cuisine, area and custom groups"
```

---

### Task 8: Stage 1 docs and pull request

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

In `## Data and storage`, add a row to the key table:

```md
| `whattoeat:groups`      | Custom groups, like "price" (JSON array of `{ id, name }`) |
```

and change the paste example's `"version": 1` to `"version": 4` with `"groups": []` added.

- [ ] **Step 2: Full check list, then commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "docs: custom groups storage key"
```

- [ ] **Step 3: Push and open the stage 1 PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "feat: cuisine, area and custom groups as multi-value tag groups" --body "$(cat <<'EOF'
## Summary
- Restaurants keep cuisine, area and custom group values in a `groups` map; cuisine and area take several values.
- Old saved data and version 1–3 files are converted on load and import.
- Export version 4 carries custom group definitions; imports merge groups by id and name.
- The restaurant form has one chip input per group; the home filter has a row per group.

Stage 1 of `docs/superpowers/specs/2026-10-14-tag-groups-design.md`. Custom groups cannot be created in the UI until the Tags page (stage 2).

## Test plan
- [x] bun run check
- [x] bun run test
- [x] bun run build
- [ ] Preview: old data with a cuisine and area still shows and filters
- [ ] Preview: add a restaurant with two cuisines; filter by each
- [ ] Preview: import a version 4 file with a custom group; its filter row appears

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```

Report the PR link and the preview URL (see `shipping-a-change`), then stop for approval.

---

# Stage 2 — Tags page

### Task 9: Group and value operations

**Files:**
- Modify: `src/lib/groups.ts`
- Test: `tests/lib/groups.test.ts`

**Interfaces:**
- Consumes: Task 2 exports; `newId`, `normalizeTag`, `groupValues`, `valuesByUsage`.
- Produces:
  - `type ValueCount = { value: string; count: number }`
  - `valueCounts(list, group): ValueCount[]` (most used first, ties by name)
  - `usingGroup(list, group): number`
  - `type NameError = "tags.nameRequired" | "tags.nameTaken"`
  - `type ValueError = "tags.valueRequired" | "tags.valueComma"`
  - `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
  - `addGroup(defs, name): Result<GroupDef[], NameError>`
  - `renameGroup(defs, id, name): Result<GroupDef[], NameError>`
  - `moveGroup(defs, id, offset: -1 | 1): GroupDef[]`
  - `deleteGroup(list, defs, id, now): { restaurants: Restaurant[]; groups: GroupDef[] }`
  - `checkValue(text): Result<string, ValueError>` (normalized)
  - `renameValue(list, group, from, to, now): Restaurant[]`
  - `moveValue(list, from, value, to, now): Restaurant[]`
  - `deleteValue(list, group, value, now): Restaurant[]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/groups.test.ts`:

```ts
const NOW = new Date("2026-10-15T00:00:00.000Z");
const STAMP = NOW.toISOString();

test("valueCounts counts restaurants per value, most used first", () => {
	const list = [make("a", { g1: ["cheap"] }), make("b", { g1: ["cheap", "fancy"] })];
	expect(valueCounts(list, "g1")).toEqual([
		{ value: "cheap", count: 2 },
		{ value: "fancy", count: 1 },
	]);
	expect(usingGroup(list, "g1")).toBe(2);
	expect(usingGroup(list, "area")).toBe(0);
});

test("addGroup trims, refuses blank and taken names, and makes a free id", () => {
	expect(addGroup([price], "  ")).toEqual({ ok: false, error: "tags.nameRequired" });
	expect(addGroup([price], "PRICE")).toEqual({ ok: false, error: "tags.nameTaken" });
	expect(addGroup([price], "Cuisine")).toEqual({ ok: false, error: "tags.nameTaken" });
	const result = addGroup([price], " Vibe ");
	expect(result.ok && result.value[1]?.name).toBe("Vibe");
	expect(result.ok && result.value[1]?.id).toMatch(/^[0-9A-Za-z]{8}$/);
});

test("renameGroup lets a group keep its name in other case, refuses another's", () => {
	expect(renameGroup([price, vibe], "g1", "PRICE")).toEqual({
		ok: true,
		value: [{ id: "g1", name: "PRICE" }, vibe],
	});
	expect(renameGroup([price, vibe], "g1", "vibe")).toEqual({ ok: false, error: "tags.nameTaken" });
});

test("moveGroup swaps with a neighbour and stops at the ends", () => {
	expect(moveGroup([price, vibe], "g2", -1)).toEqual([vibe, price]);
	expect(moveGroup([price, vibe], "g1", -1)).toEqual([price, vibe]);
	expect(moveGroup([price, vibe], "g2", 1)).toEqual([price, vibe]);
});

test("deleteGroup turns its values into tags on the restaurants that had them", () => {
	const list = [
		{ ...make("a", { g1: ["cheap"], area: ["siam"] }), tags: ["cheap", "spicy"] },
		make("b", { area: ["ari"] }),
	];
	const result = deleteGroup(list, [price, vibe], "g1", NOW);
	expect(result.groups).toEqual([vibe]);
	expect(result.restaurants).toEqual([
		{ ...list[0]!, groups: { area: ["siam"] }, tags: ["cheap", "spicy"], updatedAt: STAMP },
		list[1]!,
	]);
});

test.each([
	["  ", { ok: false, error: "tags.valueRequired" }],
	["a, b", { ok: false, error: "tags.valueComma" }],
	[" Rice  Noodle ", { ok: true, value: "rice noodle" }],
])("checkValue(%p)", (text, expected) => {
	expect(checkValue(text)).toEqual(expected);
});

test("renameValue renames in one group only and merges into an existing value", () => {
	const list = [
		{ ...make("a", { g1: ["noodles", "noodle"] }), tags: ["noodles"] },
		make("b", { g1: ["noodles"] }),
		make("c", { g1: ["rice"] }),
	];
	expect(renameValue(list, "g1", "noodles", "noodle", NOW)).toEqual([
		{ ...list[0]!, groups: { g1: ["noodle"] }, updatedAt: STAMP },
		{ ...list[1]!, groups: { g1: ["noodle"] }, updatedAt: STAMP },
		list[2]!,
	]);
});

test("renameValue works on plain tags", () => {
	const list = [{ ...make("a"), tags: ["Thai".toLowerCase()] }];
	expect(renameValue(list, "tags", "thai", "thai food", NOW)[0]?.tags).toEqual(["thai food"]);
});

test("moveValue moves a value to another group or to tags, once", () => {
	const list = [
		make("a", { g1: ["cheap"], g2: ["cheap"] }),
		make("b", { g1: ["cheap", "fast"] }),
	];
	expect(moveValue(list, "g1", "cheap", "g2", NOW)).toEqual([
		{ ...list[0]!, groups: { g2: ["cheap"] }, updatedAt: STAMP },
		{ ...list[1]!, groups: { g1: ["fast"], g2: ["cheap"] }, updatedAt: STAMP },
	]);
	expect(moveValue(list, "g1", "fast", "tags", NOW)[1]).toMatchObject({
		groups: { g1: ["cheap"] },
		tags: ["fast"],
	});
});

test("deleteValue removes a value everywhere and leaves others untouched", () => {
	const list = [make("a", { g1: ["cheap"] }), make("b", { g1: ["fast"] })];
	expect(deleteValue(list, "g1", "cheap", NOW)).toEqual([
		{ ...list[0]!, groups: {}, updatedAt: STAMP },
		list[1]!,
	]);
});
```

Add the new names to the import list.

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/groups.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement (append to `src/lib/groups.ts`)**

Extend the restaurant import with `newId`, `normalizeTag`, `valuesByUsage`, then:

```ts
export type ValueCount = { value: string; count: number };

/** Each value of one group with how many restaurants have it, most used first, ties by name. */
export const valueCounts = (
	list: readonly Restaurant[],
	group: string,
): ValueCount[] =>
	valuesByUsage(list, group).map((value) => ({
		value,
		count: list.filter((item) => groupValues(item, group).includes(value))
			.length,
	}));

/** How many restaurants have any value in a group. */
export const usingGroup = (list: readonly Restaurant[], group: string): number =>
	list.filter((item) => groupValues(item, group).length > 0).length;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export type NameError = "tags.nameRequired" | "tags.nameTaken";
export type ValueError = "tags.valueRequired" | "tags.valueComma";

const checkName = (
	defs: readonly GroupDef[],
	name: string,
	exceptId?: string,
): Result<string, NameError> => {
	const clean = name.trim();
	if (clean === "") return { ok: false, error: "tags.nameRequired" };
	if (isGroupNameTaken(defs, clean, exceptId))
		return { ok: false, error: "tags.nameTaken" };
	return { ok: true, value: clean };
};

export const addGroup = (
	defs: readonly GroupDef[],
	name: string,
): Result<GroupDef[], NameError> => {
	const checked = checkName(defs, name);
	if (!checked.ok) return checked;
	const id = newId([...RESERVED_GROUP_IDS, ...customGroupIds(defs)]);
	return { ok: true, value: [...defs, { id, name: checked.value }] };
};

export const renameGroup = (
	defs: readonly GroupDef[],
	id: string,
	name: string,
): Result<GroupDef[], NameError> => {
	const checked = checkName(defs, name, id);
	if (!checked.ok) return checked;
	return {
		ok: true,
		value: defs.map((def) => (def.id === id ? { ...def, name: checked.value } : def)),
	};
};

/** Swap a group with its neighbour; at either end nothing changes. */
export const moveGroup = (
	defs: readonly GroupDef[],
	id: string,
	offset: -1 | 1,
): GroupDef[] => {
	const from = defs.findIndex((def) => def.id === id);
	const to = from + offset;
	const next = [...defs];
	const a = next[from];
	const b = next[to];
	if (from < 0 || a === undefined || b === undefined) return next;
	next[from] = b;
	next[to] = a;
	return next;
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** Set one group's values; an empty list removes the key. `tags` sets plain tags. */
const withValues = (
	item: Restaurant,
	group: string,
	values: string[],
): Restaurant => {
	if (group === "tags") return { ...item, tags: values };
	const groups = Object.fromEntries(
		Object.entries(item.groups).filter(([id]) => id !== group),
	);
	if (values.length > 0) groups[group] = values;
	return { ...item, groups };
};

/** Apply `edit` to every restaurant that has `value` in `group`, stamping `updatedAt`. */
const editWhere = (
	list: readonly Restaurant[],
	group: string,
	value: string,
	now: Date,
	edit: (item: Restaurant) => Restaurant,
): Restaurant[] =>
	list.map((item) =>
		groupValues(item, group).includes(value)
			? { ...edit(item), updatedAt: now.toISOString() }
			: item,
	);

/** Normalized value text, refusing blank text and commas (commas separate values). */
export const checkValue = (text: string): Result<string, ValueError> => {
	if (text.includes(",")) return { ok: false, error: "tags.valueComma" };
	const value = normalizeTag(text);
	if (value === "") return { ok: false, error: "tags.valueRequired" };
	return { ok: true, value };
};

/** Rename a value in one group; when `to` is already there, the two merge into one. */
export const renameValue = (
	list: readonly Restaurant[],
	group: string,
	from: string,
	to: string,
	now: Date,
): Restaurant[] =>
	from === to
		? [...list]
		: editWhere(list, group, from, now, (item) =>
				withValues(
					item,
					group,
					unique(groupValues(item, group).map((value) => (value === from ? to : value))),
				),
			);

/** Move a value from one group to another (or to plain tags); a restaurant keeps one copy. */
export const moveValue = (
	list: readonly Restaurant[],
	from: string,
	value: string,
	to: string,
	now: Date,
): Restaurant[] =>
	from === to
		? [...list]
		: editWhere(list, from, value, now, (item) => {
				const removed = withValues(
					item,
					from,
					groupValues(item, from).filter((other) => other !== value),
				);
				return withValues(removed, to, unique([...groupValues(removed, to), value]));
			});

export const deleteValue = (
	list: readonly Restaurant[],
	group: string,
	value: string,
	now: Date,
): Restaurant[] =>
	editWhere(list, group, value, now, (item) =>
		withValues(
			item,
			group,
			groupValues(item, group).filter((other) => other !== value),
		),
	);

/** Remove a custom group; its values become plain tags on every restaurant that had them. */
export const deleteGroup = (
	list: readonly Restaurant[],
	defs: readonly GroupDef[],
	id: string,
	now: Date,
): { restaurants: Restaurant[]; groups: GroupDef[] } => ({
	restaurants: list.map((item) => {
		const values = groupValues(item, id);
		if (values.length === 0) return item;
		return {
			...withValues(withValues(item, id, []), "tags", unique([...item.tags, ...values])),
			updatedAt: now.toISOString(),
		};
	}),
	groups: defs.filter((def) => def.id !== id),
});
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "feat(lib): add, rename, reorder and delete groups; rename, move and delete values"
```

---

### Task 10: Keep the saved filter in step

**Files:**
- Modify: `src/lib/filter.ts`
- Test: `tests/lib/filter.test.ts`

**Interfaces:**
- Produces:
  - `renameFilterValue(filter, group, from, to): Filter`
  - `moveFilterValue(filter, from, value, to): Filter` (drops it when `to` is `tags`)
  - `dropFilterValue(filter, group, value): Filter`
  - `dropFilterGroup(filter, group): Filter`
  - `onFilterChanged(callback): () => void` (storage events for `FILTER_KEY` from other tabs)

- [ ] **Step 1: Write the failing tests**

```ts
const f = (include: string[], exclude: string[] = []) => ({ include, exclude });

test("renameFilterValue renames in its own list and keeps one copy", () => {
	expect(renameFilterValue({ g1: f(["noodles", "noodle"]), g2: f(["noodles"]) }, "g1", "noodles", "noodle"))
		.toEqual({ g1: f(["noodle"]), g2: f(["noodles"]) });
	expect(renameFilterValue({ g1: f([], ["a"]) }, "g1", "a", "b")).toEqual({ g1: f([], ["b"]) });
});

test("renameFilterValue onto a value in the other list keeps it included", () => {
	expect(renameFilterValue({ g1: f(["b"], ["a"]) }, "g1", "a", "b")).toEqual({ g1: f(["b"]) });
});

test("moveFilterValue carries the state to the target group, or drops it for tags", () => {
	expect(moveFilterValue({ g1: f(["cheap"]) }, "g1", "cheap", "g2")).toEqual({ g2: f(["cheap"]) });
	expect(moveFilterValue({ g1: f([], ["cheap"]) }, "g1", "cheap", "tags")).toEqual({});
});

test("dropFilterValue and dropFilterGroup remove and tidy up", () => {
	expect(dropFilterValue({ g1: f(["a", "b"]) }, "g1", "a")).toEqual({ g1: f(["b"]) });
	expect(dropFilterValue({ g1: f(["a"]) }, "g1", "a")).toEqual({});
	expect(dropFilterGroup({ g1: f(["a"]), area: f(["siam"]) }, "g1")).toEqual({ area: f(["siam"]) });
});

test("onFilterChanged fires for filter storage events only", () => {
	let count = 0;
	const stop = onFilterChanged(() => count++);
	window.dispatchEvent(new StorageEvent("storage", { key: FILTER_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
	stop();
	window.dispatchEvent(new StorageEvent("storage", { key: FILTER_KEY }));
	expect(count).toBe(1);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/lib/filter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement (append to `src/lib/filter.ts`)**

```ts
/** Set one group's lists; an empty group is removed. An item in both lists stays included. */
const withGroup = (filter: Filter, group: string, next: GroupFilter): Filter => {
	const rest = Object.fromEntries(
		Object.entries(filter).filter(([id]) => id !== group),
	);
	const include = [...new Set(next.include)];
	const exclude = [...new Set(next.exclude)].filter((item) => !include.includes(item));
	return include.length + exclude.length > 0
		? { ...rest, [group]: { include, exclude } }
		: rest;
};

export const renameFilterValue = (
	filter: Filter,
	group: string,
	from: string,
	to: string,
): Filter => {
	const current = groupFilter(filter, group);
	const swap = (list: string[]): string[] =>
		list.map((item) => (item === from ? to : item));
	return withGroup(filter, group, {
		include: swap(current.include),
		exclude: swap(current.exclude),
	});
};

export const dropFilterValue = (
	filter: Filter,
	group: string,
	value: string,
): Filter => {
	const current = groupFilter(filter, group);
	const keep = (item: string): boolean => item !== value;
	return withGroup(filter, group, {
		include: current.include.filter(keep),
		exclude: current.exclude.filter(keep),
	});
};

/** Carry a value's state to another group; plain tags are not filtered, so it is dropped there. */
export const moveFilterValue = (
	filter: Filter,
	from: string,
	value: string,
	to: string,
): Filter => {
	const state = tagState(filter, from, value);
	const dropped = dropFilterValue(filter, from, value);
	if (state === "off" || to === "tags") return dropped;
	const target = groupFilter(dropped, to);
	return withGroup(dropped, to, {
		include: state === "include" ? [...target.include, value] : target.include,
		exclude: state === "exclude" ? [...target.exclude, value] : target.exclude,
	});
};

export const dropFilterGroup = (filter: Filter, group: string): Filter =>
	withGroup(filter, group, EMPTY_GROUP);

/** Call `callback` when another tab saves the filter. Returns an unsubscribe function. */
export const onFilterChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === FILTER_KEY) callback();
	};
	window.addEventListener("storage", onStorage);
	return () => window.removeEventListener("storage", onStorage);
};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/lib/filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "feat(lib): helpers that keep the saved filter in step with tag edits"
```

---

### Task 11: Tags page — cards and group actions

**Files:**
- Create: `src/components/tag-manager.ts`, `src/routes/tags.html`
- Modify: `src/types/global.d.ts`, `src/lib/i18n.ts`, `src/components/app-header.ts`
- Test: `tests/components/tag-manager.test.ts`, `tests/components/app-header.test.ts`

**Interfaces:**
- Consumes: Task 2 and Task 9 exports from `#lib/groups`; `dropFilterGroup`, `loadFilter`,
  `saveFilter` from `#lib/filter`; store load/save/subscribe.
- Produces: `<tag-manager>`; `Page` gains `"tags"`; DOM hooks used by tests and Task 12:
  - `section.group[data-group="<id>"]` per card, `h2` holding the label
  - `li.value[data-value="<value>"]` with `.count`
  - group buttons `data-action="rename-group" | "move-up" | "move-down" | "delete-group"`,
    `"confirm-delete-group"`, `"cancel"`, `"save-group-name"`
  - `form.add-group` with `input#new-group` and `p.error`

- [ ] **Step 1: i18n keys**

Add to `en` (and `th` in the same order):

| key | en | th |
| --- | --- | --- |
| `nav.tags` | Tags | แท็ก |
| `tags.title` | Tags | แท็ก |
| `tags.intro` | Groups sort your restaurants for the home filter. Plain tags are shown but not filtered. | กลุ่มช่วยจัดร้านสำหรับตัวกรองหน้าแรก แท็กทั่วไปจะแสดงแต่ไม่ใช้กรอง |
| `tags.count.one` | 1 restaurant | 1 ร้าน |
| `tags.count.other` | {count} restaurants | {count} ร้าน |
| `tags.noValues` | No values yet. | ยังไม่มีค่า |
| `tags.rename` | Rename | เปลี่ยนชื่อ |
| `tags.save` | Save | บันทึก |
| `tags.cancel` | Cancel | ยกเลิก |
| `tags.moveUp` | Move {group} up | เลื่อน {group} ขึ้น |
| `tags.moveDown` | Move {group} down | เลื่อน {group} ลง |
| `tags.delete` | Delete | ลบ |
| `tags.deleteGroupPrompt` | Delete the group {group}? Its values on {count} restaurants become plain tags. | ลบกลุ่ม {group} หรือไม่ ค่าในร้าน {count} ร้านจะกลายเป็นแท็กทั่วไป |
| `tags.confirmDelete` | Confirm delete | ยืนยันการลบ |
| `tags.addTitle` | Add a group | เพิ่มกลุ่ม |
| `tags.addLabel` | Group name | ชื่อกลุ่ม |
| `tags.add` | Add | เพิ่ม |
| `tags.nameRequired` | Name is required. | กรุณาใส่ชื่อ |
| `tags.nameTaken` | A group with this name already exists. | มีกลุ่มชื่อนี้อยู่แล้ว |
| `tags.empty` | No restaurants yet. | ยังไม่มีร้านอาหาร |
| `tags.emptyLink` | Add some restaurants | เพิ่มร้านอาหาร |

- [ ] **Step 2: Write the failing tests**

`tests/components/app-header.test.ts`: change `renders nav links to the four pages` to five,
with `"./tags"` / `"Tags"` between Restaurants and History.

`tests/components/tag-manager.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-manager";
import type { TagManager } from "#components/tag-manager";
import { FILTER_KEY } from "#lib/filter";
import { loadGroups, saveGroups } from "#lib/groups";
import { setLang } from "#lib/i18n";
import { addRestaurant, loadRestaurants } from "#lib/store";

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
	const el = document.createElement("tag-manager");
	document.body.append(el);
	await el.updateComplete;
	return el;
};
const $ = <T extends Element>(el: TagManager, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);
const card = (el: TagManager, group: string) =>
	$<HTMLElement>(el, `section.group[data-group="${group}"]`)!;
const click = async (el: TagManager, root: ParentNode, action: string) => {
	root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
	await el.updateComplete;
};
const cardTitles = (el: TagManager) =>
	[...el.shadowRoot!.querySelectorAll("section.group h2")].map((h) => h.textContent?.trim());
const typeIn = async (el: TagManager, input: HTMLInputElement, text: string) => {
	input.value = text;
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
};

test("shows a card per group in order, ending with plain tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	expect(cardTitles(el)).toEqual(["Type", "Cuisine", "Area", "Price", "Tags"]);
});

test("each value shows how many restaurants use it, most used first", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thai", "lao"] } });
	const el = await mount();
	const rows = [...card(el, "cuisine").querySelectorAll("li.value")].map((li) => [
		li.getAttribute("data-value"),
		li.querySelector(".count")?.textContent?.trim(),
	]);
	expect(rows).toEqual([["thai", "2 restaurants"], ["lao", "1 restaurant"]]);
});

test("only custom groups have group actions", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	expect(card(el, "cuisine").querySelector('[data-action="rename-group"]')).toBeNull();
	expect(card(el, "g1").querySelector('[data-action="rename-group"]')).not.toBeNull();
});

test("adding a group saves it and clears the field; blank and taken names show errors", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	const input = $<HTMLInputElement>(el, "#new-group")!;
	const submit = async () => {
		$<HTMLFormElement>(el, "form.add-group")!.dispatchEvent(new Event("submit", { cancelable: true }));
		await el.updateComplete;
	};
	await submit();
	expect($(el, "form.add-group .error")?.textContent).toBe("Name is required.");
	await typeIn(el, input, "area");
	await submit();
	expect($(el, "form.add-group .error")?.textContent).toBe("A group with this name already exists.");
	await typeIn(el, input, "Vibe");
	await submit();
	expect(loadGroups().map((def) => def.name)).toEqual(["Price", "Vibe"]);
	expect(input.value).toBe("");
	expect($(el, "form.add-group .error")).toBeNull();
});

test("renaming a group saves the new name", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await click(el, card(el, "g1"), "rename-group");
	await typeIn(el, card(el, "g1").querySelector<HTMLInputElement>("input")!, "Cost");
	await click(el, card(el, "g1"), "save-group-name");
	expect(loadGroups()).toEqual([{ id: "g1", name: "Cost" }]);
});

test("move up and down reorder custom groups", async () => {
	saveGroups([{ id: "g1", name: "Price" }, { id: "g2", name: "Vibe" }]);
	const el = await mount();
	await click(el, card(el, "g2"), "move-up");
	expect(loadGroups().map((def) => def.id)).toEqual(["g2", "g1"]);
	expect(card(el, "g2").querySelector<HTMLButtonElement>('[data-action="move-up"]')!.disabled).toBe(true);
});

test("deleting a group asks first, then turns its values into tags and drops its filter", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	localStorage.setItem(FILTER_KEY, JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }));
	const el = await mount();
	await click(el, card(el, "g1"), "delete-group");
	expect(card(el, "g1").textContent).toContain("Its values on 1 restaurants become plain tags.");
	await click(el, card(el, "g1"), "confirm-delete-group");
	expect(loadGroups()).toEqual([]);
	expect(loadRestaurants()[0]?.tags).toEqual(["cheap"]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	expect($(el, 'section.group[data-group="g1"]')).toBeNull();
});

test("with no restaurants, links to the restaurants page and still allows adding groups", async () => {
	const el = await mount();
	expect($(el, ".empty a")?.getAttribute("href")).toBe("./restaurants");
	expect($(el, "form.add-group")).not.toBeNull();
});

test("follows restaurant and group changes from elsewhere", async () => {
	const el = await mount();
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	await el.updateComplete;
	expect(card(el, "g1").querySelector('li.value[data-value="cheap"]')).not.toBeNull();
});

test("renders in Thai", async () => {
	setLang("th");
	const el = await mount();
	expect(cardTitles(el)).toEqual(["ประเภท", "สัญชาติอาหาร", "ย่าน", "แท็ก"]);
});
```

(The delete prompt uses "1 restaurants" via `{count}`; that is fine for the prompt. If you
prefer, add `.one` / `.other` prompt keys and update the expectation.)

- [ ] **Step 3: Run the tests to see them fail**

Run: `bun test tests/components/tag-manager.test.ts tests/components/app-header.test.ts`
Expected: FAIL (`Cannot find module '#components/tag-manager'`, header has four links).

- [ ] **Step 4: Implement**

`src/components/app-header.ts`: `Page` gains `"tags"`; insert
`{ page: "tags", href: "./tags", label: "nav.tags" }` after the restaurants link.

`src/types/global.d.ts`: `import type { TagManager } from "#components/tag-manager";` and
`"tag-manager": TagManager;`.

`src/routes/tags.html` — a copy of `settings.html` with title `Tags · What to Eat`,
`<app-header current="tags">`, `<script type="module" src="../components/tag-manager.ts">` and
`<main><tag-manager></tag-manager></main>`. Follow the `adding-a-page` skill.

`src/components/tag-manager.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { dropFilterGroup, loadFilter, saveFilter } from "#lib/filter";
import {
	addGroup,
	deleteGroup,
	type GroupDef,
	groupLabel,
	loadGroups,
	moveGroup,
	type NameError,
	onGroupsChanged,
	renameGroup,
	saveGroups,
	usingGroup,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { BUILT_IN_GROUPS, type Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged, saveRestaurants } from "#lib/store";
import { uiStyles } from "#styles/ui";

/** What the page is asking about right now; only one prompt is open at a time. */
type Prompt =
	| { kind: "rename-group"; id: string; text: string; error?: NameError }
	| { kind: "delete-group"; id: string };

@customElement("tag-manager")
export class TagManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.25rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			section.group {
				gap: 0.75rem;
			}

			.group-head {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.group-head h2 {
				font-size: 1.125rem;
			}

			.values {
				display: grid;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			li.value {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 0.75rem;
			}

			li.value .name {
				font-weight: 600;
			}

			li.value .actions {
				margin-left: auto;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state() private restaurants: Restaurant[] = [];
	@state() private defs: GroupDef[] = [];
	@state() private prompt: Prompt | undefined;
	@state() private newName = "";
	@state() private addError: NameError | undefined;

	private unsubscribe: (() => void)[] = [];

	override connectedCallback(): void {
		super.connectedCallback();
		this.reload();
		this.unsubscribe = [
			onRestaurantsChanged(() => this.reload()),
			onGroupsChanged(() => this.reload()),
		];
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		for (const stop of this.unsubscribe) stop();
		this.unsubscribe = [];
	}

	private reload(): void {
		this.defs = loadGroups();
		this.restaurants = loadRestaurants();
	}

	private readonly addNewGroup = (event: Event): void => {
		event.preventDefault();
		const result = addGroup(this.defs, this.newName);
		if (!result.ok) {
			this.addError = result.error;
			return;
		}
		this.addError = undefined;
		this.newName = "";
		saveGroups(result.value);
	};

	private saveGroupName(id: string, text: string): void {
		const result = renameGroup(this.defs, id, text);
		if (!result.ok) {
			this.prompt = { kind: "rename-group", id, text, error: result.error };
			return;
		}
		this.prompt = undefined;
		saveGroups(result.value);
	}

	private confirmDeleteGroup(id: string): void {
		const result = deleteGroup(this.restaurants, this.defs, id, new Date());
		this.prompt = undefined;
		saveFilter(dropFilterGroup(loadFilter(), id));
		// Restaurants first: if the group list save fails, the next load still turns its values into tags.
		saveRestaurants(result.restaurants);
		saveGroups(result.groups);
	}

	override render() {
		const groups = [
			...BUILT_IN_GROUPS,
			...this.defs.map((def) => def.id),
			"tags",
		];
		return html`
			<h1>${t("tags.title")}</h1>
			<p class="muted">${t("tags.intro")}</p>
			${
				this.restaurants.length === 0
					? html`<div class="card empty">
							<p>${t("tags.empty")}</p>
							<a href="./restaurants">${t("tags.emptyLink")}</a>
						</div>`
					: nothing
			}
			${groups.map((group) => this.renderGroup(group))}
			${this.renderAddGroup()}
		`;
	}

	private renderGroup(group: string) {
		const index = this.defs.findIndex((def) => def.id === group);
		const custom = index >= 0;
		const label = groupLabel(group, this.defs);
		const values = valueCounts(this.restaurants, group);
		return html`
			<section class="card group" data-group=${group} aria-labelledby="title-${group}">
				<div class="group-head">
					${this.renderGroupTitle(group, label)}
					${custom ? this.renderGroupActions(group, label, index) : nothing}
				</div>
				${this.renderGroupPrompt(group, label)}
				${
					values.length === 0
						? html`<p class="muted">${t("tags.noValues")}</p>`
						: html`<ul class="values">
								${values.map(({ value, count }) => this.renderValue(group, value, count))}
							</ul>`
				}
			</section>
		`;
	}

	private renderGroupTitle(group: string, label: string) {
		const prompt = this.prompt;
		if (prompt?.kind === "rename-group" && prompt.id === group)
			return html`<form
				class="rename"
				@submit=${(event: Event) => {
					event.preventDefault();
					this.saveGroupName(group, prompt.text);
				}}
			>
				<label class="visually-hidden" for="rename-${group}">${t("tags.addLabel")}</label>
				<input
					id="rename-${group}"
					.value=${live(prompt.text)}
					@input=${(event: Event) => {
						this.prompt = { ...prompt, text: (event.target as HTMLInputElement).value, error: undefined };
					}}
				/>
				<button type="submit" class="primary" data-action="save-group-name">${t("tags.save")}</button>
				<button type="button" data-action="cancel" @click=${() => (this.prompt = undefined)}>${t("tags.cancel")}</button>
				${prompt.error ? html`<p class="error" role="alert">${t(prompt.error)}</p>` : nothing}
			</form>`;
		return html`<h2 id="title-${group}">${label}</h2>`;
	}

	private renderGroupActions(group: string, label: string, index: number) {
		return html`<div class="actions">
			<button type="button" data-action="rename-group" @click=${() => {
				this.prompt = { kind: "rename-group", id: group, text: label };
			}}>${t("tags.rename")}</button>
			<button
				type="button"
				data-action="move-up"
				aria-label=${t("tags.moveUp", { group: label })}
				?disabled=${index === 0}
				@click=${() => saveGroups(moveGroup(this.defs, group, -1))}
			>↑</button>
			<button
				type="button"
				data-action="move-down"
				aria-label=${t("tags.moveDown", { group: label })}
				?disabled=${index === this.defs.length - 1}
				@click=${() => saveGroups(moveGroup(this.defs, group, 1))}
			>↓</button>
			<button type="button" class="danger" data-action="delete-group" @click=${() => {
				this.prompt = { kind: "delete-group", id: group };
			}}>${t("tags.delete")}</button>
		</div>`;
	}

	private renderGroupPrompt(group: string, label: string) {
		const prompt = this.prompt;
		if (prompt?.kind !== "delete-group" || prompt.id !== group) return nothing;
		return html`<div role="alert">
			<p>${t("tags.deleteGroupPrompt", { group: label, count: usingGroup(this.restaurants, group) })}</p>
			<div class="actions">
				<button type="button" class="danger" data-action="confirm-delete-group" @click=${() => this.confirmDeleteGroup(group)}>
					${t("tags.confirmDelete")}
				</button>
				<button type="button" data-action="cancel" @click=${() => (this.prompt = undefined)}>${t("tags.cancel")}</button>
			</div>
		</div>`;
	}

	/** Task 12 adds the value actions here. */
	private renderValue(group: string, value: string, count: number) {
		return html`<li class="value" data-value=${value}>
			<span class="name">${valueLabel(group, value)}</span>
			<span class="count muted">${count === 1 ? t("tags.count.one") : t("tags.count.other", { count })}</span>
		</li>`;
	}

	private renderAddGroup() {
		return html`<form class="card add-group" novalidate @submit=${this.addNewGroup}>
			<h2>${t("tags.addTitle")}</h2>
			<label>
				${t("tags.addLabel")}
				<input
					id="new-group"
					autocomplete="off"
					aria-invalid=${this.addError ? "true" : "false"}
					.value=${live(this.newName)}
					@input=${(event: Event) => {
						this.newName = (event.target as HTMLInputElement).value;
						this.addError = undefined;
					}}
				/>
			</label>
			${this.addError ? html`<p class="error" role="alert">${t(this.addError)}</p>` : nothing}
			<div class="actions"><button type="submit" class="primary">${t("tags.add")}</button></div>
		</form>`;
	}
}
```

Check `uiStyles` for a `.visually-hidden` class (the home page uses one); if it lives only in
`random-picker`, move it into `src/styles/ui.ts`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `bun test tests/components/tag-manager.test.ts tests/components/app-header.test.ts tests/routes/pages.test.ts tests/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format && git add -A
git commit -m "feat(components): tags page lists groups with counts and manages custom groups"
```

---

### Task 12: Tags page — value actions

**Files:**
- Modify: `src/components/tag-manager.ts`, `src/lib/i18n.ts`
- Test: `tests/components/tag-manager.test.ts`

**Interfaces:**
- Consumes: `checkValue`, `renameValue`, `moveValue`, `deleteValue`, `type ValueError`
  (Task 9); `renameFilterValue`, `moveFilterValue`, `dropFilterValue` (Task 10).
- Produces: value buttons `data-action="rename-value" | "move-value" | "delete-value"`,
  `"save-value"`, `"confirm-merge"`, `"confirm-move"`, `"confirm-delete-value"`, `"cancel"`;
  the move form has `select[name="target"]`.

- [ ] **Step 1: i18n keys** (en / th)

| key | en | th |
| --- | --- | --- |
| `tags.move` | Move to… | ย้ายไป… |
| `tags.moveLabel` | Move {value} to | ย้าย {value} ไปที่ |
| `tags.renameLabel` | New name for {value} | ชื่อใหม่ของ {value} |
| `tags.mergePrompt` | {to} already exists. Merge {from} into {to} on {count} restaurants? | มี {to} อยู่แล้ว รวม {from} เข้ากับ {to} ใน {count} ร้านหรือไม่ |
| `tags.confirmMerge` | Merge | รวม |
| `tags.deleteValuePrompt` | Remove {value} from {count} restaurants? | ลบ {value} ออกจาก {count} ร้านหรือไม่ |
| `tags.valueRequired` | Value is required. | กรุณาใส่ค่า |
| `tags.valueComma` | A value cannot contain a comma. | ค่าต้องไม่มีจุลภาค |

- [ ] **Step 2: Write the failing tests**

```ts
const valueRow = (el: TagManager, group: string, value: string) =>
	card(el, group).querySelector<HTMLElement>(`li.value[data-value="${value}"]`)!;

test("Type values show counts only", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	const el = await mount();
	expect(valueRow(el, "kind", "food").querySelector("button")).toBeNull();
	expect(valueRow(el, "kind", "food").querySelector(".name")?.textContent).toBe("Food");
});

test("renaming a value changes it on every restaurant and in the saved filter", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thia", "lao"] } });
	localStorage.setItem(FILTER_KEY, JSON.stringify({ cuisine: { include: ["thia"], exclude: [] } }));
	const el = await mount();
	await click(el, valueRow(el, "cuisine", "thia"), "rename-value");
	await typeIn(el, valueRow(el, "cuisine", "thia").querySelector("input")!, " Thai ");
	await click(el, valueRow(el, "cuisine", "thia"), "save-value");
	expect(loadRestaurants().map((item) => item.groups.cuisine)).toEqual([["thai"], ["thai", "lao"]]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({ cuisine: { include: ["thai"], exclude: [] } });
});

test("renaming to blank text or text with a comma shows an error and changes nothing", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await click(el, valueRow(el, "cuisine", "thai"), "rename-value");
	const input = valueRow(el, "cuisine", "thai").querySelector("input")!;
	await typeIn(el, input, "  ");
	await click(el, valueRow(el, "cuisine", "thai"), "save-value");
	expect(valueRow(el, "cuisine", "thai").querySelector(".error")?.textContent).toBe("Value is required.");
	await typeIn(el, input, "thai, lao");
	await click(el, valueRow(el, "cuisine", "thai"), "save-value");
	expect(valueRow(el, "cuisine", "thai").querySelector(".error")?.textContent).toBe("A value cannot contain a comma.");
	expect(loadRestaurants()[0]?.groups.cuisine).toEqual(["thai"]);
});

test("renaming onto an existing value asks to merge, and merging keeps one copy", async () => {
	// The group must exist before the restaurant, or its values are saved as plain tags.
	saveGroups([{ id: "g1", name: "Dish" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["noodles", "noodle"] } });
	const el = await mount();
	await click(el, valueRow(el, "g1", "noodles"), "rename-value");
	await typeIn(el, valueRow(el, "g1", "noodles").querySelector("input")!, "noodle");
	await click(el, valueRow(el, "g1", "noodles"), "save-value");
	expect(valueRow(el, "g1", "noodles").textContent).toContain("noodle already exists. Merge noodles into noodle on 1 restaurants?");
	await click(el, valueRow(el, "g1", "noodles"), "confirm-merge");
	expect(loadRestaurants()[0]?.groups.g1).toEqual(["noodle"]);
});

test("moving a value offers every group but Type and its own, and moves it", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { area: ["cheap"] } });
	const el = await mount();
	await click(el, valueRow(el, "area", "cheap"), "move-value");
	const select = valueRow(el, "area", "cheap").querySelector("select")!;
	expect([...select.options].map((option) => option.value)).toEqual(["cuisine", "g1", "tags"]);
	select.value = "g1";
	select.dispatchEvent(new Event("change"));
	await el.updateComplete;
	await click(el, valueRow(el, "area", "cheap"), "confirm-move");
	expect(loadRestaurants()[0]?.groups).toEqual({ g1: ["cheap"] });
});

test("deleting a value asks first, then removes it everywhere", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy", "hot"] });
	const el = await mount();
	await click(el, valueRow(el, "tags", "spicy"), "delete-value");
	expect(valueRow(el, "tags", "spicy").textContent).toContain("Remove spicy from 1 restaurants?");
	await click(el, valueRow(el, "tags", "spicy"), "confirm-delete-value");
	expect(loadRestaurants()[0]?.tags).toEqual(["hot"]);
});

test("cancel closes a value prompt without changes", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy"] });
	const el = await mount();
	await click(el, valueRow(el, "tags", "spicy"), "delete-value");
	await click(el, valueRow(el, "tags", "spicy"), "cancel");
	expect(valueRow(el, "tags", "spicy").querySelector('[data-action="confirm-delete-value"]')).toBeNull();
	expect(loadRestaurants()[0]?.tags).toEqual(["spicy"]);
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `bun test tests/components/tag-manager.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

Extend `Prompt`:

```ts
	| { kind: "rename-value"; group: string; value: string; text: string; error?: ValueError }
	| { kind: "merge"; group: string; value: string; to: string }
	| { kind: "move-value"; group: string; value: string; to: string }
	| { kind: "delete-value"; group: string; value: string };
```

Add methods. Save the filter **before** restaurants (see Task 13 for why):

```ts
	private saveValueName(group: string, value: string, text: string): void {
		const checked = checkValue(text);
		if (!checked.ok) {
			this.prompt = { kind: "rename-value", group, value, text, error: checked.error };
			return;
		}
		const to = checked.value;
		if (to !== value && valueCounts(this.restaurants, group).some((item) => item.value === to)) {
			this.prompt = { kind: "merge", group, value, to };
			return;
		}
		this.applyRename(group, value, to);
	}

	private applyRename(group: string, value: string, to: string): void {
		this.prompt = undefined;
		saveFilter(renameFilterValue(loadFilter(), group, value, to));
		saveRestaurants(renameValue(this.restaurants, group, value, to, new Date()));
	}

	private applyMove(group: string, value: string, to: string): void {
		this.prompt = undefined;
		saveFilter(moveFilterValue(loadFilter(), group, value, to));
		saveRestaurants(moveValue(this.restaurants, group, value, to, new Date()));
	}

	private applyDelete(group: string, value: string): void {
		this.prompt = undefined;
		saveFilter(dropFilterValue(loadFilter(), group, value));
		saveRestaurants(deleteValue(this.restaurants, group, value, new Date()));
	}

	/** Groups a value can move to: every group but Type and its own, then plain tags. */
	private moveTargets(group: string): string[] {
		return [...VALUE_GROUPS, ...this.defs.map((def) => def.id), "tags"].filter(
			(id) => id !== group,
		);
	}
```

Replace `renderValue`:

```ts
	private renderValue(group: string, value: string, count: number) {
		const countText = count === 1 ? t("tags.count.one") : t("tags.count.other", { count });
		const prompt = this.prompt;
		const mine =
			prompt !== undefined &&
			prompt.kind !== "rename-group" &&
			prompt.kind !== "delete-group" &&
			prompt.group === group &&
			prompt.value === value
				? prompt
				: undefined;
		return html`<li class="value" data-value=${value}>
			<span class="name">${valueLabel(group, value)}</span>
			<span class="count muted">${countText}</span>
			${group === "kind" ? nothing : this.renderValueBody(group, value, count, mine)}
		</li>`;
	}
```

and add `renderValueBody(group, value, count, prompt)` that renders, by `prompt?.kind`:

- `undefined`: an `.actions` div with Rename (`rename-value`, opens
  `{ kind: "rename-value", group, value, text: value }`), Move to… (`move-value`, opens
  `{ kind: "move-value", group, value, to: this.moveTargets(group)[0] ?? "tags" }`) and Delete
  (`delete-value`, class `danger`).
- `"rename-value"`: a `form` with a visually hidden label `t("tags.renameLabel", { value })`,
  an input bound to `prompt.text` (input updates `text` and clears `error`), a `save-value`
  submit button calling `saveValueName(group, value, prompt.text)`, a `cancel` button, and
  `p.error` with `t(prompt.error)` when set.
- `"merge"`: `role="alert"` block with
  `t("tags.mergePrompt", { from: value, to: prompt.to, count })`, a `confirm-merge` button calling
  `applyRename(group, value, prompt.to)`, and `cancel`.
- `"move-value"`: a `form` with label `t("tags.moveLabel", { value })` and
  `<select name="target">` whose options are `moveTargets(group)` labelled with
  `groupLabel(id, this.defs)`; `@change` stores the chosen id in `prompt.to`; a
  `confirm-move` button calling `applyMove(group, value, prompt.to)`, and `cancel`.
- `"delete-value"`: `role="alert"` block with `t("tags.deleteValuePrompt", { value, count })`,
  a `confirm-delete-value` danger button calling `applyDelete(group, value)`, and `cancel`.

Every `cancel` button sets `this.prompt = undefined`. Opening any prompt replaces the one that
was open.

- [ ] **Step 5: Run the tests to see them pass**

Run: `bun test tests/components/tag-manager.test.ts tests/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format && git add -A
git commit -m "feat(components): rename, merge, move and delete values on the tags page"
```

---

### Task 13: Home filter follows changes from another tab

**Files:**
- Modify: `src/components/random-picker.ts`
- Test: `tests/components/random-picker.test.ts`

**Why:** the Tags page saves the renamed filter first, then the restaurants. A home page open
in another tab gets the filter storage event first. If it pruned at that moment, its old
restaurant list would not contain the new value yet and it would drop it. So on a filter event
the home page reloads the filter **without pruning**. The restaurant event that follows prunes
against the new list, where the value now exists.

- [ ] **Step 1: Write the failing test**

```ts
test("a filter saved in another tab is picked up without dropping values not yet loaded", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	localStorage.setItem(FILTER_KEY, JSON.stringify({ cuisine: { include: ["thia"], exclude: [] } }));
	const el = await mount();
	// Another tab renames thia to thai: filter first, then restaurants.
	localStorage.setItem(FILTER_KEY, JSON.stringify({ cuisine: { include: ["thai"], exclude: [] } }));
	window.dispatchEvent(new StorageEvent("storage", { key: FILTER_KEY }));
	await el.updateComplete;
	const [item] = loadRestaurants();
	saveRestaurants([{ ...item!, groups: { cuisine: ["thai"] } }]);
	await el.updateComplete;
	expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({ cuisine: { include: ["thai"], exclude: [] } });
	expect(tagButton(el, "thai", "cuisine")?.dataset.state).toBe("include");
});
```

Import `loadRestaurants` and `saveRestaurants` from `#lib/store`.

- [ ] **Step 2: Run the test to see it fail**

Run: `bun test tests/components/random-picker.test.ts`
Expected: FAIL (the home page still shows the old filter).

- [ ] **Step 3: Implement**

In `connectedCallback`, add a third subscription:

```ts
		// Another tab saved the filter (for example after renaming a value): take it as it is.
		// Pruning waits for the restaurant change that follows.
		this.unsubscribeFilter = onFilterChanged(() => {
			this.filter = loadFilter();
			this.keepPickInPool();
		});
```

Unsubscribe in `disconnectedCallback`; import `onFilterChanged` from `#lib/filter`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/components/random-picker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && git add -A
git commit -m "fix(components): home filter follows a filter saved in another tab"
```

---

### Task 14: Stage 2 docs and pull request

**Files:**
- Modify: `README.md`, `IDEAS.md`

- [ ] **Step 1: Docs**

- `README.md`: add `| `/tags` | Groups and their values: counts, add, rename, reorder and delete groups; rename, merge, move and delete values |`
  to the pages table, and add `tags` to the routes list in "Project layout".
- `IDEAS.md`: delete the "Rename or merge a tag" bullet.

- [ ] **Step 2: Full check list, then commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "docs: tags page in readme; drop the shipped rename idea"
```

- [ ] **Step 3: Push and open the stage 2 PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "feat: tags page to manage groups and values" --body "$(cat <<'EOF'
## Summary
- New Tags page (`/tags`): a card per group with value counts.
- Custom groups: add, rename, reorder, delete (values become plain tags).
- Values: rename (merging into an existing value), move to another group, delete.
- The saved home filter follows every rename, move and delete, also across tabs.

Stage 2 of `docs/superpowers/specs/2026-10-14-tag-groups-design.md`.

## Test plan
- [x] bun run check
- [x] bun run test
- [x] bun run build
- [ ] Preview: add a "Price" group, give a restaurant "cheap", filter by it on the home page
- [ ] Preview: rename a value used in the home filter; the filter keeps it
- [ ] Preview: delete a group; its values show as plain tags
- [ ] Preview: phone width — header with five links, cards and prompts wrap

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```

Report the PR link and the preview URL, then stop for approval.
