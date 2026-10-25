import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	addVisit,
	countOlderThan,
	groupByDay,
	HISTORY_EVENT,
	type HistoryEntry,
	historyKey,
	isHistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	onHistoryChanged,
	relativeDay,
	removeVisit,
	removeVisitsOlderThan,
	saveHistory,
	summarize,
} from "#lib/history";
import { nameFromText, type Restaurant } from "#lib/restaurant";

const entry = (
	id: string,
	restaurantId: string,
	name: string,
	visitedAt: string,
): HistoryEntry => ({ id, restaurantId, name, visitedAt });

const restaurant = (id: string, name: string): Restaurant => ({
	id,
	name: nameFromText(name),
	tags: [],
	links: [],
	notes: "",
	groups: {},
	kinds: [],
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
	localStorage.setItem(historyKey(), raw);
	expect(loadHistory()).toEqual([]);
});

test("skips entries that are not valid and drops unknown fields", () => {
	localStorage.setItem(
		historyKey(),
		JSON.stringify([
			{ ...entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"), extra: 1 },
			{
				id: "b",
				restaurantId: "r1",
				name: " ",
				visitedAt: "2026-10-13T05:00:00.000Z",
			},
			{ id: "c", restaurantId: "r1", name: "C", visitedAt: "yesterday" },
			{
				id: "",
				restaurantId: "r1",
				name: "D",
				visitedAt: "2026-10-13T05:00:00.000Z",
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
			visitedAt: "2026-10-13T05:00:00.000Z",
		}),
	).toBe(false);
	expect(isHistoryEntry("a")).toBe(false);
});

test("loads entries saved with lockedAt before the rename to visitedAt", () => {
	const { visitedAt, ...rest } = entry(
		"a",
		"r1",
		"A",
		"2026-10-13T05:00:00.000Z",
	);
	localStorage.setItem(
		historyKey(),
		JSON.stringify([{ ...rest, lockedAt: visitedAt }]),
	);
	expect(loadHistory()).toEqual([
		entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"),
	]);
});

test("loads newest first even when stored out of order", () => {
	localStorage.setItem(
		historyKey(),
		JSON.stringify([
			entry("old", "r1", "A", "2026-10-01T05:00:00.000Z"),
			entry("new", "r2", "B", "2026-10-13T05:00:00.000Z"),
			entry("mid", "r1", "A", "2026-10-07T05:00:00.000Z"),
		]),
	);
	expect(loadHistory().map((item) => item.id)).toEqual(["new", "mid", "old"]);
});

test("addVisit saves the restaurant id, its name and the time, newest first", () => {
	addVisit(restaurant("r1", "Jay Fai"), new Date("2026-10-12T12:00:00.000Z"));
	const added = addVisit(
		restaurant("r2", "Thipsamai"),
		new Date("2026-10-13T12:30:00.000Z"),
	);
	expect(added).toMatchObject({
		restaurantId: "r2",
		name: "Thipsamai",
		visitedAt: "2026-10-13T12:30:00.000Z",
	});
	expect(added.id).toMatch(/^[0-9A-Za-z]{8}$/);
	const stored = JSON.parse(localStorage.getItem(historyKey()) ?? "[]");
	expect(stored.map((item: HistoryEntry) => item.name)).toEqual([
		"Thipsamai",
		"Jay Fai",
	]);
	expect(loadHistory()).toEqual(stored);
});

test("addVisit gives every entry a different id", () => {
	const ids = new Set(
		Array.from({ length: 20 }, () => addVisit(restaurant("r1", "A")).id),
	);
	expect(ids.size).toBe(20);
});

test("removeVisit deletes only that entry", () => {
	saveHistory([
		entry("a", "r1", "A", "2026-10-13T05:00:00.000Z"),
		entry("b", "r1", "A", "2026-10-12T05:00:00.000Z"),
	]);
	expect(removeVisit("a").map((item) => item.id)).toEqual(["b"]);
	expect(loadHistory().map((item) => item.id)).toEqual(["b"]);
});

test("addVisit falls back to memory when localStorage throws", () => {
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
		const added = addVisit(restaurant("r1", "A"));
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
	expect(localStorage.getItem(historyKey())).toBe("[]");
});

test("onHistoryChanged fires for saves here, other tabs and a cleared storage", () => {
	let calls = 0;
	const off = onHistoryChanged(() => {
		calls += 1;
	});
	saveHistory([]);
	window.dispatchEvent(new StorageEvent("storage", { key: historyKey() }));
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
			lastVisitedAt: "2026-10-13T05:00:00.000Z",
			deleted: false,
		},
		{
			restaurantId: "r2",
			name: "B",
			count: 1,
			lastVisitedAt: "2026-10-12T05:00:00.000Z",
			deleted: false,
		},
		{
			restaurantId: "r3",
			name: "C",
			count: 1,
			lastVisitedAt: "2026-10-11T05:00:00.000Z",
			deleted: false,
		},
	]);
});

test("summarize uses the current name, or the newest visited name for a deleted restaurant", () => {
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
		addVisit(restaurant("r1", "A"));
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

const NOW = new Date("2026-10-14T12:00:00.000Z");
const ages = (): HistoryEntry[] => [
	entry("today", "r1", "A", "2026-10-14T08:00:00.000Z"),
	entry("week", "r1", "A", "2026-10-07T12:00:00.000Z"),
	entry("weekOld", "r1", "A", "2026-10-07T11:59:59.000Z"),
	entry("monthOld", "r1", "A", "2026-09-13T12:00:00.000Z"),
	entry("yearOld", "r1", "A", "2025-10-13T12:00:00.000Z"),
];

test("countOlderThan counts visits before a week, a month, a year, or all", () => {
	const list = ages();
	expect(countOlderThan(list, "week", NOW)).toBe(3);
	expect(countOlderThan(list, "month", NOW)).toBe(2);
	expect(countOlderThan(list, "year", NOW)).toBe(1);
	expect(countOlderThan(list, "all", NOW)).toBe(5);
});

test("removeVisitsOlderThan keeps visits on or after the cutoff", () => {
	saveHistory(ages());
	expect(removeVisitsOlderThan("week", NOW).map((item) => item.id)).toEqual([
		"today",
		"week",
	]);
	expect(loadHistory().map((item) => item.id)).toEqual(["today", "week"]);
});

test("removeVisitsOlderThan all empties the history", () => {
	saveHistory(ages());
	expect(removeVisitsOlderThan("all", NOW)).toEqual([]);
	expect(loadHistory()).toEqual([]);
});

const at = (id: string, local: [number, number, number, number, number]) => ({
	id,
	restaurantId: "r",
	name: id,
	visitedAt: new Date(...local).toISOString(),
});

test("groupByDay keeps the order and groups visits by local calendar day", () => {
	const days = groupByDay([
		at("a", [2026, 9, 16, 20, 0]),
		at("b", [2026, 9, 16, 0, 1]),
		at("c", [2026, 9, 15, 23, 59]),
		at("d", [2026, 8, 30, 12, 0]),
	]);
	expect(days.map((d) => d.entries.map((e) => e.id))).toEqual([
		["a", "b"],
		["c"],
		["d"],
	]);
	expect(days[0]!.day).toEqual(new Date(2026, 9, 16));
	expect(days[1]!.day).toEqual(new Date(2026, 9, 15));
	expect(new Set(days.map((d) => d.key)).size).toBe(3);
});

test("groupByDay of nothing is nothing", () => {
	expect(groupByDay([])).toEqual([]);
});

test("relativeDay names today and yesterday by local day, else nothing", () => {
	const now = new Date(2026, 9, 16, 0, 30);
	expect(relativeDay(new Date(2026, 9, 16), now)).toBe("today");
	expect(relativeDay(new Date(2026, 9, 15), now)).toBe("yesterday");
	expect(relativeDay(new Date(2026, 9, 14), now)).toBeUndefined();
	expect(relativeDay(new Date(2026, 9, 17), now)).toBeUndefined();
});

test("relativeDay works across a month boundary", () => {
	expect(relativeDay(new Date(2026, 8, 30), new Date(2026, 9, 1, 9))).toBe(
		"yesterday",
	);
});
