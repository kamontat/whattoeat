/**
 * The service worker, bundled into `dist/sw.js` by `scripts/service-worker.ts` after the pages
 * are built. That script replaces `PRECACHE` with every build file's path and `VERSION` with a
 * hash of their contents, so each deploy gets a new worker and a cache of its own.
 */
import {
	cacheFirst,
	cacheName,
	cleanup,
	NETWORK_WAIT_MS,
	networkFirst,
	strategy,
} from "#lib/precache";

declare const PRECACHE: string[];
declare const VERSION: string;

// The DOM lib has no worker types, so only what this file uses is declared.
type ExtendableEvent = Event & { waitUntil(promise: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & {
	request: Request;
	respondWith(response: Promise<Response>): void;
};
type WorkerScope = {
	location: Location;
	clients: { claim(): Promise<void> };
	skipWaiting(): Promise<void>;
	addEventListener(
		type: "install" | "activate",
		listener: (event: ExtendableEvent) => void,
	): void;
	addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
};

const worker = self as unknown as WorkerScope;
const CACHE = cacheName(VERSION);
// `PRECACHE` is inlined wherever it is named, so it is named once.
const precached = new Set(PRECACHE);

worker.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			// `reload` skips the HTTP cache, which may still hold the previous deploy's pages.
			.then((cache) =>
				cache.addAll(
					[...precached].map((url) => new Request(url, { cache: "reload" })),
				),
			)
			.then(() => worker.skipWaiting()),
	);
});

worker.addEventListener("activate", (event) => {
	event.waitUntil(cleanup(caches, CACHE).then(() => worker.clients.claim()));
});

worker.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) return;
	const how = strategy(url.pathname, precached);
	if (how === undefined) return;
	const load = () => fetch(request);
	event.respondWith(
		caches
			.open(CACHE)
			.then((cache) =>
				how === "cache-first"
					? cacheFirst(cache, request, load)
					: networkFirst(cache, request, load, NETWORK_WAIT_MS),
			),
	);
});
