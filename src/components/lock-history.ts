import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
	type HistoryEntry,
	loadHistory,
	onHistoryChanged,
	removeLock,
	summarize,
} from "#lib/history";
import { getLang, LangController, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged } from "#lib/store";
import { uiStyles } from "#styles/ui";

@customElement("lock-history")
export class LockHistory extends LitElement {
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

			.locks {
				display: grid;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.lock {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 1rem;
			}

			.lock .what {
				flex: 1 1 12rem;
				display: grid;
				gap: 0.125rem;
			}

			.lock .name {
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

	/** The lock whose Delete was pressed and now waits for confirmation. */
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
	private focusAfterRender(id: string, action: string): void {
		void this.updateComplete.then(() => {
			this.renderRoot
				.querySelector<HTMLElement>(
					`li[data-id="${id}"] [data-action="${action}"]`,
				)
				?.focus();
		});
	}

	private askDelete(id: string): void {
		this.confirmingId = id;
		this.focusAfterRender(id, "confirm-delete");
	}

	private cancelDelete(id: string): void {
		this.confirmingId = undefined;
		this.focusAfterRender(id, "delete");
	}

	private confirmDelete(id: string): void {
		this.confirmingId = undefined;
		removeLock(id);
	}

	override render() {
		const heading = html`<h1>${t("history.title")}</h1>`;
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
									<td>${day.format(new Date(row.lastLockedAt))}</td>
								</tr>`,
							)}
						</tbody>
					</table>
				</div>
			</section>
			<section aria-labelledby="locks-title">
				<h2 id="locks-title">${t("history.listTitle")}</h2>
				<ul class="locks">
					${this.history.map((entry) => this.renderLock(entry, dayTime))}
				</ul>
			</section>
		`;
	}

	private renderLock(entry: HistoryEntry, format: Intl.DateTimeFormat) {
		const confirming = this.confirmingId === entry.id;
		return html`
			<li class="card lock" data-id=${entry.id}>
				<div class="what">
					<span class="name">${entry.name}</span>
					<time class="muted" datetime=${entry.lockedAt}>${format.format(new Date(entry.lockedAt))}</time>
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
