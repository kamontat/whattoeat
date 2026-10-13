import { t } from "#lib/i18n";

/** What a place serves. A restaurant can be several, like a cafe with drinks and dessert. */
export const KINDS = ["food", "drinks", "dessert"] as const;
export type Kind = (typeof KINDS)[number];

export type Restaurant = {
	id: string;
	name: string;
	tags: string[];
	location: string;
	notes: string;
	/** Short area name to filter by, like "siam"; `location` holds the address or map link. */
	area: string;
	/** Country or style of the food, like "thai". */
	cuisine: string;
	kinds: Kind[];
	createdAt: string;
	updatedAt: string;
};

/** A restaurant as stored before area, cuisine and kinds existed, or with kinds not yet checked. */
export type StoredRestaurant = Omit<
	Restaurant,
	"area" | "cuisine" | "kinds"
> & {
	area?: string;
	cuisine?: string;
	kinds?: string[];
};

/** The filterable groups of a restaurant. */
export const GROUPS = ["kind", "cuisine", "area", "tags"] as const;
export type Group = (typeof GROUPS)[number];

export type RestaurantInput = {
	name: string;
	tags: string[];
	location: string;
	notes: string;
	area?: string;
	cuisine?: string;
	kinds?: readonly string[];
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

export type CleanInput = Required<Omit<RestaurantInput, "kinds">> & {
	kinds: Kind[];
};

export const normalizeInput = (input: RestaurantInput): CleanInput => ({
	name: input.name.trim(),
	tags: parseTags(input.tags.join(",")),
	location: input.location.trim(),
	notes: input.notes.trim(),
	area: normalizeTag(input.area ?? ""),
	cuisine: normalizeTag(input.cuisine ?? ""),
	kinds: cleanKinds(input.kinds),
});

/** A stored restaurant in canonical form: tags merged by case, area, cuisine and kinds filled in. */
export const cleanStored = (item: StoredRestaurant): Restaurant => ({
	...item,
	tags: parseTags(item.tags.join(",")),
	area: normalizeTag(item.area ?? ""),
	cuisine: normalizeTag(item.cuisine ?? ""),
	kinds: cleanKinds(item.kinds),
});

const nameKey = (name: string): string => name.trim().toLocaleLowerCase();

/** Whether another restaurant (not `exceptId`) already has this name, ignoring case and surrounding spaces. */
export const isNameTaken = (
	list: readonly Restaurant[],
	name: string,
	exceptId?: string,
): boolean => {
	const key = nameKey(name);
	return list.some(
		(item) => item.id !== exceptId && nameKey(item.name) === key,
	);
};

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

/** Area, cuisine and kinds may be missing (older data); unknown kinds are dropped by `cleanStored`. */
export const isRestaurant = (value: unknown): value is StoredRestaurant => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof Restaurant, unknown>>;
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
		isString(item.location) &&
		isString(item.notes) &&
		isOptionalString(item.area) &&
		isOptionalString(item.cuisine) &&
		(item.kinds === undefined ||
			(Array.isArray(item.kinds) && item.kinds.every(isString))) &&
		isDate(item.createdAt) &&
		isDate(item.updatedAt)
	);
};

/** Only http(s) URLs are rendered as links; anything else (including `javascript:`) stays text. */
export const isLink = (text: string): boolean => /^https?:\/\//i.test(text);

/** The values a restaurant has in one filter group. */
export const groupValues = (item: Restaurant, group: Group): string[] => {
	switch (group) {
		case "kind":
			return item.kinds;
		case "cuisine":
			return item.cuisine === "" ? [] : [item.cuisine];
		case "area":
			return item.area === "" ? [] : [item.area];
		case "tags":
			return item.tags;
	}
};

/** Every value used in one group, most-used first with ties by name; kinds keep the order of `KINDS`. */
export const valuesByUsage = (
	list: readonly Restaurant[],
	group: Group,
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

/** "Drinks, Dessert · japanese · ari": kinds in the current language, then cuisine and area. */
export const metaLine = (item: Restaurant): string =>
	[
		item.kinds.map((kind) => t(`kind.${kind}`)).join(", "),
		item.cuisine,
		item.area,
	]
		.filter((part) => part !== "")
		.join(" · ");
