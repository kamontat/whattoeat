import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { getLang, LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { isLink, metaLine, type Restaurant } from "#lib/restaurant";
import { type MatchRange, searchByName } from "#lib/search";
import { uiStyles } from "#styles/ui";

/** Restaurants in list order: by name, in the current language's collation. */
export const sortByName = (restaurants: readonly Restaurant[]): Restaurant[] =>
	[...restaurants].sort((a, b) => a.name.localeCompare(b.name, getLang()));

/**
 * The restaurant list, narrowed to what `query` matches. It only reports what is tapped:
 * `restaurant-edit` (detail: the restaurant), `restaurant-add` (detail: `{ name }` from the
 * no-match card, `{}` from the empty card) and `search-clear`.
 */
@customElement("restaurant-list")
export class RestaurantList extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
			}

			/* Room for the stuck bar when a focused row scrolls into view. */
			li[data-id] {
				scroll-margin-top: 7rem;
			}

			.list .row {
				min-height: 3.5rem;
			}

			/* A link sits beside the edit button, not inside it: a button can't hold a link. */
			li:has(> .open-link) {
				display: flex;
			}

			.open-link {
				display: flex;
				flex: none;
				align-items: center;
				justify-content: center;
				width: var(--tap);
				color: var(--color-muted);
			}

			.open-link:hover {
				color: var(--color-link);
			}

			.open-link:focus-visible {
				outline-offset: -3px;
			}

			.group > * + * > .open-link {
				border-top: 1px solid var(--color-border);
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

			.no-match .actions {
				justify-content: center;
			}

			@media (min-width: 48rem) {
				li[data-id] {
					scroll-margin-top: 0;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@property({ attribute: false })
	restaurants: readonly Restaurant[] = [];

	/** What is searched for; empty shows every restaurant. */
	@property()
	query = "";

	/** The restaurant open in the form, marked in the list. */
	@property({ attribute: false })
	currentId: string | undefined;

	/** Focus the row of `id`; false when the query hides it. */
	focusRow(id: string): boolean {
		const row = this.renderRoot.querySelector<HTMLElement>(
			`li[data-id="${id}"] button`,
		);
		row?.focus();
		return row !== null;
	}

	private emit(type: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	override render() {
		if (this.restaurants.length === 0)
			return html`<div class="card empty">
				<p>${t("manager.empty")}</p>
				<button type="button" class="primary" data-action="add" @click=${() => this.emit("restaurant-add", {})}>
					${t("manager.addLabel")}
				</button>
			</div>`;
		const results = searchByName(sortByName(this.restaurants), this.query);
		if (results.length === 0) return this.renderNoMatch();
		return html`<ul class="group list">${repeat(
			results,
			({ item }) => item.id,
			({ item, ranges }) => this.renderRow(item, ranges),
		)}</ul>`;
	}

	private renderNoMatch() {
		const query = this.query.trim();
		return html`<div class="card empty no-match">
			<p>${t("search.noMatch", { query })}</p>
			<div class="actions">
				<button type="button" class="primary" data-action="add-named" @click=${() => this.emit("restaurant-add", { name: query })}>
					${icon("plus", 20)}<span>${t("search.add", { query })}</span>
				</button>
				<button type="button" data-action="clear-search-empty" @click=${() => this.emit("search-clear")}>
					${t("search.clear")}
				</button>
			</div>
		</div>`;
	}

	private renderRow(item: Restaurant, ranges: readonly MatchRange[]) {
		const meta = metaLine(item);
		const metaId = `meta-${item.id}`;
		return html`<li data-id=${item.id}>
			<button
				type="button"
				class="item row"
				data-action="edit"
				aria-current=${this.currentId === item.id ? "true" : nothing}
				aria-label=${t("manager.editTitle", { name: item.name })}
				aria-describedby=${meta ? metaId : nothing}
				@click=${() => this.emit("restaurant-edit", item)}
			>
				<span class="grow">
					<b class="name">${renderName(item.name, ranges)}</b>
					${meta ? html`<small class="meta" id=${metaId}>${meta}</small>` : nothing}
				</span>
				<span class="trail">${icon("chevron", 20)}</span>
			</button>
			${
				isLink(item.link)
					? html`<a
							class="open-link"
							href=${item.link}
							target="_blank"
							rel="noopener noreferrer"
							aria-label=${t("manager.openLink", { name: item.name })}
						>${icon("external", 20)}</a>`
					: nothing
			}
		</li>`;
	}
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
