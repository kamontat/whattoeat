import { t } from "#lib/i18n";

/** What a place serves. A restaurant can be several, like a cafe with drinks and dessert. */
export const KINDS = ["food", "drinks", "dessert"] as const;
export type Kind = (typeof KINDS)[number];

/** Groups every restaurant has, in display order. Type's values are `KINDS`; the rest are free text. */
export const BUILT_IN_GROUPS = ["kind", "cuisine", "area"] as const;
export type BuiltInGroup = (typeof BUILT_IN_GROUPS)[number];
/** Built-in groups whose values live in `Restaurant.groups`. */
export const VALUE_GROUPS = ["cuisine", "area"] as const;
/** Ids a custom group may never take; `tags` stands for plain tags. */
export const RESERVED_GROUP_IDS: readonly string[] = [
	...BUILT_IN_GROUPS,
	"tags",
];

/** Values by group id: "cuisine", "area" or a custom group's id. A key exists only when it has values. */
export type GroupValues = Record<string, string[]>;

export type Restaurant = {
	id: string;
	name: string;
	/** A web page for the place: a map, its own site or a social page. Empty when there is none. */
	link: string;
	notes: string;
	kinds: Kind[];
	/** Plain tags: shown, not filtered. */
	tags: string[];
	groups: GroupValues;
	createdAt: string;
	updatedAt: string;
};

/**
 * A restaurant as stored or imported: the old shape with `area` and `cuisine` strings and a
 * `location` instead of a `link`, the new shape with `groups`, or a mix. Kinds may be missing
 * or unknown.
 */
export type StoredRestaurant = Omit<Restaurant, "kinds" | "groups" | "link"> & {
	link?: string;
	location?: string;
	area?: string;
	cuisine?: string;
	kinds?: string[];
	groups?: Record<string, string[]>;
};

export type RestaurantInput = {
	name: string;
	tags: readonly string[];
	link: string;
	notes: string;
	kinds?: readonly string[];
	groups?: Readonly<Record<string, readonly string[]>>;
};

/** Canonical form of a tag: NFC, trimmed, single spaces, lowercase. Tags compare by this form only. */
export const normalizeTag = (text: string): string =>
	text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** Split comma-separated text into normalized, non-empty, de-duplicated tags, keeping first-seen order. */
export const parseTags = (text: string): string[] => {
	const tags = new Set<string>();
	for (const raw of text.split(",")) {
		const tag = normalizeTag(raw);
		if (tag !== "") tags.add(tag);
	}
	return [...tags];
};

export const isKind = (value: unknown): value is Kind =>
	KINDS.includes(value as Kind);

/** Known kinds only, once each, in the order of `KINDS`. */
const cleanKinds = (kinds: readonly string[] = []): Kind[] =>
	KINDS.filter((kind) => kinds.includes(kind));

export type CleanInput = Omit<Restaurant, "id" | "createdAt" | "updatedAt">;

/**
 * Keep the groups in `VALUE_GROUPS` and `customIds`, cleaned like tags and without empty ones;
 * values of any other id become plain tags so nothing is lost.
 */
const cleanGroups = (
	groups: Readonly<Record<string, readonly string[]>>,
	tags: readonly string[],
	customIds: readonly string[],
): Pick<Restaurant, "groups" | "tags"> => {
	const known = new Set<string>([...VALUE_GROUPS, ...customIds]);
	const kept: [string, string[]][] = [];
	const orphans: string[] = [];
	for (const [id, values] of Object.entries(groups)) {
		if (!known.has(id)) {
			orphans.push(...values);
			continue;
		}
		const clean = parseTags(values.join(","));
		if (clean.length > 0) kept.push([id, clean]);
	}
	return {
		groups: Object.fromEntries(kept),
		tags: parseTags([...tags, ...orphans].join(",")),
	};
};

/** `customIds` are the ids of the custom groups that exist; values under any other id become tags. */
export const normalizeInput = (
	input: RestaurantInput,
	customIds: readonly string[] = [],
): CleanInput => ({
	name: input.name.trim(),
	link: input.link.trim(),
	notes: input.notes.trim(),
	kinds: cleanKinds(input.kinds),
	...cleanGroups(input.groups ?? {}, input.tags, customIds),
});

/**
 * An old free-text `location` becomes the link when it is one and there is no link yet;
 * otherwise it goes on the first line of the notes so nothing is lost.
 */
const moveLocation = (
	item: StoredRestaurant,
): Pick<Restaurant, "link" | "notes"> => {
	const link = (item.link ?? "").trim();
	const location = (item.location ?? "").trim();
	if (location === "" || location === link) return { link, notes: item.notes };
	if (link === "" && isLink(location))
		return { link: location, notes: item.notes };
	const notes = item.notes.trim();
	return { link, notes: notes === "" ? location : `${location}\n${notes}` };
};

/**
 * A stored or imported restaurant in canonical form: old `area` and `cuisine` strings join their
 * group, an old `location` becomes the link or part of the notes, values of unknown groups
 * become tags, and only known fields are kept.
 */
export const cleanStored = (
	item: StoredRestaurant,
	customIds: readonly string[] = [],
): Restaurant => {
	const groups: Record<string, readonly string[]> = { ...item.groups };
	for (const id of VALUE_GROUPS) {
		const old = item[id];
		const current =
			item.groups && Object.hasOwn(item.groups, id)
				? item.groups[id]
				: undefined;
		if (old) groups[id] = [old, ...(current ?? [])];
	}
	return {
		id: item.id,
		...normalizeInput(
			{
				name: item.name,
				...moveLocation(item),
				tags: item.tags,
				...(item.kinds !== undefined ? { kinds: item.kinds } : {}),
				groups,
			},
			customIds,
		),
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	};
};

export const nameKey = (name: string): string =>
	name.trim().toLocaleLowerCase();

const isString = (value: unknown): value is string => typeof value === "string";

const isDate = (value: unknown): value is string =>
	isString(value) && !Number.isNaN(Date.parse(value));

const ID_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;
// The largest multiple of 62 that fits in a byte; bytes from here up would favour the first letters.
const ID_BYTE_LIMIT = 256 - (256 % ID_ALPHABET.length);

/**
 * A short random id (8 of 62 characters, about 2×10¹⁴ values), redrawn if it is already
 * taken. Older UUID ids stay valid: an id only has to be a non-empty string.
 */
export const newId = (
	taken: Iterable<string>,
	random: (bytes: Uint8Array) => Uint8Array = (bytes) =>
		crypto.getRandomValues(bytes),
): string => {
	const used = new Set(taken);
	for (;;) {
		let id = "";
		while (id.length < ID_LENGTH) {
			for (const byte of random(new Uint8Array(ID_LENGTH - id.length))) {
				if (byte < ID_BYTE_LIMIT) id += ID_ALPHABET[byte % ID_ALPHABET.length];
			}
		}
		if (!used.has(id)) return id;
	}
};

const isOptionalString = (value: unknown): boolean =>
	value === undefined || isString(value);

/** A plain object whose own values are each an array of strings. */
const isGroupValues = (value: unknown): boolean =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every(
		(list) => Array.isArray(list) && list.every(isString),
	);

/** Accepts the old shape (area and cuisine strings) and the new one (a groups map). */
export const isRestaurant = (value: unknown): value is StoredRestaurant => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<
		Record<keyof Restaurant | "location" | "area" | "cuisine", unknown>
	>;
	const id = item.id;
	const name = item.name;
	const tags = item.tags;
	return (
		isString(id) &&
		id !== "" &&
		isString(name) &&
		name.trim() !== "" &&
		Array.isArray(tags) &&
		tags.every(isString) &&
		isOptionalString(item.link) &&
		isOptionalString(item.location) &&
		isString(item.notes) &&
		isOptionalString(item.area) &&
		isOptionalString(item.cuisine) &&
		(item.groups === undefined || isGroupValues(item.groups)) &&
		(item.kinds === undefined ||
			(Array.isArray(item.kinds) && item.kinds.every(isString))) &&
		isDate(item.createdAt) &&
		isDate(item.updatedAt)
	);
};

/** Only http(s) URLs are rendered as links; anything else (including `javascript:`) stays text. */
export const isLink = (text: string): boolean => /^https?:\/\//i.test(text);

/** The values a restaurant has in one group; `kind` is its kinds and `tags` its plain tags. */
export const groupValues = (item: Restaurant, group: string): string[] => {
	if (group === "kind") return item.kinds;
	if (group === "tags") return item.tags;
	return Object.hasOwn(item.groups, group) ? (item.groups[group] ?? []) : [];
};

/** Every value used in one group, most-used first with ties by name; kinds keep the order of `KINDS`. */
export const valuesByUsage = (
	list: readonly Restaurant[],
	group: string,
): string[] => {
	const counts = new Map<string, number>();
	for (const item of list) {
		for (const value of groupValues(item, group))
			counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	if (group === "kind") return KINDS.filter((kind) => counts.has(kind));
	return [...counts]
		.sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
		.map(([value]) => value);
};

/** Every tag in the list, most-used first; ties are sorted by name. */
export const tagsByUsage = (list: readonly Restaurant[]): string[] =>
	valuesByUsage(list, "tags");

/** "Drinks, Dessert · thai, japanese · ari": kinds in the current language, then cuisines and areas. */
export const metaLine = (item: Restaurant): string =>
	[
		item.kinds.map((kind) => t(`kind.${kind}`)).join(", "),
		groupValues(item, "cuisine").join(", "),
		groupValues(item, "area").join(", "),
	]
		.filter((part) => part !== "")
		.join(" · ");
