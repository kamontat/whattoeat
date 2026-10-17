/**
 * Apply a draft of restaurant changes to one neighbourhood preset file.
 *
 *   bun .claude/skills/preset-data/scripts/upsert-preset.ts <preset-id> <draft.json>
 *
 * The draft is `{ "restaurants": [...] }`. Each item is one of:
 *   - new:    { id?, name, location, kinds, area, notes?, cuisine?, tags? }  (an unused id is kept)
 *   - update: { id, ...fields to change }  (or no id, matched by name, case-insensitive)
 *   - remove: { id, remove: true }
 *
 * New restaurants get 8-character ids unique across every preset file and today's timestamps.
 * Changed ones get a new `updatedAt`. Tags and group values are cleaned the way the app does.
 * When the preset already has an index entry, its `updatedAt` is set to today if anything
 * changed. The script never writes `count`: run `bun run presets:index` afterwards.
 */

const DIR = "src/assets/data/presets";
const KINDS = ["food", "drinks", "dessert"] as const;
const ID_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

type Restaurant = {
	id: string;
	name: string;
	location: string;
	notes: string;
	kinds: string[];
	groups: Record<string, string[]>;
	tags: string[];
	createdAt: string;
	updatedAt: string;
};

type Draft = {
	id?: string;
	remove?: boolean;
	name?: string;
	location?: string;
	notes?: string;
	kinds?: string[];
	cuisine?: string | string[];
	area?: string;
	tags?: string[];
};

type IndexEntry = { id: string; areas: string[]; updatedAt: string };

const fail = (message: string): never => {
	console.error(`upsert-preset: ${message}`);
	process.exit(1);
};

const [presetId, draftPath] = process.argv.slice(2);
if (!presetId || !draftPath)
	fail("usage: upsert-preset.ts <preset-id> <draft.json>");
if (!/^[a-z0-9-]+$/.test(presetId as string))
	fail(`preset id "${presetId}" must be lowercase letters, digits and dashes`);

const clean = (text: string): string =>
	text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

const cleanList = (values: readonly string[]): string[] => [
	...new Set(values.map(clean).filter((value) => value !== "")),
];

const asList = (value: string | string[] | undefined): string[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

const randomId = (taken: Set<string>): string => {
	for (;;) {
		let id = "";
		while (id.length < 8) {
			const [byte = 255] = crypto.getRandomValues(new Uint8Array(1));
			if (byte < 248) id += ID_ALPHABET[byte % 62];
		}
		if (!taken.has(id)) return id;
	}
};

const filePath = `${DIR}/${presetId}.json`;
const file = Bun.file(filePath);
const existing: Restaurant[] = (await file.exists())
	? ((await file.json()) as { restaurants: Restaurant[] }).restaurants
	: [];

// Ids in every other preset file, so a new id never collides across presets.
const taken = new Set(existing.map((item) => item.id));
for (const name of new Bun.Glob("*.json").scanSync({ cwd: DIR })) {
	if (name === "index.json" || name === `${presetId}.json`) continue;
	const other = (await Bun.file(`${DIR}/${name}`).json()) as {
		restaurants: Restaurant[];
	};
	for (const item of other.restaurants) taken.add(item.id);
}

const draft = (await Bun.file(draftPath as string).json()) as {
	restaurants?: Draft[];
};
if (!Array.isArray(draft.restaurants))
	fail("draft must be { \"restaurants\": [...] }");

const now = new Date().toISOString();
const list = [...existing];
let added = 0;
let updated = 0;
let removed = 0;

const findIndex = (item: Draft): number => {
	if (item.id !== undefined) return list.findIndex((r) => r.id === item.id);
	if (item.name === undefined) return -1;
	const key = item.name.trim().toLocaleLowerCase();
	return list.findIndex((r) => r.name.trim().toLocaleLowerCase() === key);
};

const checkKinds = (kinds: string[], label: string): string[] => {
	const bad = kinds.filter((kind) => !(KINDS as readonly string[]).includes(kind));
	if (bad.length > 0)
		fail(`${label}: unknown kinds ${bad.join(", ")} (use ${KINDS.join(", ")})`);
	return KINDS.filter((kind) => kinds.includes(kind));
};

for (const item of draft.restaurants as Draft[]) {
	const at = findIndex(item);
	const label = item.name ?? item.id ?? "(unnamed)";

	if (item.remove) {
		if (at === -1) fail(`${label}: nothing to remove`);
		list.splice(at, 1);
		removed++;
		continue;
	}

	if (at === -1) {
		if (!item.name?.trim() || !item.location?.trim() || !item.area?.trim())
			fail(
				item.id === undefined
					? `${label}: a new restaurant needs name, location and area`
					: `${label}: no restaurant with this id (to add one under it, give name, location, kinds and area)`,
			);
		if (item.id !== undefined && taken.has(item.id))
			fail(`${label}: id ${item.id} is already used by another preset; drop it to get a new one`);
		const kinds = checkKinds(item.kinds ?? [], label);
		if (kinds.length === 0) fail(`${label}: a new restaurant needs kinds`);
		const groups: Record<string, string[]> = {};
		const cuisine = cleanList(asList(item.cuisine));
		if (cuisine.length > 0) groups.cuisine = cuisine;
		groups.area = cleanList([item.area as string]);
		const id = item.id ?? randomId(taken);
		taken.add(id);
		list.push({
			id,
			name: (item.name as string).trim(),
			location: (item.location as string).trim(),
			notes: item.notes?.trim() ?? "",
			kinds,
			groups,
			tags: cleanList(item.tags ?? []),
			createdAt: now,
			updatedAt: now,
		});
		added++;
		continue;
	}

	const before = list[at] as Restaurant;
	const next: Restaurant = structuredClone(before);
	if (item.name !== undefined) next.name = item.name.trim();
	if (item.location !== undefined) next.location = item.location.trim();
	if (item.notes !== undefined) next.notes = item.notes.trim();
	if (item.kinds !== undefined) next.kinds = checkKinds(item.kinds, label);
	if (item.tags !== undefined) next.tags = cleanList(item.tags);
	if (item.cuisine !== undefined) {
		const cuisine = cleanList(asList(item.cuisine));
		if (cuisine.length > 0) next.groups.cuisine = cuisine;
		else delete next.groups.cuisine;
	}
	if (item.area !== undefined) next.groups.area = cleanList([item.area]);
	if (JSON.stringify(next) !== JSON.stringify(before)) {
		next.updatedAt = now;
		list[at] = next;
		updated++;
	}
}

const names = new Map<string, string>();
for (const item of list) {
	const key = item.name.trim().toLocaleLowerCase();
	if (names.has(key)) fail(`two restaurants are named "${item.name}"`);
	names.set(key, item.id);
}

await Bun.write(
	filePath,
	`${JSON.stringify(
		{
			app: "whattoeat",
			version: 4,
			exportedAt: now,
			restaurants: list,
			history: [],
			groups: [],
		},
		null,
		"\t",
	)}\n`,
);

console.log(
	`${filePath}: ${added} added, ${updated} updated, ${removed} removed, ${list.length} total`,
);

// Keep the index in step: today's date when anything changed, and a warning for unknown areas.
const indexPath = `${DIR}/index.json`;
const index = (await Bun.file(indexPath).json()) as { presets: IndexEntry[] };
const entry = index.presets.find((item) => item.id === presetId);
if (entry === undefined) {
	console.log(
		`no index entry for "${presetId}" yet: add one to ${indexPath}, then run bun run presets:index`,
	);
} else {
	if (added + updated + removed > 0) {
		entry.updatedAt = now.slice(0, 10);
		await Bun.write(indexPath, `${JSON.stringify(index, null, "\t")}\n`);
		console.log(`${indexPath}: updatedAt set to ${entry.updatedAt}`);
	}
	const unknown = new Set(
		list
			.map((item) => item.groups.area?.[0] ?? "")
			.filter((area) => !entry.areas.includes(area)),
	);
	if (unknown.size > 0)
		console.log(
			`areas missing from the index entry (tests will fail): ${[...unknown].join(", ")}`,
		);
	console.log("next: bun run presets:index && bun run format");
}
