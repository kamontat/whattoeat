import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
	groupByDay,
	type HistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	onHistoryChanged,
	relativeDay,
	removeVisit,
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
				min-height: var(--tap);
				padding: 0 0.75rem;
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
					<a class="button-link" href="./">${t("history.emptyLink")}</a>
				</div>
			`;
		const lang = getLang();
		const day = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
		const time = new Intl.DateTimeFormat(lang, { timeStyle: "short" });
		const total = this.history.length;
		return html`
			${heading}
			<section class="stats card">
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
					({ day: date, entries }) => html`<div class="day">
						<h3 class="group-label">${this.dayLabel(date, day)}</h3>
						<ul class="group visits">
							${repeat(
								entries,
								(entry) => entry.id,
								(entry) => this.renderVisit(entry, time),
							)}
						</ul>
					</div>`,
				)}
			</section>
		`;
	}

	/** Today, Yesterday, or the date. */
	private dayLabel(date: Date, format: Intl.DateTimeFormat): string {
		const relative = relativeDay(date, new Date());
		if (relative === "today") return t("history.today");
		if (relative === "yesterday") return t("history.yesterday");
		return format.format(date);
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
