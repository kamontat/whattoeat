import { expect, test } from "bun:test";
import { setLang } from "#lib/i18n";
import {
	canonicalLabel,
	cleanStored,
	displayName,
	groupValues,
	isLink,
	isRestaurant,
	linkLabel,
	metaLine,
	nameFromText,
	newId,
	normalizeInput,
	normalizeTag,
	openLinks,
	parseTags,
	type Restaurant,
	type StoredRestaurant,
	tagsByUsage,
	valuesByUsage,
} from "#lib/restaurant";

const valid: Restaurant = {
	id: "a1",
	name: { en: "Som Tam Nua", th: "" },
	tags: ["thai", "spicy"],
	links: [{ label: "map", url: "https://maps.example/siam" }],
	notes: "",
	groups: { area: ["siam"], cuisine: ["thai"] },
	kinds: ["food"],
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
};

test("nameFromText puts Thai text with no Latin letters in th and anything else in en", () => {
	expect(nameFromText(" Som Tam ")).toEqual({ en: "Som Tam", th: "" });
	expect(nameFromText("ส้มตำ")).toEqual({ en: "", th: "ส้มตำ" });
	expect(nameFromText("ส้มตำ 2")).toEqual({ en: "", th: "ส้มตำ 2" });
	expect(nameFromText("Sushiro (ซูชิโร่) - Siam")).toEqual({
		en: "Sushiro (ซูชิโร่) - Siam",
		th: "",
	});
	expect(nameFromText("")).toEqual({ en: "", th: "" });
});

test("displayName uses the current language, falling back to the other", () => {
	setLang("th");
	expect(displayName({ name: { en: "Pho", th: "เฝอ" } })).toBe("เฝอ");
	expect(displayName({ name: { en: "Pho", th: "" } })).toBe("Pho");
	setLang("en");
	expect(displayName({ name: { en: "", th: "เฝอ" } })).toBe("เฝอ");
});

test("cleanStored reads an old string name into the language its script is in", () => {
	expect(cleanStored({ ...valid, name: "Som Tam Nua" }).name).toEqual({
		en: "Som Tam Nua",
		th: "",
	});
	expect(cleanStored({ ...valid, name: "ส้มตำนัว" }).name).toEqual({
		en: "",
		th: "ส้มตำนัว",
	});
});

test("normalizeInput trims both names", () => {
	expect(
		normalizeInput({
			name: { en: " Pho ", th: " เฝอ " },
			tags: [],
			links: [],
			notes: "",
		}).name,
	).toEqual({ en: "Pho", th: "เฝอ" });
});

test.each([
	["an old string name", "Pho", true],
	["an English name only", { en: "Pho", th: "" }, true],
	["a Thai name only", { en: "", th: "เฝอ" }, true],
	["both names blank", { en: " ", th: "" }, false],
	["a name missing a language", { en: "Pho" }, false],
	["a numeric name", { en: 1, th: "" }, false],
])("isRestaurant with %s is %p", (_label, name, expected) => {
	expect(isRestaurant({ ...valid, name })).toBe(expected);
});

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
			name: { en: "  Jay Fai ", th: "" },
			tags: [" street ", "", "street"],
			links: [
				{ label: " Map ", url: " https://maps.example/jayfai " },
				{ label: "  ", url: "  " },
				{ label: "", url: "https://ig.example/jayfai" },
			],
			notes: " ok ",
		}),
	).toEqual({
		name: { en: "Jay Fai", th: "" },
		tags: ["street"],
		links: [
			{ label: "map", url: "https://maps.example/jayfai" },
			{ label: "", url: "https://ig.example/jayfai" },
		],
		notes: "ok",
		groups: {},
		kinds: [],
	});
});

test("normalizeInput cleans group values like tags, drops empty groups and keeps known kinds in order", () => {
	expect(
		normalizeInput(
			{
				name: { en: "Cafe", th: "" },
				tags: [],
				links: [],
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
				name: { en: "Cafe", th: "" },
				tags: ["spicy"],
				links: [],
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
	).toEqual({ ...valid, name: { en: "Som", th: "" } });
});

test("isRestaurant accepts the old shape with a location and no link", () => {
	const { links: _l, ...rest } = valid;
	expect(isRestaurant({ ...rest, location: "Siam Square" })).toBe(true);
	expect(isRestaurant(rest)).toBe(true);
});

test("cleanStored moves an old location that is a link into link", () => {
	const { links: _l, ...rest } = valid;
	expect(
		cleanStored({ ...rest, location: " https://maps.example/x " }),
	).toEqual({
		...valid,
		links: [{ label: "", url: "https://maps.example/x" }],
	});
});

test("cleanStored moves an old location that is not a link to the start of the notes", () => {
	const { links: _l, ...rest } = valid;
	expect(
		cleanStored({ ...rest, location: " Siam, 2F ", notes: "Queue early" }),
	).toEqual({ ...valid, links: [], notes: "Siam, 2F\nQueue early" });
	expect(cleanStored({ ...rest, location: "Siam", notes: "" })).toEqual({
		...valid,
		links: [],
		notes: "Siam",
	});
});

test("cleanStored keeps an existing link and moves a different old location to the notes", () => {
	expect(
		cleanStored({ ...valid, location: "https://other.example", notes: "" }),
	).toEqual({ ...valid, notes: "https://other.example" });
	expect(
		cleanStored({ ...valid, location: "https://maps.example/siam" }),
	).toEqual(valid);
	expect(cleanStored({ ...valid, location: " " })).toEqual(valid);
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
	["numeric link", { ...valid, link: 5 }],
	["links not an array", { ...valid, links: "https://x.example" }],
	["a link with no url", { ...valid, links: [{ label: "Map" }] }],
	[
		"a numeric link label",
		{ ...valid, links: [{ label: 1, url: "https://x.example" }] },
	],
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

test("cleanStored turns an old single link into one unlabelled link", () => {
	const { links: _l, ...rest } = valid;
	expect(
		cleanStored({ ...rest, link: " https://maps.example/old " }).links,
	).toEqual([{ label: "", url: "https://maps.example/old" }]);
	expect(cleanStored({ ...rest, links: [] }).links).toEqual([]);
	expect(cleanStored(rest).links).toEqual([]);
});

test("cleanStored keeps links when there are some and drops an old link beside them", () => {
	expect(
		cleanStored({ ...valid, link: "https://maps.example/old" }).links,
	).toEqual(valid.links);
});

test("isRestaurant accepts labelled links and the old single link", () => {
	expect(
		isRestaurant({
			...valid,
			links: [
				{ label: "Map", url: "https://maps.example" },
				{ label: "", url: "https://ig.example" },
			],
		}),
	).toBe(true);
	const { links: _l, ...rest } = valid;
	expect(isRestaurant({ ...rest, link: "https://maps.example" })).toBe(true);
});

test("linkLabel names a preset label in the current language, else the label, else the host without www", () => {
	setLang("en");
	expect(linkLabel({ label: "map", url: "https://maps.example" })).toBe("Map");
	setLang("th");
	expect(linkLabel({ label: "map", url: "https://maps.example" })).toBe("แผนที่");
	setLang("en");
	expect(linkLabel({ label: "Grab", url: "https://x.example/grab" })).toBe(
		"Grab",
	);
	expect(
		linkLabel({ label: " ", url: "https://www.instagram.com/jayfai/" }),
	).toBe("instagram.com");
	expect(linkLabel({ label: "", url: "not a url" })).toBe("not a url");
});

test("canonicalLabel ignores case: a preset label in either language becomes its key, any other is normalized", () => {
	expect(canonicalLabel(" Map ")).toBe("map");
	expect(canonicalLabel("SOCIAL")).toBe("social");
	expect(canonicalLabel("เว็บไซต์")).toBe("website");
	expect(canonicalLabel(" Grab  Food ")).toBe("grab food");
	expect(canonicalLabel("GRAB food")).toBe(canonicalLabel("grab Food"));
	expect(canonicalLabel("  ")).toBe("");
});

test("normalizeInput stores a preset label as its key", () => {
	expect(
		normalizeInput({
			name: { en: "Pho", th: "" },
			tags: [],
			links: [
				{ label: "Main", url: "https://pho.example" },
				{ label: "แผนที่", url: "https://maps.example/pho" },
			],
			notes: "",
		}).links,
	).toEqual([
		{ label: "main", url: "https://pho.example" },
		{ label: "map", url: "https://maps.example/pho" },
	]);
});

test("openLinks keeps only http(s) links", () => {
	expect(
		openLinks({
			...valid,
			links: [
				{ label: "", url: "javascript:alert(1)" },
				{ label: "map", url: "https://maps.example" },
			],
		}),
	).toEqual([{ label: "map", url: "https://maps.example" }]);
});

test("openLinks orders main, map, social, website, menu, delivery, then the rest as given", () => {
	const link = (label: string) => ({
		label,
		url: `https://x.example/${label}`,
	});
	expect(
		openLinks({
			...valid,
			links: [
				link("Grab"),
				link(""),
				link("delivery"),
				link("menu"),
				link("website"),
				link("social"),
				link("map"),
				link("main"),
			],
		}).map((item) => item.label),
	).toEqual([
		"main",
		"map",
		"social",
		"website",
		"menu",
		"delivery",
		"Grab",
		"",
	]);
	expect(
		openLinks({ ...valid, links: [link("website"), link("map")] })[0]?.label,
	).toBe("map");
});
