import { afterEach, beforeEach, expect, test } from "bun:test";
import { type Filter, LIST_FILTER } from "#lib/filter";
import type { GroupDef } from "#lib/groups";
import { setLang } from "#lib/i18n";
import { groupValues, nameFromText, type Restaurant } from "#lib/restaurant";
import {
	editValue,
	loadPick,
	PICK_KEY,
	savePick,
	tagEntries,
	tagGroups,
	valueTargets,
	wouldMerge,
} from "#lib/tags";

const make = (
	id: string,
	groups: Restaurant["groups"] = {},
	extra: Partial<Restaurant> = {},
): Restaurant => ({
	id,
	name: nameFromText(id),
	tags: [],
	links: [],
	notes: "",
	groups,
	kinds: [],
	createdAt: "2026-10-16T00:00:00.000Z",
	updatedAt: "2026-10-16T00:00:00.000Z",
	...extra,
});

const price: GroupDef = { id: "g1", name: "Price" };
const NOW = new Date("2026-10-17T00:00:00.000Z");

beforeEach(() => {
	setLang("en");
	sessionStorage.clear();
});
afterEach(() => sessionStorage.clear());

test("tagGroups lists Type, built-ins, custom groups, then plain tags with counts", () => {
	const list = [
		make(
			"a",
			{ cuisine: ["thai", "lao"], g1: ["$"] },
			{ kinds: ["food"], tags: ["spicy"] },
		),
		make("b", {}, { kinds: ["food"] }),
	];
	const groups = tagGroups(list, [price]);
	expect(groups.map((group) => group.id)).toEqual([
		"kind",
		"cuisine",
		"area",
		"g1",
		"tags",
	]);
	expect(groups.map((group) => group.kind)).toEqual([
		"fixed",
		"built-in",
		"built-in",
		"custom",
		"tags",
	]);
	expect(groups.find((group) => group.id === "cuisine")).toMatchObject({
		values: 2,
		restaurants: 1,
	});
	expect(groups.find((group) => group.id === "area")).toMatchObject({
		values: 0,
		restaurants: 0,
	});
	expect(groups.find((group) => group.id === "g1")?.label).toBe("Price");
});

test("tagEntries puts groups first, then values most used first", () => {
	const list = [
		make("a", { cuisine: ["thai"] }, { kinds: ["food"] }),
		make("b", { cuisine: ["thai", "lao"] }, { kinds: ["food"] }),
	];
	const entries = tagEntries(list, [price]);
	expect(entries.slice(0, 5)).toEqual([
		{ type: "group", group: "kind", name: "Type" },
		{ type: "group", group: "cuisine", name: "Cuisine" },
		{ type: "group", group: "area", name: "Area" },
		{ type: "group", group: "g1", name: "Price" },
		{ type: "group", group: "tags", name: "Tags" },
	]);
	const values = entries.slice(5);
	const kindIndex = values.findIndex(
		(entry) =>
			entry.type === "value" &&
			entry.group === "kind" &&
			entry.value === "food",
	);
	const cuisineIndex = values.findIndex(
		(entry) => entry.type === "value" && entry.group === "cuisine",
	);
	expect(kindIndex).toBeGreaterThanOrEqual(0);
	expect(kindIndex).toBeLessThan(cuisineIndex);
	expect(
		values.filter(
			(entry) => entry.type === "value" && entry.group === "cuisine",
		),
	).toEqual([
		{ type: "value", group: "cuisine", value: "thai", name: "thai", count: 2 },
		{ type: "value", group: "cuisine", value: "lao", name: "lao", count: 1 },
	]);
});

test("valueTargets never offers Type", () => {
	expect(valueTargets([price])).toEqual(["cuisine", "area", "g1", "tags"]);
});

test("wouldMerge only when the target already has the value", () => {
	const list = [make("a", { cuisine: ["thai", "lao"] })];
	const from = { group: "cuisine", value: "thai" };
	expect(wouldMerge(list, from, from)).toBe(false);
	expect(
		wouldMerge(
			list,
			{ group: "cuisine", value: "lao" },
			{ group: "cuisine", value: "thai" },
		),
	).toBe(true);
	const withArea = [make("a", { cuisine: ["thai"], area: ["thai"] })];
	expect(
		wouldMerge(
			withArea,
			{ group: "cuisine", value: "thai" },
			{ group: "area", value: "thai" },
		),
	).toBe(true);
	const withoutArea = [make("a", { cuisine: ["thai"] })];
	expect(
		wouldMerge(
			withoutArea,
			{ group: "cuisine", value: "thai" },
			{ group: "area", value: "thai" },
		),
	).toBe(false);
});

test("editValue renames then moves, keeping one copy and following the filter", () => {
	const list = [make("a", { cuisine: ["thai"], area: ["Thai"] })];
	const filter: Filter = { cuisine: { include: ["thai"], exclude: [] } };
	const result = editValue(
		list,
		filter,
		{ group: "cuisine", value: "thai" },
		{ group: "area", value: "Thai" },
		NOW,
	);
	const [item] = result.restaurants;
	expect(item).toBeDefined();
	expect(groupValues(item!, "cuisine")).toEqual([]);
	expect(groupValues(item!, "area")).toEqual(["Thai"]);
	expect(result.filter).toEqual({ area: { include: ["Thai"], exclude: [] } });
});

test("editValue keeps a value moved into plain tags in a filter that filters them", () => {
	const list = [make("a", { area: ["siam"] })];
	const filter: Filter = { area: { include: [], exclude: ["siam"] } };
	const from = { group: "area", value: "siam" };
	const to = { group: "tags", value: "siam" };
	expect(editValue(list, filter, from, to, NOW).filter).toEqual({});
	expect(editValue(list, filter, from, to, NOW, LIST_FILTER).filter).toEqual({
		tags: { include: [], exclude: ["siam"] },
	});
});

test("loadPick falls back to cuisine for a missing or unknown group", () => {
	expect(loadPick(["cuisine", "g1"])).toBe("cuisine");
	savePick("g1");
	expect(loadPick(["cuisine", "g1"])).toBe("g1");
	expect(loadPick(["cuisine"])).toBe("cuisine");
	expect(PICK_KEY).toBe("whattoeat:tags-group");
});

test("loadPick and savePick swallow storage errors", () => {
	// A spy on Storage.prototype leaves happy-dom's storage refusing later writes (see
	// store.test.ts), so swap the global for one that throws on every call instead.
	const real = globalThis.sessionStorage;
	const blocked = () => {
		throw new Error("blocked");
	};
	Object.defineProperty(globalThis, "sessionStorage", {
		value: { getItem: blocked, setItem: blocked },
		configurable: true,
	});
	try {
		expect(loadPick(["cuisine", "g1"])).toBe("cuisine");
		expect(() => savePick("g1")).not.toThrow();
	} finally {
		Object.defineProperty(globalThis, "sessionStorage", {
			value: real,
			configurable: true,
		});
	}
});
