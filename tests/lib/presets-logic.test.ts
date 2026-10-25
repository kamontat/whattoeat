import { expect, spyOn, test } from "bun:test";
import {
	type AddedPreset,
	fetchIndex,
	fetchPresetFiles,
	loadAddedPresets,
	mergeAddedPresets,
	type PresetEntry,
	type PresetFile,
	type PresetIndex,
	parseIndex,
	presetCities,
	presetState,
	presetsKey,
	replaceWithPresets,
	saveAddedPresets,
	shownPlaces,
	updatePreset,
} from "#lib/presets";
import {
	isLink,
	LINK_LABELS,
	nameFromText,
	type Restaurant,
} from "#lib/restaurant";
import { toExportFile } from "#lib/transfer";

const make = (id: string, name = id): Restaurant => ({
	id,
	name: nameFromText(name),
	tags: [],
	links: [],
	groups: {},
	kinds: [],
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

const entry = (overrides: Partial<PresetEntry> = {}): PresetEntry => ({
	id: "ladprao",
	city: "bangkok",
	district: "chatuchak",
	name: { en: "Ladprao", th: "ลาดพร้าว" },
	count: 2,
	updatedAt: "2026-10-16",
	places: ["Central Ladprao"],
	areas: ["central ladprao"],
	...overrides,
});

const record = (overrides: Partial<AddedPreset> = {}): AddedPreset => ({
	id: "ladprao",
	updatedAt: "2026-10-16",
	ids: ["a", "b"],
	...overrides,
});

const file = (
	presetEntry: PresetEntry,
	...restaurants: Restaurant[]
): PresetFile => ({ entry: presetEntry, restaurants });

const validIndex = {
	version: 1,
	cities: { bangkok: { en: "Bangkok", th: "กรุงเทพฯ" } },
	districts: { chatuchak: { en: "Chatuchak", th: "จตุจักร" } },
	presets: [entry()],
};

test("parseIndex rejects a missing presets array, an entry with an unknown district, and a non-number count", () => {
	expect(parseIndex({ ...validIndex, presets: undefined })).toBeUndefined();
	expect(
		parseIndex({
			...validIndex,
			presets: [entry({ district: "nowhere" })],
		}),
	).toBeUndefined();
	expect(
		parseIndex({
			...validIndex,
			presets: [{ ...entry(), count: "2" }],
		}),
	).toBeUndefined();
});

test("parseIndex accepts the bundled index", async () => {
	const data = await Bun.file("src/assets/data/presets/index.json").json();
	expect(parseIndex(data)).toEqual(data);
});

test("every bundled preset file is version 7, with preset-labelled links and no old location or link", async () => {
	const index = await Bun.file("src/assets/data/presets/index.json").json();
	for (const { id } of index.presets as { id: string }[]) {
		const data = await Bun.file(`src/assets/data/presets/${id}.json`).json();
		expect(data.version).toBe(7);
		for (const item of data.restaurants) {
			expect(item).not.toHaveProperty("location");
			expect(item).not.toHaveProperty("link");
			for (const link of item.links) {
				expect(LINK_LABELS).toContain(link.label);
				expect(isLink(link.url)).toBe(true);
			}
		}
	}
});

test('presetState is "new" when not recorded', () => {
	expect(presetState(entry(), [], new Set())).toBe("new");
});

test('presetState is "new" when recorded but none of its ids are saved', () => {
	expect(presetState(entry(), [record()], new Set(["other"]))).toBe("new");
});

test('presetState is "added" when recorded, an id is saved, and updatedAt matches', () => {
	expect(presetState(entry(), [record()], new Set(["a"]))).toBe("added");
});

test('presetState is "update" when recorded, an id is saved, and the stored updatedAt is older', () => {
	expect(
		presetState(
			entry({ updatedAt: "2026-11-01" }),
			[record({ updatedAt: "2026-10-16" })],
			new Set(["a"]),
		),
	).toBe("update");
});

test("replaceWithPresets returns only the files' restaurants, deduped, and records exactly those presets", () => {
	const files = [
		file(entry({ id: "ladprao" }), make("a"), make("b")),
		file(entry({ id: "ratchayothin" }), make("b"), make("c")),
	];
	const result = replaceWithPresets(files);
	expect(result.list.map((item) => item.id)).toEqual(["a", "b", "c"]);
	expect(result.added).toEqual([
		{ id: "ladprao", updatedAt: "2026-10-16", ids: ["a", "b"] },
		{ id: "ratchayothin", updatedAt: "2026-10-16", ids: ["b", "c"] },
	]);
});

test("loadAddedPresets returns [] for bad JSON and drops entries without a string id", () => {
	localStorage.setItem(presetsKey(), "{not json");
	expect(loadAddedPresets()).toEqual([]);
	localStorage.setItem(
		presetsKey(),
		JSON.stringify([record(), { updatedAt: "x", ids: [] }]),
	);
	expect(loadAddedPresets()).toEqual([record()]);
	expect(saveAddedPresets([record()])).toBe(true);
	localStorage.clear();
});

test("mergeAddedPresets keeps current records and adds unknown ones", () => {
	const current = [record({ id: "siam", updatedAt: "2026-10-01" })];
	const incoming = [
		record({ id: "siam", updatedAt: "2026-10-16" }),
		record({ id: "ladprao", updatedAt: "2026-10-16" }),
	];
	expect(mergeAddedPresets(current, incoming)).toEqual([
		record({ id: "siam", updatedAt: "2026-10-01" }),
		record({ id: "ladprao", updatedAt: "2026-10-16" }),
	]);
});

test("updatePreset reverts an edited recorded restaurant in place and counts it", () => {
	const a = make("a");
	const edited = { ...a, notes: "edited" };
	const x = make("x");
	const result = updatePreset([edited, x], file(entry(), a), [
		record({ ids: ["a"] }),
	]);
	expect(result.list.map((item) => item.id)).toEqual(["a", "x"]);
	expect(result.list[0]).toEqual(a);
	expect(result.counts).toEqual({ added: 0, removed: 0, reverted: 1 });
});

test("updatePreset does not count an unchanged copy as reverted, whatever its key order", () => {
	const a = make("a");
	const reversed = Object.fromEntries(
		Object.entries(a).reverse(),
	) as Restaurant;
	const result = updatePreset([reversed], file(entry(), a), [
		record({ ids: ["a"] }),
	]);
	expect(result.counts.reverted).toBe(0);
});

test("updatePreset adds restaurants new in the file, after the saved list, in file order", () => {
	const a = make("a");
	const b = make("b");
	const c = make("c");
	const result = updatePreset([a], file(entry(), a, b, c), [
		record({ ids: ["a"] }),
	]);
	expect(result.list.map((item) => item.id)).toEqual(["a", "b", "c"]);
	expect(result.counts.added).toBe(2);
});

test("updatePreset removes restaurants the file dropped", () => {
	const a = make("a");
	const b = make("b");
	const x = make("x");
	const result = updatePreset([a, b, x], file(entry(), a), [
		record({ ids: ["a", "b"] }),
	]);
	expect(result.list.map((item) => item.id)).toEqual(["a", "x"]);
	expect(result.counts.removed).toBe(1);
});

test("updatePreset leaves a restaurant the user deleted deleted", () => {
	const a = make("a");
	const x = make("x");
	const result = updatePreset([x], file(entry(), a), [record({ ids: ["a"] })]);
	expect(result.list.map((item) => item.id)).toEqual(["x"]);
	expect(result.counts).toEqual({ added: 0, removed: 0, reverted: 0 });
});

test("updatePreset takes over an unrecorded saved copy in place, never duplicating it", () => {
	const a = make("a");
	const b = make("b");
	const editedB = { ...b, notes: "edited" };
	const x = make("x");
	const y = make("y");
	const result = updatePreset([x, editedB, y], file(entry(), a, b), [
		record({ ids: ["a"] }),
	]);
	expect(result.list.map((item) => item.id)).toEqual(["x", "b", "y"]);
	expect(result.list[1]).toEqual(b);
	expect(result.counts).toEqual({ added: 0, removed: 0, reverted: 1 });
});

test("updatePreset with no record treats every saved file id as a takeover and adds the rest", () => {
	const a = make("a");
	const b = make("b");
	const result = updatePreset([b], file(entry(), a, b), []);
	expect(result.list.map((item) => item.id)).toEqual(["b", "a"]);
	expect(result.counts.added).toBe(1);
});

test("updatePreset rewrites only this preset's record", () => {
	const a = make("a");
	const b = make("b");
	const added: AddedPreset[] = [
		{ id: "other", updatedAt: "2026-01-01", ids: ["o"] },
		{ id: "p", updatedAt: "2026-01-01", ids: ["a"] },
	];
	const result = updatePreset(
		[],
		file(entry({ id: "p", updatedAt: "2026-10-25" }), a, b),
		added,
	);
	expect(result.added).toEqual([
		{ id: "other", updatedAt: "2026-01-01", ids: ["o"] },
		{ id: "p", updatedAt: "2026-10-25", ids: ["a", "b"] },
	]);
});

test("presetCities lists only cities a preset uses, in index order", () => {
	const index: PresetIndex = {
		version: 1,
		cities: {
			a: { en: "A", th: "A" },
			b: { en: "B", th: "B" },
			c: { en: "C", th: "C" },
		},
		districts: {},
		presets: [entry({ id: "p1", city: "c" }), entry({ id: "p2", city: "a" })],
	};
	expect(presetCities(index)).toEqual(["a", "c"]);
});

test("shownPlaces", () => {
	const places = ["P1", "P2", "Mall X"];
	expect(shownPlaces(places, "")).toEqual(["P1", "P2"]);
	expect(shownPlaces(places, "mall")).toEqual(["P1", "Mall X"]);
	expect(shownPlaces(places, "p2")).toEqual(["P1", "P2"]);
	expect(shownPlaces(["P1"], "mall")).toEqual(["P1"]);
	expect(shownPlaces(["P1", "P2", "Q"], "zzz")).toEqual(["P1", "P2"]);
});

const stubFetch = (respond: (url: string) => Promise<Response>) => {
	const spy = spyOn(globalThis, "fetch").mockImplementation(((
		input: RequestInfo | URL,
	) => respond(String(input))) as typeof fetch);
	return () => spy.mockRestore();
};

test("fetchPresetFiles rejects when one of two files returns 404", async () => {
	const restore = stubFetch((url) =>
		url.includes("ratchayothin")
			? Promise.resolve(new Response("missing", { status: 404 }))
			: Promise.resolve(
					new Response(JSON.stringify(toExportFile([make("a")]))),
				),
	);
	try {
		await expect(
			fetchPresetFiles("./", [
				entry({ id: "ladprao" }),
				entry({ id: "ratchayothin" }),
			]),
		).rejects.toThrow();
	} finally {
		restore();
	}
});

test("fetchIndex rejects a 200 with the wrong shape", async () => {
	const restore = stubFetch(() =>
		Promise.resolve(new Response(JSON.stringify({ version: 1 }))),
	);
	try {
		await expect(fetchIndex("./")).rejects.toThrow();
	} finally {
		restore();
	}
});
