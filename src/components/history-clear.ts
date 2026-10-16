import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
	CLEAR_RANGES,
	type ClearRange,
	countOlderThan,
	type HistoryEntry,
	loadHistory,
	onHistoryChanged,
	removeVisitsOlderThan,
} from "#lib/history";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { uiStyles } from "#styles/ui";

/** Settings rows that delete visits older than a range, or all of them, after asking. */
@customElement("history-clear")
export class HistoryClear extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 0.5rem;
			}

			.item:disabled .grow {
				color: var(--color-muted);
			}

			.cleared:empty {
				display: none;
			}

			/* Focus lands here only when no row is left to clear; it is a message, not a control. */
			.cleared:focus {
				outline: none;
			}

			.clear-prompt {
				padding: 0 1.125rem;
			}

			.clear-actions {
				padding: 0 1.125rem 1rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private history: HistoryEntry[] = [];

	/** The range whose row was pressed and now waits for confirmation. */
	@state()
	private clearing: ClearRange | undefined;

	/** What the last clear did, read out once. */
	@state()
	private status = "";

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.history = loadHistory();
		this.unsubscribe = onHistoryChanged(() => {
			this.history = loadHistory();
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	private row(range: ClearRange): HTMLButtonElement | null {
		return this.renderRoot.querySelector(`button[data-clear="${range}"]`);
	}

	private askClear(range: ClearRange): void {
		this.clearing = range;
		this.status = "";
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="clear-confirm"]'),
		);
	}

	private readonly cancelClear = (): void => {
		const range = this.clearing;
		this.clearing = undefined;
		if (range !== undefined) this.focusAfterRender(() => this.row(range));
	};

	/** Focus goes to the first row that can still clear something, else the result message. */
	private readonly confirmClear = (): void => {
		const range = this.clearing;
		if (range === undefined) return;
		const count = countOlderThan(this.history, range, new Date());
		removeVisitsOlderThan(range);
		this.clearing = undefined;
		this.status = t(`settings.cleared.${count === 1 ? "one" : "other"}`, {
			count,
		});
		this.focusAfterRender(
			() =>
				CLEAR_RANGES.map((item) => this.row(item)).find(
					(button) => button !== null && !button.disabled,
				) ?? this.renderRoot.querySelector(".cleared"),
		);
	};

	private renderPrompt(range: ClearRange) {
		const count = countOlderThan(this.history, range, new Date());
		const plural = count === 1 ? "one" : "other";
		const prompt =
			range === "all"
				? t(`history.clearAllPrompt.${plural}`, { count })
				: t(`history.clearPrompt.${plural}`, {
						count,
						range: t(`history.range.${range}`),
					});
		return html`
			<div class="group">
				<p class="clear-prompt item" role="alert">${prompt}</p>
				<div class="actions clear-actions">
					<button type="button" class="danger" data-action="clear-confirm" @click=${this.confirmClear}>
						${t("history.clearConfirm")}
					</button>
					<button type="button" data-action="clear-cancel" @click=${this.cancelClear}>
						${t("history.cancel")}
					</button>
				</div>
			</div>
		`;
	}

	override render() {
		if (this.clearing !== undefined) return this.renderPrompt(this.clearing);
		const now = new Date();
		return html`
			<ul class="group">
				${CLEAR_RANGES.map((range) => {
					const count = countOlderThan(this.history, range, now);
					return html`<li>
						<button
							type="button"
							class="item"
							data-clear=${range}
							?disabled=${count === 0}
							@click=${() => this.askClear(range)}
						>
							<span class="lead">${icon("clock", 22)}</span>
							<span class="grow">
								<b>${
									range === "all"
										? t("settings.clearAll")
										: t("settings.clearOlder", {
												range: t(`history.range.${range}`),
											})
								}</b>
							</span>
							<small class="trail">${t(`settings.visitCount.${count === 1 ? "one" : "other"}`, { count })}</small>
						</button>
					</li>`;
				})}
			</ul>
			<p class="success cleared" role="status" tabindex="-1">${this.status || nothing}</p>
		`;
	}
}
