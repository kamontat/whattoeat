import { customGroupIds, forgetGroupsMemory, loadGroups } from "#lib/groups";
import { forgetHistoryMemory } from "#lib/history";
import { forgetProfilesMemory, profileKey } from "#lib/profiles";
import {
	type CleanInput,
	cleanStored,
	isBlankName,
	isRestaurant,
	newId,
	normalizeInput,
	type Restaurant,
	type RestaurantInput,
} from "#lib/restaurant";

export const restaurantsKey = (): string => profileKey("restaurants");
export const CHANGE_EVENT = "whattoeat:restaurants-changed";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: Restaurant[] | undefined;

/** Stored entries the last load could not read; the next save drops them. */
let skipped = 0;

/**
 * How many stored entries the last `loadRestaurants` skipped. Stored text that is not a JSON
 * array counts as one.
 */
export const skippedCount = (): number => skipped;

export const loadRestaurants = (): Restaurant[] => {
	if (memory !== undefined) return memory;
	skipped = 0;
	let raw: string | null;
	try {
		raw = localStorage.getItem(restaurantsKey());
	} catch {
		return [];
	}
	if (raw === null) return [];
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		skipped = 1;
		return [];
	}
	if (!Array.isArray(data)) {
		skipped = 1;
		return [];
	}
	const valid = data.filter(isRestaurant);
	skipped = data.length - valid.length;
	// Older data may hold tags that differ only in case, area and cuisine strings, or values of
	// a group deleted since; cleaning fixes all three.
	const ids = customGroupIds(loadGroups());
	return valid.map((item) => cleanStored(item, ids));
};

/** True when the last save could not reach localStorage, so changes vanish when the page is left. */
export const isMemoryOnly = (): boolean => memory !== undefined;

/** Returns `false` when localStorage refused the write and the list is only kept in memory. */
export const saveRestaurants = (list: Restaurant[]): boolean => {
	try {
		localStorage.setItem(restaurantsKey(), JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
	return memory === undefined;
};

/**
 * Delete every localStorage entry this origin holds, then announce it the way another tab's
 * `localStorage.clear()` would, so restaurants, history, theme and language listeners reset in this tab too.
 */
export const resetStorage = (): void => {
	forgetHistoryMemory();
	forgetGroupsMemory();
	forgetProfilesMemory();
	try {
		localStorage.clear();
	} catch {
		// Storage blocked: only the in-memory list is dropped.
	}
	memory = undefined;
	window.dispatchEvent(new StorageEvent("storage", { key: null }));
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const requireName = (input: RestaurantInput): CleanInput => {
	const clean = normalizeInput(input, customGroupIds(loadGroups()));
	if (isBlankName(clean.name)) throw new Error("Restaurant name is required");
	return clean;
};

export const addRestaurant = (
	input: RestaurantInput,
	now: Date = new Date(),
): Restaurant[] => {
	const existing = loadRestaurants();
	const clean = requireName(input);
	const stamp = now.toISOString();
	const id = newId(existing.map((item) => item.id));
	const list = [
		...existing,
		{ id, ...clean, createdAt: stamp, updatedAt: stamp },
	];
	saveRestaurants(list);
	return list;
};

export const updateRestaurant = (
	id: string,
	input: RestaurantInput,
	now: Date = new Date(),
): Restaurant[] => {
	const existing = loadRestaurants();
	const clean = requireName(input);
	const list = existing.map((item) =>
		item.id === id ? { ...item, ...clean, updatedAt: now.toISOString() } : item,
	);
	saveRestaurants(list);
	return list;
};

export const removeRestaurant = (id: string): Restaurant[] => {
	const list = loadRestaurants().filter((item) => item.id !== id);
	saveRestaurants(list);
	return list;
};

/**
 * Call `callback` after every save in this tab and every change from another tab (a `null` key is
 * what `localStorage.clear()` sends). Returns an unsubscribe function.
 */
export const onRestaurantsChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === null || event.key === restaurantsKey()) callback();
	};
	window.addEventListener(CHANGE_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(CHANGE_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};
