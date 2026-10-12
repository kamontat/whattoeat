import { isRestaurant, normalizeInput, type Restaurant } from "#lib/restaurant";

export const EXPORT_VERSION = 1;

export type ExportFile = {
	app: "whattoeat";
	version: number;
	exportedAt: string;
	restaurants: Restaurant[];
};

/** Each error is an i18n message key, so the UI can show it directly with `t(error)`. */
export type ImportError =
	| "import.error.json"
	| "import.error.format"
	| "import.error.version"
	| "import.error.entries"
	| "import.error.read";

export type ImportResult =
	| { ok: true; restaurants: Restaurant[] }
	| { ok: false; error: ImportError };

export const toExportFile = (
	restaurants: Restaurant[],
	now: Date = new Date(),
): ExportFile => ({
	app: "whattoeat",
	version: EXPORT_VERSION,
	exportedAt: now.toISOString(),
	restaurants,
});

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
	if (file.version !== EXPORT_VERSION)
		return { ok: false, error: "import.error.version" };
	if (
		!restaurants.every(isRestaurant) ||
		new Set(restaurants.map((item) => item.id)).size !== restaurants.length
	)
		return { ok: false, error: "import.error.entries" };
	// Clean imported text the same way as typed input, and keep only known fields.
	return {
		ok: true,
		restaurants: restaurants.map((item) => ({
			id: item.id,
			...normalizeInput(item),
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
		})),
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
