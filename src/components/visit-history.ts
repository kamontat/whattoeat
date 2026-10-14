import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
	type HistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	onHistoryChanged,
	removeVisit,
	summarize,
} from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
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
				gap: 2rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			h1:focus {
				outline: none;
			}

			section {
				display: grid;
				gap: 0.75rem;
			}

			section > h2 {
				font-size: 1.125rem;
			}

			.table-wrap {
				overflow-x: auto;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
			}

			table {
				width: 100%;
				border-collapse: collapse;
				font-variant-numeric: tabular-nums;
			}

			th,
			td {
				padding: 0.625rem 0.875rem;
				text-align: left;
				border-bottom: 1px solid var(--color-border);
			}

			tbody tr:last-child td {
				border-bottom: 0;
			}

			th {
				font-size: 0.75rem;
				letter-spacing: 0.05em;
				text-transform: uppercase;
				color: var(--color-muted);
				font-weight: 600;
			}

			.num {
				text-align: right;
			}

			.visits {
				display: grid;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.visit {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 1rem;
			}

			.visit .what {
				flex: 1 1 12rem;
				display: grid;
				gap: 0.125rem;
			}

			.visit .name {
				font-weight: 600;
			}

			time {
				font-variant-numeric: tabular-nums;
			}

			.empty {
				justify-items: center;
				text-align: center;
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
			<h1 tabindex="-1">${t("history.title")}</h1>
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
		const dayTime = new Intl.DateTimeFormat(lang, {
			dateStyle: "medium",
			timeStyle: "short",
		});
		const total = this.history.length;
		return html`
			${heading}
			<section aria-labelledby="stats-title">
				<h2 id="stats-title">${t("history.statsTitle")}</h2>
				<p class="total">
					${total === 1 ? t("history.total.one") : t("history.total.other", { count: total })}
				</p>
				<div class="table-wrap">
					<table>
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
			<section aria-labelledby="visits-title">
				<h2 id="visits-title">${t("history.listTitle")}</h2>
				<ul class="visits">
					${repeat(
						this.history,
						(entry) => entry.id,
						(entry) => this.renderVisit(entry, dayTime),
					)}
				</ul>
			</section>
		`;
	}

	private renderVisit(entry: HistoryEntry, format: Intl.DateTimeFormat) {
		const confirming = this.confirmingId === entry.id;
		return html`
			<li class="card visit" data-id=${entry.id}>
				<div class="what">
					<span class="name">${entry.name}</span>
					<time class="muted" datetime=${entry.visitedAt}>${format.format(new Date(entry.visitedAt))}</time>
				</div>
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
							: html`<button type="button" data-action="delete" @click=${() => this.askDelete(entry.id)}>
									${t("history.delete")}
								</button>`
					}
				</div>
			</li>
		`;
	}
}
