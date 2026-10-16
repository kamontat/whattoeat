/** A part of a name that matched, as UTF-16 offsets into the original string. */
export type MatchRange = { start: number; end: number };

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
		const plain = char.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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
		ranges.push({
			start: map[at] ?? 0,
			end: map[at + word.length] ?? name.length,
		});
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
