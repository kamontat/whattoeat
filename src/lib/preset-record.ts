/**
 * The record of a preset this profile has added. A leaf module with no imports, so both
 * `#lib/presets` and `#lib/transfer` can use it without importing each other.
 */

/** A preset this browser has added: the restaurant ids its file held when it was added. */
export type AddedPreset = { id: string; updatedAt: string; ids: string[] };

const isString = (value: unknown): value is string => typeof value === "string";

export const isAddedPreset = (value: unknown): value is AddedPreset => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof AddedPreset, unknown>>;
	return (
		isString(item.id) &&
		item.id !== "" &&
		isString(item.updatedAt) &&
		Array.isArray(item.ids) &&
		item.ids.every(isString)
	);
};

/** `current`, then each `incoming` record whose id `current` has none for. */
export const mergeAddedPresets = (
	current: readonly AddedPreset[],
	incoming: readonly AddedPreset[],
): AddedPreset[] => {
	const ids = new Set(current.map((item) => item.id));
	return [...current, ...incoming.filter((item) => !ids.has(item.id))];
};
