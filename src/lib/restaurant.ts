export type Restaurant = {
	id: string;
	name: string;
	tags: string[];
	location: string;
	notes: string;
	createdAt: string;
	updatedAt: string;
};

export type RestaurantInput = {
	name: string;
	tags: string[];
	location: string;
	notes: string;
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

export const normalizeInput = (input: RestaurantInput): RestaurantInput => ({
	name: input.name.trim(),
	tags: parseTags(input.tags.join(",")),
	location: input.location.trim(),
	notes: input.notes.trim(),
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

export const isRestaurant = (value: unknown): value is Restaurant => {
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
		isDate(item.createdAt) &&
		isDate(item.updatedAt)
	);
};

/** Only http(s) URLs are rendered as links; anything else (including `javascript:`) stays text. */
export const isLink = (text: string): boolean => /^https?:\/\//i.test(text);

/** Every tag in the list, most-used first; ties are sorted by name. */
export const tagsByUsage = (list: readonly Restaurant[]): string[] => {
	const counts = new Map<string, number>();
	for (const item of list) {
		for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return [...counts]
		.sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
		.map(([tag]) => tag);
};
