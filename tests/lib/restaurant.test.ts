import { expect, test } from "bun:test";
import {
	isLink,
	isNameTaken,
	isRestaurant,
	newId,
	normalizeInput,
	normalizeTag,
	parseTags,
	type Restaurant,
	tagsByUsage,
} from "#lib/restaurant";

const valid: Restaurant = {
	id: "a1",
	name: "Som Tam Nua",
	tags: ["thai", "spicy"],
	location: "Siam Square",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
};

test("parseTags trims, drops empties and de-duplicates in order", () => {
	expect(parseTags(" thai, ,noodle ,thai,")).toEqual(["thai", "noodle"]);
});

test("parseTags returns [] for blank text", () => {
	expect(parseTags("   ")).toEqual([]);
});

test("parseTags merges tags that differ only in case, keeping first-seen order", () => {
	expect(parseTags("Thai, noodle, THAI, thai")).toEqual(["thai", "noodle"]);
});

test.each([
	["lowercases", "Thai", "thai"],
	["trims", "  thai  ", "thai"],
	["collapses inner whitespace", "thai \t  food", "thai food"],
	["composes Unicode to NFC", "cafe\u0301", "caf\u00e9"],
	["leaves Thai text alone", "ก๋วยเตี๋ยว", "ก๋วยเตี๋ยว"],
	["returns empty for blank text", "   ", ""],
])("normalizeTag %s", (_label, input, expected) => {
	expect(normalizeTag(input)).toBe(expected);
});

const withTags = (id: string, tags: string[]): Restaurant => ({
	...valid,
	id,
	tags,
});

test("tagsByUsage orders tags by how many restaurants use them, then by name", () => {
	expect(
		tagsByUsage([
			withTags("1", ["thai", "spicy"]),
			withTags("2", ["noodle", "thai"]),
			withTags("3", ["noodle", "thai", "cheap"]),
		]),
	).toEqual(["thai", "noodle", "cheap", "spicy"]);
});

test("tagsByUsage returns [] for no restaurants", () => {
	expect(tagsByUsage([])).toEqual([]);
});

test("normalizeInput trims every field and cleans tags", () => {
	expect(
		normalizeInput({
			name: "  Jay Fai ",
			tags: [" street ", "", "street"],
			location: " Bangkok ",
			notes: " ok ",
		}),
	).toEqual({
		name: "Jay Fai",
		tags: ["street"],
		location: "Bangkok",
		notes: "ok",
	});
});

test("isRestaurant accepts a valid restaurant", () => {
	expect(isRestaurant(valid)).toBe(true);
});

test.each([
	["null", null],
	["string", "x"],
	["empty id", { ...valid, id: "" }],
	["blank name", { ...valid, name: "   " }],
	["missing tags", { ...valid, tags: undefined }],
	["non-string tag", { ...valid, tags: ["ok", 1] }],
	["numeric location", { ...valid, location: 5 }],
	["missing notes", { ...valid, notes: undefined }],
	["missing createdAt", { ...valid, createdAt: undefined }],
	["missing updatedAt", { ...valid, updatedAt: undefined }],
	["non-date createdAt", { ...valid, createdAt: "yesterday-ish" }],
	["non-date updatedAt", { ...valid, updatedAt: "" }],
])("isRestaurant rejects %s", (_label, value) => {
	expect(isRestaurant(value)).toBe(false);
});

test.each([
	["https://maps.app.goo.gl/abc", true],
	["HTTP://example.com", true],
	["Siam Square", false],
	["javascript:alert(1)", false],
	["", false],
])("isLink(%p) is %p", (text, expected) => {
	expect(isLink(text)).toBe(expected);
});

test("newId gives 8 letters and digits", () => {
	for (let i = 0; i < 50; i++) expect(newId([])).toMatch(/^[0-9A-Za-z]{8}$/);
});

test("newId skips ids that are already taken", () => {
	// Two draws: the first spells "00000000", which is taken; the second spells "11111111".
	const draws = [new Uint8Array(8).fill(0), new Uint8Array(8).fill(1)];
	const random = (bytes: Uint8Array): Uint8Array => {
		bytes.set(draws.shift()!);
		return bytes;
	};
	expect(newId(["00000000"], random)).toBe("11111111");
});

test("newId skips bytes that would bias the alphabet", () => {
	// 248 and above are rejected, so 255 is skipped and 61 maps to the last letter.
	const draws = [Uint8Array.from([255, 61, 61, 61, 61, 61, 61, 61, 61])];
	const random = (bytes: Uint8Array): Uint8Array => {
		const next = draws[0]!.subarray(0, bytes.length);
		bytes.set(next);
		draws[0] = draws[0]!.subarray(bytes.length);
		return bytes;
	};
	expect(newId([], random)).toBe("zzzzzzzz");
});

test("isNameTaken ignores case and surrounding spaces", () => {
	const list = [{ ...valid, id: "a", name: "Som Tam Nua" }];
	expect(isNameTaken(list, "  som tam NUA ")).toBe(true);
	expect(isNameTaken(list, "Som Tam")).toBe(false);
});

test("isNameTaken lets a restaurant keep its own name", () => {
	const list = [
		{ ...valid, id: "a", name: "Som Tam Nua" },
		{ ...valid, id: "b", name: "Jay Fai" },
	];
	expect(isNameTaken(list, "som tam nua", "a")).toBe(false);
	expect(isNameTaken(list, "jay fai", "a")).toBe(true);
});
