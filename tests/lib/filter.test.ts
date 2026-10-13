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
	area: "",
	cuisine: "",
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

test("the filter has type, cuisine and area groups, not tags", () => {
	expect(Object.keys(EMPTY_FILTER).sort()).toEqual(["area", "cuisine", "kind"]);
});

test("tags do not affect the filter", () => {
	const tagged = [make("A", { tags: ["thai"] }), make("B")];
	expect(names(applyFilter(tagged, EMPTY_FILTER))).toEqual(["A", "B"]);
});

const places = [
	make("Noodle", { area: "siam", cuisine: "thai", kinds: ["food"] }),
	make("Cafe", { area: "ari", cuisine: "", kinds: ["drinks", "dessert"] }),
	make("Sushi", { area: "siam", cuisine: "japanese", kinds: ["food"] }),
	make("Bingsu", { area: "siam", cuisine: "korean", kinds: ["dessert"] }),
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
	expect(off).toEqual(EMPTY_FILTER);
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

test("pruneFilter drops values no restaurant uses in that group any more", () => {
	const filter: Filter = {
		...kinds(["food"], ["dessert"]),
		area: { include: ["siam"], exclude: ["gone"] },
	};
	expect(pruneFilter(filter, [make("A", { kinds: ["food"] })])).toEqual(
		kinds(["food"]),
	);
	expect(pruneFilter(filter, places)).toEqual({
		...kinds(["food"], ["dessert"]),
		area: { include: ["siam"], exclude: [] },
	});
});

test("loadFilter gives the empty filter when nothing is stored", () => {
	expect(loadFilter()).toEqual(EMPTY_FILTER);
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
