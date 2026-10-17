import { css, html, nothing } from "lit";
import { getLang, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { metaLine, type Restaurant } from "#lib/restaurant";
import type { MatchRange } from "#lib/search";

export const listStyles = css`
	/* Room for the stuck bar when a focused row scrolls into view. */
	li[data-id] {
		scroll-margin-top: 7rem;
	}

	.list .row {
		min-height: 3.5rem;
	}

	.list .meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.list .row[aria-current="true"] {
		background: var(--color-surface-2);
		box-shadow: inset 3px 0 0 var(--color-primary);
	}

	@media (forced-colors: active) {
		.list .row[aria-current="true"] {
			outline: 2px solid CanvasText;
			outline-offset: -2px;
		}
	}

	.name mark {
		border-radius: 3px;
		background: var(--color-primary-soft);
		color: inherit;
		font-weight: 700;
	}

	@media (min-width: 48rem) {
		li[data-id] {
			scroll-margin-top: 0;
		}
	}
`;

/** Restaurants in list order: by name, in the current language's collation. */
export const sortByName = (restaurants: readonly Restaurant[]): Restaurant[] =>
	[...restaurants].sort((a, b) => a.name.localeCompare(b.name, getLang()));

/** One row of the list; the whole row is the button that opens the restaurant for editing. */
export function renderRow(
	item: Restaurant,
	ranges: readonly MatchRange[],
	current: boolean,
	onEdit: (item: Restaurant) => void,
) {
	const meta = metaLine(item);
	const metaId = `meta-${item.id}`;
	return html`<li data-id=${item.id}>
		<button
			type="button"
			class="item row"
			data-action="edit"
			aria-current=${current ? "true" : nothing}
			aria-label=${t("manager.editTitle", { name: item.name })}
			aria-describedby=${meta ? metaId : nothing}
			@click=${() => onEdit(item)}
		>
			<span class="grow">
				<b class="name">${renderName(item.name, ranges)}</b>
				${meta ? html`<small class="meta" id=${metaId}>${meta}</small>` : nothing}
			</span>
			<span class="trail">${icon("chevron", 20)}</span>
		</button>
	</li>`;
}

/** The name with the parts the search matched wrapped in `<mark>`. */
function renderName(name: string, ranges: readonly MatchRange[]) {
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
