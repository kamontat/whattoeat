import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
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
			:host {
				display: grid;
				gap: 1.25rem;
				justify-items: center;
				padding-top: 1rem;
			}

			/* Filter: one panel, a label column beside each row of chips. */
			.filter {
				display: grid;
				gap: 0.875rem;
				width: 100%;
				box-sizing: border-box;
				padding: 1rem 1.25rem;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
			}

			.filter-head {
				display: flex;
				flex-wrap: wrap;
				align-items: baseline;
				gap: 0.25rem 0.75rem;
			}

			.filter-title {
				font-size: 1rem;
			}

			.filter-group {
				display: grid;
				grid-template-columns: 5.5rem 1fr;
				align-items: start;
				gap: 0.5rem;
			}

			.filter-group h3 {
				margin: 0;
				padding-top: 0.375rem;
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-weight: 600;
			}

			@media (max-width: 30rem) {
				.filter-group {
					grid-template-columns: 1fr;
					gap: 0.375rem;
				}

				.filter-group h3 {
					padding-top: 0;
				}
			}

			.filter .chips {
				gap: 0.375rem;
			}

			button.tag {
				min-height: 2rem;
				padding: 0.25rem 0.75rem;
				font-size: 0.875rem;
				line-height: 1.2;
			}

			button.tag:hover {
				border-color: var(--color-muted);
			}

			button.tag.include {
				border-color: var(--color-success);
				background: var(--color-success);
				color: var(--color-surface);
				font-weight: 600;
			}

			button.tag.exclude {
				border-color: var(--color-danger);
				border-style: dashed;
				color: var(--color-danger);
				text-decoration: line-through;
			}

			.active-filter {
				padding-top: 0.75rem;
				border-top: 1px solid var(--color-border);
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			button.link {
				padding: 0;
				margin-left: 0.25rem;
				border: 0;
				background: none;
				color: var(--color-primary);
				font-weight: 600;
				text-decoration: underline;
			}

			.no-match {
				color: var(--color-danger);
			}

			.count {
				margin-top: 0.5rem;
			}

			.pick {
				padding: 1.125rem 2.25rem;
				font-size: 1.5rem;
				font-weight: 700;
				border-radius: 999px;
				box-shadow: 0 6px 20px -8px var(--color-primary);
			}

			.pick:not(:disabled):active {
				transform: translateY(1px);
			}

			.pick:disabled {
				opacity: 0.5;
				cursor: not-allowed;
				box-shadow: none;
			}

			/* Picked cards: equal height, the action sits on the bottom edge. */
			[aria-live] {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
				gap: 1rem;
				width: 100%;
			}

			[aria-live]:empty {
				display: none;
			}

			.result,
			.empty {
				width: 100%;
				box-sizing: border-box;
			}

			.empty {
				justify-items: center;
				text-align: center;
			}

			.result {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				padding: 1.25rem;
			}

			.result h2 {
				font-size: 1.25rem;
				line-height: 1.3;
			}

			.result .meta {
				color: var(--color-primary);
				font-size: 0.875rem;
				font-weight: 600;
			}

			.result .location,
			.result .notes {
				font-size: 0.9375rem;
			}

			.notes {
				white-space: pre-wrap;
				color: var(--color-muted);
			}

			.result .chips {
				margin-top: 0.25rem;
			}

			.result .chip {
				font-size: 0.8125rem;
			}

			.result .foot {
				margin-top: auto;
				padding-top: 0.75rem;
			}

			.result .visit {
				width: 100%;
				font-weight: 600;
			}

			.result.visited {
				border-color: var(--color-success);
				box-shadow: 0 0 0 1px var(--color-success);
			}

			.visited-label {
				padding: 0.5rem 0;
				color: var(--color-success);
				font-weight: 700;
				text-align: center;
			}

			.visited-label:focus {
				outline: none;
			}
		`,
	];

	protected readonly langController = new LangController(this);

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
		const heading = html`
			<h1 class="visually-hidden">${t("app.title")}</h1>
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			${isHistoryMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
		`;
		if (this.restaurants.length === 0) {
			return html`
				${heading}
				<div class="card empty">
					<p>${t("picker.empty")}</p>
					<a href="./restaurants">${t("picker.addLink")}</a>
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
		return html`
			${heading}
			${groups.length > 0 ? this.renderFilter(groups) : nothing}
			${empty ? html`<p class="no-match" role="status">${t("filter.noMatch")}</p>` : nothing}
			<p class="count muted">${this.countText()}</p>
			<button type="button" class="primary pick" ?disabled=${empty} @click=${this.pick}>
				${this.picked.length > 0 ? t("picker.again") : t("picker.button")}
			</button>
			<div aria-live="polite">${this.picked.map((item) => this.renderResult(item))}</div>
		`;
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

	private renderFilter(groups: { group: string; values: string[] }[]) {
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
		return html`
			<section class="filter" aria-labelledby="filter-title">
				<div class="filter-head">
					<h2 id="filter-title" class="filter-title">${t("filter.title")}</h2>
					<p class="hint">${t("filter.hint")}</p>
				</div>
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
			return html`<button type="button" class="primary visit" data-id=${item.id} @click=${() => this.visit(item)}>
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
						? html`<p class="location">
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
