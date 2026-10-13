import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	applyFilter,
	cycleTag,
	EMPTY_FILTER,
	FILTER_KEY,
	isFilterActive,
	loadFilter,
	pruneFilter,
	saveFilter,
	tagState,
} from "#lib/filter";
import type { Restaurant } from "#lib/restaurant";

const make = (name: string, tags: string[]): Restaurant => ({
	id: name,
	name,
	tags,
	location: "",
	notes: "",
	createdAt: "2026-10-13T00:00:00.000Z",
	updatedAt: "2026-10-13T00:00:00.000Z",
});

const list = [
	make("A", ["thai"]),
	make("B", ["japanese"]),
	make("C", ["thai", "spicy"]),
	make("D", []),
];
const names = (items: Restaurant[]) => items.map((item) => item.name);

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("an empty filter keeps every restaurant", () => {
	expect(names(applyFilter(list, EMPTY_FILTER))).toEqual(["A", "B", "C", "D"]);
});

test("include keeps restaurants with any included tag", () => {
	expect(
		names(applyFilter(list, { include: ["thai", "japanese"], exclude: [] })),
	).toEqual(["A", "B", "C"]);
});

test("exclude drops restaurants with any excluded tag, untagged ones stay", () => {
	expect(names(applyFilter(list, { include: [], exclude: ["spicy"] }))).toEqual(
		["A", "B", "D"],
	);
});

test("include and exclude combine", () => {
	expect(
		names(applyFilter(list, { include: ["thai"], exclude: ["spicy"] })),
	).toEqual(["A"]);
});

test("a filter can match nothing", () => {
	expect(applyFilter(list, { include: ["pizza"], exclude: [] })).toEqual([]);
});

test("isFilterActive is true only when a list has tags", () => {
	expect(isFilterActive(EMPTY_FILTER)).toBe(false);
	expect(isFilterActive({ include: [], exclude: ["x"] })).toBe(true);
	expect(isFilterActive({ include: ["x"], exclude: [] })).toBe(true);
});

test("cycleTag goes off, include, exclude, off", () => {
	const included = cycleTag(EMPTY_FILTER, "thai");
	expect(included).toEqual({ include: ["thai"], exclude: [] });
	expect(tagState(included, "thai")).toBe("include");
	const excluded = cycleTag(included, "thai");
	expect(excluded).toEqual({ include: [], exclude: ["thai"] });
	expect(tagState(excluded, "thai")).toBe("exclude");
	const off = cycleTag(excluded, "thai");
	expect(off).toEqual(EMPTY_FILTER);
	expect(tagState(off, "thai")).toBe("off");
});

test("cycleTag leaves other tags alone", () => {
	expect(cycleTag({ include: ["a"], exclude: ["b"] }, "c")).toEqual({
		include: ["a", "c"],
		exclude: ["b"],
	});
});

test("pruneFilter drops tags that are no longer known", () => {
	expect(
		pruneFilter({ include: ["thai", "gone"], exclude: ["old"] }, ["thai"]),
	).toEqual({ include: ["thai"], exclude: [] });
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

test("loadFilter normalizes tags, drops non-strings and blanks, and resolves conflicts toward include", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({
			include: ["Thai", 1, " ", "THAI"],
			exclude: ["thai", "Spicy"],
		}),
	);
	expect(loadFilter()).toEqual({ include: ["thai"], exclude: ["spicy"] });
});

test("saveFilter round-trips through loadFilter", () => {
	saveFilter({ include: ["thai"], exclude: ["spicy"] });
	expect(loadFilter()).toEqual({ include: ["thai"], exclude: ["spicy"] });
});

test("saveFilter does not throw when storage refuses the write", () => {
	const spy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("QuotaExceededError");
	});
	try {
		expect(() => saveFilter({ include: ["x"], exclude: [] })).not.toThrow();
	} finally {
		spy.mockRestore();
	}
});
