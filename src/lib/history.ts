import { newId, type Restaurant } from "#lib/restaurant";

export const HISTORY_KEY = "whattoeat:history";
export const HISTORY_EVENT = "whattoeat:history-changed";

/** One "Eat here" press: which restaurant, its name at that moment, and when. */
export type HistoryEntry = {
	id: string;
	restaurantId: string;
	name: string;
	visitedAt: string;
};

/** One row of the History page's stats table. */
export type HistoryStat = {
	restaurantId: string;
	name: string;
	count: number;
	lastVisitedAt: string;
	deleted: boolean;
};

/** Set when localStorage refused a write; history then lives in memory for this session. */
let memory: HistoryEntry[] | undefined;

const isFilled = (value: unknown): value is string =>
	typeof value === "string" && value.trim() !== "";

export const isHistoryEntry = (value: unknown): value is HistoryEntry => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof HistoryEntry, unknown>>;
	return (
		isFilled(item.id) &&
		isFilled(item.restaurantId) &&
		isFilled(item.name) &&
		typeof item.visitedAt === "string" &&
		!Number.isNaN(Date.parse(item.visitedAt))
	);
};

/** History saved before visits were renamed from locks, and version 2 exports, name the time `lockedAt`. */
export const renameLockedAt = (value: unknown): unknown => {
	if (typeof value !== "object" || value === null || "visitedAt" in value)
		return value;
	const { lockedAt, ...rest } = value as Record<string, unknown>;
	return lockedAt === undefined ? value : { ...rest, visitedAt: lockedAt };
};

/** Keep only the known fields, so stored and imported data stays small and predictable. */
export const cleanEntry = (entry: HistoryEntry): HistoryEntry => ({
	id: entry.id,
	restaurantId: entry.restaurantId,
	name: entry.name,
	visitedAt: entry.visitedAt,
});

export const newestFirst = (list: readonly HistoryEntry[]): HistoryEntry[] =>
	[...list].sort((a, b) => Date.parse(b.visitedAt) - Date.parse(a.visitedAt));

/** Unreadable stored history is skipped without a warning; the next save drops it. */
export const loadHistory = (): HistoryEntry[] => {
	if (memory !== undefined) return memory;
	let data: unknown;
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		if (raw === null) return [];
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	return newestFirst(
		data.map(renameLockedAt).filter(isHistoryEntry).map(cleanEntry),
	);
};

/** Returns `false` when localStorage refused the write and history is only kept in memory. */
export const saveHistory = (list: HistoryEntry[]): boolean => {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
	return memory === undefined;
};

/** True when the last save could not reach localStorage, so history vanishes when the page is left. */
export const isHistoryMemoryOnly = (): boolean => memory !== undefined;

/** Drop the in-memory fallback; `resetStorage` calls this when it wipes everything. */
export const forgetHistoryMemory = (): void => {
	memory = undefined;
};

export const addVisit = (
	restaurant: Pick<Restaurant, "id" | "name">,
	now: Date = new Date(),
): HistoryEntry => {
	const existing = loadHistory();
	const entry: HistoryEntry = {
		id: newId(existing.map((item) => item.id)),
		restaurantId: restaurant.id,
		name: restaurant.name,
		visitedAt: now.toISOString(),
	};
	saveHistory(newestFirst([entry, ...existing]));
	return entry;
};

export const removeVisit = (id: string): HistoryEntry[] => {
	const list = loadHistory().filter((item) => item.id !== id);
	saveHistory(list);
	return list;
};

/** How old a visit must be for the History page's clear buttons to delete it; `all` deletes every one. */
export const CLEAR_RANGES = ["week", "month", "year", "all"] as const;
export type ClearRange = (typeof CLEAR_RANGES)[number];

/** Visits before this time are older than `range`. */
const cutoff = (range: ClearRange, now: Date): number => {
	if (range === "all") return Number.POSITIVE_INFINITY;
	const date = new Date(now);
	if (range === "week") date.setDate(date.getDate() - 7);
	else if (range === "month") date.setMonth(date.getMonth() - 1);
	else date.setFullYear(date.getFullYear() - 1);
	return date.getTime();
};

const isOlderThan = (entry: HistoryEntry, before: number): boolean =>
	Date.parse(entry.visitedAt) < before;

export const countOlderThan = (
	list: readonly HistoryEntry[],
	range: ClearRange,
	now: Date = new Date(),
): number => {
	const before = cutoff(range, now);
	return list.filter((item) => isOlderThan(item, before)).length;
};

export const removeVisitsOlderThan = (
	range: ClearRange,
	now: Date = new Date(),
): HistoryEntry[] => {
	const before = cutoff(range, now);
	const list = loadHistory().filter((item) => !isOlderThan(item, before));
	saveHistory(list);
	return list;
};

/**
 * Call `callback` after every save in this tab and every change from another tab (a `null` key is
 * what `localStorage.clear()` sends). Returns an unsubscribe function.
 */
export const onHistoryChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === HISTORY_KEY || event.key === null) callback();
	};
	window.addEventListener(HISTORY_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(HISTORY_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};

/**
 * One row per restaurant: most visited first, ties by the latest visit. A restaurant that still
 * exists shows its current name; a deleted one shows the name from its newest visit.
 */
export const summarize = (
	history: readonly HistoryEntry[],
	restaurants: readonly Restaurant[],
): HistoryStat[] => {
	const rows = new Map<string, HistoryStat>();
	for (const entry of newestFirst(history)) {
		const row = rows.get(entry.restaurantId);
		if (row) {
			row.count += 1;
			continue;
		}
		const current = restaurants.find((item) => item.id === entry.restaurantId);
		rows.set(entry.restaurantId, {
			restaurantId: entry.restaurantId,
			name: current?.name ?? entry.name,
			count: 1,
			lastVisitedAt: entry.visitedAt,
			deleted: current === undefined,
		});
	}
	return [...rows.values()].sort(
		(a, b) =>
			b.count - a.count ||
			Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt),
	);
};
