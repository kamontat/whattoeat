import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import {
	countText,
	type Named,
	noMatch,
	searchByName,
	searchWords,
} from "#lib/search";
import { uiStyles } from "#styles/ui";

/**
 * Strings `restaurant-search` shows in place of its own restaurant-flavoured defaults, so a
 * page searching something else (e.g. tags) can supply its own wording. `count` and `noMatch`
 * take the current query and return the text to show for it.
 */
export type SearchLabels = {
	open: string;
	placeholder: string;
	count: (query: string) => string;
	noMatch: (query: string) => string;
};

/**
 * The search field for the restaurant list. It owns what is typed (never stored) and the `/`
 * shortcut, and reports `search-change` (detail: `{ searching, query }`) on every change,
 * `search-cancel` when the user ends search, and `search-pick` (detail: the matched item) when
 * the Search key is pressed with exactly one match.
 */
@customElement("restaurant-search")
export class RestaurantSearch extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/* The row and the count are items of the parent's grid, as if written there. */
			:host {
				display: contents;
			}

			.search-row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}

			.search-row[hidden] {
				display: none;
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
		`,
	];

	protected readonly langController = new LangController(this);

	/** `/` opens search on wide screens only. */
	protected readonly wide = new MediaController(this, WIDE);

	/** The items to count and pick from. */
	@property({ attribute: false })
	restaurants: readonly Named[] = [];

	/** Restaurant-flavoured defaults when `undefined`; a page's own wording otherwise. */
	@property({ attribute: false })
	labels: SearchLabels | undefined;

	/** Whether search is open; read it, open it with `open()`. */
	@state()
	searching = false;

	/** What is typed in the field; never stored. */
	@state()
	private query = "";

	/** The result count read out to screen readers once typing pauses. */
	@state()
	private announced = "";

	private announceTimer: ReturnType<typeof setTimeout> | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("keydown", this.onShortcut);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("keydown", this.onShortcut);
		clearTimeout(this.announceTimer);
	}

	/** Nothing left to search: end search outright rather than leave a dead "0 of 0" view. */
	protected override willUpdate(changed: PropertyValues): void {
		if (
			changed.has("restaurants") &&
			this.searching &&
			this.restaurants.length === 0
		)
			this.end();
	}

	private get field(): HTMLInputElement | null {
		return this.renderRoot.querySelector<HTMLInputElement>("#search");
	}

	focusField(): void {
		this.field?.focus();
	}

	/**
	 * iOS only opens the keyboard for a focus made during the tap, so the row is always rendered
	 * and is shown and focused here, before any re-render.
	 */
	open(): void {
		const row = this.renderRoot.querySelector<HTMLElement>(".search-row");
		if (row !== null) row.hidden = false;
		this.focusField();
		this.searching = true;
		this.emitChange();
	}

	/** Empty the field and put focus back in it, staying in search. */
	readonly clear = (): void => {
		this.query = "";
		this.scheduleAnnounce();
		const input = this.field;
		if (input !== null) {
			input.value = "";
			input.focus();
		}
		this.emitChange();
	};

	private emit(type: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	private emitChange(): void {
		this.emit("search-change", {
			searching: this.searching,
			query: this.query,
		});
	}

	private end(): void {
		clearTimeout(this.announceTimer);
		this.searching = false;
		this.query = "";
		this.announced = "";
		this.emitChange();
	}

	/** End search without telling the page it was cancelled, e.g. after a successful pick. */
	close(): void {
		this.end();
	}

	private readonly cancel = (): void => {
		this.end();
		this.emit("search-cancel");
	};

	/**
	 * `/` opens search on wide screens, unless typing somewhere or a sheet is open. Already
	 * searching but focus has drifted elsewhere (e.g. a result row): bring it back to the field
	 * instead of doing nothing.
	 */
	private readonly onShortcut = (event: KeyboardEvent): void => {
		if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey)
			return;
		if (!this.wide.matches || this.restaurants.length === 0) return;
		if (document.documentElement.classList.contains("sheet-open")) return;
		const target = event.composedPath()[0];
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
		)
			return;
		event.preventDefault();
		if (this.searching) this.focusField();
		else this.open();
	};

	private readonly onInput = (event: Event): void => {
		this.query = (event.target as HTMLInputElement).value;
		this.scheduleAnnounce();
		this.emitChange();
	};

	/**
	 * Escape ends search. Enter (the keyboard's Search key) picks the only match, or else just
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
		const results =
			searchWords(this.query).length > 0
				? searchByName(this.restaurants, this.query)
				: [];
		if (results.length === 1 && results[0] !== undefined)
			this.emit("search-pick", results[0].item);
		else (event.target as HTMLInputElement).blur();
	};

	/** Say the count once typing pauses, not on every key. */
	private scheduleAnnounce(): void {
		clearTimeout(this.announceTimer);
		this.announced = "";
		this.announceTimer = setTimeout(() => {
			this.announced = noMatch(this.restaurants, this.query)
				? (this.labels?.noMatch(this.query.trim()) ??
					t("search.noMatch", { query: this.query.trim() }))
				: (this.labels?.count(this.query) ??
					countText(this.restaurants, this.query));
		}, 500);
	}

	override render() {
		return html`<div class="search-row" ?hidden=${!this.searching}>
				<label class="search-field">
					${icon("search", 20)}
					<input
						id="search"
						type="search"
						aria-label=${this.labels?.open ?? t("search.open")}
						placeholder=${this.labels?.placeholder ?? t("search.placeholder")}
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
				this.searching && !noMatch(this.restaurants, this.query)
					? html`<p class="search-count page-sub">${this.labels?.count(this.query) ?? countText(this.restaurants, this.query)}</p>`
					: nothing
			}
			<p class="visually-hidden search-announce" role="status">${this.announced}</p>`;
	}
}
