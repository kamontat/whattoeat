import { newId, type Restaurant } from "#lib/restaurant";

export const HISTORY_KEY = "whattoeat:history";
export const HISTORY_EVENT = "whattoeat:history-changed";
/** History keeps at least this many of the newest visits, however old they are. */
export const HISTORY_KEEP_COUNT = 1000;

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

/**
 * Keep every visit from the last year, or the newest `HISTORY_KEEP_COUNT`, whichever is more.
 * Returns the kept visits newest first.
 */
export const pruneHistory = (
	list: readonly HistoryEntry[],
	now: Date = new Date(),
): HistoryEntry[] => {
	const cutoff = new Date(now);
	cutoff.setFullYear(cutoff.getFullYear() - 1);
	return newestFirst(list).filter(
		(item, index) =>
			index < HISTORY_KEEP_COUNT ||
			Date.parse(item.visitedAt) >= cutoff.getTime(),
	);
};

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

/**
 * Saves the visits `pruneHistory` keeps. Returns `false` when localStorage refused the write and
 * history is only kept in memory.
 */
export const saveHistory = (all: readonly HistoryEntry[]): boolean => {
	const list = pruneHistory(all);
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
