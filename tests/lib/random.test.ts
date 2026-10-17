import { expect, test } from "bun:test";
import {
	loadPickCount,
	PICK_COUNT_KEY,
	PICK_COUNTS,
	pickOptions,
	savePickCount,
} from "#lib/random";
import type { Restaurant } from "#lib/restaurant";

const make = (id: string): Restaurant => ({
	id,
	name: id,
	tags: [],
	link: "",
	notes: "",
	groups: {},
	kinds: [],
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

const ids = (list: Restaurant[]) => list.map((item) => item.id);

test("returns nothing for an empty list", () => {
	expect(pickOptions([])).toEqual([]);
});

test("returns the only item even when it was a previous pick", () => {
	expect(ids(pickOptions([make("a")], 2, ["a"]))).toEqual(["a"]);
});

test("returns two different items by default", () => {
	const list = [make("a"), make("b"), make("c")];
	for (const value of [0, 0.34, 0.67, 0.99]) {
		const picks = ids(pickOptions(list, undefined, [], () => value));
		expect(picks).toHaveLength(2);
		expect(new Set(picks).size).toBe(2);
	}
});

test("uses rng to choose each item from what is left", () => {
	const list = [make("a"), make("b"), make("c")];
	expect(ids(pickOptions(list, 2, [], () => 0))).toEqual(["a", "b"]);
	expect(ids(pickOptions(list, 2, [], () => 0.99))).toEqual(["c", "b"]);
});

test("prefers items that were not picked last time", () => {
	const list = [make("a"), make("b"), make("c"), make("d")];
	for (const value of [0, 0.34, 0.67, 0.99]) {
		expect(ids(pickOptions(list, 2, ["a", "b"], () => value)).sort()).toEqual([
			"c",
			"d",
		]);
	}
});

test("fills up with previous picks when there are not enough new ones", () => {
	const list = [make("a"), make("b"), make("c")];
	const picks = ids(pickOptions(list, 2, ["a", "b"], () => 0));
	expect(picks[0]).toBe("c");
	expect(["a", "b"]).toContain(picks[1]!);
});

test("with two items returns both", () => {
	const list = [make("a"), make("b")];
	expect(ids(pickOptions(list, 2, ["a", "b"], () => 0.5)).sort()).toEqual([
		"a",
		"b",
	]);
});

test("the pick counts run from one to five", () => {
	expect(PICK_COUNTS).toEqual([1, 2, 3, 4, 5]);
});

test("the pick count defaults to two", () => {
	localStorage.clear();
	expect(loadPickCount()).toBe(2);
});

test("the pick count is saved and read back", () => {
	localStorage.clear();
	savePickCount(4);
	expect(localStorage.getItem(PICK_COUNT_KEY)).toBe("4");
	expect(loadPickCount()).toBe(4);
	localStorage.clear();
});

test("a stored pick count outside 1 to 5 falls back to two", () => {
	for (const stored of ["0", "6", "2.5", "abc", ""]) {
		localStorage.setItem(PICK_COUNT_KEY, stored);
		expect(loadPickCount()).toBe(2);
	}
	localStorage.clear();
});
