import {
	isRestaurant,
	normalizeInput,
	type Restaurant,
	type RestaurantInput,
} from "#lib/restaurant";

export const STORAGE_KEY = "whattoeat:restaurants";
export const CHANGE_EVENT = "whattoeat:restaurants-changed";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: Restaurant[] | undefined;

export const loadRestaurants = (): Restaurant[] => {
	if (memory !== undefined) return memory;
	let raw: string | null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		return [];
	}
	if (raw === null) return [];
	try {
		const data: unknown = JSON.parse(raw);
		return Array.isArray(data) ? data.filter(isRestaurant) : [];
	} catch {
		return [];
	}
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

const requireName = (input: RestaurantInput): RestaurantInput => {
	const clean = normalizeInput(input);
	if (clean.name === "") throw new Error("Restaurant name is required");
	return clean;
};

export const addRestaurant = (
	input: RestaurantInput,
	now: Date = new Date(),
): Restaurant[] => {
	const clean = requireName(input);
	const stamp = now.toISOString();
	const list = [
		...loadRestaurants(),
		{ id: crypto.randomUUID(), ...clean, createdAt: stamp, updatedAt: stamp },
	];
	saveRestaurants(list);
	return list;
};

export const updateRestaurant = (
	id: string,
	input: RestaurantInput,
	now: Date = new Date(),
): Restaurant[] => {
	const clean = requireName(input);
	const list = loadRestaurants().map((item) =>
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
