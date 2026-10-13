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

const make = (
	name: string,
	tags: string[],
	extra: Partial<Restaurant> = {},
): Restaurant => ({
	id: name,
	name,
	tags,
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
	make("A", ["thai"]),
	make("B", ["japanese"]),
	make("C", ["thai", "spicy"]),
	make("D", []),
];
const names = (items: Restaurant[]) => items.map((item) => item.name);
const tags = (include: string[], exclude: string[] = []): Filter => ({
	...EMPTY_FILTER,
	tags: { include, exclude },
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("an empty filter keeps every restaurant", () => {
	expect(names(applyFilter(list, EMPTY_FILTER))).toEqual(["A", "B", "C", "D"]);
});

test("include keeps restaurants with any included tag", () => {
	expect(names(applyFilter(list, tags(["thai", "japanese"])))).toEqual([
		"A",
		"B",
		"C",
	]);
});

test("exclude drops restaurants with any excluded tag, untagged ones stay", () => {
	expect(names(applyFilter(list, tags([], ["spicy"])))).toEqual([
		"A",
		"B",
		"D",
	]);
});

test("include and exclude combine", () => {
	expect(names(applyFilter(list, tags(["thai"], ["spicy"])))).toEqual(["A"]);
});

test("a filter can match nothing", () => {
	expect(applyFilter(list, tags(["pizza"]))).toEqual([]);
});

const places = [
	make("Noodle", [], { area: "siam", cuisine: "thai", kinds: ["food"] }),
	make("Cafe", [], { area: "ari", cuisine: "", kinds: ["drinks", "dessert"] }),
	make("Sushi", [], { area: "siam", cuisine: "japanese", kinds: ["food"] }),
	make("Bingsu", [], { area: "siam", cuisine: "korean", kinds: ["dessert"] }),
];

test("values in one group match any, groups must all match", () => {
	const filter: Filter = {
		...EMPTY_FILTER,
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
	expect(isFilterActive(tags([], ["x"]))).toBe(true);
	expect(isFilterActive(cycleTag(EMPTY_FILTER, "kind", "food"))).toBe(true);
});

test("cycleTag goes off, include, exclude, off", () => {
	const included = cycleTag(EMPTY_FILTER, "tags", "thai");
	expect(included).toEqual(tags(["thai"]));
	expect(tagState(included, "tags", "thai")).toBe("include");
	const excluded = cycleTag(included, "tags", "thai");
	expect(excluded).toEqual(tags([], ["thai"]));
	expect(tagState(excluded, "tags", "thai")).toBe("exclude");
	const off = cycleTag(excluded, "tags", "thai");
	expect(off).toEqual(EMPTY_FILTER);
	expect(tagState(off, "tags", "thai")).toBe("off");
});

test("cycleTag leaves other values and groups alone", () => {
	const start = cycleTag(tags(["a"], ["b"]), "area", "thai");
	expect(cycleTag(start, "tags", "c")).toEqual({
		...EMPTY_FILTER,
		tags: { include: ["a", "c"], exclude: ["b"] },
		area: { include: ["thai"], exclude: [] },
	});
	expect(tagState(start, "tags", "thai")).toBe("off");
});

test("pruneFilter drops values no restaurant uses in that group any more", () => {
	const filter: Filter = {
		...tags(["thai", "gone"], ["old"]),
		area: { include: ["siam"], exclude: ["thai"] },
	};
	expect(pruneFilter(filter, list)).toEqual(tags(["thai"]));
	expect(pruneFilter(filter, places)).toEqual({
		...EMPTY_FILTER,
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
])("loadFilter gives the empty filter for %s", (_label, raw) => {
	localStorage.setItem(FILTER_KEY, raw);
	expect(loadFilter()).toEqual(EMPTY_FILTER);
});

test("loadFilter reads an older tag-only filter as the tags group", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ include: ["Thai"], exclude: ["spicy"] }),
	);
	expect(loadFilter()).toEqual(tags(["thai"], ["spicy"]));
});

test("loadFilter normalizes values, drops non-strings, blanks and unknown kinds, and resolves conflicts toward include", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({
			tags: { include: ["Thai", 1, " ", "THAI"], exclude: ["thai", "Spicy"] },
			area: { include: " Siam ", exclude: ["Ari"] },
			kind: { include: ["Food", "pizza"], exclude: [] },
			cuisine: "x",
		}),
	);
	expect(loadFilter()).toEqual({
		tags: { include: ["thai"], exclude: ["spicy"] },
		area: { include: [], exclude: ["ari"] },
		kind: { include: ["food"], exclude: [] },
		cuisine: { include: [], exclude: [] },
	});
});

test("saveFilter round-trips through loadFilter", () => {
	const filter = cycleTag(tags(["thai"], ["spicy"]), "kind", "dessert");
	saveFilter(filter);
	expect(loadFilter()).toEqual(filter);
});

test("saveFilter does not throw when storage refuses the write", () => {
	const spy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("QuotaExceededError");
	});
	try {
		expect(() => saveFilter(tags(["x"]))).not.toThrow();
	} finally {
		spy.mockRestore();
	}
});
