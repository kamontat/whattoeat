import { type Localized, localize, t } from "#lib/i18n";

/** A part of a name that matched, as UTF-16 offsets into the original string. */
export type MatchRange = { start: number; end: number };

/** Something searched by name: one string, or a name in both languages. */
export type Named = { name: string | Localized };

/** An item the query keeps, the name that matched, and what to highlight in it. */
export type SearchResult<T> = { item: T; text: string; ranges: MatchRange[] };

/** The names to try, the one shown in the current language first. */
const namesOf = ({ name }: Named): string[] => {
	if (typeof name === "string") return [name];
	const shown = localize(name);
	return [
		shown,
		...Object.values(name).filter(
			(text) => text !== shown && text.trim() !== "",
		),
	];
};

/**
 * Lower-cased text with Latin accents (U+0300–U+036F after NFD) removed, one character at a
 * time, so composed and decomposed accents fold the same. Thai vowel and tone marks are
 * combining marks too, but different Thai words differ only by them, so they stay.
 * `map[i]` is the offset in `text` of the character folded into position `i`; one more entry
 * holds `text.length`.
 */
const fold = (text: string): { folded: string; map: number[] } => {
	let folded = "";
	const map: number[] = [];
	let offset = 0;
	for (const char of text) {
		const plain = char
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase();
		for (const unit of plain) {
			for (let i = 0; i < unit.length; i++) map.push(offset);
			folded += unit;
		}
		offset += char.length;
	}
	map.push(offset);
	return { folded, map };
};

/** The query split into folded words; empty when there is nothing to search for. */
export const searchWords = (query: string): string[] =>
	fold(query)
		.folded.split(/\s+/)
		.filter((word) => word !== "");

/**
 * Whether every word occurs in `name`, and if so the parts of `name` to highlight, sorted and
 * merged. `undefined` when it does not match. No words matches with nothing highlighted.
 */
export const matchName = (
	name: string,
	words: readonly string[],
): MatchRange[] | undefined => {
	const { folded, map } = fold(name);
	const ranges: MatchRange[] = [];
	for (const word of words) {
		const at = folded.indexOf(word);
		if (at === -1) return undefined;
		const start = map[at] ?? 0;
		let end = map[at + word.length] ?? name.length;
		// A combining mark right after the matched text (e.g. a Thai tone mark) belongs with it,
		// or the browser draws it detached from the <mark> it decorates.
		while (/\p{M}/u.test(name[end] ?? "")) end++;
		ranges.push({ start, end });
	}
	ranges.sort((a, b) => a.start - b.start);
	const merged: MatchRange[] = [];
	for (const range of ranges) {
		const last = merged.at(-1);
		if (last !== undefined && range.start <= last.end)
			last.end = Math.max(last.end, range.end);
		else merged.push({ ...range });
	}
	return merged;
};

/**
 * The items with a name that has every word of `query`, in the given order; no words keeps
 * them all. A name in both languages matches on either, the shown one first.
 */
export const searchByName = <T extends Named>(
	items: readonly T[],
	query: string,
): SearchResult<T>[] => {
	const words = searchWords(query);
	return items.flatMap((item) => {
		for (const text of namesOf(item)) {
			const ranges = matchName(text, words);
			if (ranges !== undefined) return [{ item, text, ranges }];
		}
		return [];
	});
};

/** Searching for words that no item's name has (the list shows its no-match card instead). */
export const noMatch = (items: readonly Named[], query: string): boolean =>
	items.length > 0 &&
	searchWords(query).length > 0 &&
	searchByName(items, query).length === 0;

/** How many restaurants there are, or how many of them the query keeps when it has words. */
export const countText = (items: readonly Named[], query: string): string => {
	const total = items.length;
	if (searchWords(query).length > 0)
		return t("search.count", {
			shown: searchByName(items, query).length,
			total,
		});
	return total === 1
		? t("picker.count.one")
		: t("picker.count.other", { count: total });
};
