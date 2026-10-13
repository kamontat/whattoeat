import { normalizeTag, type Restaurant } from "#lib/restaurant";

export type TagFilter = { include: string[]; exclude: string[] };
export type TagState = "off" | "include" | "exclude";

export const EMPTY_FILTER: TagFilter = { include: [], exclude: [] };
export const FILTER_KEY = "whattoeat:filter";

/** Keep restaurants with any included tag (all when none is included), then drop any with an excluded tag. */
export const applyFilter = (
	list: readonly Restaurant[],
	filter: TagFilter,
): Restaurant[] =>
	list.filter(
		(item) =>
			(filter.include.length === 0 ||
				item.tags.some((tag) => filter.include.includes(tag))) &&
			!item.tags.some((tag) => filter.exclude.includes(tag)),
	);

export const isFilterActive = (filter: TagFilter): boolean =>
	filter.include.length > 0 || filter.exclude.length > 0;

export const tagState = (filter: TagFilter, tag: string): TagState => {
	if (filter.include.includes(tag)) return "include";
	if (filter.exclude.includes(tag)) return "exclude";
	return "off";
};

/** Move one tag to its next state: off, include, exclude, then off again. */
export const cycleTag = (filter: TagFilter, tag: string): TagFilter => {
	const include = filter.include.filter((item) => item !== tag);
	const exclude = filter.exclude.filter((item) => item !== tag);
	switch (tagState(filter, tag)) {
		case "off":
			return { include: [...include, tag], exclude };
		case "include":
			return { include, exclude: [...exclude, tag] };
		case "exclude":
			return { include, exclude };
	}
};

export const pruneFilter = (
	filter: TagFilter,
	knownTags: readonly string[],
): TagFilter => {
	const known = (tag: string): boolean => knownTags.includes(tag);
	return {
		include: filter.include.filter(known),
		exclude: filter.exclude.filter(known),
	};
};

const toTags = (value: unknown): string[] => {
	if (!Array.isArray(value)) return [];
	const tags = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const tag = normalizeTag(item);
		if (tag !== "") tags.add(tag);
	}
	return [...tags];
};

/** The saved filter, or the empty filter when nothing valid is stored. A tag in both lists stays included. */
export const loadFilter = (): TagFilter => {
	let data: unknown;
	try {
		data = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null");
	} catch {
		return EMPTY_FILTER;
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return EMPTY_FILTER;
	}
	const raw = data as Partial<Record<keyof TagFilter, unknown>>;
	const include = toTags(raw.include);
	return {
		include,
		exclude: toTags(raw.exclude).filter((tag) => !include.includes(tag)),
	};
};

export const saveFilter = (filter: TagFilter): void => {
	try {
		localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
	} catch {
		// Storage blocked: the filter lasts for this page only.
	}
};
