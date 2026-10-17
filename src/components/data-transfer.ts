import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import "#components/app-footer";
import "#components/app-preferences";
import "#components/history-clear";
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
import {
	fetchIndex,
	loadAddedPresets,
	type PresetIndex,
	presetState,
	saveAddedPresets,
} from "#lib/presets";
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

type DeleteKind = "restaurants" | "history" | "all";

/** The class of each delete's result line, by what was deleted. */
const DONE_CLASS: Record<DeleteKind, string> = {
	restaurants: "clear-restaurants-done",
	history: "clear-history-done",
	all: "reset-done",
};

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

			.item:disabled .grow {
				color: var(--color-muted);
			}

			/* This card holds rows from two components, so it draws their dividers itself. */
			.deletes > * + * {
				border-top: 1px solid var(--color-border);
			}

			/* Focus lands here once a delete greys its row out; it is a message, not a control. */
			.deleted:focus {
				outline: none;
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

			.paste-body {
				display: grid;
				gap: 0.625rem;
				padding: 0 1.125rem 1rem;
			}

			textarea {
				font-family: ui-monospace, monospace;
				font-size: 0.875rem;
			}

			.confirm {
				display: grid;
				gap: 0.75rem;
				padding: 1rem 1.125rem;
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

	/** The bundled neighbourhood index, for the presets row's subtitle; `undefined` until it
	 * loads or if it fails to. */
	@state()
	private presetIndex: PresetIndex | undefined;

	@state()
	private imported: number | undefined;

	/** Result of the last copy: a count when it worked, the JSON to copy by hand when it did not. */
	@state()
	private copied: { count: number } | { fallback: string } | undefined;

	@state()
	private pasteText = "";

	/** True once reading the clipboard failed, so the JSON has to be pasted by hand. */
	@state()
	private pasteByHand = false;

	/** Which delete row has its prompt open in the Delete card. */
	@state()
	private confirming: "restaurants" | "all" | undefined;

	/** What the last delete did, shown under the Delete card until another delete starts. */
	@state()
	private deleted: { kind: DeleteKind; message: string } | undefined;

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
		void this.loadPresetIndex();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.unsubscribeGroups?.();
		this.unsubscribeGroups = undefined;
	}

	/** Runs `find` after the next render and focuses what it returns, for actions that change which controls are shown. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	/**
	 * Validate an export file's text and hold it until the user picks Replace or Merge. With
	 * nothing saved yet there is nothing to lose, so it is saved at once without asking.
	 */
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
			const empty =
				loadRestaurants().length === 0 &&
				loadHistory().length === 0 &&
				loadGroups().length === 0;
			if (empty) this.apply("replace");
		} else {
			this.pending = undefined;
			this.error = result.error;
		}
	}

	/** Fetch the bundled neighbourhood index for the presets row's subtitle; silent on failure. */
	private async loadPresetIndex(): Promise<void> {
		try {
			this.presetIndex = await fetchIndex("./");
		} catch {
			this.presetIndex = undefined;
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

	/** Read the export straight from the clipboard; open the paste box when the browser will not. */
	private readonly pasteData = async (): Promise<void> => {
		let text = "";
		try {
			// The clipboard is missing outside secure contexts and can be refused by permission.
			if (!navigator.clipboard?.readText) throw new Error("no clipboard");
			text = await navigator.clipboard.readText();
		} catch {
			// Fall through to the paste box.
		}
		if (text.trim() === "") {
			this.pasteByHand = true;
			this.focusAfterRender(() =>
				this.renderRoot.querySelector("textarea.paste"),
			);
			return;
		}
		this.readImport(text);
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
		this.pasteByHand = false;
		this.imported = persisted ? list.length : undefined;
	}

	/** Open a delete row's prompt in place, dropping the last result. */
	private ask(row: "restaurants" | "all"): void {
		this.confirming = row;
		this.deleted = undefined;
		const confirm =
			row === "all" ? "reset-confirm" : "clear-restaurants-confirm";
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(`[data-action="${confirm}"]`),
		);
	}

	private readonly cancelDelete = (): void => {
		const row = this.confirming;
		this.confirming = undefined;
		const action = row === "all" ? "reset" : "clear-restaurants";
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(`[data-action="${action}"]`),
		);
	};

	/** Show what a delete did under the card; when its row greyed out, focus lands there. */
	private report(kind: DeleteKind, message: string, focus: boolean): void {
		this.deleted = { kind, message };
		if (focus)
			this.focusAfterRender(() => this.renderRoot.querySelector(".deleted"));
	}

	private readonly confirmReset = (): void => {
		resetStorage();
		this.pending = undefined;
		this.error = undefined;
		this.imported = undefined;
		this.copied = undefined;
		this.pasteText = "";
		this.pasteByHand = false;
		this.confirming = undefined;
		this.report("all", t("settings.resetDone"), false);
	};

	/**
	 * Empty the restaurant list and forget which presets were added, so every preset reads as
	 * new again. History, groups, theme and language stay.
	 */
	private readonly confirmClearRestaurants = (): void => {
		const count = loadRestaurants().length;
		saveRestaurants([]);
		saveAddedPresets([]);
		this.confirming = undefined;
		this.report(
			"restaurants",
			t(`settings.clearedRestaurants.${count === 1 ? "one" : "other"}`, {
				count,
			}),
			true,
		);
	};

	private readonly onHistoryCleared = (
		event: CustomEvent<{ count: number }>,
	): void => {
		const { count } = event.detail;
		this.confirming = undefined;
		this.report(
			"history",
			t(`settings.cleared.${count === 1 ? "one" : "other"}`, { count }),
			loadHistory().length === 0,
		);
	};

	private renderPrompt(
		row: "restaurants" | "all",
		prompt: string,
		confirm: string,
		onConfirm: () => void,
	) {
		const name = row === "all" ? "reset" : "clear-restaurants";
		return html`
			<div class="confirm">
				<p class="${name}-prompt" role="alert">${prompt}</p>
				<div class="actions">
					<button type="button" class="danger" data-action="${name}-confirm" @click=${onConfirm}>
						${confirm}
					</button>
					<button type="button" data-action="${name}-cancel" @click=${this.cancelDelete}>
						${t("settings.cancel")}
					</button>
				</div>
			</div>
		`;
	}

	/** The last delete's result, when it came from one of `kinds`; it sits under that card. */
	private renderDeleted(...kinds: DeleteKind[]) {
		const deleted = this.deleted;
		if (deleted === undefined || !kinds.includes(deleted.kind)) return nothing;
		return html`<p class="success deleted ${DONE_CLASS[deleted.kind]}" role="status" tabindex="-1">
			${deleted.message}
		</p>`;
	}

	/**
	 * Delete restaurants and Delete history share a card; Delete all data has its own. Prompts
	 * open in place.
	 */
	private renderDeletes() {
		return html`
			<div class="group deletes">
				${
					this.confirming === "restaurants"
						? this.renderPrompt(
								"restaurants",
								t("settings.clearRestaurantsPrompt", { count: this.count }),
								t("settings.clearRestaurantsConfirm"),
								this.confirmClearRestaurants,
							)
						: html`<button
								type="button"
								class="item"
								data-action="clear-restaurants"
								?disabled=${this.count === 0}
								@click=${() => this.ask("restaurants")}
							>
								<span class="lead">${icon("bowl", 22)}</span>
								<span class="grow"><b>${t("settings.clearRestaurants")}</b></span>
							</button>`
				}
				<history-clear @history-cleared=${this.onHistoryCleared}></history-clear>
			</div>
			${this.renderDeleted("restaurants", "history")}
			<div class="group reset-all">
				${
					this.confirming === "all"
						? this.renderPrompt(
								"all",
								t("settings.resetPrompt", { count: this.count }),
								t("settings.resetConfirm"),
								this.confirmReset,
							)
						: html`<button
								type="button"
								class="item danger"
								data-action="reset"
								@click=${() => this.ask("all")}
							>
								<span class="lead">${icon("trash", 22)}</span>
								<span class="grow"><b>${t("settings.reset")}</b></span>
							</button>`
				}
			</div>
			${this.renderDeleted("all")}
		`;
	}

	/** "{added} of {total} added", once the index has loaded; `nothing` until then or on failure. */
	private presetsSubtitle() {
		if (this.presetIndex === undefined) return nothing;
		const savedIds = new Set(loadRestaurants().map((item) => item.id));
		const added = loadAddedPresets();
		const addedCount = this.presetIndex.presets.filter(
			(entry) => presetState(entry, added, savedIds) !== "new",
		).length;
		return html`<small>${t("settings.presetsAdded", {
			added: addedCount,
			total: this.presetIndex.presets.length,
		})}</small>`;
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

	private renderPasteBox() {
		return html`
			<div class="paste-body">
				<p class="paste-failed" role="status">${t("settings.pasteFailed")}</p>
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
			<section class="organise" aria-labelledby="organise-title">
				<h2 id="organise-title" class="group-label">${t("settings.organiseTitle")}</h2>
				<div class="group">
					<a class="item" href="./settings/tags" data-action="tags">
						<span class="lead">${icon("tag", 22)}</span>
						<span class="grow">
							<b>${t("nav.tags")}</b>
							<small>${t("settings.tagsSub")}</small>
						</span>
						<span class="trail">${icon("chevron", 20)}</span>
					</a>
				</div>
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
					<a class="item" href="./settings/presets" data-action="presets">
						<span class="lead">${icon("pin", 22)}</span>
						<span class="grow">
							<b>${t("settings.presets")}</b>
							${this.presetsSubtitle()}
						</span>
						<span class="trail">${icon("chevron", 20)}</span>
					</a>
				</div>
				<div class="group">
					<label class="item file">
						<span class="lead">${icon("upload", 22)}</span>
						<span class="grow"><b>${t("settings.importFile")}</b></span>
						<span class="trail">${icon("chevron", 20)}</span>
						<input type="file" accept="application/json,.json" @change=${this.onFile} />
					</label>
					<button type="button" class="item" data-action="paste" @click=${this.pasteData}>
						<span class="lead">${icon("copy", 22)}</span>
						<span class="grow"><b>${t("settings.pasteLabel")}</b></span>
					</button>
					${this.pasteByHand ? this.renderPasteBox() : nothing}
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
				${this.renderDeletes()}
			</section>
			<section class="about" aria-labelledby="about-title">
				<h2 id="about-title" class="group-label">${t("settings.about")}</h2>
				<app-footer></app-footer>
			</section>
		`;
	}
}
