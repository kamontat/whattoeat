import type { Restaurant } from "#lib/restaurant";

/**
 * Pick one restaurant uniformly at random. With two or more restaurants the previous pick is
 * excluded, so pressing the button again always shows a different one.
 */
export const pickRandom = (
	list: readonly Restaurant[],
	previousId?: string,
	rng: () => number = Math.random,
): Restaurant | undefined => {
	const pool =
		list.length > 1 ? list.filter((item) => item.id !== previousId) : list;
	return pool[Math.floor(rng() * pool.length)];
};
