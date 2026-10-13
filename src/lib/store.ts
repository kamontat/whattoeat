import {
	isNameTaken,
	isRestaurant,
	newId,
	normalizeInput,
	type Restaurant,
	type RestaurantInput,
} from "#lib/restaurant";

export const STORAGE_KEY = "whattoeat:restaurants";
export const CHANGE_EVENT = "whattoeat:restaurants-changed";
/** Stored entries that failed validation, kept so the next save does not destroy them for good. */
export const INVALID_KEY = "whattoeat:restaurants:invalid";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: Restaurant[] | undefined;

const backupInvalid = (entries: unknown[]): void => {
	try {
		const previous: unknown = JSON.parse(
			localStorage.getItem(INVALID_KEY) ?? "[]",
		);
		const kept = Array.isArray(previous) ? previous : [];
		const seen = new Set(kept.map((entry) => JSON.stringify(entry)));
		const added = entries.filter((entry) => !seen.has(JSON.stringify(entry)));
		if (added.length > 0) {
			localStorage.setItem(INVALID_KEY, JSON.stringify([...kept, ...added]));
		}
	} catch {
		// Best effort: a failed backup must not break loading.
	}
};

export const loadRestaurants = (): Restaurant[] => {
	if (memory !== undefined) return memory;
	let raw: string | null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		return [];
	}
	if (raw === null) return [];
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	const valid = data.filter(isRestaurant);
	if (valid.length < data.length) {
		backupInvalid(data.filter((entry) => !isRestaurant(entry)));
	}
	return valid;
};

/** True when the last save could not reach localStorage, so changes vanish when the page is left. */
export const isMemoryOnly = (): boolean => memory !== undefined;

/** Returns `false` when localStorage refused the write and the list is only kept in memory. */
export const saveRestaurants = (list: Restaurant[]): boolean => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
	return memory === undefined;
};

const requireName = (
	input: RestaurantInput,
	list: readonly Restaurant[],
	exceptId?: string,
): RestaurantInput => {
	const clean = normalizeInput(input);
	if (clean.name === "") throw new Error("Restaurant name is required");
	if (isNameTaken(list, clean.name, exceptId))
		throw new Error("Restaurant name is already taken");
	return clean;
};

export const addRestaurant = (
	input: RestaurantInput,
	now: Date = new Date(),
): Restaurant[] => {
	const existing = loadRestaurants();
	const clean = requireName(input, existing);
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
	const clean = requireName(input, existing, id);
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
		if (event.key === STORAGE_KEY || event.key === null) callback();
	};
	window.addEventListener(CHANGE_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(CHANGE_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};
