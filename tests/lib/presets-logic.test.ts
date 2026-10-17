import { expect, spyOn, test } from "bun:test";
import {
	type AddedPreset,
	addPresets,
	fetchIndex,
	fetchPresetFiles,
	loadAddedPresets,
	PRESETS_KEY,
	type PresetEntry,
	type PresetFile,
	parseIndex,
	presetState,
	replaceWithPresets,
	saveAddedPresets,
} from "#lib/presets";
import { isLink, type Restaurant } from "#lib/restaurant";
import { EXPORT_VERSION, toExportFile } from "#lib/transfer";

const make = (id: string, name = id): Restaurant => ({
	id,
	name,
	tags: [],
	link: "",
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

test("every bundled preset file is the current export version, with links and no old locations", async () => {
	const index = await Bun.file("src/assets/data/presets/index.json").json();
	for (const { id } of index.presets as { id: string }[]) {
		const data = await Bun.file(`src/assets/data/presets/${id}.json`).json();
		expect(data.version).toBe(EXPORT_VERSION);
		for (const item of data.restaurants) {
			expect(item).not.toHaveProperty("location");
			expect(typeof item.link).toBe("string");
			if (item.link !== "") expect(isLink(item.link)).toBe(true);
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

test("addPresets keeps an existing restaurant untouched when a preset has the same id", () => {
	const saved = [make("a", "Old Name")];
	const files = [file(entry(), make("a", "New Name"), make("b", "B"))];
	const result = addPresets(saved, files, []);
	expect(result.list.find((item) => item.id === "a")?.name).toBe("Old Name");
	expect(result.newCount).toBe(1);
});

test("addPresets counts a restaurant in two files once", () => {
	const files = [
		file(entry({ id: "ladprao" }), make("a", "A")),
		file(entry({ id: "ratchayothin" }), make("a", "A dup"), make("b", "B")),
	];
	const result = addPresets([], files, []);
	expect(result.newCount).toBe(2);
	expect(result.list).toHaveLength(2);
});

test("addPresets records each file with entry.updatedAt and all of its file ids, replacing an older record for the same id", () => {
	const files = [
		file(
			entry({ id: "ladprao", updatedAt: "2026-11-01" }),
			make("a"),
			make("b"),
		),
	];
	const result = addPresets([], files, [
		record({ id: "ladprao", updatedAt: "2026-10-16", ids: ["old"] }),
	]);
	expect(result.added).toEqual([
		{ id: "ladprao", updatedAt: "2026-11-01", ids: ["a", "b"] },
	]);
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
	localStorage.setItem(PRESETS_KEY, "{not json");
	expect(loadAddedPresets()).toEqual([]);
	localStorage.setItem(
		PRESETS_KEY,
		JSON.stringify([record(), { updatedAt: "x", ids: [] }]),
	);
	expect(loadAddedPresets()).toEqual([record()]);
	expect(saveAddedPresets([record()])).toBe(true);
	localStorage.clear();
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
