/**
 * Apply a draft of restaurant changes to one neighbourhood preset file.
 *
 *   bun .claude/skills/preset-data/scripts/upsert-preset.ts <preset-id> <draft.json>
 *
 * The draft is `{ "restaurants": [...] }`. Each item is one of:
 *   - new:    { id?, name, location, kinds, area, notes?, link?, cuisine?, tags? }
 *             (an unused id is kept; `location` becomes the first line of `notes`)
 *   - update: { id, ...fields to change }  (or no id, matched by English or Thai name,
 *             case-insensitive); `location` is not accepted here, give the whole new `notes`
 *   - remove: { id, remove: true }
 *
 * `name` is a string (the English name) or `{ en?, th? }`; an update changes only the
 * languages it gives. Every restaurant needs a name in at least one language.
 *
 * `link` must be an http(s) URL or empty.
 * New restaurants get 8-character ids unique across every preset file and today's timestamps.
 * Changed ones get a new `updatedAt`. Tags and group values are cleaned the way the app does.
 * When the preset already has an index entry, its `updatedAt` is set to today if anything
 * changed. The script never writes `count`: run `bun run presets:index` afterwards.
 */

const DIR = "src/assets/data/presets";
const KINDS = ["food", "drinks", "dessert"] as const;
const ID_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

type Name = { en: string; th: string };

type Restaurant = {
	id: string;
	name: Name;
	link: string;
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
	name?: string | Partial<Name>;
	location?: string;
	notes?: string;
	link?: string;
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

/** The languages a draft name gives, trimmed; a string is the English name. */
const draftName = (name: Draft["name"]): Partial<Name> => {
	if (name === undefined) return {};
	if (typeof name === "string") return { en: name.trim() };
	const given: Partial<Name> = {};
	if (name.en !== undefined) given.en = name.en.trim();
	if (name.th !== undefined) given.th = name.th.trim();
	return given;
};

const nameLabel = (name: Partial<Name>): string | undefined =>
	[name.en, name.th].filter((text) => text !== undefined && text !== "").join(" / ") ||
	undefined;

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
	const keys = Object.values(draftName(item.name))
		.map((text) => text.toLocaleLowerCase())
		.filter((key) => key !== "");
	if (keys.length === 0) return -1;
	return list.findIndex((r) =>
		[r.name.en, r.name.th].some((text) =>
			keys.includes(text.trim().toLocaleLowerCase()),
		),
	);
};

const checkLink = (link: string | undefined, label: string): string => {
	const value = link?.trim() ?? "";
	if (value !== "" && !/^https?:\/\//.test(value))
		fail(`${label}: link must start with https:// or http:// (put places and floors in notes)`);
	return value;
};

const checkKinds = (kinds: string[], label: string): string[] => {
	const bad = kinds.filter((kind) => !(KINDS as readonly string[]).includes(kind));
	if (bad.length > 0)
		fail(`${label}: unknown kinds ${bad.join(", ")} (use ${KINDS.join(", ")})`);
	return KINDS.filter((kind) => kinds.includes(kind));
};

for (const item of draft.restaurants as Draft[]) {
	const at = findIndex(item);
	const given = draftName(item.name);
	const label = nameLabel(given) ?? item.id ?? "(unnamed)";

	if (item.remove) {
		if (at === -1) fail(`${label}: nothing to remove`);
		list.splice(at, 1);
		removed++;
		continue;
	}

	if (at === -1) {
		if (!nameLabel(given) || !item.location?.trim() || !item.area?.trim())
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
			name: { en: given.en ?? "", th: given.th ?? "" },
			link: checkLink(item.link, label),
			notes: [(item.location as string).trim(), item.notes?.trim() ?? ""]
				.filter((line) => line !== "")
				.join("\n"),
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
	next.name = { ...next.name, ...given };
	if (next.name.en === "" && next.name.th === "")
		fail(`${label}: a restaurant needs a name in English or Thai`);
	if (item.location !== undefined)
		fail(`${label}: location only applies to new restaurants; give the whole new notes instead`);
	if (item.link !== undefined) next.link = checkLink(item.link, label);
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

for (const lang of ["en", "th"] as const) {
	const names = new Map<string, string>();
	for (const item of list) {
		const key = item.name[lang].trim().toLocaleLowerCase();
		if (key === "") continue;
		if (names.has(key)) fail(`two restaurants are named "${item.name[lang]}"`);
		names.set(key, item.id);
	}
}

await Bun.write(
	filePath,
	`${JSON.stringify(
		{
			app: "whattoeat",
			version: 6,
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
