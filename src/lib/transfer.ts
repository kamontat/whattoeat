import {
	cleanEntry,
	type HistoryEntry,
	isHistoryEntry,
	newestFirst,
} from "#lib/history";
import { isRestaurant, normalizeInput, type Restaurant } from "#lib/restaurant";

export const EXPORT_VERSION = 2;

/** Version 1 files predate history; they still import, with no history. */
const READABLE_VERSIONS: readonly unknown[] = [1, EXPORT_VERSION];

export type ExportFile = {
	app: "whattoeat";
	version: number;
	exportedAt: string;
	restaurants: Restaurant[];
	history: HistoryEntry[];
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
	  }
	| { ok: false; error: ImportError };

export const toExportFile = (
	restaurants: Restaurant[],
	history: HistoryEntry[] = [],
	now: Date = new Date(),
): ExportFile => ({
	app: "whattoeat",
	version: EXPORT_VERSION,
	exportedAt: now.toISOString(),
	restaurants,
	history,
});

/** Export as JSON text: indented for a downloaded file, one line for the clipboard. */
export const exportJson = (
	restaurants: Restaurant[],
	history: HistoryEntry[],
	now: Date,
	{ pretty }: { pretty: boolean },
): string =>
	JSON.stringify(
		toExportFile(restaurants, history, now),
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
		const entries = file.history;
		if (!Array.isArray(entries))
			return { ok: false, error: "import.error.format" };
		if (
			!entries.every(isHistoryEntry) ||
			new Set(entries.map((item) => item.id)).size !== entries.length
		)
			return { ok: false, error: "import.error.entries" };
		history = newestFirst(entries.map(cleanEntry));
	}
	// Clean imported text the same way as typed input, and keep only known fields.
	return {
		ok: true,
		restaurants: restaurants.map((item) => ({
			id: item.id,
			...normalizeInput(item),
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
		})),
		history,
	};
};

/** Incoming restaurants replace existing ones with the same id (keeping their position); new ids are appended. */
export const mergeRestaurants = (
	existing: Restaurant[],
	incoming: Restaurant[],
): Restaurant[] => {
	const byId = new Map(existing.map((item) => [item.id, item]));
	for (const item of incoming) byId.set(item.id, item);
	return [...byId.values()];
};

/** Incoming locks replace existing ones with the same id; the result is newest first. */
export const mergeHistory = (
	existing: HistoryEntry[],
	incoming: HistoryEntry[],
): HistoryEntry[] => {
	const byId = new Map(existing.map((item) => [item.id, item]));
	for (const item of incoming) byId.set(item.id, item);
	return newestFirst([...byId.values()]);
};
