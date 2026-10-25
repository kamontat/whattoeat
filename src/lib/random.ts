import { profileKey } from "#lib/profiles";
import type { Restaurant } from "#lib/restaurant";

/** How many restaurants one press of the pick button can show. */
export const PICK_COUNTS = [1, 2, 3, 4, 5] as const;
export type PickCount = (typeof PICK_COUNTS)[number];
export const DEFAULT_PICK_COUNT: PickCount = 2;

export const pickCountKey = (): string => profileKey("pick-count");

const isPickCount = (value: number): value is PickCount =>
	(PICK_COUNTS as readonly number[]).includes(value);

/** The stored pick count, else two. */
export const loadPickCount = (): PickCount => {
	try {
		const stored = Number(localStorage.getItem(pickCountKey()) || Number.NaN);
		if (isPickCount(stored)) return stored;
	} catch {
		// Storage blocked: fall back to the default.
	}
	return DEFAULT_PICK_COUNT;
};

export const savePickCount = (count: PickCount): void => {
	try {
		localStorage.setItem(pickCountKey(), String(count));
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
};

/** Take up to `count` different items from `pool`, each uniformly from what is left. */
const take = (
	pool: readonly Restaurant[],
	count: number,
	rng: () => number,
): Restaurant[] => {
	const rest = [...pool];
	const picks: Restaurant[] = [];
	while (picks.length < count && rest.length > 0) {
		const [item] = rest.splice(Math.floor(rng() * rest.length), 1);
		if (item) picks.push(item);
	}
	return picks;
};

/**
 * Pick `count` different restaurants at random. Restaurants from the previous pick are used
 * only when there are not enough others, so pressing the button again shows new options
 * whenever the list allows it.
 */
export const pickOptions = (
	list: readonly Restaurant[],
	count = 2,
	previousIds: readonly string[] = [],
	rng: () => number = Math.random,
): Restaurant[] => {
	const wasPicked = (item: Restaurant) => previousIds.includes(item.id);
	const picks = take(
		list.filter((item) => !wasPicked(item)),
		count,
		rng,
	);
	return [...picks, ...take(list.filter(wasPicked), count - picks.length, rng)];
};
