import { expect, test } from "bun:test";
import { PRESETS, presetUrl } from "#lib/presets";
import { groupValues } from "#lib/restaurant";
import { parseImport } from "#lib/transfer";

const AREAS: Record<string, readonly string[]> = {
	ladprao: [
		"central ladprao",
		"union mall",
		"lotus ladprao",
		"ha yaek lat phrao",
		"lat phrao",
	],
	ratchayothin: ["major ratchayothin", "avenue ratchayothin", "ratchada"],
};

test("lists the Ladprao and Ratchayothin presets", () => {
	expect(PRESETS.map((preset) => preset.id)).toEqual([
		"ladprao",
		"ratchayothin",
	]);
});

test("each preset is fetched from presets/<id>.json next to the page", () => {
	expect(presetUrl("ladprao")).toBe("presets/ladprao.json");
});

for (const preset of PRESETS) {
	test(`${preset.id}: the bundled file imports and holds the listed count`, async () => {
		const text = await Bun.file(`src/assets/presets/${preset.id}.json`).text();
		const result = parseImport(text);
		if (!result.ok) throw new Error(result.error);
		expect(result.restaurants.length).toBe(preset.count);
	});

	test(`${preset.id}: every restaurant sits in one of its areas`, async () => {
		const result = parseImport(
			await Bun.file(`src/assets/presets/${preset.id}.json`).text(),
		);
		if (!result.ok) throw new Error(result.error);
		for (const item of result.restaurants)
			expect(AREAS[preset.id]).toContain(groupValues(item, "area")[0]);
	});
}
