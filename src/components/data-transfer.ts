import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { LangController, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import {
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	saveRestaurants,
} from "#lib/store";
import {
	exportFileName,
	type ImportError,
	mergeRestaurants,
	parseImport,
	toExportFile,
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
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private count = 0;

	@state()
	private pending: Restaurant[] | undefined;

	@state()
	private error: ImportError | undefined;

	@state()
	private imported: number | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.count = loadRestaurants().length;
		this.unsubscribe = onRestaurantsChanged(() => {
			this.count = loadRestaurants().length;
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
			this.pending = result.restaurants;
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
		const json = JSON.stringify(toExportFile(loadRestaurants(), now), null, 2);
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

	private apply(mode: "replace" | "merge"): void {
		if (this.pending === undefined) return;
		const list =
			mode === "replace"
				? this.pending
				: mergeRestaurants(loadRestaurants(), this.pending);
		const persisted = saveRestaurants(list);
		this.pending = undefined;
		this.imported = persisted ? list.length : undefined;
	}

	override render() {
		return html`
			<h1>${t("settings.title")}</h1>
			<p class="count">${t("settings.count", { count: this.count })}</p>
			${isMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			<section class="card">
				<h2>${t("settings.exportTitle")}</h2>
				<div class="actions">
					<button type="button" class="primary" data-action="export" @click=${this.exportData}>
						${t("settings.export")}
					</button>
				</div>
			</section>
			<section class="card">
				<h2>${t("settings.importTitle")}</h2>
				<label>
					${t("settings.importFile")}
					<input type="file" accept="application/json,.json" @change=${this.onFile} />
				</label>
				${this.error ? html`<p class="error" role="alert">${t(this.error)}</p>` : nothing}
				${
					this.pending
						? html`
								<p class="found">${t("settings.importFound", { count: this.pending.length })}</p>
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
		`;
	}
}
