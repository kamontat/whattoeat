/**
 * Rewrites each entry's `count` in the preset index from its file's `restaurants` length.
 * Everything else in the index is written by hand. Run with `bun run presets:index`.
 */

type PresetEntry = { id: string; count: number };
type PresetIndex = { presets: PresetEntry[] };

const DIR = "src/assets/data/presets";
const INDEX_PATH = `${DIR}/index.json`;

const index = (await Bun.file(INDEX_PATH).json()) as PresetIndex;

for (const entry of index.presets) {
	const file = Bun.file(`${DIR}/${entry.id}.json`);
	if (!(await file.exists())) {
		console.error(`presets-index: no file for preset "${entry.id}"`);
		process.exit(1);
	}
	const { restaurants } = (await file.json()) as { restaurants: unknown[] };
	entry.count = restaurants.length;
}

await Bun.write(INDEX_PATH, `${JSON.stringify(index, null, "\t")}\n`);
