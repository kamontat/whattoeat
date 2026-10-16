import { expect, test } from "bun:test";
import { matchName, searchWords } from "#lib/search";

test("splits the query into folded words, dropping empty ones", () => {
	expect(searchWords("  Ramen   NAGI ")).toEqual(["ramen", "nagi"]);
	expect(searchWords("   ")).toEqual([]);
	expect(searchWords("")).toEqual([]);
});

test("folds Latin accents away but keeps Thai marks", () => {
	expect(searchWords("Café")).toEqual(["cafe"]);
	expect(searchWords("ข้าว")).toEqual(["ข้าว"]);
});

test("matches a word anywhere in the name, ignoring case", () => {
	expect(matchName("Ramen Champion", ["champ"])).toEqual([
		{ start: 6, end: 11 },
	]);
	expect(matchName("Ramen Champion", ["sushi"])).toBeUndefined();
});

test("every word must appear, in any order", () => {
	expect(matchName("Nagi Ramen Silom", searchWords("ramen nagi"))).toEqual([
		{ start: 0, end: 4 },
		{ start: 5, end: 10 },
	]);
	expect(matchName("Nagi Ramen Silom", searchWords("ramen sushi"))).toBe(
		undefined,
	);
});

test("an unaccented query highlights the accented letters it matched", () => {
	expect(matchName("Café Tartine", searchWords("cafe"))).toEqual([
		{ start: 0, end: 4 },
	]);
	// Decomposed input: "e" plus a combining acute, 5 code units for 4 letters.
	expect(matchName("Cafe\u0301 Tartine", searchWords("cafe"))).toEqual([
		{ start: 0, end: 5 },
	]);
});

test("Thai matches as typed: different tone marks do not match", () => {
	expect(matchName("ข้าวมันไก่", searchWords("ข้าว"))).toEqual([
		{ start: 0, end: 4 },
	]);
	expect(matchName("ข่าวสด", searchWords("ข้าว"))).toBeUndefined();
});

test("a Thai highlight range includes a combining mark right after the matched text", () => {
	expect(matchName("ข้าวมันไก่", searchWords("ไก"))).toEqual([
		{ start: 7, end: 10 },
	]);
	expect(matchName("ข้าวมันไก่", searchWords("ข"))).toEqual([
		{ start: 0, end: 2 },
	]);
});

test("overlapping and repeated words merge into one range", () => {
	expect(matchName("Ramen Champion", searchWords("ram amen"))).toEqual([
		{ start: 0, end: 5 },
	]);
	expect(matchName("Ramen", searchWords("ram ram"))).toEqual([
		{ start: 0, end: 3 },
	]);
});

test("no words matches everything with nothing to highlight", () => {
	expect(matchName("Jay Fai", [])).toEqual([]);
});
