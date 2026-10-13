import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
	type HistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	saveHistory,
} from "#lib/history";
import { LangController, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import {
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	resetStorage,
	saveRestaurants,
	skippedCount,
} from "#lib/store";
import {
	exportFileName,
	exportJson,
	type ImportError,
	mergeHistory,
	mergeRestaurants,
	parseImport,
} from "#lib/transfer";
import { uiStyles } from "#styles/ui";

@customElement("data-transfer")
export class DataTransferPanel extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.5rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			h2 {
				font-size: 1.125rem;
			}

			input[type="file"] {
				padding: 0.5rem;
			}

			textarea {
				font-family: ui-monospace, monospace;
				font-size: 0.875rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private count = 0;

	/** Stored entries the last load could not read. */
	@state()
	private skipped = 0;

	/** A checked import waiting for Replace or Merge; `history` is `undefined` for a version 1 file. */
	@state()
	private pending:
		| { restaurants: Restaurant[]; history: HistoryEntry[] | undefined }
		| undefined;

	@state()
	private error: ImportError | undefined;

	@state()
	private imported: number | undefined;

	/** Result of the last copy: a count when it worked, the JSON to copy by hand when it did not. */
	@state()
	private copied: { count: number } | { fallback: string } | undefined;

	@state()
	private pasteText = "";

	/** "confirm" while the reset prompt is open, "done" after everything was deleted. */
	@state()
	private reset: "confirm" | "done" | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.count = loadRestaurants().length;
		this.skipped = skippedCount();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.count = loadRestaurants().length;
			this.skipped = skippedCount();
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	/** Validate an export file's text and hold it until the user picks Replace or Merge. */
	readImport(text: string): void {
		const result = parseImport(text);
		this.imported = undefined;
		if (result.ok) {
			this.pending = {
				restaurants: result.restaurants,
				history: result.history,
			};
			this.error = undefined;
		} else {
			this.pending = undefined;
			this.error = result.error;
		}
	}

	private readonly onFile = async (event: Event): Promise<void> => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		// Clear so choosing the same file again fires another change event.
		input.value = "";
		let text: string;
		try {
			text = await file.text();
		} catch {
			this.pending = undefined;
			this.imported = undefined;
			this.error = "import.error.read";
			return;
		}
		this.readImport(text);
	};

	private readonly exportData = (): void => {
		const now = new Date();
		const json = exportJson(loadRestaurants(), loadHistory(), now, {
			pretty: true,
		});
		const url = URL.createObjectURL(
			new Blob([json], { type: "application/json" }),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = exportFileName(now);
		link.click();
		// Revoking at once can cancel the download in some browsers.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	private readonly copyData = async (): Promise<void> => {
		const restaurants = loadRestaurants();
		const json = exportJson(restaurants, loadHistory(), new Date(), {
			pretty: false,
		});
		try {
			// The clipboard is missing outside secure contexts and can be refused by permission.
			if (!navigator.clipboard) throw new Error("no clipboard");
			await navigator.clipboard.writeText(json);
			this.copied = { count: restaurants.length };
		} catch {
			this.copied = { fallback: json };
		}
	};

	private readonly selectAll = (event: Event): void => {
		(event.target as HTMLTextAreaElement).select();
	};

	private apply(mode: "replace" | "merge"): void {
		if (this.pending === undefined) return;
		const { restaurants, history } = this.pending;
		const list =
			mode === "replace"
				? restaurants
				: mergeRestaurants(loadRestaurants(), restaurants);
		let persisted = saveRestaurants(list);
		// A version 1 file has no history, so the saved history stays as it is.
		if (history !== undefined) {
			const locks =
				mode === "replace" ? history : mergeHistory(loadHistory(), history);
			persisted = saveHistory(locks) && persisted;
		}
		this.pending = undefined;
		this.pasteText = "";
		this.imported = persisted ? list.length : undefined;
	}

	private readonly confirmReset = (): void => {
		resetStorage();
		this.pending = undefined;
		this.error = undefined;
		this.imported = undefined;
		this.copied = undefined;
		this.pasteText = "";
		this.reset = "done";
	};

	private renderReset() {
		if (this.reset === "confirm")
			return html`
				<p class="reset-prompt" role="alert">${t("settings.resetPrompt", { count: this.count })}</p>
				<div class="actions">
					<button type="button" class="danger" data-action="reset-confirm" @click=${this.confirmReset}>
						${t("settings.resetConfirm")}
					</button>
					<button
						type="button"
						data-action="reset-cancel"
						@click=${() => {
							this.reset = undefined;
						}}
					>
						${t("settings.cancel")}
					</button>
				</div>
			`;
		return html`
			<div class="actions">
				<button
					type="button"
					class="danger"
					data-action="reset"
					@click=${() => {
						this.reset = "confirm";
					}}
				>
					${t("settings.reset")}
				</button>
			</div>
			${
				this.reset === "done"
					? html`<p class="success reset-done" role="status">${t("settings.resetDone")}</p>`
					: nothing
			}
		`;
	}

	private renderCopied() {
		if (this.copied === undefined) return nothing;
		if ("count" in this.copied)
			return html`<p class="success copied" role="status">
				${t("settings.copied", { count: this.copied.count })}
			</p>`;
		return html`
			<p class="error copy-failed" role="alert">${t("settings.copyFailed")}</p>
			<textarea class="copy-fallback" rows="4" readonly .value=${this.copied.fallback} @focus=${this.selectAll}></textarea>
		`;
	}

	override render() {
		return html`
			<h1>${t("settings.title")}</h1>
			<p class="count">${t("settings.count", { count: this.count })}</p>
			${isMemoryOnly() || isHistoryMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			<section class="card">
				<h2>${t("settings.exportTitle")}</h2>
				<div class="actions">
					<button type="button" class="primary" data-action="export" @click=${this.exportData}>
						${t("settings.export")}
					</button>
					<button type="button" data-action="copy" @click=${this.copyData}>
						${t("settings.copy")}
					</button>
				</div>
				${this.renderCopied()}
			</section>
			<section class="card">
				<h2>${t("settings.importTitle")}</h2>
				<label>
					${t("settings.importFile")}
					<input type="file" accept="application/json,.json" @change=${this.onFile} />
				</label>
				<label>
					${t("settings.pasteLabel")}
					<textarea
						class="paste"
						rows="4"
						spellcheck="false"
						.value=${live(this.pasteText)}
						@input=${(event: Event) => {
							this.pasteText = (event.target as HTMLTextAreaElement).value;
						}}
					></textarea>
				</label>
				<div class="actions">
					<button
						type="button"
						data-action="check-paste"
						?disabled=${this.pasteText.trim() === ""}
						@click=${() => this.readImport(this.pasteText)}
					>
						${t("settings.pasteCheck")}
					</button>
				</div>
				${this.error ? html`<p class="error" role="alert">${t(this.error)}</p>` : nothing}
				${
					this.pending
						? html`
								<p class="found">${t("settings.importFound", { count: this.pending.restaurants.length })}</p>
								<div class="actions">
									<button type="button" class="danger" data-action="replace" @click=${() => this.apply("replace")}>
										${t("settings.replace")}
									</button>
									<button type="button" class="primary" data-action="merge" @click=${() => this.apply("merge")}>
										${t("settings.merge")}
									</button>
									<button
										type="button"
										data-action="cancel-import"
										@click=${() => {
											this.pending = undefined;
										}}
									>
										${t("settings.cancel")}
									</button>
								</div>
							`
						: nothing
				}
				${
					this.imported === undefined
						? nothing
						: html`<p class="success" role="status">${t("settings.imported", { count: this.imported })}</p>`
				}
			</section>
			<section class="card">
				<h2>${t("settings.resetTitle")}</h2>
				${this.renderReset()}
			</section>
		`;
	}
}
