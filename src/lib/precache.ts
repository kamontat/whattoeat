/**
 * The service worker's caching rules, kept apart from `src/sw.ts` so they run under test. Every
 * build file is cached up front under one cache per build, so a page is only ever served with
 * the chunks of the same build.
 */

export const CACHE_PREFIX = "whattoeat-";

/** How long a page or data file waits for the network before the cached copy answers. */
export const NETWORK_WAIT_MS = 3000;

export const cacheName = (version: string): string =>
	`${CACHE_PREFIX}${version}`;

/** `bun-server build` names bundled files `<name>-<8-character hash>.<ext>`. */
const HASHED = /-[a-z0-9]{8}\.[a-z0-9]+$/;

export const isHashed = (path: string): boolean => HASHED.test(path);

/**
 * The paths to cache, from file paths relative to `dist/`. Pages are cached at the path
 * Cloudflare serves them on (`settings/tags.html` at `/settings/tags`, `index.html` at `/`),
 * since it redirects the `.html` path there. Source maps and the worker itself are left out.
 */
export const precacheUrls = (files: string[]): string[] =>
	files
		.filter((file) => !file.endsWith(".map") && file !== "sw.js")
		.map((file) => {
			if (file === "index.html") return "/";
			if (file.endsWith(".html")) return `/${file.slice(0, -".html".length)}`;
			return `/${file}`;
		})
		.sort();

export type Strategy = "cache-first" | "network-first";

/**
 * Hashed files never change, so the cache answers them. Pages and unhashed files (icons,
 * presets) try the network first, so a new deploy shows as soon as there is a connection.
 * Anything not cached goes to the network untouched.
 */
export const strategy = (
	path: string,
	precached: ReadonlySet<string>,
): Strategy | undefined => {
	if (!precached.has(path)) return undefined;
	return isHashed(path) ? "cache-first" : "network-first";
};

const MATCH: CacheQueryOptions = { ignoreSearch: true };

type Matcher = Pick<Cache, "match">;

export const cacheFirst = async (
	cache: Matcher,
	request: Request,
	load: () => Promise<Response>,
): Promise<Response> => (await cache.match(request, MATCH)) ?? load();

/**
 * The network's reply, unless it fails or takes longer than `wait` ms and the cache has a copy.
 * With nothing cached it keeps waiting for the network, and rejects with its error.
 */
export const networkFirst = async (
	cache: Matcher,
	request: Request,
	load: () => Promise<Response>,
	wait: number,
): Promise<Response> => {
	const network = load();
	let timer: Parameters<typeof clearTimeout>[0];
	const timeout = new Promise<undefined>((resolve) => {
		timer = setTimeout(resolve, wait);
	});
	const first = await Promise.race([network.catch(() => undefined), timeout]);
	clearTimeout(timer);
	if (first) return first;
	return (await cache.match(request, MATCH)) ?? network;
};

/** Delete every cache this app made except `keep`, leaving other caches on the origin alone. */
export const cleanup = async (
	caches: Pick<CacheStorage, "keys" | "delete">,
	keep: string,
): Promise<void> => {
	const names = await caches.keys();
	await Promise.all(
		names
			.filter((name) => name.startsWith(CACHE_PREFIX) && name !== keep)
			.map((name) => caches.delete(name)),
	);
};
