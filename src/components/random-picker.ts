import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
	applyFilter,
	cycleTag,
	EMPTY_FILTER,
	isFilterActive,
	loadFilter,
	pruneFilter,
	saveFilter,
	type TagFilter,
	type TagState,
	tagState,
} from "#lib/filter";
import { addLock } from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
import { pickOptions } from "#lib/random";
import { isLink, type Restaurant, tagsByUsage } from "#lib/restaurant";
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
				gap: 1.5rem;
				justify-items: center;
				padding-top: 2rem;
				text-align: center;
			}

			.pick {
				padding: 1.25rem 2rem;
				font-size: 1.5rem;
				font-weight: 700;
				border-radius: 999px;
			}

			[aria-live] {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
				gap: 1rem;
				width: 100%;
			}

			.result,
			.empty {
				width: 100%;
				box-sizing: border-box;
				justify-items: center;
			}

			.result h2 {
				font-size: 1.75rem;
			}

			.result .chips {
				justify-content: center;
			}

			.notes {
				white-space: pre-wrap;
			}

			.filter {
				display: grid;
				gap: 0.5rem;
				width: 100%;
				justify-items: center;
			}

			.filter-title {
				font-size: 1rem;
			}

			.filter .chips {
				justify-content: center;
			}

			button.tag {
				padding: 0.25rem 0.75rem;
				font-size: 0.875rem;
			}

			button.tag.include {
				border-color: var(--color-success);
				color: var(--color-success);
				font-weight: 700;
			}

			button.tag.exclude {
				border-color: var(--color-danger);
				color: var(--color-danger);
				text-decoration: line-through;
			}

			button.link {
				padding: 0;
				border: 0;
				background: none;
				color: var(--color-primary);
				text-decoration: underline;
			}

			.pick:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.result.locked {
				border-color: var(--color-success);
				box-shadow: 0 0 0 1px var(--color-success);
			}

			.locked-label {
				color: var(--color-success);
				font-weight: 700;
			}

			.locked-label:focus {
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

	/** The options from the last press, emptied when none of them are left in the pool. */
	@state()
	private picked: Restaurant[] = [];

	/** The card the user chose with "Eat here" for this pick, and when. */
	@state()
	private locked: { id: string; at: Date } | undefined;

	private unsubscribe: (() => void) | undefined;

	@state()
	private filter: TagFilter = EMPTY_FILTER;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		this.filter = loadFilter();
		this.pruneFilter();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			this.skipped = skippedCount();
			this.pruneFilter();
			this.keepPickInPool();
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private get pool(): Restaurant[] {
		return applyFilter(this.restaurants, this.filter);
	}

	/** Drop filter tags no restaurant uses any more; save only when that changed something. */
	private pruneFilter(): void {
		const pruned = pruneFilter(this.filter, tagsByUsage(this.restaurants));
		if (
			pruned.include.length !== this.filter.include.length ||
			pruned.exclude.length !== this.filter.exclude.length
		) {
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
		if (!this.picked.some((item) => item.id === this.locked?.id))
			this.locked = undefined;
	}

	private setFilter(next: TagFilter): void {
		this.filter = next;
		saveFilter(next);
		this.keepPickInPool();
	}

	private readonly clearFilter = (): void => {
		this.setFilter(EMPTY_FILTER);
	};

	private readonly pick = (): void => {
		this.locked = undefined;
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
		const tags = tagsByUsage(this.restaurants);
		const empty = this.pool.length === 0;
		return html`
			${heading}
			${tags.length > 0 ? this.renderFilter(tags) : nothing}
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

	private renderFilter(tags: string[]) {
		const symbol: Record<TagState, string> = {
			off: "",
			include: "✓ ",
			exclude: "✕ ",
		};
		const summary = [
			...this.filter.include.map((tag) => `${symbol.include}${tag}`),
			...this.filter.exclude.map((tag) => `${symbol.exclude}${tag}`),
		].join(", ");
		return html`
			<section class="filter" aria-labelledby="filter-title">
				<h2 id="filter-title" class="filter-title">${t("filter.title")}</h2>
				<p class="hint">${t("filter.hint")}</p>
				<ul class="chips">
					${tags.map((tag) => {
						const state = tagState(this.filter, tag);
						return html`<li>
							<button
								type="button"
								class="chip tag ${state}"
								data-tag=${tag}
								data-state=${state}
								aria-pressed=${state === "off" ? "false" : "true"}
								aria-label=${t("filter.tagState", { tag, state: t(`filter.state.${state}`) })}
								@click=${() => this.setFilter(cycleTag(this.filter, tag))}
							>
								${symbol[state]}${tag}
							</button>
						</li>`;
					})}
				</ul>
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

	private lock(item: Restaurant): void {
		// A second press before the re-render must not save a second lock.
		if (this.locked !== undefined) return;
		const entry = addLock(item);
		this.locked = { id: item.id, at: new Date(entry.lockedAt) };
		// The pressed button is gone after the render, so move focus to the label that replaced it.
		void this.updateComplete.then(() => {
			this.renderRoot.querySelector<HTMLElement>(".locked-label")?.focus();
		});
	}

	private renderLock(item: Restaurant) {
		if (this.locked === undefined)
			return html`<button type="button" class="primary lock" data-id=${item.id} @click=${() => this.lock(item)}>
				${t("picker.lock")}
			</button>`;
		if (this.locked.id !== item.id) return nothing;
		const time = new Intl.DateTimeFormat(getLang(), {
			hour: "2-digit",
			minute: "2-digit",
		}).format(this.locked.at);
		return html`<p class="locked-label" tabindex="-1">${t("picker.locked", { time })}</p>`;
	}

	private renderResult(item: Restaurant) {
		return html`
			<article class="card result ${this.locked?.id === item.id ? "locked" : ""}">
				<h2>${item.name}</h2>
				${
					item.tags.length > 0
						? html`<ul class="chips">${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}</ul>`
						: nothing
				}
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
				${this.renderLock(item)}
			</article>
		`;
	}
}
