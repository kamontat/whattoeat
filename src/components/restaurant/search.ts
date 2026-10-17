import {
	css,
	html,
	type LitElement,
	nothing,
	type ReactiveController,
} from "lit";
import { live } from "lit/directives/live.js";
import { t } from "#lib/i18n";
import { icon } from "#lib/icons";
import type { Restaurant } from "#lib/restaurant";
import { type MatchRange, matchName, searchWords } from "#lib/search";

export const searchStyles = css`
	.search-row[hidden] {
		display: none;
	}

	.search-open {
		width: var(--tap);
		min-height: var(--tap);
		padding: 0;
		border-radius: var(--radius-pill);
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.search-field {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--tap);
		padding: 0 0 0 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
		color: var(--color-muted);
		font-weight: 400;
	}

	.search-field:focus-within {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}

	.search-field input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		appearance: none;
		-webkit-appearance: none;
	}

	/* The field's own ring is drawn around the whole field above. */
	.search-field input:focus-visible {
		outline: none;
	}

	.search-field input::-webkit-search-cancel-button,
	.search-field input::-webkit-search-decoration {
		display: none;
	}

	.clear-search {
		width: var(--tap);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-muted);
	}

	.cancel-search {
		padding: 0 0.25rem;
		border-color: transparent;
		background: transparent;
		color: var(--color-link);
	}

	.search-count {
		margin-top: -0.25rem;
	}

	.no-match .actions {
		justify-content: center;
	}

	@media (prefers-reduced-motion: no-preference) {
		.search-row:not([hidden]) {
			animation: search-in var(--duration) ease-out;
		}

		@keyframes search-in {
			from {
				opacity: 0;
			}
		}
	}
`;

export type SearchResult = { item: Restaurant; ranges: MatchRange[] };

type SearchOptions = {
	/** Every restaurant, in list order. */
	sorted: () => Restaurant[];
	/** Whether `/` may open search right now. */
	shortcutEnabled: () => boolean;
	/** Enter with exactly one match opens it. */
	onPick: (item: Restaurant) => void;
	/** The no-match card's Add: a new restaurant already named what was searched for. */
	onAddNamed: (name: string) => void;
	focusAfterRender: (find: () => Element | null | undefined) => void;
};

/**
 * The restaurant list's search: whether it is open, what is typed (never stored), the result
 * count read out once typing pauses, and the `/` shortcut that opens it on wide screens.
 */
export class RestaurantSearch implements ReactiveController {
	/** Whether the header is in search mode. */
	searching = false;

	/** What is typed in the search field; never stored. */
	query = "";

	/** The result count read out to screen readers once typing pauses. */
	announced = "";

	private announceTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private readonly host: LitElement,
		private readonly options: SearchOptions,
	) {
		host.addController(this);
	}

	hostConnected(): void {
		document.addEventListener("keydown", this.onShortcut);
	}

	hostDisconnected(): void {
		document.removeEventListener("keydown", this.onShortcut);
		clearTimeout(this.announceTimer);
	}

	private get field(): HTMLInputElement | null {
		return this.host.renderRoot.querySelector<HTMLInputElement>("#search");
	}

	/**
	 * `/` opens search on wide screens, unless typing somewhere or a sheet is open. Already
	 * searching but focus has drifted elsewhere (e.g. a result row): bring it back to the field
	 * instead of doing nothing.
	 */
	private readonly onShortcut = (event: KeyboardEvent): void => {
		if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey)
			return;
		if (!this.options.shortcutEnabled()) return;
		if (document.documentElement.classList.contains("sheet-open")) return;
		const target = event.composedPath()[0];
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
		)
			return;
		event.preventDefault();
		if (this.searching) {
			this.field?.focus();
			return;
		}
		this.open();
	};

	/**
	 * iOS only opens the keyboard for a focus made during the tap, so the search row is always
	 * rendered and is shown and focused here, before any re-render.
	 */
	readonly open = (): void => {
		const row = this.host.renderRoot.querySelector<HTMLElement>(".search-row");
		if (row !== null) row.hidden = false;
		this.field?.focus();
		this.searching = true;
		this.host.requestUpdate();
	};

	private readonly onInput = (event: Event): void => {
		this.query = (event.target as HTMLInputElement).value;
		this.scheduleAnnounce();
	};

	/**
	 * Escape ends search. Enter (the keyboard's Search key) opens the only match, or else just
	 * puts the keyboard away so every result is in view.
	 */
	private readonly onKey = (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			event.preventDefault();
			this.cancel();
			return;
		}
		if (event.key !== "Enter") return;
		event.preventDefault();
		const results = this.results(this.options.sorted());
		const only = searchWords(this.query).length > 0 ? results : [];
		if (only.length === 1 && only[0] !== undefined)
			this.options.onPick(only[0].item);
		else (event.target as HTMLInputElement).blur();
	};

	private readonly clear = (): void => {
		this.query = "";
		this.scheduleAnnounce();
		const input = this.field;
		if (input !== null) {
			input.value = "";
			input.focus();
		}
	};

	/** Leave search without moving focus, e.g. when there is nothing left to search. */
	end(): void {
		clearTimeout(this.announceTimer);
		this.searching = false;
		this.query = "";
		this.announced = "";
		this.host.requestUpdate();
	}

	private readonly cancel = (): void => {
		this.end();
		this.options.focusAfterRender(() =>
			this.host.renderRoot.querySelector('[data-action="search"]'),
		);
	};

	/** Say the count once typing pauses, not on every key. */
	private scheduleAnnounce(): void {
		clearTimeout(this.announceTimer);
		this.announced = "";
		this.host.requestUpdate();
		this.announceTimer = setTimeout(() => {
			const sorted = this.options.sorted();
			this.announced = this.noMatch(sorted)
				? t("search.noMatch", { query: this.query.trim() })
				: this.countText(sorted);
			this.host.requestUpdate();
		}, 500);
	}

	/** The restaurants the query keeps, in list order, with what to highlight in each name. */
	results(sorted: readonly Restaurant[]): SearchResult[] {
		const words = this.searching ? searchWords(this.query) : [];
		return sorted.flatMap((item) => {
			const ranges = matchName(item.name, words);
			return ranges === undefined ? [] : [{ item, ranges }];
		});
	}

	/** Searching for words that no restaurant name has (the no-match card shows instead). */
	noMatch(sorted: readonly Restaurant[]): boolean {
		return (
			sorted.length > 0 &&
			searchWords(this.query).length > 0 &&
			this.results(sorted).length === 0
		);
	}

	countText(sorted: readonly Restaurant[]): string {
		const total = sorted.length;
		if (this.searching && searchWords(this.query).length > 0)
			return t("search.count", {
				shown: this.results(sorted).length,
				total,
			});
		return total === 1
			? t("picker.count.one")
			: t("picker.count.other", { count: total });
	}

	/** The magnifier in the header that opens search. */
	renderOpen() {
		return html`<button
			type="button"
			class="search-open"
			data-action="search"
			aria-label=${t("search.open")}
			@click=${this.open}
		>
			${icon("search", 20)}
		</button>`;
	}

	/** The search field, always rendered (see `open`), and the count under it while searching. */
	renderRow(sorted: readonly Restaurant[], count: string) {
		return html`<div class="search-row" ?hidden=${!this.searching}>
				<label class="search-field">
					${icon("search", 20)}
					<input
						id="search"
						type="search"
						aria-label=${t("search.open")}
						placeholder=${t("search.placeholder")}
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
						spellcheck="false"
						enterkeyhint="search"
						.value=${live(this.query)}
						@input=${this.onInput}
						@keydown=${this.onKey}
					/>
					${
						this.query !== ""
							? html`<button
									type="button"
									class="clear-search"
									data-action="clear-search"
									aria-label=${t("search.clear")}
									@pointerdown=${(event: PointerEvent) => event.preventDefault()}
									@click=${this.clear}
								>
									${icon("x", 18)}
								</button>`
							: nothing
					}
				</label>
				<button type="button" class="cancel-search" data-action="cancel-search" @click=${this.cancel}>
					${t("search.cancel")}
				</button>
			</div>
			${
				this.searching && !this.noMatch(sorted)
					? html`<p class="search-count page-sub">${count}</p>`
					: nothing
			}`;
	}

	renderAnnounce() {
		return html`<p class="visually-hidden search-announce" role="status">${this.announced}</p>`;
	}

	renderNoMatch() {
		const query = this.query.trim();
		return html`<div class="card empty no-match">
			<p>${t("search.noMatch", { query })}</p>
			<div class="actions">
				<button type="button" class="primary" data-action="add-named" @click=${() => this.options.onAddNamed(query)}>
					${icon("plus", 20)}<span>${t("search.add", { query })}</span>
				</button>
				<button type="button" data-action="clear-search-empty" @click=${this.clear}>
					${t("search.clear")}
				</button>
			</div>
		</div>`;
	}
}
