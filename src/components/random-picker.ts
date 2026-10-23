import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "#components/filter-bar";
import { restaurantChips } from "#components/restaurant-chips";
import {
	applyFilter,
	EMPTY_FILTER,
	type Filter,
	isFilterActive,
	loadFilter,
	onFilterChanged,
	pruneFilter,
	saveFilter,
} from "#lib/filter";
import {
	allGroupIds,
	type GroupDef,
	loadGroups,
	onGroupsChanged,
} from "#lib/groups";
import { addVisit, isHistoryMemoryOnly } from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import {
	loadPickCount,
	PICK_COUNTS,
	type PickCount,
	pickOptions,
	savePickCount,
} from "#lib/random";
import {
	displayName,
	linkLabel,
	metaLine,
	openLinks,
	type Restaurant,
} from "#lib/restaurant";
import {
	loadRestaurants,
	onRestaurantsChanged,
	skippedCount,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

@customElement("random-picker")
export class RandomPicker extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/*
			 * Phone: fill the space above the tab bar so the pinned pick button ends the column
			 * even when there is little content yet (the 1.25rem is main's top padding on phones).
			 */
			:host {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				min-height: calc(100dvh - 1.25rem - var(--tab-bar-height));
				/* main leaves --tab-bar-space below; pull back so the pinned button sits on the tab bar. */
				margin-bottom: calc(var(--tab-bar-height) - var(--tab-bar-space));
			}

			.main-col {
				display: grid;
				align-content: start;
				gap: 0.75rem;
				min-width: 0;
			}

			.head {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-end;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.head-actions {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}

			.stepper {
				display: inline-flex;
				flex: none;
				align-items: stretch;
				border: 1px solid var(--color-control);
				border-radius: var(--radius-sm);
				background: var(--color-surface);
			}

			.stepper button {
				min-width: var(--tap);
				padding: 0;
				border: 0;
				background: none;
			}

			.stepper-value {
				display: grid;
				place-items: center;
				min-width: 1.75rem;
				font-weight: 600;
				font-variant-numeric: tabular-nums;
				white-space: nowrap;
			}

			.no-match {
				color: var(--color-danger);
			}

			.results {
				display: grid;
				gap: 0.75rem;
			}

			.results:empty {
				display: none;
			}

			.result {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}

			.result h2 {
				font-size: 1.25rem;
				line-height: 1.25;
				font-weight: 600;
			}

			.result .meta {
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			/* The name opens the restaurant's link; the icon says it leaves the app. */
			.result h2 a {
				color: inherit;
				text-decoration: underline;
				text-decoration-color: var(--color-border);
				text-underline-offset: 0.2em;
			}

			.result h2 a:hover {
				text-decoration-color: currentColor;
			}

			.result h2 a .icon {
				margin-inline-start: 0.375rem;
				vertical-align: -0.0625em;
				color: var(--color-muted);
			}

			/* Two or more links: each by its label, in a wrapping row under the notes. */
			.result .links {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem 1rem;
				margin: 0;
				padding: 0;
				list-style: none;
				font-size: 0.875rem;
			}

			.result .links a {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				min-height: 2rem;
				color: var(--color-link);
			}

			.result .links a .icon {
				color: var(--color-muted);
			}

			.notes {
				white-space: pre-wrap;
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.result .chips {
				margin-top: 0.25rem;
			}

			.result .chip {
				font-size: 0.75rem;
			}

			.result .foot {
				margin-top: auto;
				padding-top: 0.625rem;
			}

			.result.visited {
				border-color: var(--color-success);
				box-shadow: 0 0 0 1px var(--color-success);
			}

			.visited-label {
				padding: 0.5rem 0;
				color: var(--color-success);
				font-weight: 600;
			}

			.visited-label:focus {
				outline: none;
			}

			.pick {
				width: 100%;
				min-height: 3.125rem;
				font-size: 1.0625rem;
			}

			/*
			 * Phone: the pick button stays in reach, just above the tab bar, with nothing of the
			 * gradient peeking out below it. margin-top: auto pushes it to the end of the column
			 * so it never sits right under short content.
			 */
			.pinned {
				position: sticky;
				z-index: 5;
				bottom: var(--tab-bar-height);
				margin-top: auto;
				padding: 0.75rem 0 0.5rem;
				background: linear-gradient(to bottom, transparent, var(--color-bg) 35%);
				display: flex;
				gap: 0.5rem;
			}

			.pinned .pick {
				flex: 1;
				min-width: 0;
			}

			@media (min-width: 48rem) {
				.stepper-value {
					min-width: 5.5rem;
					padding: 0 0.25rem;
					font-size: 0.875rem;
				}

				:host {
					min-height: 0;
					margin-bottom: 0;
				}

				.results {
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 1rem;
				}

				.pick {
					width: auto;
					min-height: var(--tap);
					font-size: 0.9375rem;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Wide screens put the pick button in the heading row; phones pin it above the tab bar. */
	protected readonly wide = new MediaController(this, WIDE);

	@state()
	private restaurants: Restaurant[] = [];

	/** Stored entries the last load could not read. */
	@state()
	private skipped = 0;

	/** The group definitions saved so far, in their stored order. */
	@state()
	private defs: GroupDef[] = [];

	/** The options from the last press, emptied when none of them are left in the pool. */
	@state()
	private picked: Restaurant[] = [];

	/** The card the user chose with "Eat here" for this pick, and when. */
	@state()
	private visited: { id: string; at: Date } | undefined;

	/**
	 * The live region's text. Written only from `pick()`: cleared immediately, then set once the
	 * clear has rendered, so picking the same names again still changes the text and gets announced.
	 */
	@state()
	private announced = "";

	private unsubscribe: (() => void) | undefined;
	private unsubscribeGroups: (() => void) | undefined;
	private unsubscribeFilter: (() => void) | undefined;

	@state()
	private filter: Filter = EMPTY_FILTER;

	/** How many restaurants a press shows; also set in Settings. */
	@state()
	private count: PickCount = loadPickCount();

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		this.defs = loadGroups();
		this.filter = loadFilter();
		this.count = loadPickCount();
		this.pruneFilter();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			this.skipped = skippedCount();
			this.pruneFilter();
			this.keepPickInPool();
		});
		this.unsubscribeGroups = onGroupsChanged(() => {
			this.defs = loadGroups();
			this.restaurants = loadRestaurants();
			this.pruneFilter();
			this.keepPickInPool();
		});
		// Another tab saved the filter (for example after renaming a value): take it as it is.
		// Pruning, and dropping picks outside the filter, wait for the restaurant change that
		// follows: until it lands, a renamed value matches no restaurant and would drop every pick.
		this.unsubscribeFilter = onFilterChanged(() => {
			this.filter = loadFilter();
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.unsubscribeGroups?.();
		this.unsubscribeGroups = undefined;
		this.unsubscribeFilter?.();
		this.unsubscribeFilter = undefined;
	}

	private get pool(): Restaurant[] {
		return applyFilter(this.restaurants, this.filter);
	}

	/** Drop filter values no restaurant uses any more; save only when that changed something. */
	private pruneFilter(): void {
		const pruned = pruneFilter(
			this.filter,
			this.restaurants,
			allGroupIds(this.defs),
		);
		if (JSON.stringify(pruned) !== JSON.stringify(this.filter)) {
			saveFilter(pruned);
		}
		this.filter = pruned;
	}

	/** Drop picked restaurants that were deleted or are outside the filter. */
	private keepPickInPool(): void {
		const pool = this.pool;
		this.picked = this.picked
			.map((item) => pool.find((other) => other.id === item.id))
			.filter((item) => item !== undefined);
		if (!this.picked.some((item) => item.id === this.visited?.id))
			this.visited = undefined;
		// Leave the announcement text alone otherwise: this is not a new pick.
		if (this.picked.length === 0) this.announced = "";
	}

	private setFilter(next: Filter): void {
		this.filter = next;
		saveFilter(next);
		this.keepPickInPool();
	}

	private readonly pick = (): void => {
		this.visited = undefined;
		this.picked = pickOptions(
			this.pool,
			this.count,
			this.picked.map((item) => item.id),
		);
		// Clear first, then set the real text once that clear has rendered: picking the same
		// names again still changes the live region's text, so it is announced again.
		this.announced = "";
		void this.updateComplete.then(() => {
			this.announced = this.pickAnnouncement();
		});
	};

	override render() {
		const warnings = html`
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			${isHistoryMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
		`;
		const title = html`<h1 class="page-title">${t("app.title")}</h1>`;
		if (this.restaurants.length === 0) {
			return html`
				<header class="head"><div>${title}</div></header>
				${warnings}
				<div class="card empty">
					<p>${t("picker.empty")}</p>
					<a class="button-link primary" href="./settings/presets">${t("picker.presetsLink")}</a>
					<a class="button-link secondary" href="./restaurants">${t("picker.addLink")}</a>
				</div>
			`;
		}
		const empty = this.pool.length === 0;
		const wide = this.wide.matches;
		const stepper = this.renderStepper(wide);
		const pick = html`<button type="button" class="primary pick" ?disabled=${empty} @click=${this.pick}>
			${icon("dice", 22)}<span>${this.picked.length > 0 ? t("picker.again") : t("picker.button")}</span>
		</button>`;
		return html`
			${warnings}
			<div class="main-col">
				<header class="head">
					<div>${title}<p class="count page-sub">${this.countText()}</p></div>
					${wide ? html`<div class="head-actions">${stepper}${pick}</div>` : nothing}
				</header>
				<filter-bar
					.restaurants=${this.restaurants}
					.defs=${this.defs}
					.filter=${this.filter}
					@filter-change=${(event: CustomEvent<Filter>) => this.setFilter(event.detail)}
				></filter-bar>
				${empty ? html`<p class="no-match" role="status">${t("filter.noMatch")}</p>` : nothing}
				<p class="announce visually-hidden" role="status">${this.announced}</p>
				<div class="results">${this.picked.map((item) => this.renderResult(item))}</div>
			</div>
			${wide ? nothing : html`<div class="pinned">${stepper}${pick}</div>`}
		`;
	}

	/** How many restaurants the next press shows, beside the pick button. Phones show the number alone. */
	private renderStepper(wide: boolean) {
		return html`<div class="stepper" role="group" aria-label=${t("picker.pickCount")}>
			<button
				type="button"
				data-step="fewer"
				aria-label=${t("picker.fewer")}
				?disabled=${!this.canStep(-1)}
				@click=${() => this.step(-1)}
			>${icon("minus", 18)}</button>
			<span class="stepper-value">${wide ? t("picker.perPick", { count: this.count }) : this.count}</span>
			<button
				type="button"
				data-step="more"
				aria-label=${t("picker.more")}
				?disabled=${!this.canStep(1)}
				@click=${() => this.step(1)}
			>${icon("plus", 18)}</button>
		</div>`;
	}

	private canStep(by: number): boolean {
		return (PICK_COUNTS as readonly number[]).includes(this.count + by);
	}

	private step(by: number): void {
		if (!this.canStep(by)) return;
		this.count = (this.count + by) as PickCount;
		savePickCount(this.count);
	}

	/** Screen readers hear the new picks by name rather than every whole tile. */
	private pickAnnouncement(): string {
		const names = this.picked.map(displayName);
		if (names.length === 0) return "";
		return t("picker.announce", {
			names: new Intl.ListFormat(getLang(), { type: "conjunction" }).format(
				names,
			),
		});
	}

	private countText(): string {
		const total = this.restaurants.length;
		if (isFilterActive(this.filter)) {
			return t("picker.countFiltered", { count: this.pool.length, total });
		}
		return total === 1
			? t("picker.count.one")
			: t("picker.count.other", { count: total });
	}

	private visit(item: Restaurant): void {
		// A second press before the re-render must not save a second visit.
		if (this.visited !== undefined) return;
		const entry = addVisit(item);
		this.visited = { id: item.id, at: new Date(entry.visitedAt) };
		// The pressed button is gone after the render, so move focus to the label that replaced it.
		void this.updateComplete.then(() => {
			this.renderRoot.querySelector<HTMLElement>(".visited-label")?.focus();
		});
	}

	private renderVisit(item: Restaurant) {
		if (this.visited === undefined)
			return html`<button type="button" class="soft visit" data-id=${item.id} @click=${() => this.visit(item)}>
				${t("picker.visit")}
			</button>`;
		if (this.visited.id !== item.id) return nothing;
		const time = new Intl.DateTimeFormat(getLang(), {
			hour: "2-digit",
			minute: "2-digit",
		}).format(this.visited.at);
		return html`<p class="visited-label" tabindex="-1">${t("picker.visited", { time })}</p>`;
	}

	private renderResult(item: Restaurant) {
		const links = openLinks(item);
		const [first] = links;
		return html`
			<article class="card result ${this.visited?.id === item.id ? "visited" : ""}">
				<h2>${
					first !== undefined
						? html`<a href=${first.url} target="_blank" rel="noopener noreferrer">${displayName(item)}${icon("external", 16)}</a>`
						: displayName(item)
				}</h2>
				${metaLine(item) ? html`<p class="meta">${metaLine(item)}</p>` : nothing}
				${item.notes ? html`<p class="notes">${item.notes}</p>` : nothing}
				${
					links.length > 1
						? html`<ul class="links" aria-label=${t("picker.links", { name: displayName(item) })}>
								${links.map(
									(link) =>
										html`<li><a href=${link.url} target="_blank" rel="noopener noreferrer">${linkLabel(link)}${icon("external", 14)}</a></li>`,
								)}
							</ul>`
						: nothing
				}
				${restaurantChips(item, this.defs)}
				<div class="foot">${this.renderVisit(item)}</div>
			</article>
		`;
	}
}
