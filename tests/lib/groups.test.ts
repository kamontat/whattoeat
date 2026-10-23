import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	addGroup,
	allGroupIds,
	builtInGroupNamed,
	checkValue,
	customChips,
	customGroupIds,
	deleteGroup,
	deleteValue,
	GROUPS_EVENT,
	GROUPS_KEY,
	groupLabel,
	isGroupDef,
	isGroupNameTaken,
	isGroupsMemoryOnly,
	loadGroups,
	mergeGroupDefs,
	moveGroup,
	moveValue,
	onGroupsChanged,
	type Result,
	remapGroups,
	renameGroup,
	renameValue,
	saveGroups,
	usingGroup,
	type ValueError,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import { setLang } from "#lib/i18n";
import { groupValues, nameFromText, type Restaurant } from "#lib/restaurant";

const make = (id: string, groups: Restaurant["groups"] = {}): Restaurant => ({
	id,
	name: nameFromText(id),
	tags: [],
	links: [],
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
	for (const id of ["kind", "cuisine", "area", "tags", "__proto__"])
		expect(isGroupDef({ id, name: "X" })).toBe(false);
	expect(isGroupDef(price)).toBe(true);
});

test("saveGroups round-trips, notifies, and falls back to memory when storage refuses", () => {
	const seen: string[] = [];
	const stop = onGroupsChanged(() => seen.push("x"));
	expect(saveGroups([price])).toBe(true);
	expect(loadGroups()).toEqual([price]);
	// happy-dom bypasses a mocked Storage.prototype.setItem after real writes, so swap the global.
	const real = globalThis.localStorage;
	const full = {
		getItem: () => null,
		setItem: () => {
			throw new Error("full");
		},
	};
	Object.defineProperty(globalThis, "localStorage", {
		value: full,
		configurable: true,
	});
	try {
		expect(saveGroups([price, vibe])).toBe(false);
		expect(isGroupsMemoryOnly()).toBe(true);
		expect(loadGroups()).toEqual([price, vibe]);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
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
	expect(allGroupIds([vibe, price])).toEqual([
		"kind",
		"cuisine",
		"area",
		"g2",
		"g1",
	]);
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
		customChips(
			make("a", { cuisine: ["thai"], g1: ["cheap"], g2: ["cosy", "quiet"] }),
			[vibe, price],
		),
	).toEqual(["Vibe: cosy", "Vibe: quiet", "Price: cheap"]);
});

test("mergeGroupDefs appends new groups in file order", () => {
	expect(mergeGroupDefs([price], [vibe])).toEqual({
		groups: [price, vibe],
		remap: {},
	});
});

test("mergeGroupDefs renames by id unless the new name is taken", () => {
	expect(
		mergeGroupDefs([price, vibe], [{ id: "g1", name: "Cost" }]).groups,
	).toEqual([{ id: "g1", name: "Cost" }, vibe]);
	expect(
		mergeGroupDefs([price, vibe], [{ id: "g1", name: "vibe" }]).groups,
	).toEqual([price, vibe]);
});

test("mergeGroupDefs merges a new id into a custom group with the same name", () => {
	expect(mergeGroupDefs([price], [{ id: "x9", name: " PRICE " }])).toEqual({
		groups: [price],
		remap: { x9: "g1" },
	});
});

test("mergeGroupDefs merges a group named like Cuisine or Area into the built-in", () => {
	expect(
		mergeGroupDefs(
			[],
			[
				{ id: "x1", name: "Cuisine" },
				{ id: "x2", name: "ย่าน" },
			],
		),
	).toEqual({ groups: [], remap: { x1: "cuisine", x2: "area" } });
});

test("mergeGroupDefs keeps a group named like Type or Tags under a free suffixed name", () => {
	expect(
		mergeGroupDefs(
			[{ id: "g1", name: "Type - 1" }],
			[
				{ id: "x1", name: "Type" },
				{ id: "x2", name: "tags" },
			],
		).groups,
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
		remapGroups(
			[make("a", { x1: ["cheap", "fast"], g1: ["cheap"], area: ["siam"] })],
			{ x1: "g1" },
		),
	).toEqual([make("a", { g1: ["cheap", "fast"], area: ["siam"] })]);
});

const NOW = new Date("2026-10-15T00:00:00.000Z");
const STAMP = NOW.toISOString();

test("valueCounts counts restaurants per value, most used first", () => {
	const list = [
		make("a", { g1: ["cheap"] }),
		make("b", { g1: ["cheap", "fancy"] }),
	];
	expect(valueCounts(list, "g1")).toEqual([
		{ value: "cheap", count: 2 },
		{ value: "fancy", count: 1 },
	]);
	expect(usingGroup(list, "g1")).toBe(2);
	expect(usingGroup(list, "area")).toBe(0);
});

test("addGroup trims, refuses blank and taken names, and makes a free id", () => {
	expect(addGroup([price], "  ")).toEqual({
		ok: false,
		error: "tags.nameRequired",
	});
	expect(addGroup([price], "PRICE")).toEqual({
		ok: false,
		error: "tags.nameTaken",
	});
	expect(addGroup([price], "Cuisine")).toEqual({
		ok: false,
		error: "tags.nameTaken",
	});
	const result = addGroup([price], " Vibe ");
	expect(result.ok && result.value[1]?.name).toBe("Vibe");
	expect(result.ok && result.value[1]?.id).toMatch(/^[0-9A-Za-z]{8}$/);
});

test("renameGroup lets a group keep its name in other case, refuses another's", () => {
	expect(renameGroup([price, vibe], "g1", "PRICE")).toEqual({
		ok: true,
		value: [{ id: "g1", name: "PRICE" }, vibe],
	});
	expect(renameGroup([price, vibe], "g1", "vibe")).toEqual({
		ok: false,
		error: "tags.nameTaken",
	});
});

test("moveGroup swaps with a neighbour and stops at the ends", () => {
	expect(moveGroup([price, vibe], "g2", -1)).toEqual([vibe, price]);
	expect(moveGroup([price, vibe], "g1", -1)).toEqual([price, vibe]);
	expect(moveGroup([price, vibe], "g2", 1)).toEqual([price, vibe]);
});

test("deleteGroup turns its values into tags on the restaurants that had them", () => {
	const list = [
		{
			...make("a", { g1: ["cheap"], area: ["siam"] }),
			tags: ["cheap", "spicy"],
		},
		make("b", { area: ["ari"] }),
	];
	const result = deleteGroup(list, [price, vibe], "g1", NOW);
	expect(result.groups).toEqual([vibe]);
	expect(result.restaurants).toEqual([
		{
			...list[0]!,
			groups: { area: ["siam"] },
			tags: ["cheap", "spicy"],
			updatedAt: STAMP,
		},
		list[1]!,
	]);
});

test.each<[string, Result<string, ValueError>]>([
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
	expect(renameValue(list, "tags", "thai", "thai food", NOW)[0]?.tags).toEqual([
		"thai food",
	]);
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

test('moveValue into a group id of "__proto__" keeps the value as an own property, not a prototype change', () => {
	const list = [make("a", { g1: ["cheap"] })];
	const [result] = moveValue(list, "g1", "cheap", "__proto__", NOW);
	expect(Object.hasOwn(result!.groups, "__proto__")).toBe(true);
	expect(groupValues(result!, "__proto__")).toEqual(["cheap"]);
	expect(Object.getPrototypeOf(result!.groups)).toBe(Object.prototype);
});
