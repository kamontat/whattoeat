import { expect, test } from "bun:test";
import type { HistoryEntry } from "#lib/history";
import type { AddedPreset } from "#lib/presets";
import { nameFromText, type Restaurant } from "#lib/restaurant";
import type { ImportError } from "#lib/transfer";
import {
	exportFileName,
	exportJson,
	mergeHistory,
	mergeRestaurants,
	parseImport,
	toExportFile,
} from "#lib/transfer";

const make = (id: string, name = id): Restaurant => ({
	id,
	name: nameFromText(name),
	tags: [],
	links: [],
	notes: "",
	groups: {},
	kinds: [],
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

const visit = (
	id: string,
	visitedAt: string,
	restaurantId = "a",
): HistoryEntry => ({
	id,
	restaurantId,
	name: restaurantId,
	visitedAt,
});

test("exportJson gives indented or one-line json that imports back", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	const history = [visit("h1", "2026-10-12T09:00:00.000Z")];
	const pretty = exportJson([make("a"), make("b")], history, [], [], now, {
		pretty: true,
	});
	const compact = exportJson([make("a"), make("b")], history, [], [], now, {
		pretty: false,
	});
	expect(pretty).toContain("\n  ");
	expect(compact).not.toContain("\n");
	expect(JSON.parse(pretty)).toEqual(
		toExportFile([make("a"), make("b")], history, [], [], now),
	);
	for (const text of [pretty, compact])
		expect(parseImport(text)).toEqual({
			ok: true,
			restaurants: [make("a"), make("b")],
			history,
			groups: [],
			presets: [],
		});
});

test("toExportFile wraps restaurants and history in the versioned envelope", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	expect(
		toExportFile(
			[make("a")],
			[visit("h1", "2026-10-12T09:00:00.000Z")],
			[],
			[],
			now,
		),
	).toEqual({
		app: "whattoeat",
		version: 8,
		exportedAt: "2026-10-12T10:00:00.000Z",
		restaurants: [make("a")],
		history: [visit("h1", "2026-10-12T09:00:00.000Z")],
		groups: [],
		presets: [],
	});
	expect(toExportFile([], undefined, [], [], now).history).toEqual([]);
});

test("exportFileName uses the local date, zero padded", () => {
	expect(exportFileName(new Date(2026, 0, 5, 23, 30))).toBe(
		"whattoeat-2026-01-05.json",
	);
});

test("an exported file imports back unchanged", () => {
	const list = [make("a"), make("b", "ร้านข้าวมันไก่")];
	expect(parseImport(JSON.stringify(toExportFile(list)))).toEqual({
		ok: true,
		restaurants: list,
		history: [],
		groups: [],
		presets: [],
	});
});

test("an empty restaurants array is a valid import", () => {
	expect(parseImport(JSON.stringify(toExportFile([])))).toEqual({
		ok: true,
		restaurants: [],
		history: [],
		groups: [],
		presets: [],
	});
});

test.each([
	["not JSON", "{oops", "import.error.json"],
	["JSON null", "null", "import.error.format"],
	["a bare array", "[]", "import.error.format"],
	[
		"wrong app",
		JSON.stringify({ app: "other", version: 1, restaurants: [] }),
		"import.error.format",
	],
	[
		"missing restaurants",
		JSON.stringify({ app: "whattoeat", version: 1 }),
		"import.error.format",
	],
	[
		"future version",
		JSON.stringify({ app: "whattoeat", version: 9, restaurants: [] }),
		"import.error.version",
	],
	[
		"blank name entry",
		JSON.stringify({
			app: "whattoeat",
			version: 1,
			restaurants: [make("a"), { ...make("b"), name: "  " }],
		}),
		"import.error.entries",
	],
	[
		"entry without tags",
		JSON.stringify({
			app: "whattoeat",
			version: 1,
			restaurants: [{ ...make("a"), tags: undefined }],
		}),
		"import.error.entries",
	],
	[
		"non-object entry",
		JSON.stringify({ app: "whattoeat", version: 1, restaurants: ["x"] }),
		"import.error.entries",
	],
])("rejects %s", (_label, text, error) => {
	expect(parseImport(text)).toEqual({ ok: false, error: error as ImportError });
});

const price = { id: "g1", name: "Price" };

const file = (version: number, restaurants: unknown[], extra: object = {}) =>
	JSON.stringify({
		app: "whattoeat",
		version,
		exportedAt: "2026-10-14T00:00:00.000Z",
		restaurants,
		history: [],
		...extra,
	});

test("a version 5 file reads each one-string name into the language its script is in", () => {
	const result = parseImport(
		file(
			5,
			[
				{ ...make("a"), name: "Som Tam Nua" },
				{ ...make("b"), name: "ส้มตำนัว" },
			],
			{ groups: [] },
		),
	);
	expect(result).toMatchObject({
		ok: true,
		restaurants: [
			{ id: "a", name: { en: "Som Tam Nua", th: "" } },
			{ id: "b", name: { en: "", th: "ส้มตำนัว" } },
		],
	});
});

test("a version 6 file turns its single link into one unlabelled link", () => {
	const { links: _l, ...old } = make("a");
	const result = parseImport(
		file(6, [{ ...old, link: "https://maps.example/a" }], { groups: [] }),
	);
	expect(result).toMatchObject({
		ok: true,
		restaurants: [
			{ id: "a", links: [{ label: "", url: "https://maps.example/a" }] },
		],
	});
});

test("a version 8 file keeps its labelled links in order", () => {
	const item = {
		...make("a"),
		links: [
			{ label: "menu", url: "https://x.example/menu" },
			{ label: "", url: "https://maps.example/a" },
		],
	};
	expect(parseImport(JSON.stringify(toExportFile([item])))).toMatchObject({
		ok: true,
		restaurants: [item],
	});
});

test("a version 8 file keeps both names", () => {
	const item = { ...make("a"), name: { en: "Pho", th: "เฝอ" } };
	expect(parseImport(JSON.stringify(toExportFile([item])))).toMatchObject({
		ok: true,
		restaurants: [item],
	});
});

test("a version 8 file round-trips its groups", () => {
	const item = { ...make("a"), groups: { g1: ["cheap"] } };
	const result = parseImport(
		exportJson([item], [], [price], [], new Date(), { pretty: false }),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [item],
		history: [],
		groups: [price],
		presets: [],
	});
});

const siamRecord: AddedPreset = {
	id: "siam",
	updatedAt: "2026-10-23",
	ids: ["a"],
};

test("exports version 8 with the preset record", () => {
	const now = new Date("2026-10-23T10:00:00.000Z");
	const result = toExportFile([], [], [], [siamRecord], now);
	expect(result.version).toBe(8);
	expect(result.presets).toEqual([siamRecord]);
});

test("reads a version 8 preset record", () => {
	const now = new Date("2026-10-23T10:00:00.000Z");
	const result = parseImport(
		JSON.stringify(toExportFile([], [], [], [siamRecord], now)),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [],
		history: [],
		groups: [],
		presets: [siamRecord],
	});
});

test("version 7 and older read as no preset record", () => {
	expect(parseImport(file(7, [], { groups: [] }))).toEqual({
		ok: true,
		restaurants: [],
		history: [],
		groups: [],
		presets: undefined,
	});
});

test("a malformed preset record rejects the file", () => {
	const result = parseImport(
		file(8, [], { groups: [], presets: [{ id: "siam", updatedAt: "x" }] }),
	);
	expect(result).toEqual({ ok: false, error: "import.error.entries" });
});

test("a version 4 file moves each location into link or notes and keeps its groups", () => {
	const { links: _l, ...old } = make("a");
	const result = parseImport(
		file(
			4,
			[
				{ ...old, location: "https://maps.example/a" },
				{ ...old, id: "b", location: "Siam, 2F", notes: "late" },
			],
			{ groups: [price] },
		),
	);
	expect(result).toMatchObject({
		ok: true,
		restaurants: [
			{
				id: "a",
				links: [{ label: "", url: "https://maps.example/a" }],
				notes: "",
			},
			{ id: "b", links: [], notes: "Siam, 2F\nlate" },
		],
		groups: [price],
	});
});

test("a version 3 file imports with old area and cuisine moved into groups and no groups list", () => {
	const { groups: _g, ...old } = make("a");
	const result = parseImport(file(3, [{ ...old, cuisine: "Thai", area: "" }]));
	expect(result).toMatchObject({
		ok: true,
		restaurants: [{ id: "a", groups: { cuisine: ["thai"] } }],
		groups: undefined,
	});
});

test.each([
	["groups is missing", {}, "import.error.format"],
	["groups is not an array", { groups: {} }, "import.error.format"],
	[
		"a group has a reserved id",
		{ groups: [{ id: "area", name: "X" }] },
		"import.error.entries",
	],
	[
		"a group has a blank name",
		{ groups: [{ id: "g1", name: " " }] },
		"import.error.entries",
	],
	[
		"two groups share an id",
		{ groups: [price, { id: "g1", name: "Other" }] },
		"import.error.entries",
	],
])("a version 4 file is rejected when %s", (_label, extra, error) => {
	expect(parseImport(file(4, [], extra))).toEqual({
		ok: false,
		error: error as ImportError,
	});
});

test("values of a group the file does not define import as tags", () => {
	const result = parseImport(
		file(4, [{ ...make("a"), groups: { gone: ["cosy"] } }], { groups: [] }),
	);
	expect(result).toMatchObject({
		ok: true,
		restaurants: [{ tags: ["cosy"], groups: {} }],
	});
});

test("a file group named like a built-in merges into it", () => {
	const result = parseImport(
		file(
			4,
			[{ ...make("a"), groups: { x1: ["Thai"], cuisine: ["thai", "lao"] } }],
			{
				groups: [{ id: "x1", name: "สัญชาติอาหาร" }],
			},
		),
	);
	expect(result).toMatchObject({
		ok: true,
		groups: [],
		restaurants: [{ groups: { cuisine: ["thai", "lao"] } }],
	});
});

test("merge replaces same id in place and appends new ids", () => {
	const existing = [make("a", "A old"), make("b")];
	const incoming = [make("c"), make("a", "A new")];
	expect(mergeRestaurants(existing, incoming)).toEqual([
		make("a", "A new"),
		make("b"),
		make("c"),
	]);
});

test("merge keeps an incoming name already used by another id", () => {
	const existing = [make("a", "Somtam"), make("b", "Pho")];
	const incoming = [make("c", "Somtam"), make("b", "Somtam")];
	expect(mergeRestaurants(existing, incoming)).toEqual([
		make("a", "Somtam"),
		make("b", "Somtam"),
		make("c", "Somtam"),
	]);
});

test("import keeps repeated names within one file", () => {
	const list = [make("a", "Somtam"), make("b", "Somtam"), make("c", "Somtam")];
	const result = parseImport(JSON.stringify(toExportFile(list)));
	expect(result.ok && result.restaurants.map((item) => item.name.en)).toEqual([
		"Somtam",
		"Somtam",
		"Somtam",
	]);
});

test("merge does not mutate its inputs", () => {
	const existing = [make("a")];
	const incoming = [make("b")];
	mergeRestaurants(existing, incoming);
	expect(existing).toEqual([make("a")]);
	expect(incoming).toEqual([make("b")]);
});

test("imported entries are normalized like typed input and lose unknown fields", () => {
	const messy = {
		...make("a", "  Foo  "),
		tags: ["", " thai ", "thai"],
		links: [{ label: " Map ", url: " https://x.example " }],
		extra: 1,
	};
	expect(
		parseImport(
			JSON.stringify({ app: "whattoeat", version: 1, restaurants: [messy] }),
		),
	).toEqual({
		ok: true,
		restaurants: [
			{
				...make("a", "Foo"),
				tags: ["thai"],
				links: [{ label: "map", url: "https://x.example" }],
			},
		],
		history: undefined,
		groups: undefined,
		presets: undefined,
	});
});

test("an entry without area, cuisine and kinds imports with them empty, unknown kinds are dropped", () => {
	const { kinds: _k, ...old } = make("a");
	const result = parseImport(
		JSON.stringify({
			app: "whattoeat",
			version: 2,
			restaurants: [
				old,
				{ ...make("b"), cuisine: " Thai ", kinds: ["x", "drinks"] },
			],
			history: [],
		}),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [
			make("a"),
			{ ...make("b"), groups: { cuisine: ["thai"] }, kinds: ["drinks"] },
		],
		history: [],
		groups: undefined,
		presets: undefined,
	});
});

test("rejects a file with duplicate ids", () => {
	expect(
		parseImport(
			JSON.stringify({
				app: "whattoeat",
				version: 1,
				restaurants: [make("a"), make("a", "B")],
			}),
		),
	).toEqual({ ok: false, error: "import.error.entries" });
});

test("imported tags are lowercased and merged by case", () => {
	const result = parseImport(
		JSON.stringify({
			app: "whattoeat",
			version: 1,
			restaurants: [{ ...make("a"), tags: ["Thai", "THAI", "Noodle"] }],
		}),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [{ ...make("a"), tags: ["thai", "noodle"] }],
		history: undefined,
		groups: undefined,
		presets: undefined,
	});
});

test("a version 1 file imports with no history", () => {
	expect(
		parseImport(
			JSON.stringify({
				app: "whattoeat",
				version: 1,
				restaurants: [make("a")],
			}),
		),
	).toEqual({
		ok: true,
		restaurants: [make("a")],
		history: undefined,
		groups: undefined,
		presets: undefined,
	});
});

test.each([
	["missing", undefined, "import.error.format"],
	["not an array", { id: "h1" }, "import.error.format"],
	[
		"with a bad entry",
		[{ id: "h1", restaurantId: "a", name: "A", visitedAt: "never" }],
		"import.error.entries",
	],
	[
		"with duplicate ids",
		[
			visit("h1", "2026-10-12T09:00:00.000Z"),
			visit("h1", "2026-10-11T09:00:00.000Z"),
		],
		"import.error.entries",
	],
])("a version 3 file with history %s is rejected", (_label, history, error) => {
	expect(
		parseImport(
			JSON.stringify({
				app: "whattoeat",
				version: 3,
				restaurants: [],
				history,
			}),
		),
	).toEqual({ ok: false, error: error as ImportError });
});

test("imported history is sorted newest first and loses unknown fields", () => {
	const result = parseImport(
		JSON.stringify({
			app: "whattoeat",
			version: 3,
			restaurants: [],
			history: [
				{ ...visit("old", "2026-10-01T09:00:00.000Z"), extra: true },
				visit("new", "2026-10-12T09:00:00.000Z", "deleted-restaurant"),
			],
		}),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [],
		history: [
			visit("new", "2026-10-12T09:00:00.000Z", "deleted-restaurant"),
			visit("old", "2026-10-01T09:00:00.000Z"),
		],
		groups: undefined,
		presets: undefined,
	});
});

test("a version 2 file reads each entry's lockedAt as its visit time", () => {
	const { visitedAt, ...rest } = visit("h1", "2026-10-12T09:00:00.000Z");
	expect(
		parseImport(
			JSON.stringify({
				app: "whattoeat",
				version: 2,
				restaurants: [],
				history: [{ ...rest, lockedAt: visitedAt }],
			}),
		),
	).toEqual({
		ok: true,
		restaurants: [],
		history: [visit("h1", "2026-10-12T09:00:00.000Z")],
		groups: undefined,
		presets: undefined,
	});
});

test("a version 3 entry with only lockedAt is rejected", () => {
	const { visitedAt, ...rest } = visit("h1", "2026-10-12T09:00:00.000Z");
	expect(
		parseImport(
			JSON.stringify({
				app: "whattoeat",
				version: 3,
				restaurants: [],
				history: [{ ...rest, lockedAt: visitedAt }],
			}),
		),
	).toEqual({ ok: false, error: "import.error.entries" });
});

test("mergeHistory keeps both sides, incoming wins on the same id, newest first", () => {
	const existing = [
		visit("a", "2026-10-10T09:00:00.000Z"),
		{ ...visit("b", "2026-10-05T09:00:00.000Z"), name: "old" },
	];
	const incoming = [
		{ ...visit("b", "2026-10-05T09:00:00.000Z"), name: "new" },
		visit("c", "2026-10-12T09:00:00.000Z"),
	];
	expect(mergeHistory(existing, incoming)).toEqual([
		visit("c", "2026-10-12T09:00:00.000Z"),
		visit("a", "2026-10-10T09:00:00.000Z"),
		{ ...visit("b", "2026-10-05T09:00:00.000Z"), name: "new" },
	]);
	expect(existing).toHaveLength(2);
});
