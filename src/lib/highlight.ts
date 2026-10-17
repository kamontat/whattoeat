import { html } from "lit";
import type { MatchRange } from "#lib/search";

/**
 * `name` with the parts `ranges` covers wrapped in `<mark>`, for a row's search-matched name.
 * The plain string back when there is nothing to highlight; otherwise a lit template part list
 * ready to drop into a template, e.g. `` html`<b>${highlight(name, ranges)}</b>` ``.
 */
export function highlight(name: string, ranges: readonly MatchRange[]) {
	if (ranges.length === 0) return name;
	const parts: unknown[] = [];
	let at = 0;
	for (const { start, end } of ranges) {
		if (start > at) parts.push(name.slice(at, start));
		parts.push(html`<mark>${name.slice(start, end)}</mark>`);
		at = end;
	}
	if (at < name.length) parts.push(name.slice(at));
	return parts;
}
