import type { Localized } from "#lib/i18n";
import { type AddedPreset, isAddedPreset } from "#lib/preset-record";
import { profileKey } from "#lib/profiles";
import type { Restaurant } from "#lib/restaurant";
import { parseImport } from "#lib/transfer";

/** One bundled neighbourhood preset, as listed in `data/presets/index.json`. */
export type PresetEntry = {
	id: string;
	city: string;
	district: string;
	name: Localized;
	count: number;
	updatedAt: string;
	places: string[];
	areas: string[];
};

export type PresetIndex = {
	version: 1;
	cities: Record<string, Localized>;
	districts: Record<string, Localized>;
	presets: PresetEntry[];
};

export {
	type AddedPreset,
	isAddedPreset,
	mergeAddedPresets,
} from "#lib/preset-record";

export type PresetState = "new" | "added" | "update";

/** An index entry together with the restaurants its file validated to. */
export type PresetFile = { entry: PresetEntry; restaurants: Restaurant[] };

export const presetsKey = (): string => profileKey("presets");

const isString = (value: unknown): value is string => typeof value === "string";

const isLocalized = (value: unknown): value is Localized => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof Localized, unknown>>;
	return isString(item.en) && isString(item.th);
};

const isLocalizedMap = (value: unknown): value is Record<string, Localized> => {
	if (typeof value !== "object" || value === null) return false;
	return Object.values(value).every(isLocalized);
};

/** `undefined` on any shape error; every entry's `city` and `district` must exist in the maps. */
export const parseIndex = (data: unknown): PresetIndex | undefined => {
	if (typeof data !== "object" || data === null) return undefined;
	const file = data as Partial<Record<keyof PresetIndex, unknown>>;
	if (file.version !== 1) return undefined;
	if (!isLocalizedMap(file.cities) || !isLocalizedMap(file.districts))
		return undefined;
	const cities = file.cities;
	const districts = file.districts;
	if (!Array.isArray(file.presets)) return undefined;
	const presets: unknown[] = file.presets;
	const isPresetEntry = (value: unknown): value is PresetEntry => {
		if (typeof value !== "object" || value === null) return false;
		const entry = value as Partial<Record<keyof PresetEntry, unknown>>;
		return (
			isString(entry.id) &&
			entry.id !== "" &&
			isString(entry.city) &&
			Object.hasOwn(cities, entry.city) &&
			isString(entry.district) &&
			Object.hasOwn(districts, entry.district) &&
			isLocalized(entry.name) &&
			typeof entry.count === "number" &&
			isString(entry.updatedAt) &&
			Array.isArray(entry.places) &&
			entry.places.every(isString) &&
			Array.isArray(entry.areas) &&
			entry.areas.every(isString)
		);
	};
	if (!presets.every(isPresetEntry)) return undefined;
	return { version: 1, cities, districts, presets: presets as PresetEntry[] };
};

export const indexUrl = (base: string): string =>
	`${base}data/presets/index.json`;

export const presetFileUrl = (base: string, id: string): string =>
	`${base}data/presets/${id}.json`;

/** Unreadable entries are skipped; bad JSON or blocked storage gives `[]`. */
export const loadAddedPresets = (): AddedPreset[] => {
	let data: unknown;
	try {
		data = JSON.parse(localStorage.getItem(presetsKey()) ?? "[]");
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	return data.filter(isAddedPreset);
};

/** `false` when localStorage refused the write. */
export const saveAddedPresets = (list: AddedPreset[]): boolean => {
	try {
		localStorage.setItem(presetsKey(), JSON.stringify(list));
		return true;
	} catch {
		return false;
	}
};

/**
 * A preset counts as added only while `added` records it and at least one of its recorded ids is
 * still in `savedIds` (see the design's "What the browser stores"); otherwise it is "new", even
 * when recorded. When it still counts as added, a stale `updatedAt` means "update".
 */
export const presetState = (
	entry: PresetEntry,
	added: readonly AddedPreset[],
	savedIds: ReadonlySet<string>,
): PresetState => {
	const record = added.find((item) => item.id === entry.id);
	if (record === undefined) return "new";
	if (!record.ids.some((id) => savedIds.has(id))) return "new";
	return record.updatedAt === entry.updatedAt ? "added" : "update";
};

const toAddedPreset = (file: PresetFile): AddedPreset => ({
	id: file.entry.id,
	updatedAt: file.entry.updatedAt,
	ids: file.restaurants.map((item) => item.id),
});

/** Record `files` into `added`, replacing any existing record for the same preset id. */
const recordAdded = (
	added: readonly AddedPreset[],
	files: readonly PresetFile[],
): AddedPreset[] => {
	const next = [...added];
	for (const file of files) {
		const record = toAddedPreset(file);
		const index = next.findIndex((item) => item.id === record.id);
		if (index === -1) next.push(record);
		else next[index] = record;
	}
	return next;
};

/**
 * Add `files`' restaurants to `saved`: an id already saved, or repeated across the files, is
 * dropped, so existing restaurants (including any edits) are never touched. `list` is `saved`
 * followed by the new restaurants, in file order.
 */
export const addPresets = (
	saved: Restaurant[],
	files: PresetFile[],
	added: AddedPreset[],
): { list: Restaurant[]; added: AddedPreset[]; newCount: number } => {
	const savedIds = new Set(saved.map((item) => item.id));
	const seen = new Set<string>();
	const fresh: Restaurant[] = [];
	for (const file of files) {
		for (const restaurant of file.restaurants) {
			if (savedIds.has(restaurant.id) || seen.has(restaurant.id)) continue;
			seen.add(restaurant.id);
			fresh.push(restaurant);
		}
	}
	return {
		list: [...saved, ...fresh],
		added: recordAdded(added, files),
		newCount: fresh.length,
	};
};

/** Replace the whole list with `files`' restaurants, repeat ids dropped (keeping the first copy). */
export const replaceWithPresets = (
	files: PresetFile[],
): { list: Restaurant[]; added: AddedPreset[] } => {
	const seen = new Set<string>();
	const list: Restaurant[] = [];
	for (const file of files) {
		for (const restaurant of file.restaurants) {
			if (seen.has(restaurant.id)) continue;
			seen.add(restaurant.id);
			list.push(restaurant);
		}
	}
	return { list, added: files.map(toAddedPreset) };
};

/** Rejects on a network error, a non-OK status, or a failed `parseIndex`. */
export const fetchIndex = async (base: string): Promise<PresetIndex> => {
	const response = await fetch(indexUrl(base));
	if (!response.ok) throw new Error(`status ${response.status}`);
	const index = parseIndex(await response.json());
	if (index === undefined) throw new Error("invalid preset index");
	return index;
};

/**
 * Fetch every entry's file in parallel, validating each with `parseImport`. Rejects if any one
 * fails: a network error, a non-OK status, or a failed `parseImport`.
 */
export const fetchPresetFiles = (
	base: string,
	entries: PresetEntry[],
): Promise<PresetFile[]> =>
	Promise.all(
		entries.map(async (entry): Promise<PresetFile> => {
			const response = await fetch(presetFileUrl(base, entry.id));
			if (!response.ok) throw new Error(`status ${response.status}`);
			const result = parseImport(await response.text());
			if (!result.ok) throw new Error(result.error);
			return { entry, restaurants: result.restaurants };
		}),
	);
