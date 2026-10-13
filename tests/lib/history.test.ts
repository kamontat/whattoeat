import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	addLock,
	HISTORY_EVENT,
	HISTORY_KEY,
	type HistoryEntry,
	isHistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	onHistoryChanged,
	removeLock,
	saveHistory,
	summarize,
} from "#lib/history";
import type { Restaurant } from "#lib/restaurant";

const entry = (
	id: string,
	restaurantId: string,
	name: string,
	lockedAt: string,
): HistoryEntry => ({ id, restaurantId, name, lockedAt });

const restaurant = (id: string, name: string): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

beforeEach(() => {
	// Leave any in-memory fallback from an earlier test, then start empty.
	saveHistory([]);
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
});

test("loads [] when nothing is stored", () => {
	expect(loadHistory()).toEqual([]);
});

test.each([
	["not json", "{oops"],
	["not an array", JSON.stringify({ id: "a" })],
])("loads [] for stored text that is %s", (_label, raw) => {
	localStorage.setItem(HISTORY_KEY, raw);
	expect(loadHistory()).toEqual([]);
});

test("skips entries that are not valid and drops unknown fields", () => {
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([
			{ ...entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"), extra: 1 },
			{
				id: "b",
				restaurantId: "r1",
				name: " ",
				lockedAt: "2026-10-13T05:00:00.000Z",
			},
			{ id: "c", restaurantId: "r1", name: "C", lockedAt: "yesterday" },
			{
				id: "",
				restaurantId: "r1",
				name: "D",
				lockedAt: "2026-10-13T05:00:00.000Z",
			},
			null,
		]),
	);
	expect(loadHistory()).toEqual([
		entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"),
	]);
});

test("isHistoryEntry needs ids, a name and a readable time", () => {
	expect(
		isHistoryEntry(entry("a", "r1", "A", "2026-10-13T05:00:00.000Z")),
	).toBe(true);
	expect(
		isHistoryEntry({
			id: "a",
			restaurantId: "",
			name: "A",
			lockedAt: "2026-10-13T05:00:00.000Z",
		}),
	).toBe(false);
	expect(isHistoryEntry("a")).toBe(false);
});

test("loads newest first even when stored out of order", () => {
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([
			entry("old", "r1", "A", "2026-10-01T05:00:00.000Z"),
			entry("new", "r2", "B", "2026-10-13T05:00:00.000Z"),
			entry("mid", "r1", "A", "2026-10-07T05:00:00.000Z"),
		]),
	);
	expect(loadHistory().map((item) => item.id)).toEqual(["new", "mid", "old"]);
});

test("addLock saves the restaurant id, its name and the time, newest first", () => {
	addLock(restaurant("r1", "Jay Fai"), new Date("2026-10-12T12:00:00.000Z"));
	const added = addLock(
		restaurant("r2", "Thipsamai"),
		new Date("2026-10-13T12:30:00.000Z"),
	);
	expect(added).toMatchObject({
		restaurantId: "r2",
		name: "Thipsamai",
		lockedAt: "2026-10-13T12:30:00.000Z",
	});
	expect(added.id).toMatch(/^[0-9A-Za-z]{8}$/);
	const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
	expect(stored.map((item: HistoryEntry) => item.name)).toEqual([
		"Thipsamai",
		"Jay Fai",
	]);
	expect(loadHistory()).toEqual(stored);
});

test("addLock gives every entry a different id", () => {
	const ids = new Set(
		Array.from({ length: 20 }, () => addLock(restaurant("r1", "A")).id),
	);
	expect(ids.size).toBe(20);
});

test("removeLock deletes only that entry", () => {
	saveHistory([
		entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"),
		entry("b", "r1", "A", "2026-10-12T05:00:00.000Z"),
	]);
	expect(removeLock("a").map((item) => item.id)).toEqual(["b"]);
	expect(loadHistory().map((item) => item.id)).toEqual(["b"]);
});

test("addLock falls back to memory when localStorage throws", () => {
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		const added = addLock(restaurant("r1", "A"));
		expect(loadHistory()).toEqual([added]);
		expect(saveHistory(loadHistory())).toBe(false);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	// A successful save leaves memory mode again.
	expect(saveHistory([])).toBe(true);
	expect(localStorage.getItem(HISTORY_KEY)).toBe("[]");
});

test("onHistoryChanged fires for saves here, other tabs and a cleared storage", () => {
	let calls = 0;
	const off = onHistoryChanged(() => {
		calls += 1;
	});
	saveHistory([]);
	window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: null }));
	window.dispatchEvent(new StorageEvent("storage", { key: "whattoeat:theme" }));
	expect(calls).toBe(3);
	off();
	window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
	expect(calls).toBe(3);
});

test("summarize counts per restaurant, most first, ties by latest", () => {
	const stats = summarize(
		[
			entry("1", "r1", "A", "2026-10-13T05:00:00.000Z"),
			entry("2", "r2", "B", "2026-10-12T05:00:00.000Z"),
			entry("3", "r1", "A", "2026-10-10T05:00:00.000Z"),
			entry("4", "r3", "C", "2026-10-11T05:00:00.000Z"),
		],
		[restaurant("r1", "A"), restaurant("r2", "B"), restaurant("r3", "C")],
	);
	expect(stats).toEqual([
		{
			restaurantId: "r1",
			name: "A",
			count: 2,
			lastLockedAt: "2026-10-13T05:00:00.000Z",
			deleted: false,
		},
		{
			restaurantId: "r2",
			name: "B",
			count: 1,
			lastLockedAt: "2026-10-12T05:00:00.000Z",
			deleted: false,
		},
		{
			restaurantId: "r3",
			name: "C",
			count: 1,
			lastLockedAt: "2026-10-11T05:00:00.000Z",
			deleted: false,
		},
	]);
});

test("summarize uses the current name, or the newest locked name for a deleted restaurant", () => {
	const stats = summarize(
		[
			entry("1", "r1", "Old name", "2026-10-13T05:00:00.000Z"),
			entry("2", "gone", "Newest", "2026-10-12T05:00:00.000Z"),
			entry("3", "gone", "Older", "2026-10-01T05:00:00.000Z"),
		],
		[restaurant("r1", "New name")],
	);
	expect(stats.map(({ name, deleted }) => ({ name, deleted }))).toEqual([
		{ name: "Newest", deleted: true },
		{ name: "New name", deleted: false },
	]);
});

test("summarize of no history is empty", () => {
	expect(summarize([], [restaurant("r1", "A")])).toEqual([]);
});

test("isHistoryMemoryOnly is true only while history could not be saved", () => {
	expect(isHistoryMemoryOnly()).toBe(false);
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		addLock(restaurant("r1", "A"));
		expect(isHistoryMemoryOnly()).toBe(true);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	saveHistory([]);
	expect(isHistoryMemoryOnly()).toBe(false);
});
