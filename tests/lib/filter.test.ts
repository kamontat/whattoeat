import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	applyFilter,
	dropFilterGroup,
	dropFilterValue,
	EMPTY_FILTER,
	FILTER_KEY,
	type Filter,
	isFilterActive,
	LIST_FILTER,
	LIST_FILTER_KEY,
	loadFilter,
	moveFilterValue,
	onFilterChanged,
	pruneFilter,
	renameFilterValue,
	saveFilter,
	setTagState,
	tagState,
} from "#lib/filter";
import { nameFromText, type Restaurant } from "#lib/restaurant";

const make = (name: string, extra: Partial<Restaurant> = {}): Restaurant => ({
	id: name,
	name: nameFromText(name),
	tags: [],
	link: "",
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
const names = (items: Restaurant[]) => items.map((item) => item.name.en);
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

test("setTagState works on a group missing from the filter", () => {
	expect(setTagState({}, "g1", "cheap", "include")).toEqual({
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
	const filter = setTagState(EMPTY_FILTER, "cuisine", "thai", "include");
	expect(names(applyFilter(places, filter))).toEqual(["Noodle"]);
});

test("isFilterActive is true only when some group has a value", () => {
	expect(isFilterActive(EMPTY_FILTER)).toBe(false);
	expect(isFilterActive(kinds([], ["food"]))).toBe(true);
	expect(
		isFilterActive(setTagState(EMPTY_FILTER, "area", "siam", "include")),
	).toBe(true);
});

test("setTagState moves a value straight to the asked state", () => {
	const included = setTagState(EMPTY_FILTER, "kind", "food", "include");
	expect(included).toEqual(kinds(["food"]));
	const excluded = setTagState(included, "kind", "food", "exclude");
	expect(excluded).toEqual(kinds([], ["food"]));
	expect(setTagState(excluded, "kind", "food", "include")).toEqual(
		kinds(["food"]),
	);
});

test("setTagState off removes the value and drops a group left empty", () => {
	expect(setTagState(kinds(["food"]), "kind", "food", "off")).toEqual(
		EMPTY_FILTER,
	);
	expect(
		setTagState(kinds(["food"], ["drinks"]), "kind", "food", "off"),
	).toEqual(kinds([], ["drinks"]));
});

test("setTagState leaves other values and groups alone", () => {
	const start = setTagState(
		kinds(["food"], ["drinks"]),
		"area",
		"thai",
		"include",
	);
	expect(setTagState(start, "kind", "dessert", "include")).toEqual({
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
	const filter = setTagState(
		kinds(["food"], ["drinks"]),
		"area",
		"siam",
		"include",
	);
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

const f = (include: string[], exclude: string[] = []) => ({ include, exclude });

test("renameFilterValue renames in its own list and keeps one copy", () => {
	expect(
		renameFilterValue(
			{ g1: f(["noodles", "noodle"]), g2: f(["noodles"]) },
			"g1",
			"noodles",
			"noodle",
		),
	).toEqual({ g1: f(["noodle"]), g2: f(["noodles"]) });
	expect(renameFilterValue({ g1: f([], ["a"]) }, "g1", "a", "b")).toEqual({
		g1: f([], ["b"]),
	});
});

test("renameFilterValue onto a value in the other list keeps it included", () => {
	expect(renameFilterValue({ g1: f(["b"], ["a"]) }, "g1", "a", "b")).toEqual({
		g1: f(["b"]),
	});
});

test("moveFilterValue carries the state to the target group, or drops it for tags", () => {
	expect(moveFilterValue({ g1: f(["cheap"]) }, "g1", "cheap", "g2")).toEqual({
		g2: f(["cheap"]),
	});
	expect(
		moveFilterValue({ g1: f([], ["cheap"]) }, "g1", "cheap", "tags"),
	).toEqual({});
});

test("dropFilterValue and dropFilterGroup remove and tidy up", () => {
	expect(dropFilterValue({ g1: f(["a", "b"]) }, "g1", "a")).toEqual({
		g1: f(["b"]),
	});
	expect(dropFilterValue({ g1: f(["a"]) }, "g1", "a")).toEqual({});
	expect(dropFilterGroup({ g1: f(["a"]), area: f(["siam"]) }, "g1")).toEqual({
		area: f(["siam"]),
	});
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

test("the list filter keeps plain tags, stored apart from the home filter", () => {
	const filter: Filter = { tags: f(["thai"], ["spicy"]), area: f(["siam"]) };
	saveFilter(filter, LIST_FILTER);
	expect(localStorage.getItem(LIST_FILTER_KEY)).not.toBeNull();
	expect(localStorage.getItem(FILTER_KEY)).toBeNull();
	expect(loadFilter(LIST_FILTER)).toEqual(filter);
	expect(loadFilter()).toEqual(EMPTY_FILTER);
});

test("plain tags filter restaurants like any group", () => {
	const tagged = [
		make("A", { tags: ["thai", "spicy"] }),
		make("B", { tags: ["thai"] }),
		make("C"),
	];
	expect(names(applyFilter(tagged, { tags: f(["thai"], ["spicy"]) }))).toEqual([
		"B",
	]);
});

test("pruneFilter keeps used plain tags for the list filter", () => {
	const items = [make("A", { tags: ["thai"] })];
	expect(
		pruneFilter(
			{ tags: f(["thai", "gone"]) },
			items,
			["kind", "tags"],
			LIST_FILTER,
		),
	).toEqual({ tags: f(["thai"]) });
});

test("moveFilterValue carries the state into plain tags for the list filter", () => {
	expect(
		moveFilterValue(
			{ g1: f([], ["cheap"]) },
			"g1",
			"cheap",
			"tags",
			LIST_FILTER,
		),
	).toEqual({ tags: f([], ["cheap"]) });
});

test("onFilterChanged listens to the list filter key when asked", () => {
	let count = 0;
	const stop = onFilterChanged(() => count++, LIST_FILTER);
	window.dispatchEvent(new StorageEvent("storage", { key: FILTER_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: LIST_FILTER_KEY }));
	stop();
	expect(count).toBe(1);
});
