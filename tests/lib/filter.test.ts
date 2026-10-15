import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	applyFilter,
	cycleTag,
	EMPTY_FILTER,
	FILTER_KEY,
	type Filter,
	isFilterActive,
	loadFilter,
	pruneFilter,
	saveFilter,
	tagState,
} from "#lib/filter";
import type { Restaurant } from "#lib/restaurant";

const make = (name: string, extra: Partial<Restaurant> = {}): Restaurant => ({
	id: name,
	name,
	tags: [],
	location: "",
	notes: "",
	groups: {},
	kinds: [],
	createdAt: "2026-10-13T00:00:00.000Z",
	updatedAt: "2026-10-13T00:00:00.000Z",
	...extra,
});

const list = [
	make("A", { kinds: ["food"] }),
	make("B", { kinds: ["drinks"] }),
	make("C", { kinds: ["food", "dessert"] }),
	make("D"),
];
const names = (items: Restaurant[]) => items.map((item) => item.name);
const kinds = (include: string[], exclude: string[] = []): Filter => ({
	...EMPTY_FILTER,
	kind: { include, exclude },
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("an empty filter keeps every restaurant", () => {
	expect(names(applyFilter(list, EMPTY_FILTER))).toEqual(["A", "B", "C", "D"]);
});

test("include keeps restaurants with any included value", () => {
	expect(names(applyFilter(list, kinds(["food", "drinks"])))).toEqual([
		"A",
		"B",
		"C",
	]);
});

test("exclude drops restaurants with any excluded value, ones without a value stay", () => {
	expect(names(applyFilter(list, kinds([], ["dessert"])))).toEqual([
		"A",
		"B",
		"D",
	]);
});

test("include and exclude combine", () => {
	expect(names(applyFilter(list, kinds(["food"], ["dessert"])))).toEqual(["A"]);
});

test("a filter can match nothing", () => {
	expect(
		applyFilter(list, {
			...EMPTY_FILTER,
			area: { include: ["x"], exclude: [] },
		}),
	).toEqual([]);
});

test("the empty filter has no groups", () => {
	expect(EMPTY_FILTER).toEqual({});
});

test("a custom group filters like a built-in one", () => {
	const items = [
		make("A", { groups: { g1: ["cheap"] } }),
		make("B", { groups: { g1: ["fancy"] } }),
		make("C"),
	];
	expect(
		names(applyFilter(items, { g1: { include: ["cheap"], exclude: [] } })),
	).toEqual(["A"]);
	expect(
		names(applyFilter(items, { g1: { include: [], exclude: ["cheap"] } })),
	).toEqual(["B", "C"]);
});

test("cycleTag works on a group missing from the filter", () => {
	expect(cycleTag({}, "g1", "cheap")).toEqual({
		g1: { include: ["cheap"], exclude: [] },
	});
	expect(tagState({}, "g1", "cheap")).toBe("off");
});

test("tags do not affect the filter", () => {
	const tagged = [make("A", { tags: ["thai"] }), make("B")];
	expect(names(applyFilter(tagged, EMPTY_FILTER))).toEqual(["A", "B"]);
});

const places = [
	make("Noodle", {
		groups: { area: ["siam"], cuisine: ["thai"] },
		kinds: ["food"],
	}),
	make("Cafe", { groups: { area: ["ari"] }, kinds: ["drinks", "dessert"] }),
	make("Sushi", {
		groups: { area: ["siam"], cuisine: ["japanese"] },
		kinds: ["food"],
	}),
	make("Bingsu", {
		groups: { area: ["siam"], cuisine: ["korean"] },
		kinds: ["dessert"],
	}),
];

test("values in one group match any, groups must all match", () => {
	const filter: Filter = {
		area: { include: ["siam"], exclude: [] },
		kind: { include: ["food", "dessert"], exclude: [] },
		cuisine: { include: [], exclude: ["japanese"] },
	};
	expect(names(applyFilter(places, filter))).toEqual(["Noodle", "Bingsu"]);
});

test("a restaurant with no value in an included group does not match it", () => {
	const filter = cycleTag(EMPTY_FILTER, "cuisine", "thai");
	expect(names(applyFilter(places, filter))).toEqual(["Noodle"]);
});

test("isFilterActive is true only when some group has a value", () => {
	expect(isFilterActive(EMPTY_FILTER)).toBe(false);
	expect(isFilterActive(kinds([], ["food"]))).toBe(true);
	expect(isFilterActive(cycleTag(EMPTY_FILTER, "area", "siam"))).toBe(true);
});

test("cycleTag goes off, include, exclude, off", () => {
	const included = cycleTag(EMPTY_FILTER, "kind", "food");
	expect(included).toEqual(kinds(["food"]));
	expect(tagState(included, "kind", "food")).toBe("include");
	const excluded = cycleTag(included, "kind", "food");
	expect(excluded).toEqual(kinds([], ["food"]));
	expect(tagState(excluded, "kind", "food")).toBe("exclude");
	const off = cycleTag(excluded, "kind", "food");
	// cycleTag always sets the group's key, even back to empty; it stays functionally
	// equivalent to EMPTY_FILTER (isFilterActive, matchesGroup, tagState all treat an empty
	// group the same as an absent one), but is not deep-equal to it.
	expect(off).toEqual(kinds([]));
	expect(tagState(off, "kind", "food")).toBe("off");
});

test("cycleTag leaves other values and groups alone", () => {
	const start = cycleTag(kinds(["food"], ["drinks"]), "area", "thai");
	expect(cycleTag(start, "kind", "dessert")).toEqual({
		...EMPTY_FILTER,
		kind: { include: ["food", "dessert"], exclude: ["drinks"] },
		area: { include: ["thai"], exclude: [] },
	});
	expect(tagState(start, "cuisine", "thai")).toBe("off");
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

test("loadFilter gives the empty filter when nothing is stored", () => {
	expect(loadFilter()).toEqual(EMPTY_FILTER);
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

test.each([
	["bad JSON", "{nope"],
	["null", "null"],
	["an array", "[]"],
	["a string", '"thai"'],
	["an older tag-only filter", '{"include":["thai"],"exclude":["spicy"]}'],
])("loadFilter gives the empty filter for %s", (_label, raw) => {
	localStorage.setItem(FILTER_KEY, raw);
	expect(loadFilter()).toEqual(EMPTY_FILTER);
});

test("loadFilter normalizes values, drops non-strings, blanks, unknown kinds and tags, and resolves conflicts toward include", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({
			tags: { include: ["thai"], exclude: [] },
			cuisine: { include: ["Thai", 1, " ", "THAI"], exclude: ["thai", "Lao"] },
			area: { include: " Siam ", exclude: ["Ari"] },
			kind: { include: ["Food", "pizza"], exclude: [] },
		}),
	);
	expect(loadFilter()).toEqual({
		cuisine: { include: ["thai"], exclude: ["lao"] },
		area: { include: [], exclude: ["ari"] },
		kind: { include: ["food"], exclude: [] },
	});
});

test("saveFilter round-trips through loadFilter", () => {
	const filter = cycleTag(kinds(["food"], ["drinks"]), "area", "siam");
	saveFilter(filter);
	expect(loadFilter()).toEqual(filter);
});

test("saveFilter does not throw when storage refuses the write", () => {
	const spy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("QuotaExceededError");
	});
	try {
		expect(() => saveFilter(kinds(["food"]))).not.toThrow();
	} finally {
		spy.mockRestore();
	}
});
