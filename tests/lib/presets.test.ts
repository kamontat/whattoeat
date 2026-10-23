import { expect, test } from "bun:test";
import { Glob } from "bun";
import { groupValues } from "#lib/restaurant";
import { parseImport } from "#lib/transfer";

type LocalizedName = { en: string; th: string };

type PresetEntry = {
	id: string;
	city: string;
	district: string;
	name: LocalizedName;
	count: number;
	updatedAt: string;
	places: string[];
	areas: string[];
};

type PresetIndex = {
	version: number;
	cities: Record<string, LocalizedName>;
	districts: Record<string, LocalizedName>;
	presets: PresetEntry[];
};

const DIR = "src/assets/data/presets";

const index = (await Bun.file(`${DIR}/index.json`).json()) as PresetIndex;

const fileIds = [...new Glob("*.json").scanSync({ cwd: DIR })]
	.map((file) => file.replace(/\.json$/, ""))
	.filter((id) => id !== "index")
	.sort();

test("index lists exactly the preset files", () => {
	expect(index.presets.map((entry) => entry.id).toSorted()).toEqual(fileIds);
});

for (const entry of index.presets) {
	test(`${entry.id}: count matches the file`, async () => {
		const text = await Bun.file(`${DIR}/${entry.id}.json`).text();
		const result = parseImport(text);
		if (!result.ok) throw new Error(result.error);
		expect(result.restaurants.length).toBe(entry.count);
	});

	test(`${entry.id}: every restaurant's area is one of the entry's areas`, async () => {
		const text = await Bun.file(`${DIR}/${entry.id}.json`).text();
		const result = parseImport(text);
		if (!result.ok) throw new Error(result.error);
		for (const item of result.restaurants) {
			const [area = ""] = groupValues(item, "area");
			expect(entry.areas).toContain(area);
		}
	});
}

test("restaurant ids are unique across all preset files", async () => {
	const ids: string[] = [];
	for (const entry of index.presets) {
		const text = await Bun.file(`${DIR}/${entry.id}.json`).text();
		const result = parseImport(text);
		if (!result.ok) throw new Error(result.error);
		ids.push(...result.restaurants.map((item) => item.id));
	}
	expect(new Set(ids).size).toBe(ids.length);
});

test("every city and district id has en and th names", () => {
	const cityIds = new Set(index.presets.map((entry) => entry.city));
	const districtIds = new Set(index.presets.map((entry) => entry.district));

	for (const id of cityIds) {
		const name = index.cities[id];
		expect(name, id).toBeDefined();
		expect(name?.en, id).toBeTruthy();
		expect(name?.th, id).toBeTruthy();
	}
	for (const id of districtIds) {
		const name = index.districts[id];
		expect(name, id).toBeDefined();
		expect(name?.en, id).toBeTruthy();
		expect(name?.th, id).toBeTruthy();
	}
});

const THAI = /[฀-๿]/;

for (const entry of index.presets) {
	test(`${entry.id}: names are split by language, without the place`, async () => {
		const result = parseImport(
			await Bun.file(`${DIR}/${entry.id}.json`).text(),
		);
		if (!result.ok) throw new Error(result.error);
		for (const item of result.restaurants) {
			expect(item.name.en, item.id).not.toMatch(THAI);
			expect(item.name.en, item.id).not.toMatch(/ - [^-]+$/);
			expect(item.name.th, item.id).not.toMatch(/ - [^-]+$/);
		}
	});

	test(`${entry.id}: every restaurant has an http(s) link`, async () => {
		const result = parseImport(
			await Bun.file(`${DIR}/${entry.id}.json`).text(),
		);
		if (!result.ok) throw new Error(result.error);
		for (const item of result.restaurants)
			expect(item.link, item.id).toMatch(/^https:\/\//);
	});

	test(`${entry.id}: the only verification marker is "unverified"`, async () => {
		const result = parseImport(
			await Bun.file(`${DIR}/${entry.id}.json`).text(),
		);
		if (!result.ok) throw new Error(result.error);
		for (const item of result.restaurants)
			for (const tag of item.tags)
				expect(tag, item.id).not.toMatch(
					/^(unverified .+|likely open|open \d+)$/,
				);
	});

	test(`${entry.id}: no restaurant is listed twice in one area`, async () => {
		const result = parseImport(
			await Bun.file(`${DIR}/${entry.id}.json`).text(),
		);
		if (!result.ok) throw new Error(result.error);
		const keys = result.restaurants.map(
			(item) =>
				`${item.name.en.toLowerCase()}|${groupValues(item, "area").join()}`,
		);
		expect(keys.filter((key, at) => keys.indexOf(key) !== at)).toEqual([]);
	});
}
