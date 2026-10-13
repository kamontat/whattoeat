import type { Restaurant } from "#lib/restaurant";

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
