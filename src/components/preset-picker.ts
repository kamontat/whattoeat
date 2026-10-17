import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import "#components/app-toast";
import type { AppToast } from "#components/app-toast";
import { getLang, LangController, type MessageKey, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import {
	type AddedPreset,
	addPresets,
	fetchIndex,
	fetchPresetFiles,
	type Localized,
	loadAddedPresets,
	localize,
	type PresetEntry,
	type PresetFile,
	type PresetIndex,
	type PresetState,
	presetState,
	replaceWithPresets,
	saveAddedPresets,
} from "#lib/presets";
import type { Restaurant } from "#lib/restaurant";
import {
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	saveRestaurants,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

type Mode = "add" | "replace";

const MODES: readonly Mode[] = ["add", "replace"];

const MODE_KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];

/** How long "Undone." stays, shorter than the default 6 s because it has no action. */
const UNDONE_DURATION = 3000;

const areasText = (n: number): string =>
	n === 1 ? t("presets.areas.one") : t("presets.areas.other", { n });

const restaurantsText = (n: number): string =>
	n === 1
		? t("presets.restaurants.one")
		: t("presets.restaurants.other", { n });

/** Above this many presets a search box earns its place. */
const SEARCH_THRESHOLD = 7;

/** A district or city label when the id has none (should not happen for a validated index). */
const labelFor = (map: Record<string, Localized>, id: string): string => {
	const value = map[id];
	return value === undefined ? id : localize(value);
};

/** `text` with the first case-insensitive match of `query` wrapped in `<mark>`. */
const highlight = (text: string, query: string): string | TemplateResult => {
	if (query === "") return text;
	const at = text.toLowerCase().indexOf(query.toLowerCase());
	if (at === -1) return text;
	return html`${text.slice(0, at)}<mark>${text.slice(at, at + query.length)}</mark>${text.slice(at + query.length)}`;
};

/** The text before and after the first literal occurrence of `token`, for splicing html into a translated string. */
const splitOnToken = (text: string, token: string): [string, string] => {
	const at = text.indexOf(token);
	return at === -1
		? [text, ""]
		: [text.slice(0, at), text.slice(at + token.length)];
};

type Badge = { label: MessageKey; state: string };

/**
 * The `/settings/presets` page body: fetches the bundled neighbourhood index, then lists its
 * presets grouped by district with search and a city filter. A pinned area at the bottom holds
 * the Add / Replace switch and the action button; saving fetches the ticked preset files, then
 * merges them into (Add) or swaps them for (Replace) the saved list, with an Undo message.
 *
 * Messages go to the page's `<app-toast>` when one is mounted, otherwise to one rendered in
 * this component's own shadow root.
 */
@customElement("preset-picker")
export class PresetPicker extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/*
			 * Phone: fill the space above the tab bar so the pinned area ends the column even
			 * with a short list, as Home does (the 1.25rem is main's top padding on phones).
			 */
			:host {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				min-height: calc(100dvh - 1.25rem - var(--tab-bar-height));
				/* main leaves --tab-bar-space below; pull back so the pinned area sits on the tab bar. */
				margin-bottom: calc(var(--tab-bar-height) - var(--tab-bar-space));
			}

			.pinned {
				position: sticky;
				z-index: 5;
				bottom: var(--tab-bar-height);
				margin-top: auto;
				display: grid;
				gap: 0.625rem;
				padding: 0.75rem 0 0.5rem;
				background: linear-gradient(to bottom, transparent, var(--color-bg) 35%);
			}

			fieldset {
				margin: 0;
				padding: 0;
				border: 0;
				min-width: 0;
			}

			.pinned .action {
				box-sizing: border-box;
				width: 100%;
				justify-content: center;
			}

			.confirm {
				gap: 0.75rem;
				padding: 1rem 1.125rem;
			}

			@media (min-width: 48rem) {
				:host {
					min-height: 0;
					margin-bottom: 0;
				}
			}

			.back {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				min-height: var(--tap);
				margin: -0.5rem 0 -0.5rem -0.5rem;
				padding: 0 0.5rem;
				font-weight: 600;
				text-decoration: none;
			}

			.list {
				display: grid;
				gap: 1rem;
			}

			.hidden-line {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}

			.chip[aria-pressed="true"] {
				background: var(--color-primary-soft);
				border-color: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			.badge {
				flex: none;
				padding: 0.125rem 0.5rem;
				border-radius: var(--radius-pill);
				background: var(--color-surface-2);
				color: var(--color-muted);
				font-size: 0.75rem;
				font-weight: 600;
			}

			.badge[data-state="added"] {
				color: var(--color-success);
			}

			.badge[data-state="update"] {
				color: var(--color-primary);
			}

			mark {
				background: var(--color-primary-soft);
				color: inherit;
				border-radius: 2px;
				padding: 0 0.1em;
			}

			@media (forced-colors: active) {
				.chip[aria-pressed="true"] {
					outline: 2px solid CanvasText;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Relative prefix for the back link and the index fetch; pages one folder under Settings. */
	@property() base = "../";

	@state() private index: PresetIndex | undefined;
	@state() private loadError = false;
	@state() private selected: Set<string> = new Set();
	@state() private query = "";
	@state() private city: string | undefined;

	@state() private savedIds: ReadonlySet<string> = new Set();
	@state() private added: AddedPreset[] = [];

	/**
	 * Add mode shows a locked "Added" row and a tickable "Update" one; Replace mode shows "In
	 * your list" for both, starting unticked. Starts as Add on every mount and is never stored.
	 */
	@state() mode: Mode = "add";

	/** True while the Replace confirm card stands in for the pinned area. */
	@state() confirming = false;

	/** True while the ticked preset files are being fetched. */
	@state() private busy = false;

	/** A ticked preset file failed to load; nothing was saved. */
	@state() private filesError = false;

	/** Render a `<app-toast>` of our own, because the page did not mount one. */
	private ownToast = false;

	/**
	 * The saved list and `whattoeat:presets` from just before the last save, for Undo. Memory
	 * only: leaving the page drops it.
	 */
	private snapshot: { list: Restaurant[]; added: AddedPreset[] } | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.mode = "add";
		this.confirming = false;
		this.ownToast = document.querySelector("app-toast") === null;
		this.reloadStore();
		this.unsubscribe = onRestaurantsChanged(() => this.reloadStore());
		void this.loadIndex();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private reloadStore(): void {
		this.savedIds = new Set(loadRestaurants().map((item) => item.id));
		this.added = loadAddedPresets();
		// The switch hides with nothing saved, and the mode is then Add.
		if (this.savedIds.size === 0) this.setMode("add");
	}

	/** Changing the mode clears the selection: ticking means something different in each. */
	private setMode(mode: Mode): void {
		if (mode === this.mode) return;
		this.mode = mode;
		this.selected = new Set();
		this.confirming = false;
		this.filesError = false;
	}

	/** Runs `find` after the next render and focuses what it returns, as data-transfer does. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	private modeInput(mode: Mode): Element | null {
		return this.renderRoot.querySelector(
			`input[name="preset-mode"][value="${mode}"]`,
		);
	}

	/** Arrow keys move between the two options, wrapping, like a native radio group. */
	private readonly onModeKey = (event: KeyboardEvent): void => {
		if (!MODE_KEYS.includes(event.key)) return;
		event.preventDefault();
		const next: Mode = this.mode === "add" ? "replace" : "add";
		this.setMode(next);
		this.focusAfterRender(() => this.modeInput(next));
	};

	/** The page's toast if it mounted one, otherwise our own. */
	private toast(): AppToast | null {
		return (document.querySelector("app-toast") ??
			this.renderRoot.querySelector("app-toast")) as AppToast | null;
	}

	/**
	 * The presets the action applies to, in index order. In Add mode an Added row shows ticked
	 * but is locked, so it is never part of the action.
	 */
	private tickedEntries(index: PresetIndex): PresetEntry[] {
		return index.presets.filter(
			(entry) =>
				this.selected.has(entry.id) &&
				!(
					this.mode === "add" &&
					presetState(entry, this.added, this.savedIds) === "added"
				),
		);
	}

	/** The action button's label; the restaurant count is the index's estimate. */
	private actionLabel(ticked: readonly PresetEntry[]): string {
		if (ticked.length === 0) return t("presets.goPicker");
		const count = restaurantsText(
			ticked.reduce((sum, entry) => sum + entry.count, 0),
		);
		return this.mode === "replace"
			? t("presets.replace", { count })
			: t("presets.add", { areas: areasText(ticked.length), count });
	}

	private readonly onApply = (): void => {
		if (this.mode === "add") {
			void this.save();
			return;
		}
		this.confirming = true;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="replace-confirm"]'),
		);
	};

	private readonly cancelReplace = (): void => {
		this.confirming = false;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="apply"]'),
		);
	};

	private readonly confirmReplace = (): void => {
		void this.save();
	};

	/**
	 * Fetch every ticked file, then save. If any file fails, nothing is saved and the selection
	 * is kept. The list and `whattoeat:presets` are snapshotted right before saving, for Undo.
	 */
	private async save(): Promise<void> {
		const index = this.index;
		if (index === undefined || this.busy) return;
		const mode = this.mode;
		const ticked = this.tickedEntries(index);
		if (ticked.length === 0) return;
		this.busy = true;
		this.filesError = false;
		let files: PresetFile[];
		try {
			files = await fetchPresetFiles(this.base, ticked);
		} catch {
			this.busy = false;
			this.filesError = true;
			if (this.confirming) this.cancelReplace();
			return;
		}

		const before = { list: loadRestaurants(), added: loadAddedPresets() };
		let message: string;
		let undoable = true;
		// Presets first: saving restaurants announces the change, and the rows reload from both.
		if (mode === "add") {
			const result = addPresets(before.list, files, before.added);
			saveAddedPresets(result.added);
			if (result.newCount === 0) {
				// Nothing to undo: the list is unchanged, only the presets were recorded.
				undoable = false;
				message = t("presets.nothingNew");
			} else {
				message = saveRestaurants(result.list)
					? t("presets.added", { count: result.newCount })
					: t("presets.sessionOnly");
			}
		} else {
			const result = replaceWithPresets(files);
			saveAddedPresets(result.added);
			message = saveRestaurants(result.list)
				? t("presets.replaced", { count: result.list.length })
				: t("presets.sessionOnly");
		}
		this.snapshot = undoable ? before : undefined;
		this.busy = false;
		this.confirming = false;
		this.selected = new Set();
		this.reloadStore();
		await this.updateComplete;
		this.toast()?.show(
			message,
			undoable ? { action: t("presets.undo"), onAction: this.undo } : {},
		);
	}

	/** Put back the list and `whattoeat:presets` from before the last save. */
	private readonly undo = (): void => {
		const snapshot = this.snapshot;
		if (snapshot === undefined) return;
		this.snapshot = undefined;
		saveAddedPresets(snapshot.added);
		saveRestaurants(snapshot.list);
		this.reloadStore();
		this.toast()?.show(t("presets.undone"), { duration: UNDONE_DURATION });
	};

	private async loadIndex(): Promise<void> {
		this.loadError = false;
		try {
			const index = await fetchIndex(this.base);
			this.index = index;
			this.city = Object.keys(index.cities)[0];
		} catch {
			this.index = undefined;
			this.loadError = true;
		}
	}

	private readonly retry = (): void => {
		void this.loadIndex();
	};

	/** Every preset sorted by its district's label, then its own, in the current language. */
	private sortEntries(
		index: PresetIndex,
		entries: readonly PresetEntry[],
	): PresetEntry[] {
		const lang = getLang();
		return [...entries].sort((a, b) => {
			if (a.district !== b.district) {
				const cmp = labelFor(index.districts, a.district).localeCompare(
					labelFor(index.districts, b.district),
					lang,
				);
				if (cmp !== 0) return cmp;
			}
			return localize(a.name).localeCompare(localize(b.name), lang);
		});
	}

	private toggle(id: string, checked: boolean): void {
		const next = new Set(this.selected);
		if (checked) next.add(id);
		else next.delete(id);
		this.selected = next;
	}

	private clearSearch(hidden: readonly PresetEntry[]): void {
		this.query = "";
		const first = hidden[0];
		if (first !== undefined) this.city = first.city;
	}

	override render() {
		return html`
			<a class="back" href=${`${this.base}settings`}>${icon("back", 20)}<span>${t("presets.back")}</span></a>
			<h1 class="page-title">${t("presets.title")}</h1>
			${isMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${this.renderBody()}
			${this.ownToast ? html`<app-toast></app-toast>` : nothing}
		`;
	}

	private renderPinned(index: PresetIndex) {
		const ticked = this.tickedEntries(index);
		const label = this.actionLabel(ticked);
		const announce = html`<p class="visually-hidden" aria-live="polite">${label}</p>`;
		if (this.confirming)
			return html`
				${announce}
				<div class="pinned">
					<div class="group confirm">
						<p class="replace-prompt" role="alert">${t(
							"presets.replacePrompt",
							{
								saved: this.savedIds.size,
								count: ticked.reduce((sum, entry) => sum + entry.count, 0),
								names: ticked.map((entry) => localize(entry.name)).join(", "),
							},
						)}</p>
						<div class="actions">
							<button
								type="button"
								class="danger"
								data-action="replace-confirm"
								?disabled=${this.busy}
								@click=${this.confirmReplace}
							>${t("presets.replaceConfirm")}</button>
							<button
								type="button"
								data-action="replace-cancel"
								?disabled=${this.busy}
								@click=${this.cancelReplace}
							>
								${t("settings.cancel")}
							</button>
						</div>
					</div>
				</div>
			`;
		const replacing = this.mode === "replace";
		return html`
			${announce}
			<div class="pinned">
				${this.savedIds.size > 0 ? this.renderSwitch() : nothing}
				${this.filesError ? html`<p class="error files-error" role="alert">${t("presets.filesError")}</p>` : nothing}
				${
					replacing && ticked.length > 0
						? html`<p class="muted replace-warning">${t("presets.replaceWarning", { count: this.savedIds.size })}</p>`
						: nothing
				}
				${
					ticked.length === 0
						? html`<a class="button-link action" data-action="go-picker" href=${this.base}>${label}</a>`
						: html`<button
								type="button"
								class="action ${replacing ? "danger" : "primary"}"
								data-action="apply"
								?disabled=${this.busy}
								@click=${this.onApply}
							>${label}</button>`
				}
			</div>
		`;
	}

	private renderSwitch() {
		return html`<fieldset
			class="mode"
			role="radiogroup"
			aria-labelledby="preset-mode-label"
			@keydown=${this.onModeKey}
		>
			<legend id="preset-mode-label" class="visually-hidden">${t("presets.mode.label")}</legend>
			<div class="seg">
				${MODES.map(
					(mode) => html`<label>
						<input
							type="radio"
							name="preset-mode"
							value=${mode}
							.checked=${live(this.mode === mode)}
							@change=${() => this.setMode(mode)}
						/>
						<span>${t(mode === "add" ? "presets.mode.add" : "presets.mode.replace")}</span>
					</label>`,
				)}
			</div>
		</fieldset>`;
	}

	private renderBody() {
		if (this.loadError) {
			return html`
				<p class="error" role="alert">${t("presets.loadError")}</p>
				<button type="button" data-action="retry" @click=${this.retry}>${t("presets.retry")}</button>
			`;
		}
		const index = this.index;
		if (index === undefined)
			return html`<p class="muted loading">${t("presets.loading")}</p>`;
		return this.renderIndex(index);
	}

	private renderIndex(index: PresetIndex) {
		const query = this.query.trim();
		const q = query.toLowerCase();
		const searching = q !== "";

		const matchesEntry = (entry: PresetEntry): boolean => {
			if (!searching) return true;
			if (entry.name.en.toLowerCase().includes(q)) return true;
			if (entry.name.th.toLowerCase().includes(q)) return true;
			const district = index.districts[entry.district];
			if (district !== undefined) {
				if (district.en.toLowerCase().includes(q)) return true;
				if (district.th.toLowerCase().includes(q)) return true;
			}
			return entry.places.some((place) => place.toLowerCase().includes(q));
		};

		const inCity = (entry: PresetEntry): boolean =>
			searching || this.city === undefined || entry.city === this.city;

		const sortedAll = this.sortEntries(index, index.presets);
		const visible = sortedAll.filter(
			(entry) => matchesEntry(entry) && inCity(entry),
		);
		const visibleIds = new Set(visible.map((entry) => entry.id));
		const hidden = sortedAll.filter(
			(entry) => this.selected.has(entry.id) && !visibleIds.has(entry.id),
		);

		const districtIds: string[] = [];
		for (const entry of visible)
			if (!districtIds.includes(entry.district))
				districtIds.push(entry.district);

		return html`
			${this.renderSearch(index)}
			${this.renderChips(index)}
			${this.renderHidden(hidden)}
			${
				searching && visible.length === 0
					? html`<p class="muted no-match" role="status">${t("presets.noMatch", { query })}</p>`
					: html`<div class="list">
							${districtIds.map(
								(id) => html`
									<section class="district" data-district=${id}>
										<h2 class="group-label">${labelFor(index.districts, id)}</h2>
										<div class="group">
											${visible
												.filter((entry) => entry.district === id)
												.map((entry) => this.renderRow(entry, q, searching))}
										</div>
									</section>
								`,
							)}
						</div>`
			}
			${this.renderPinned(index)}
		`;
	}

	private renderSearch(index: PresetIndex) {
		if (index.presets.length <= SEARCH_THRESHOLD) return nothing;
		return html`<label class="search-field">
			<span class="visually-hidden">${t("presets.search")}</span>
			<input
				type="search"
				placeholder=${t("presets.search")}
				.value=${live(this.query)}
				@input=${(event: Event) => {
					this.query = (event.target as HTMLInputElement).value;
				}}
			/>
		</label>`;
	}

	private renderChips(index: PresetIndex) {
		const cityIds = Object.keys(index.cities);
		if (cityIds.length < 2) return nothing;
		return html`<div class="chips">
			${cityIds.map(
				(id) => html`<button
					type="button"
					class="chip"
					data-city=${id}
					aria-pressed=${id === this.city ? "true" : "false"}
					@click=${() => {
						this.city = id;
					}}
				>${labelFor(index.cities, id)}</button>`,
			)}
		</div>`;
	}

	private renderHidden(hidden: readonly PresetEntry[]) {
		if (hidden.length === 0) return nothing;
		return html`<p class="hidden-line muted">
			<span>${t("presets.hidden", { count: hidden.length })}</span>
			<button
				type="button"
				class="quiet"
				data-action="clear-search"
				@click=${() => this.clearSearch(hidden)}
			>${t("presets.clearSearch")}</button>
		</p>`;
	}

	private rowBadge(state: PresetState): Badge | undefined {
		if (state === "new") return undefined;
		if (this.mode === "replace")
			return { label: "presets.badge.inList", state: "in-list" };
		return state === "added"
			? { label: "presets.badge.added", state: "added" }
			: { label: "presets.badge.update", state: "update" };
	}

	private renderRow(entry: PresetEntry, query: string, searching: boolean) {
		const state = presetState(entry, this.added, this.savedIds);
		const locked = this.mode === "add" && state === "added";
		const checked = locked ? true : this.selected.has(entry.id);
		const badge = this.rowBadge(state);
		return html`
			<label class="item preset" data-preset=${entry.id}>
				<input
					type="checkbox"
					.checked=${checked}
					?disabled=${locked}
					@change=${(event: Event) =>
						this.toggle(entry.id, (event.target as HTMLInputElement).checked)}
				/>
				<span class="grow">
					<b class="name">${localize(entry.name)}</b>
					<small class="sub">${this.renderSubtitle(entry, query, searching)}</small>
				</span>
				${
					badge === undefined
						? nothing
						: html`<span class="badge" data-state=${badge.state}>${t(badge.label)}</span>`
				}
			</label>
		`;
	}

	private renderSubtitle(
		entry: PresetEntry,
		query: string,
		searching: boolean,
	) {
		const shown = entry.places.slice(0, 2);
		const rest = entry.places.length - shown.length;
		const parts: (string | TemplateResult)[] = [];
		shown.forEach((place, index) => {
			if (index > 0) parts.push(", ");
			parts.push(searching ? highlight(place, query) : place);
		});
		if (rest > 0) parts.push(` ${t("presets.morePlaces", { count: rest })}`);
		const raw = t("presets.rowSub", { count: entry.count });
		const [before, after] = splitOnToken(raw, "{places}");
		return html`${before}${parts}${after}`;
	}
}
