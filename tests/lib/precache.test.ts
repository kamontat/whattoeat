import { expect, test } from "bun:test";
import {
	cacheFirst,
	cacheName,
	cleanup,
	isHashed,
	networkFirst,
	precacheUrls,
	strategy,
} from "#lib/precache";

/** A cache holding `entries` (path to body), matching on the request's path only. */
const fakeCache = (entries: Record<string, string>) => ({
	match: async (request: RequestInfo | URL) => {
		const path = new URL(
			request instanceof Request ? request.url : String(request),
		).pathname;
		const body = entries[path];
		return body === undefined ? undefined : new Response(body);
	},
});

const request = (path: string) => new Request(`https://example.com${path}`);

test("cacheName puts the build version after the app prefix", () => {
	expect(cacheName("abc123")).toBe("whattoeat-abc123");
});

test("isHashed is true only for a build file with an 8-character hash", () => {
	expect(isHashed("/chunk-0qjgjvjg.js")).toBe(true);
	expect(isHashed("/chunk-b2qfctxh.css")).toBe(true);
	expect(isHashed("/manifest-a1b2c3d4.webmanifest")).toBe(true);
	expect(isHashed("/icons/icon-192.png")).toBe(false);
	expect(isHashed("/data/presets/index.json")).toBe(false);
	expect(isHashed("/history")).toBe(false);
});

test("precacheUrls turns pages into their served paths and skips source maps and the worker", () => {
	expect(
		precacheUrls([
			"index.html",
			"history.html",
			"settings.html",
			"settings/tags.html",
			"chunk-0qjgjvjg.js",
			"chunk-0qjgjvjg.js.map",
			"data/presets/index.json",
			"icons/icon-192.png",
			"sw.js",
		]),
	).toEqual([
		"/",
		"/chunk-0qjgjvjg.js",
		"/data/presets/index.json",
		"/history",
		"/icons/icon-192.png",
		"/settings",
		"/settings/tags",
	]);
});

test("strategy serves hashed files cache-first, other precached paths network-first, and leaves the rest alone", () => {
	const precached = new Set(["/", "/history", "/chunk-0qjgjvjg.js"]);
	expect(strategy("/chunk-0qjgjvjg.js", precached)).toBe("cache-first");
	expect(strategy("/", precached)).toBe("network-first");
	expect(strategy("/history", precached)).toBe("network-first");
	expect(strategy("/chunk-zzzzzzzz.js", precached)).toBeUndefined();
	expect(strategy("/sw.js", precached)).toBeUndefined();
});

test("cacheFirst answers from the cache without touching the network", async () => {
	let loads = 0;
	const response = await cacheFirst(
		fakeCache({ "/chunk-0qjgjvjg.js": "cached" }),
		request("/chunk-0qjgjvjg.js"),
		async () => {
			loads++;
			return new Response("network");
		},
	);
	expect(await response.text()).toBe("cached");
	expect(loads).toBe(0);
});

test("cacheFirst goes to the network on a miss", async () => {
	const response = await cacheFirst(
		fakeCache({}),
		request("/chunk-0qjgjvjg.js"),
		async () => new Response("network"),
	);
	expect(await response.text()).toBe("network");
});

test("networkFirst answers from the network when it replies in time", async () => {
	const response = await networkFirst(
		fakeCache({ "/history": "cached" }),
		request("/history"),
		async () => new Response("network"),
		50,
	);
	expect(await response.text()).toBe("network");
});

test("networkFirst falls back to the cache when the network fails", async () => {
	const response = await networkFirst(
		fakeCache({ "/history": "cached" }),
		request("/history"),
		() => Promise.reject(new TypeError("Failed to fetch")),
		1000,
	);
	expect(await response.text()).toBe("cached");
});

test("networkFirst falls back to the cache when the network is too slow", async () => {
	const started = Date.now();
	const response = await networkFirst(
		fakeCache({ "/history": "cached" }),
		request("/history"),
		() => new Promise(() => {}),
		20,
	);
	expect(await response.text()).toBe("cached");
	expect(Date.now() - started).toBeLessThan(500);
});

test("networkFirst keeps waiting for a slow network when the cache has nothing", async () => {
	const response = await networkFirst(
		fakeCache({}),
		request("/history"),
		() => Bun.sleep(40).then(() => new Response("network")),
		10,
	);
	expect(await response.text()).toBe("network");
});

test("networkFirst rejects with the network error when the cache has nothing", async () => {
	const failure = networkFirst(
		fakeCache({}),
		request("/history"),
		() => Promise.reject(new TypeError("Failed to fetch")),
		1000,
	);
	await expect(failure).rejects.toThrow("Failed to fetch");
});

test("cleanup deletes this app's older caches and keeps the current one and other caches", async () => {
	const names = ["whattoeat-old", "whattoeat-new", "someone-else"];
	const deleted: string[] = [];
	await cleanup(
		{
			keys: async () => names,
			delete: async (name: string) => {
				deleted.push(name);
				return true;
			},
		},
		"whattoeat-new",
	);
	expect(deleted).toEqual(["whattoeat-old"]);
});
