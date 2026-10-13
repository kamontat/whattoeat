import {
	GROUPS,
	type Group,
	groupValues,
	isKind,
	normalizeTag,
	type Restaurant,
	valuesByUsage,
} from "#lib/restaurant";

export type GroupFilter = { include: string[]; exclude: string[] };
export type Filter = Record<Group, GroupFilter>;
export type TagState = "off" | "include" | "exclude";

const EMPTY_GROUP: GroupFilter = { include: [], exclude: [] };

export const EMPTY_FILTER: Filter = {
	kind: EMPTY_GROUP,
	cuisine: EMPTY_GROUP,
	area: EMPTY_GROUP,
	tags: EMPTY_GROUP,
};
export const FILTER_KEY = "whattoeat:filter";

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
		GROUPS.every((group) =>
			matchesGroup(groupValues(item, group), filter[group]),
		),
	);

export const isFilterActive = (filter: Filter): boolean =>
	GROUPS.some(
		(group) =>
			filter[group].include.length > 0 || filter[group].exclude.length > 0,
	);

export const tagState = (
	filter: Filter,
	group: Group,
	value: string,
): TagState => {
	if (filter[group].include.includes(value)) return "include";
	if (filter[group].exclude.includes(value)) return "exclude";
	return "off";
};

/** Move one value to its next state: off, include, exclude, then off again. */
export const cycleTag = (
	filter: Filter,
	group: Group,
	value: string,
): Filter => {
	const include = filter[group].include.filter((item) => item !== value);
	const exclude = filter[group].exclude.filter((item) => item !== value);
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

/** Drop values no restaurant in the list uses in that group any more. */
export const pruneFilter = (
	filter: Filter,
	list: readonly Restaurant[],
): Filter => {
	const pruned = { ...filter };
	for (const group of GROUPS) {
		const known = valuesByUsage(list, group);
		const keep = (value: string): boolean => known.includes(value);
		pruned[group] = {
			include: filter[group].include.filter(keep),
			exclude: filter[group].exclude.filter(keep),
		};
	}
	return pruned;
};

const toValues = (value: unknown, group: Group): string[] => {
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

const toGroup = (value: unknown, group: Group): GroupFilter => {
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
 * stays included. An older filter of only `include` and `exclude` tags becomes the tags group.
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
	if ("include" in raw || "exclude" in raw) {
		return { ...EMPTY_FILTER, tags: toGroup(raw, "tags") };
	}
	const filter = { ...EMPTY_FILTER };
	for (const group of GROUPS) filter[group] = toGroup(raw[group], group);
	return filter;
};

export const saveFilter = (filter: Filter): void => {
	try {
		localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
	} catch {
		// Storage blocked: the filter lasts for this page only.
	}
};
