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

const isString = (value: unknown): value is string => typeof value === "string";

const isDate = (value: unknown): value is string =>
	isString(value) && !Number.isNaN(Date.parse(value));

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
