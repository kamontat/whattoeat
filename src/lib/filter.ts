import {
	groupValues,
	isKind,
	normalizeTag,
	type Restaurant,
	valuesByUsage,
} from "#lib/restaurant";

export type GroupFilter = { include: string[]; exclude: string[] };
/** Include and exclude lists by group id. Plain tags are never filtered, so `tags` is never a key. */
export type Filter = Record<string, GroupFilter>;
export type TagState = "off" | "include" | "exclude";

const EMPTY_GROUP: GroupFilter = { include: [], exclude: [] };

export const EMPTY_FILTER: Filter = {};
export const FILTER_KEY = "whattoeat:filter";

const groupFilter = (filter: Filter, group: string): GroupFilter =>
	Object.hasOwn(filter, group) ? (filter[group] ?? EMPTY_GROUP) : EMPTY_GROUP;

const isEmptyGroup = (filter: GroupFilter): boolean =>
	filter.include.length === 0 && filter.exclude.length === 0;

const matchesGroup = (values: string[], filter: GroupFilter): boolean =>
	(filter.include.length === 0 ||
		values.some((value) => filter.include.includes(value))) &&
	!values.some((value) => filter.exclude.includes(value));

/**
 * In each group, keep restaurants with any included value (all when none is included), then
 * drop any with an excluded value. A restaurant must pass every group.
 */
export const applyFilter = (
	list: readonly Restaurant[],
	filter: Filter,
): Restaurant[] =>
	list.filter((item) =>
		Object.entries(filter).every(([group, value]) =>
			matchesGroup(groupValues(item, group), value),
		),
	);

export const isFilterActive = (filter: Filter): boolean =>
	Object.values(filter).some((group) => !isEmptyGroup(group));

export const tagState = (
	filter: Filter,
	group: string,
	value: string,
): TagState => {
	const current = groupFilter(filter, group);
	if (current.include.includes(value)) return "include";
	if (current.exclude.includes(value)) return "exclude";
	return "off";
};

/** Move one value to its next state: off, include, exclude, then off again. */
export const cycleTag = (
	filter: Filter,
	group: string,
	value: string,
): Filter => {
	const current = groupFilter(filter, group);
	const include = current.include.filter((item) => item !== value);
	const exclude = current.exclude.filter((item) => item !== value);
	const next = ((): GroupFilter => {
		switch (tagState(filter, group, value)) {
			case "off":
				return { include: [...include, value], exclude };
			case "include":
				return { include, exclude: [...exclude, value] };
			case "exclude":
				return { include, exclude };
		}
	})();
	return { ...filter, [group]: next };
};

/** Keep only groups in `groupIds` (never tags), values some restaurant still uses, and non-empty groups. */
export const pruneFilter = (
	filter: Filter,
	list: readonly Restaurant[],
	groupIds: readonly string[],
): Filter =>
	Object.fromEntries(
		Object.entries(filter)
			.filter(([group]) => group !== "tags" && groupIds.includes(group))
			.map(([group, value]): [string, GroupFilter] => {
				const known = valuesByUsage(list, group);
				const keep = (item: string): boolean => known.includes(item);
				return [
					group,
					{
						include: value.include.filter(keep),
						exclude: value.exclude.filter(keep),
					},
				];
			})
			.filter(([, value]) => !isEmptyGroup(value)),
	);

const toValues = (value: unknown, group: string): string[] => {
	if (!Array.isArray(value)) return [];
	const values = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const clean = normalizeTag(item);
		if (clean === "" || (group === "kind" && !isKind(clean))) continue;
		values.add(clean);
	}
	return [...values];
};

const toGroup = (value: unknown, group: string): GroupFilter => {
	if (typeof value !== "object" || value === null) return EMPTY_GROUP;
	const raw = value as Partial<Record<keyof GroupFilter, unknown>>;
	const include = toValues(raw.include, group);
	return {
		include,
		exclude: toValues(raw.exclude, group).filter(
			(item) => !include.includes(item),
		),
	};
};

/**
 * The saved filter, or the empty filter when nothing valid is stored. A value in both lists
 * stays included. Any group id but `tags`; empty groups are dropped.
 */
export const loadFilter = (): Filter => {
	let data: unknown;
	try {
		data = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null");
	} catch {
		return EMPTY_FILTER;
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return EMPTY_FILTER;
	}
	const raw = data as Record<string, unknown>;
	const entries: [string, GroupFilter][] = [];
	for (const [group, value] of Object.entries(raw)) {
		if (group === "tags") continue;
		const clean = toGroup(value, group);
		if (!isEmptyGroup(clean)) entries.push([group, clean]);
	}
	return Object.fromEntries(entries);
};

export const saveFilter = (filter: Filter): void => {
	try {
		localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
	} catch {
		// Storage blocked: the filter lasts for this page only.
	}
};

/** Set one group's lists; an empty group is removed. An item in both lists stays included. */
const withGroup = (
	filter: Filter,
	group: string,
	next: GroupFilter,
): Filter => {
	const rest = Object.fromEntries(
		Object.entries(filter).filter(([id]) => id !== group),
	);
	const include = [...new Set(next.include)];
	const exclude = [...new Set(next.exclude)].filter(
		(item) => !include.includes(item),
	);
	return include.length + exclude.length > 0
		? { ...rest, [group]: { include, exclude } }
		: rest;
};

export const renameFilterValue = (
	filter: Filter,
	group: string,
	from: string,
	to: string,
): Filter => {
	const current = groupFilter(filter, group);
	const swap = (list: string[]): string[] =>
		list.map((item) => (item === from ? to : item));
	return withGroup(filter, group, {
		include: swap(current.include),
		exclude: swap(current.exclude),
	});
};

export const dropFilterValue = (
	filter: Filter,
	group: string,
	value: string,
): Filter => {
	const current = groupFilter(filter, group);
	const keep = (item: string): boolean => item !== value;
	return withGroup(filter, group, {
		include: current.include.filter(keep),
		exclude: current.exclude.filter(keep),
	});
};

/** Carry a value's state to another group; plain tags are not filtered, so it is dropped there. */
export const moveFilterValue = (
	filter: Filter,
	from: string,
	value: string,
	to: string,
): Filter => {
	const state = tagState(filter, from, value);
	const dropped = dropFilterValue(filter, from, value);
	if (state === "off" || to === "tags") return dropped;
	const target = groupFilter(dropped, to);
	return withGroup(dropped, to, {
		include: state === "include" ? [...target.include, value] : target.include,
		exclude: state === "exclude" ? [...target.exclude, value] : target.exclude,
	});
};

export const dropFilterGroup = (filter: Filter, group: string): Filter =>
	withGroup(filter, group, EMPTY_GROUP);

/** Call `callback` when another tab saves the filter. Returns an unsubscribe function. */
export const onFilterChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === FILTER_KEY) callback();
	};
	window.addEventListener("storage", onStorage);
	return () => window.removeEventListener("storage", onStorage);
};
