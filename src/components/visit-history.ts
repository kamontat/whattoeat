import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
	CLEAR_RANGES,
	type ClearRange,
	countOlderThan,
	groupByDay,
	type HistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	onHistoryChanged,
	relativeDay,
	removeVisit,
	removeVisitsOlderThan,
	summarize,
} from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import type { Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged } from "#lib/store";
import { uiStyles } from "#styles/ui";

@customElement("visit-history")
export class VisitHistory extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.25rem;
			}

			h1:focus {
				outline: none;
			}

			section {
				display: grid;
				gap: 0.5rem;
			}

			section > h2 {
				font-size: 1rem;
				font-weight: 600;
			}

			.stats {
				gap: 0.75rem;
			}

			.table-wrap {
				overflow-x: auto;
			}

			table {
				width: 100%;
				border-collapse: collapse;
				font-size: 0.9375rem;
			}

			th,
			td {
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid var(--color-border);
				text-align: start;
				white-space: nowrap;
			}

			th {
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-weight: 500;
			}

			.num {
				text-align: end;
			}

			tbody tr:last-child td {
				border-bottom: 0;
			}

			.visit .item {
				justify-content: space-between;
			}

			.visit time {
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.visit .actions {
				flex: none;
				flex-wrap: nowrap;
			}

			.visit button {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				font-size: 0.875rem;
			}

			.clear .actions button {
				min-height: 2.25rem;
				font-size: 0.875rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private history: HistoryEntry[] = [];

	@state()
	private restaurants: Restaurant[] = [];

	/** The visit whose Delete was pressed and now waits for confirmation. */
	@state()
	private confirmingId: string | undefined;

	/** The clear range whose button was pressed and now waits for confirmation. */
	@state()
	private clearing: ClearRange | undefined;

	private unsubscribe: (() => void)[] = [];

	override connectedCallback(): void {
		super.connectedCallback();
		this.history = loadHistory();
		this.restaurants = loadRestaurants();
		this.unsubscribe = [
			onHistoryChanged(() => {
				this.history = loadHistory();
			}),
			onRestaurantsChanged(() => {
				this.restaurants = loadRestaurants();
			}),
		];
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		for (const off of this.unsubscribe) off();
		this.unsubscribe = [];
	}

	/** Swapping a row's buttons removes the focused one, so move focus to its replacement. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	/** Found by walking the rows, so an imported id with quotes cannot break a selector. */
	private rowAction(id: string, action: string): Element | undefined {
		const row = [...this.renderRoot.querySelectorAll("li[data-id]")].find(
			(item) => item.getAttribute("data-id") === id,
		);
		return row?.querySelector(`[data-action="${action}"]`) ?? undefined;
	}

	private askDelete(id: string): void {
		this.confirmingId = id;
		this.focusAfterRender(() => this.rowAction(id, "confirm-delete"));
	}

	private cancelDelete(id: string): void {
		this.confirmingId = undefined;
		this.focusAfterRender(() => this.rowAction(id, "delete"));
	}

	/** Focus goes to the next visit's Delete, else the previous one's, else the heading. */
	private confirmDelete(id: string): void {
		this.confirmingId = undefined;
		const index = this.history.findIndex((entry) => entry.id === id);
		const neighbour = this.history[index + 1] ?? this.history[index - 1];
		removeVisit(id);
		this.focusAfterRender(() =>
			neighbour === undefined
				? this.renderRoot.querySelector("h1")
				: this.rowAction(neighbour.id, "delete"),
		);
	}

	private askClear(range: ClearRange): void {
		this.clearing = range;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="clear-confirm"]'),
		);
	}

	private cancelClear(): void {
		const range = this.clearing;
		this.clearing = undefined;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(`[data-clear="${range}"]`),
		);
	}

	private confirmClear(): void {
		if (this.clearing === undefined) return;
		removeVisitsOlderThan(this.clearing);
		this.clearing = undefined;
		this.focusAfterRender(() => this.renderRoot.querySelector("h1"));
	}

	override render() {
		const heading = html`
			<h1 class="page-title" tabindex="-1">${t("history.title")}</h1>
			${isHistoryMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
		`;
		if (this.history.length === 0)
			return html`
				${heading}
				<div class="card empty">
					<p>${t("history.empty")}</p>
					<a href="./">${t("history.emptyLink")}</a>
				</div>
			`;
		const lang = getLang();
		const day = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
		const time = new Intl.DateTimeFormat(lang, { timeStyle: "short" });
		const total = this.history.length;
		return html`
			${heading}
			<section class="stats card" aria-labelledby="stats-title">
				<h2 id="stats-title">${t("history.statsTitle")}</h2>
				<p class="total muted">
					${total === 1 ? t("history.total.one") : t("history.total.other", { count: total })}
				</p>
				<div class="table-wrap" role="region" tabindex="0" aria-labelledby="stats-title">
					<table>
						<caption class="visually-hidden">${t("history.statsTitle")}</caption>
						<thead>
							<tr>
								<th scope="col">${t("history.colRestaurant")}</th>
								<th scope="col" class="num">${t("history.colTimes")}</th>
								<th scope="col">${t("history.colLast")}</th>
							</tr>
						</thead>
						<tbody>
							${summarize(this.history, this.restaurants).map(
								(row) => html`<tr>
									<td>${row.name}${row.deleted ? html` <span class="muted">${t("history.deleted")}</span>` : nothing}</td>
									<td class="num">${row.count}</td>
									<td>${day.format(new Date(row.lastVisitedAt))}</td>
								</tr>`,
							)}
						</tbody>
					</table>
				</div>
			</section>
			<section class="visits-list" aria-labelledby="visits-title">
				<h2 id="visits-title">${t("history.listTitle")}</h2>
				${groupByDay(this.history).map(
					({
						key,
						day: date,
						entries,
					}) => html`<section class="day" aria-labelledby="day-${key}">
						<h3 id="day-${key}" class="group-label">${this.dayLabel(date, day)}</h3>
						<ul class="group visits">
							${repeat(
								entries,
								(entry) => entry.id,
								(entry) => this.renderVisit(entry, time),
							)}
						</ul>
					</section>`,
				)}
			</section>
			${this.renderClear()}
		`;
	}

	/** Today, Yesterday, or the date. */
	private dayLabel(date: Date, format: Intl.DateTimeFormat): string {
		const relative = relativeDay(date, new Date());
		if (relative === "today") return t("history.today");
		if (relative === "yesterday") return t("history.yesterday");
		return format.format(date);
	}

	private renderClear() {
		const now = new Date();
		const counts = new Map(
			CLEAR_RANGES.map((range) => [
				range,
				countOlderThan(this.history, range, now),
			]),
		);
		const label = (range: ClearRange) =>
			range === "all"
				? t("history.clearAll")
				: t("history.clearOlder", { range: t(`history.range.${range}`) });
		return html`
			<section class="clear card" aria-labelledby="clear-title">
				<h2 id="clear-title">${t("history.clearTitle")}</h2>
				${
					this.clearing === undefined
						? html`<div class="actions">
								${CLEAR_RANGES.map(
									(range) => html`<button
										type="button"
										data-clear=${range}
										?disabled=${counts.get(range) === 0}
										@click=${() => this.askClear(range)}
									>
										${label(range)} (${counts.get(range)})
									</button>`,
								)}
							</div>`
						: this.renderClearPrompt(
								this.clearing,
								counts.get(this.clearing) ?? 0,
							)
				}
			</section>
		`;
	}

	private renderClearPrompt(range: ClearRange, count: number) {
		const plural = count === 1 ? "one" : "other";
		const prompt =
			range === "all"
				? t(`history.clearAllPrompt.${plural}`, { count })
				: t(`history.clearPrompt.${plural}`, {
						count,
						range: t(`history.range.${range}`),
					});
		return html`
			<p class="clear-prompt" role="alert">${prompt}</p>
			<div class="actions">
				<button type="button" class="danger" data-action="clear-confirm" @click=${this.confirmClear}>
					${t("history.clearConfirm")}
				</button>
				<button type="button" data-action="clear-cancel" @click=${this.cancelClear}>
					${t("history.cancel")}
				</button>
			</div>
		`;
	}

	private renderVisit(entry: HistoryEntry, format: Intl.DateTimeFormat) {
		const confirming = this.confirmingId === entry.id;
		const time = format.format(new Date(entry.visitedAt));
		return html`
			<li class="visit" data-id=${entry.id}>
				<div class="item">
					<span class="grow">
						<b class="name">${entry.name}</b>
						<time datetime=${entry.visitedAt}>${time}</time>
					</span>
					<div class="actions">
						${
							confirming
								? html`
										<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(entry.id)}>
											${t("history.confirmDelete")}
										</button>
										<button type="button" data-action="cancel-delete" @click=${() => this.cancelDelete(entry.id)}>
											${t("history.cancel")}
										</button>
									`
								: html`<button
										type="button"
										class="quiet"
										data-action="delete"
										aria-label=${t("history.deleteVisit", { name: entry.name, time })}
										@click=${() => this.askDelete(entry.id)}
									>
										${icon("trash", 18)}<span>${t("history.delete")}</span>
									</button>`
						}
					</div>
				</div>
			</li>
		`;
	}
}
