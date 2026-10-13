import { expect, test } from "bun:test";
import type { HistoryEntry } from "#lib/history";
import type { Restaurant } from "#lib/restaurant";
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
	name,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

const lock = (
	id: string,
	lockedAt: string,
	restaurantId = "a",
): HistoryEntry => ({
	id,
	restaurantId,
	name: restaurantId,
	lockedAt,
});

test("exportJson gives indented or one-line json that imports back", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	const history = [lock("h1", "2026-10-12T09:00:00.000Z")];
	const pretty = exportJson([make("a"), make("b")], history, now, {
		pretty: true,
	});
	const compact = exportJson([make("a"), make("b")], history, now, {
		pretty: false,
	});
	expect(pretty).toContain("\n  ");
	expect(compact).not.toContain("\n");
	expect(JSON.parse(pretty)).toEqual(
		toExportFile([make("a"), make("b")], history, now),
	);
	for (const text of [pretty, compact])
		expect(parseImport(text)).toEqual({
			ok: true,
			restaurants: [make("a"), make("b")],
			history,
		});
});

test("toExportFile wraps restaurants and history in the versioned envelope", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	expect(
		toExportFile([make("a")], [lock("h1", "2026-10-12T09:00:00.000Z")], now),
	).toEqual({
		app: "whattoeat",
		version: 2,
		exportedAt: "2026-10-12T10:00:00.000Z",
		restaurants: [make("a")],
		history: [lock("h1", "2026-10-12T09:00:00.000Z")],
	});
	expect(toExportFile([], undefined, now).history).toEqual([]);
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
	});
});

test("an empty restaurants array is a valid import", () => {
	expect(parseImport(JSON.stringify(toExportFile([])))).toEqual({
		ok: true,
		restaurants: [],
		history: [],
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
		JSON.stringify({ app: "whattoeat", version: 3, restaurants: [] }),
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

test("merge replaces same id in place and appends new ids", () => {
	const existing = [make("a", "A old"), make("b")];
	const incoming = [make("c"), make("a", "A new")];
	expect(mergeRestaurants(existing, incoming)).toEqual([
		make("a", "A new"),
		make("b"),
		make("c"),
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
		location: " x ",
		extra: 1,
	};
	expect(
		parseImport(
			JSON.stringify({ app: "whattoeat", version: 1, restaurants: [messy] }),
		),
	).toEqual({
		ok: true,
		restaurants: [{ ...make("a", "Foo"), tags: ["thai"], location: "x" }],
		history: undefined,
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
	).toEqual({ ok: true, restaurants: [make("a")], history: undefined });
});

test.each([
	["missing", undefined, "import.error.format"],
	["not an array", { id: "h1" }, "import.error.format"],
	[
		"with a bad entry",
		[{ id: "h1", restaurantId: "a", name: "A", lockedAt: "never" }],
		"import.error.entries",
	],
	[
		"with duplicate ids",
		[
			lock("h1", "2026-10-12T09:00:00.000Z"),
			lock("h1", "2026-10-11T09:00:00.000Z"),
		],
		"import.error.entries",
	],
])("a version 2 file with history %s is rejected", (_label, history, error) => {
	expect(
		parseImport(
			JSON.stringify({
				app: "whattoeat",
				version: 2,
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
			version: 2,
			restaurants: [],
			history: [
				{ ...lock("old", "2026-10-01T09:00:00.000Z"), extra: true },
				lock("new", "2026-10-12T09:00:00.000Z", "deleted-restaurant"),
			],
		}),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [],
		history: [
			lock("new", "2026-10-12T09:00:00.000Z", "deleted-restaurant"),
			lock("old", "2026-10-01T09:00:00.000Z"),
		],
	});
});

test("mergeHistory keeps both sides, incoming wins on the same id, newest first", () => {
	const existing = [
		lock("a", "2026-10-10T09:00:00.000Z"),
		{ ...lock("b", "2026-10-05T09:00:00.000Z"), name: "old" },
	];
	const incoming = [
		{ ...lock("b", "2026-10-05T09:00:00.000Z"), name: "new" },
		lock("c", "2026-10-12T09:00:00.000Z"),
	];
	expect(mergeHistory(existing, incoming)).toEqual([
		lock("c", "2026-10-12T09:00:00.000Z"),
		lock("a", "2026-10-10T09:00:00.000Z"),
		{ ...lock("b", "2026-10-05T09:00:00.000Z"), name: "new" },
	]);
	expect(existing).toHaveLength(2);
});
