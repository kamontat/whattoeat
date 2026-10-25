import {
	type GroupDef,
	isGroupDef,
	mergeGroupDefs,
	remapGroups,
} from "#lib/groups";
import {
	cleanEntry,
	type HistoryEntry,
	isHistoryEntry,
	newestFirst,
	renameLockedAt,
} from "#lib/history";
import { type AddedPreset, isAddedPreset } from "#lib/presets";
import { cleanStored, isRestaurant, type Restaurant } from "#lib/restaurant";

export const EXPORT_VERSION = 8;

/**
 * Version 1 files predate history; they still import, with no history. Version 2 files call
 * each visit's time `lockedAt`. Versions 1–3 have no group list and keep area and cuisine as
 * single strings. Versions 1–4 keep a free-text `location` where version 5 has a `link`.
 * Versions 1–5 keep each name as one string where version 6 has one per language. Versions
 * 5–6 keep one unlabelled `link` where version 7 has a list of labelled `links`. Versions 1–7
 * have no preset record.
 */
const READABLE_VERSIONS: readonly unknown[] = [
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	EXPORT_VERSION,
];

export type ExportFile = {
	app: "whattoeat";
	version: number;
	exportedAt: string;
	restaurants: Restaurant[];
	history: HistoryEntry[];
	groups: GroupDef[];
	presets: AddedPreset[];
};

/** Each error is an i18n message key, so the UI can show it directly with `t(error)`. */
export type ImportError =
	| "import.error.json"
	| "import.error.format"
	| "import.error.version"
	| "import.error.entries"
	| "import.error.read";

export type ImportResult =
	| {
			ok: true;
			restaurants: Restaurant[];
			/** `undefined` for a version 1 file, which has no history. */
			history: HistoryEntry[] | undefined;
			/** `undefined` for versions 1–3, which have no group list; the current groups stay. */
			groups: GroupDef[] | undefined;
			/** `undefined` for versions 1–7, which have no preset record. */
			presets: AddedPreset[] | undefined;
	  }
	| { ok: false; error: ImportError };

export const toExportFile = (
	restaurants: Restaurant[],
	history: HistoryEntry[] = [],
	groups: GroupDef[] = [],
	presets: AddedPreset[] = [],
	now: Date = new Date(),
): ExportFile => ({
	app: "whattoeat",
	version: EXPORT_VERSION,
	exportedAt: now.toISOString(),
	restaurants,
	history,
	groups,
	presets,
});

/** Export as JSON text: indented for a downloaded file, one line for the clipboard. */
export const exportJson = (
	restaurants: Restaurant[],
	history: HistoryEntry[],
	groups: GroupDef[],
	presets: AddedPreset[],
	now: Date,
	{ pretty }: { pretty: boolean },
): string =>
	JSON.stringify(
		toExportFile(restaurants, history, groups, presets, now),
		null,
		pretty ? 2 : undefined,
	);

const pad = (value: number): string => String(value).padStart(2, "0");

export const exportFileName = (now: Date = new Date()): string =>
	`whattoeat-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;

/** Validate an export file. All or nothing: one invalid entry rejects the whole file. */
export const parseImport = (text: string): ImportResult => {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: "import.error.json" };
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return { ok: false, error: "import.error.format" };
	}
	const file = data as Partial<Record<keyof ExportFile, unknown>>;
	const restaurants = file.restaurants;
	if (file.app !== "whattoeat" || !Array.isArray(restaurants)) {
		return { ok: false, error: "import.error.format" };
	}
	if (!READABLE_VERSIONS.includes(file.version))
		return { ok: false, error: "import.error.version" };
	if (
		!restaurants.every(isRestaurant) ||
		new Set(restaurants.map((item) => item.id)).size !== restaurants.length
	)
		return { ok: false, error: "import.error.entries" };
	let history: HistoryEntry[] | undefined;
	if (file.version !== 1) {
		if (!Array.isArray(file.history))
			return { ok: false, error: "import.error.format" };
		const entries =
			file.version === 2 ? file.history.map(renameLockedAt) : file.history;
		if (
			!entries.every(isHistoryEntry) ||
			new Set(entries.map((item) => item.id)).size !== entries.length
		)
			return { ok: false, error: "import.error.entries" };
		history = newestFirst(entries.map(cleanEntry));
	}
	let groups: GroupDef[] | undefined;
	if (typeof file.version === "number" && file.version >= 4) {
		if (!Array.isArray(file.groups))
			return { ok: false, error: "import.error.format" };
		if (
			!file.groups.every(isGroupDef) ||
			new Set(file.groups.map((item) => item.id)).size !== file.groups.length
		)
			return { ok: false, error: "import.error.entries" };
		groups = file.groups.map(({ id, name }) => ({ id, name: name.trim() }));
	}
	let presets: AddedPreset[] | undefined;
	if (typeof file.version === "number" && file.version >= 8) {
		if (!Array.isArray(file.presets))
			return { ok: false, error: "import.error.format" };
		if (!file.presets.every(isAddedPreset))
			return { ok: false, error: "import.error.entries" };
		presets = file.presets;
	}
	// A file's own repeated names, or names of built-in groups, fold into one group.
	const own = mergeGroupDefs([], groups ?? []);
	const ids = (groups ?? []).map((item) => item.id);
	// Clean imported text the same way as typed input, and keep only known fields.
	return {
		ok: true,
		restaurants: remapGroups(
			restaurants.map((item) => cleanStored(item, ids)),
			own.remap,
		),
		history,
		groups: groups === undefined ? undefined : own.groups,
		presets,
	};
};

/**
 * Incoming restaurants replace existing ones with the same id (keeping their position); new ids
 * are appended.
 */
export const mergeRestaurants = (
	existing: Restaurant[],
	incoming: Restaurant[],
): Restaurant[] => {
	const byId = new Map(existing.map((item) => [item.id, item]));
	for (const item of incoming) byId.set(item.id, item);
	return [...byId.values()];
};

/** Incoming visits replace existing ones with the same id; the result is newest first. */
export const mergeHistory = (
	existing: HistoryEntry[],
	incoming: HistoryEntry[],
): HistoryEntry[] => {
	const byId = new Map(existing.map((item) => [item.id, item]));
	for (const item of incoming) byId.set(item.id, item);
	return newestFirst([...byId.values()]);
};
