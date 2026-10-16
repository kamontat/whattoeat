import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "#components/app-sheet";
import { deepActiveElement } from "#components/app-sheet";
import { restaurantChips } from "#components/restaurant-chips";
import {
	applyFilter,
	cycleTag,
	EMPTY_FILTER,
	type Filter,
	isFilterActive,
	loadFilter,
	onFilterChanged,
	pruneFilter,
	saveFilter,
	type TagState,
	tagState,
} from "#lib/filter";
import {
	allGroupIds,
	type GroupDef,
	groupLabel,
	loadGroups,
	onGroupsChanged,
	valueLabel,
} from "#lib/groups";
import { addVisit, isHistoryMemoryOnly } from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import { pickOptions } from "#lib/random";
import {
	isLink,
	metaLine,
	type Restaurant,
	valuesByUsage,
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
				min-height: calc(100dvh - 1.25rem - var(--tab-bar-space));
			}

			.layout {
				display: grid;
				gap: 1rem;
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

			/* Phone: a Filter button and the active values beside it. */
			.filter-row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.375rem;
			}

			.filter-open {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
			}

			/* Active values beside the Filter button: buttons, so tapping one reopens the sheet. */
			.summary-chip {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				/* Transparent, not absent: forced-colours still draws an edge around the chip. */
				border: 1px solid transparent;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
			}

			.summary-chip.include {
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			.summary-chip.exclude {
				border-style: dashed;
				border-color: var(--color-control);
				color: var(--color-muted);
				text-decoration: line-through;
			}

			/* The filter itself: in the sheet on phones, in the side panel when wide. */
			.filter {
				display: grid;
				gap: 0.875rem;
			}

			.filter-title {
				font-size: 1rem;
				font-weight: 600;
			}

			.filter-group {
				display: grid;
				gap: 0.375rem;
			}

			.filter-group h3 {
				margin: 0;
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-weight: 500;
			}

			button.tag {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
				line-height: 1.2;
			}

			button.tag.include {
				border-color: var(--color-primary);
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			button.tag.exclude {
				border-style: dashed;
				color: var(--color-muted);
				text-decoration: line-through;
			}

			.active-filter {
				padding-top: 0.75rem;
				border-top: 1px solid var(--color-border);
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			/* An inline text button inside the sentence, not a 44px box. */
			button.link {
				display: inline;
				min-height: 0;
				margin-left: 0.25rem;
				padding: 0;
				border: 0;
				background: none;
				color: var(--color-link);
				font-weight: 600;
				text-decoration: underline;
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

			.result .location {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				font-size: 0.875rem;
			}

			.result .location .icon {
				flex: none;
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
			 * Phone: the pick button stays in reach, just above the tab bar. margin-top: auto
			 * pushes it to the end of the column so it never sits right under short content.
			 */
			.pinned {
				position: sticky;
				z-index: 5;
				bottom: calc(var(--tab-bar-space) - 0.75rem);
				margin-top: auto;
				padding: 0.75rem 0 0.25rem;
				background: linear-gradient(to bottom, transparent, var(--color-bg) 35%);
			}

			.empty {
				justify-items: center;
				text-align: center;
			}

			.button-link {
				display: inline-flex;
				align-items: center;
				min-height: var(--tap);
				padding: 0 var(--pad-x);
				border-radius: var(--radius-sm);
				background: var(--color-primary);
				color: var(--color-primary-text);
				font-weight: 600;
				text-decoration: none;
			}

			@media (min-width: 48rem) {
				:host {
					min-height: 0;
				}

				.layout.with-panel {
					grid-template-columns: 17.5rem minmax(0, 1fr);
					align-items: start;
					gap: 1.5rem;
				}

				.filter-panel {
					position: sticky;
					top: 1rem;
					padding: var(--pad-x);
					border: 1px solid var(--color-border);
					border-radius: var(--radius);
					background: var(--color-surface);
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

	/** Wide screens show the filter in a side panel; phones open it in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	/** Whether the phone filter sheet is open. */
	@state()
	private filterOpen = false;

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

	private unsubscribe: (() => void) | undefined;
	private unsubscribeGroups: (() => void) | undefined;
	private unsubscribeFilter: (() => void) | undefined;

	@state()
	private filter: Filter = EMPTY_FILTER;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		this.defs = loadGroups();
		this.filter = loadFilter();
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

	/**
	 * Crossing into the wide layout stops rendering the phone sheet entirely, which removes its
	 * modal `<dialog>` from the DOM without ever firing a close: close it here instead, so it does
	 * not reopen by itself if the screen narrows again. If focus was inside it, send focus to the
	 * side panel's heading rather than losing it.
	 */
	protected override willUpdate(): void {
		if (!this.wide.matches || !this.filterOpen) return;
		const sheet = this.renderRoot.querySelector("app-sheet");
		const focusWasInSheet = sheet?.contains(deepActiveElement()) ?? false;
		this.filterOpen = false;
		if (focusWasInSheet) {
			void this.updateComplete.then(() => {
				this.renderRoot.querySelector<HTMLElement>("#filter-title")?.focus();
			});
		}
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
	}

	private setFilter(next: Filter): void {
		this.filter = next;
		saveFilter(next);
		this.keepPickInPool();
	}

	private readonly clearFilter = (): void => {
		this.setFilter(EMPTY_FILTER);
	};

	private readonly pick = (): void => {
		this.visited = undefined;
		this.picked = pickOptions(
			this.pool,
			2,
			this.picked.map((item) => item.id),
		);
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
					<a class="button-link" href="./restaurants">${t("picker.addLink")}</a>
				</div>
			`;
		}
		const groups = allGroupIds(this.defs)
			.map((group) => ({
				group,
				values: valuesByUsage(this.restaurants, group),
			}))
			.filter(({ values }) => values.length > 0);
		const empty = this.pool.length === 0;
		const wide = this.wide.matches;
		const panel = wide && groups.length > 0;
		const pick = html`<button type="button" class="primary pick" ?disabled=${empty} @click=${this.pick}>
			${icon("dice", 22)}<span>${this.picked.length > 0 ? t("picker.again") : t("picker.button")}</span>
		</button>`;
		return html`
			${warnings}
			<div class="layout ${panel ? "with-panel" : ""}">
				${panel ? html`<aside class="filter-panel">${this.renderFilterBody(groups, true)}</aside>` : nothing}
				<div class="main-col">
					<header class="head">
						<div>${title}<p class="count page-sub">${this.countText()}</p></div>
						${wide ? pick : nothing}
					</header>
					${!wide && groups.length > 0 ? this.renderFilterRow(groups) : nothing}
					${empty ? html`<p class="no-match" role="status">${t("filter.noMatch")}</p>` : nothing}
					<p class="announce visually-hidden" role="status">${this.announcement()}</p>
					<div class="results">${this.picked.map((item) => this.renderResult(item))}</div>
				</div>
			</div>
			${wide ? nothing : html`<div class="pinned">${pick}</div>`}
		`;
	}

	/** Screen readers hear the new picks by name rather than both whole tiles. */
	private announcement(): string {
		const [a, b] = this.picked.map((item) => item.name);
		if (a === undefined) return "";
		return b === undefined
			? t("picker.announce.one", { a })
			: t("picker.announce.two", { a, b });
	}

	/** How many values the filter includes or excludes, across every group. */
	private activeValueCount(): number {
		return Object.values(this.filter).reduce(
			(count, group) => count + group.include.length + group.exclude.length,
			0,
		);
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

	private filterSummary(): {
		symbol: Record<TagState, string>;
		summary: string;
	} {
		const symbol: Record<TagState, string> = {
			off: "",
			include: "✓ ",
			exclude: "✕ ",
		};
		const summary = allGroupIds(this.defs)
			.map((group) => {
				const filterGroup = Object.hasOwn(this.filter, group)
					? this.filter[group]
					: undefined;
				if (filterGroup === undefined) return "";
				const { include, exclude } = filterGroup;
				const values = [
					...include.map(
						(value) => `${symbol.include}${valueLabel(group, value)}`,
					),
					...exclude.map(
						(value) => `${symbol.exclude}${valueLabel(group, value)}`,
					),
				];
				return values.length > 0
					? `${groupLabel(group, this.defs)}: ${values.join(", ")}`
					: "";
			})
			.filter((part) => part !== "")
			.join("; ");
		return { symbol, summary };
	}

	/** The filter's groups and chips; titled in the side panel, untitled in the sheet (the sheet has the heading). */
	private renderFilterBody(
		groups: { group: string; values: string[] }[],
		titled: boolean,
	) {
		const { symbol, summary } = this.filterSummary();
		return html`
			<section class="filter" aria-labelledby=${titled ? "filter-title" : nothing} aria-label=${titled ? nothing : t("filter.title")}>
				${titled ? html`<h2 id="filter-title" class="filter-title" tabindex="-1">${t("filter.title")}</h2>` : nothing}
				<p class="hint">${t("filter.hint")}</p>
				${groups.map(
					({
						group,
						values,
					}) => html`<div class="filter-group" role="group" aria-labelledby="group-${group}">
						<h3 id="group-${group}">${groupLabel(group, this.defs)}</h3>
						<ul class="chips">
							${values.map((value) => {
								const state = tagState(this.filter, group, value);
								const label = valueLabel(group, value);
								return html`<li>
									<button
										type="button"
										class="chip tag ${state}"
										data-group=${group}
										data-tag=${value}
										data-state=${state}
										aria-pressed=${state === "off" ? "false" : "true"}
										aria-label=${t("filter.tagState", {
											group: groupLabel(group, this.defs),
											tag: label,
											state: t(`filter.state.${state}`),
										})}
										@click=${() => this.setFilter(cycleTag(this.filter, group, value))}
									>
										${symbol[state]}${label}
									</button>
								</li>`;
							})}
						</ul>
					</div>`,
				)}
				${
					isFilterActive(this.filter)
						? html`<p class="active-filter">
								${t("filter.active", { tags: summary })}
								<button type="button" class="link" data-action="clear-filter" @click=${this.clearFilter}>
									${t("filter.clear")}
								</button>
							</p>`
						: nothing
				}
			</section>
		`;
	}

	/** Phone: the Filter button, the active values beside it, and the sheet it opens. */
	private renderFilterRow(groups: { group: string; values: string[] }[]) {
		const { symbol } = this.filterSummary();
		const count = this.activeValueCount();
		const active = allGroupIds(this.defs).flatMap((group) => {
			const filterGroup = Object.hasOwn(this.filter, group)
				? this.filter[group]
				: undefined;
			if (filterGroup === undefined) return [];
			return [
				...filterGroup.include.map((value) => ({
					state: "include" as const,
					label: valueLabel(group, value),
				})),
				...filterGroup.exclude.map((value) => ({
					state: "exclude" as const,
					label: valueLabel(group, value),
				})),
			];
		});
		return html`
			<div class="filter-row">
				<button
					type="button"
					class="filter-open"
					data-action="open-filter"
					aria-haspopup="dialog"
					@click=${() => {
						this.filterOpen = true;
					}}
				>
					${icon("funnel", 18)}<span>${count > 0 ? t("filter.openCount", { count }) : t("filter.title")}</span>
				</button>
				${
					active.length > 0
						? html`<ul class="chips summary" aria-label=${t("filter.title")}>
								${active.map(
									({ state, label }) => html`<li class=${state}>
										<button
											type="button"
											class="summary-chip ${state}"
											data-action="open-filter-value"
											aria-haspopup="dialog"
											@click=${() => {
												this.filterOpen = true;
											}}
										><span aria-hidden="true">${symbol[state]}</span>${label}<span class="visually-hidden">, ${t(`filter.state.${state}`)}</span></button>
									</li>`,
								)}
							</ul>`
						: nothing
				}
			</div>
			<app-sheet
				heading=${t("filter.title")}
				?open=${this.filterOpen}
				@sheet-close=${() => {
					this.filterOpen = false;
				}}
			>
				${this.renderFilterBody(groups, false)}
				<button
					slot="footer"
					type="button"
					class="primary"
					data-action="filter-done"
					@click=${() => {
						this.filterOpen = false;
					}}
				>
					${t("filter.done")}
				</button>
			</app-sheet>
		`;
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
		return html`
			<article class="card result ${this.visited?.id === item.id ? "visited" : ""}">
				<h2>${item.name}</h2>
				${metaLine(item) ? html`<p class="meta">${metaLine(item)}</p>` : nothing}
				${
					item.location
						? html`<p class="location">${icon("pin", 16)}
								${
									isLink(item.location)
										? html`<a href=${item.location} target="_blank" rel="noopener noreferrer">${item.location}</a>`
										: item.location
								}
							</p>`
						: nothing
				}
				${item.notes ? html`<p class="notes">${item.notes}</p>` : nothing}
				${restaurantChips(item, this.defs)}
				<div class="foot">${this.renderVisit(item)}</div>
			</article>
		`;
	}
}
