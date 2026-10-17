import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import "#components/app-sheet";
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

/**
 * A Settings row, "Delete history", that opens a sheet to choose how far back to delete,
 * then asks before deleting. Greyed out while there is no history. It sits in the parent's
 * card, so it brings no card of its own, and reports each clear as a `history-cleared`
 * event with the number of visits deleted for the parent to show.
 */
@customElement("history-clear")
export class HistoryClear extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
			}

			.item:disabled .grow {
				color: var(--color-muted);
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private history: HistoryEntry[] = [];

	@state()
	private sheetOpen = false;

	/** The range chosen in the sheet, waiting for confirmation. */
	@state()
	private clearing: ClearRange | undefined;

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

	private readonly openSheet = (): void => {
		this.clearing = undefined;
		this.sheetOpen = true;
	};

	/** ✕, Esc, the backdrop, or a finished clear. */
	private readonly onSheetClose = (): void => {
		this.sheetOpen = false;
		this.clearing = undefined;
	};

	private askClear(range: ClearRange): void {
		this.clearing = range;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="clear-confirm"]'),
		);
	}

	private readonly cancelClear = (): void => {
		const range = this.clearing;
		this.clearing = undefined;
		if (range !== undefined)
			this.focusAfterRender(() =>
				this.renderRoot.querySelector(`button[data-clear="${range}"]`),
			);
	};

	/** The sheet hands focus back to the row; the parent moves it on if the row greyed out. */
	private readonly confirmClear = (): void => {
		const range = this.clearing;
		if (range === undefined) return;
		const count = countOlderThan(this.history, range, new Date());
		removeVisitsOlderThan(range);
		this.clearing = undefined;
		this.sheetOpen = false;
		this.dispatchEvent(
			new CustomEvent("history-cleared", {
				detail: { count },
				bubbles: true,
				composed: true,
			}),
		);
	};

	private renderRanges() {
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
		`;
	}

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

	override render() {
		return html`
			<button
				type="button"
				class="item"
				data-action="clear-history"
				aria-haspopup="dialog"
				?disabled=${this.history.length === 0}
				@click=${this.openSheet}
			>
				<span class="lead">${icon("clock", 22)}</span>
				<span class="grow"><b>${t("settings.clearHistory")}</b></span>
				<span class="trail">${icon("chevron", 18)}</span>
			</button>
			<app-sheet heading=${t("settings.clearHistory")} ?open=${this.sheetOpen} @sheet-close=${this.onSheetClose}>
				${
					this.clearing === undefined
						? this.renderRanges()
						: this.renderPrompt(this.clearing)
				}
			</app-sheet>
		`;
	}
}
