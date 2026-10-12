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

/** Split comma-separated text into trimmed, non-empty, de-duplicated tags, keeping first-seen order. */
export const parseTags = (text: string): string[] => {
	const tags = new Set<string>();
	for (const raw of text.split(",")) {
		const tag = raw.trim();
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
		isString(item.createdAt) &&
		isString(item.updatedAt)
	);
};

/** Only http(s) URLs are rendered as links; anything else (including `javascript:`) stays text. */
export const isLink = (text: string): boolean => /^https?:\/\//i.test(text);
