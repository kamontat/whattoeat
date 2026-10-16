import { expect, test } from "bun:test";
import { setLang } from "#lib/i18n";
import {
	cleanStored,
	groupValues,
	isLink,
	isRestaurant,
	metaLine,
	newId,
	normalizeInput,
	normalizeTag,
	parseTags,
	type Restaurant,
	type StoredRestaurant,
	tagsByUsage,
	valuesByUsage,
} from "#lib/restaurant";

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

test("parseTags trims, drops empties and de-duplicates in order", () => {
	expect(parseTags(" thai, ,noodle ,thai,")).toEqual(["thai", "noodle"]);
});

test("parseTags returns [] for blank text", () => {
	expect(parseTags("   ")).toEqual([]);
});

test("parseTags merges tags that differ only in case, keeping first-seen order", () => {
	expect(parseTags("Thai, noodle, THAI, thai")).toEqual(["thai", "noodle"]);
});

test.each([
	["lowercases", "Thai", "thai"],
	["trims", "  thai  ", "thai"],
	["collapses inner whitespace", "thai \t  food", "thai food"],
	["composes Unicode to NFC", "cafe\u0301", "caf\u00e9"],
	["leaves Thai text alone", "ก๋วยเตี๋ยว", "ก๋วยเตี๋ยว"],
	["returns empty for blank text", "   ", ""],
])("normalizeTag %s", (_label, input, expected) => {
	expect(normalizeTag(input)).toBe(expected);
});

const withTags = (id: string, tags: string[]): Restaurant => ({
	...valid,
	id,
	tags,
});

test("tagsByUsage orders tags by how many restaurants use them, then by name", () => {
	expect(
		tagsByUsage([
			withTags("1", ["thai", "spicy"]),
			withTags("2", ["noodle", "thai"]),
			withTags("3", ["noodle", "thai", "cheap"]),
		]),
	).toEqual(["thai", "noodle", "cheap", "spicy"]);
});

test("tagsByUsage returns [] for no restaurants", () => {
	expect(tagsByUsage([])).toEqual([]);
});

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
		normalizeInput(
			{
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
			},
			["g1"],
		),
	).toMatchObject({
		groups: { area: ["old town"], cuisine: ["japanese", "thai"] },
		kinds: ["drinks", "dessert"],
	});
});

test("normalizeInput moves values of unknown groups into tags", () => {
	expect(
		normalizeInput(
			{
				name: "Cafe",
				tags: ["spicy"],
				location: "",
				notes: "",
				groups: { gone: ["Cheap"], kind: ["food"], g1: ["cosy"] },
			},
			["g1"],
		),
	).toMatchObject({
		tags: ["spicy", "cheap", "food"],
		groups: { g1: ["cosy"] },
	});
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
		cleanStored({
			...rest,
			tags: ["Thai", "THAI"],
			area: " Ari ",
			cuisine: "",
		}),
	).toEqual({ ...valid, tags: ["thai"], groups: { area: ["ari"] }, kinds: [] });
});

test("cleanStored keeps known custom groups and moves unknown ones into tags", () => {
	expect(
		cleanStored(
			{ ...valid, groups: { ...valid.groups, g1: ["cheap"], gone: ["cosy"] } },
			["g1"],
		),
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
		{
			...valid,
			id: "2",
			groups: { area: ["siam"], cuisine: ["thai", "japanese"] },
			kinds: ["drinks", "dessert"],
		},
		{
			...valid,
			id: "3",
			groups: { area: ["siam"], cuisine: ["japanese"] },
			kinds: [],
		},
	] satisfies Restaurant[];
	expect(valuesByUsage(list, "area")).toEqual(["siam", "ari"]);
	expect(valuesByUsage(list, "cuisine")).toEqual(["japanese", "thai"]);
	expect(valuesByUsage(list, "kind")).toEqual(["drinks", "dessert"]);
	expect(valuesByUsage(list, "tags")).toEqual(["spicy", "thai"]);
});

test("metaLine joins several cuisines and areas with commas", () => {
	setLang("en");
	expect(
		metaLine({
			...valid,
			kinds: ["food", "drinks"],
			groups: { cuisine: ["thai", "japanese"], area: ["siam"] },
		}),
	).toBe("Food, Drinks · thai, japanese · siam");
	expect(metaLine({ ...valid, kinds: [], groups: {} })).toBe("");
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
	["numeric area", { ...valid, area: 1 }],
	["numeric cuisine", { ...valid, cuisine: 1 }],
	["kinds not an array", { ...valid, kinds: "food" }],
	["non-string kind", { ...valid, kinds: [1] }],
	["non-date createdAt", { ...valid, createdAt: "yesterday-ish" }],
	["non-date updatedAt", { ...valid, updatedAt: "" }],
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

test("newId gives 8 letters and digits", () => {
	for (let i = 0; i < 50; i++) expect(newId([])).toMatch(/^[0-9A-Za-z]{8}$/);
});

test("newId skips ids that are already taken", () => {
	// Two draws: the first spells "00000000", which is taken; the second spells "11111111".
	const draws = [new Uint8Array(8).fill(0), new Uint8Array(8).fill(1)];
	const random = (bytes: Uint8Array): Uint8Array => {
		bytes.set(draws.shift()!);
		return bytes;
	};
	expect(newId(["00000000"], random)).toBe("11111111");
});

test("newId skips bytes that would bias the alphabet", () => {
	// 248 and above are rejected, so 255 is skipped and 61 maps to the last letter.
	const draws = [Uint8Array.from([255, 61, 61, 61, 61, 61, 61, 61, 61])];
	const random = (bytes: Uint8Array): Uint8Array => {
		const next = draws[0]!.subarray(0, bytes.length);
		bytes.set(next);
		draws[0] = draws[0]!.subarray(bytes.length);
		return bytes;
	};
	expect(newId([], random)).toBe("zzzzzzzz");
});
