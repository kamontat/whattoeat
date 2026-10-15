import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import "#components/app-footer";
import "#components/app-preferences";
import {
	type GroupDef,
	isGroupsMemoryOnly,
	loadGroups,
	mergeGroupDefs,
	onGroupsChanged,
	remapGroups,
	saveGroups,
} from "#lib/groups";
import {
	type HistoryEntry,
	isHistoryMemoryOnly,
	loadHistory,
	saveHistory,
} from "#lib/history";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
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
				gap: 1.25rem;
				max-width: 40rem;
				margin: 0 auto;
			}

			section {
				display: grid;
				gap: 0.5rem;
			}

			.file input {
				position: absolute;
				width: 1px;
				height: 1px;
				opacity: 0;
			}

			.file:focus-within {
				outline: 3px solid var(--color-focus);
				outline-offset: -3px;
			}

			summary.item {
				cursor: pointer;
				list-style: none;
			}

			summary.item::-webkit-details-marker {
				display: none;
			}

			details[open] summary .trail {
				transform: rotate(90deg);
			}

			.paste-body {
				display: grid;
				gap: 0.625rem;
				padding: 0 1.125rem 1rem;
			}

			textarea {
				font-family: ui-monospace, monospace;
				font-size: 0.875rem;
			}

			.reset-prompt {
				padding: 0 1.125rem;
			}

			.reset-actions {
				padding: 0 1.125rem 1rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private count = 0;

	/** Stored entries the last load could not read. */
	@state()
	private skipped = 0;

	/**
	 * A checked import waiting for Replace or Merge; `history` is `undefined` for a version 1
	 * file, `groups` for a version 1–3 file.
	 */
	@state()
	private pending:
		| {
				restaurants: Restaurant[];
				history: HistoryEntry[] | undefined;
				groups: GroupDef[] | undefined;
		  }
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
	private unsubscribeGroups: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.count = loadRestaurants().length;
		this.skipped = skippedCount();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.count = loadRestaurants().length;
			this.skipped = skippedCount();
		});
		// A group list the browser refused to store turns the storage warning on.
		this.unsubscribeGroups = onGroupsChanged(() => this.requestUpdate());
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.unsubscribeGroups?.();
		this.unsubscribeGroups = undefined;
	}

	/** Validate an export file's text and hold it until the user picks Replace or Merge. */
	readImport(text: string): void {
		const result = parseImport(text);
		this.imported = undefined;
		if (result.ok) {
			this.pending = {
				restaurants: result.restaurants,
				history: result.history,
				groups: result.groups,
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
		const json = exportJson(
			loadRestaurants(),
			loadHistory(),
			loadGroups(),
			now,
			{
				pretty: true,
			},
		);
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
		const json = exportJson(
			restaurants,
			loadHistory(),
			loadGroups(),
			new Date(),
			{
				pretty: false,
			},
		);
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
		const { restaurants, history, groups } = this.pending;
		let incoming = restaurants;
		let persisted = true;
		// Groups first, so loading restaurants after the save already knows every group id.
		// A file without a group list (versions 1–3) keeps the current groups.
		if (groups !== undefined) {
			const next =
				mode === "replace"
					? { groups, remap: {} }
					: mergeGroupDefs(loadGroups(), groups);
			incoming = remapGroups(restaurants, next.remap);
			persisted = saveGroups(next.groups);
		}
		const list =
			mode === "replace"
				? incoming
				: mergeRestaurants(loadRestaurants(), incoming);
		persisted = saveRestaurants(list) && persisted;
		// A version 1 file has no history, so the saved history stays as it is.
		if (history !== undefined) {
			const visits =
				mode === "replace" ? history : mergeHistory(loadHistory(), history);
			persisted = saveHistory(visits) && persisted;
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
				<div class="group">
					<p class="reset-prompt item" role="alert">${t("settings.resetPrompt", { count: this.count })}</p>
					<div class="actions reset-actions">
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
				</div>
			`;
		return html`
			<div class="group">
				<button
					type="button"
					class="item danger"
					data-action="reset"
					@click=${() => {
						this.reset = "confirm";
					}}
				>
					<span class="lead">${icon("trash", 22)}</span>
					<span class="grow"><b>${t("settings.reset")}</b></span>
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
			<h1 class="page-title">${t("settings.title")}</h1>
			${isMemoryOnly() || isHistoryMemoryOnly() || isGroupsMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			<section class="appearance" aria-labelledby="appearance-title">
				<h2 id="appearance-title" class="group-label">${t("settings.appearance")}</h2>
				<app-preferences></app-preferences>
			</section>
			<section class="export" aria-labelledby="export-title">
				<h2 id="export-title" class="group-label">${t("settings.exportTitle")}</h2>
				<div class="group">
					<button type="button" class="item" data-action="export" @click=${this.exportData}>
						<span class="lead">${icon("download", 22)}</span>
						<span class="grow">
							<b>${t("settings.export")}</b>
							<small class="count">${t("settings.count", { count: this.count })}</small>
						</span>
					</button>
					<button type="button" class="item" data-action="copy" @click=${this.copyData}>
						<span class="lead">${icon("copy", 22)}</span>
						<span class="grow"><b>${t("settings.copy")}</b></span>
					</button>
				</div>
				${this.renderCopied()}
			</section>
			<section class="import" aria-labelledby="import-title">
				<h2 id="import-title" class="group-label">${t("settings.importTitle")}</h2>
				<div class="group">
					<label class="item file">
						<span class="lead">${icon("upload", 22)}</span>
						<span class="grow"><b>${t("settings.importFile")}</b></span>
						<span class="trail">${icon("chevron", 20)}</span>
						<input type="file" accept="application/json,.json" @change=${this.onFile} />
					</label>
					<details class="paste-row">
						<summary class="item">
							<span class="lead">${icon("copy", 22)}</span>
							<span class="grow"><b>${t("settings.pasteLabel")}</b></span>
							<span class="trail">${icon("chevron", 20)}</span>
						</summary>
						<div class="paste-body">
							<textarea
								class="paste"
								rows="4"
								spellcheck="false"
								aria-label=${t("settings.pasteLabel")}
								.value=${live(this.pasteText)}
								@input=${(event: Event) => {
									this.pasteText = (event.target as HTMLTextAreaElement).value;
								}}
							></textarea>
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
						</div>
					</details>
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
			<section class="reset" aria-labelledby="reset-title">
				<h2 id="reset-title" class="group-label">${t("settings.resetTitle")}</h2>
				${this.renderReset()}
			</section>
			<section class="about" aria-labelledby="about-title">
				<h2 id="about-title" class="group-label">${t("settings.about")}</h2>
				<app-footer></app-footer>
			</section>
		`;
	}
}
