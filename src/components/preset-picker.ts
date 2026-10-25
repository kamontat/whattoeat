import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import "#components/app-toast";
import type { AppToast } from "#components/app-toast";
import {
	getLang,
	LangController,
	type Localized,
	localize,
	t,
} from "#lib/i18n";
import { icon } from "#lib/icons";
import {
	type AddedPreset,
	fetchIndex,
	fetchPresetFiles,
	loadAddedPresets,
	type PresetEntry,
	type PresetFile,
	type PresetIndex,
	presetState,
	replaceWithPresets,
	saveAddedPresets,
	updatePreset,
} from "#lib/presets";
import { activeProfile } from "#lib/profiles";
import type { Restaurant } from "#lib/restaurant";
import {
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	saveRestaurants,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

/** How long "Undone." stays, shorter than the default 6 s because it has no action. */
const UNDONE_DURATION = 3000;

const areasText = (n: number): string =>
	n === 1 ? t("presets.areas.one") : t("presets.areas.other", { n });

const restaurantsText = (n: number): string =>
	n === 1
		? t("presets.restaurants.one")
		: t("presets.restaurants.other", { n });

/**
 * Room for the pinned area where ResizeObserver is missing: the warning line and the button, at
 * phone size. Measured otherwise.
 */
const PINNED_FALLBACK = "9.5rem";

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

/**
 * The `/settings/presets` page body: fetches the bundled neighbourhood index, then lists its
 * presets grouped by district with search and a city filter. A pinned area at the bottom holds
 * the action button; saving fetches the ticked preset files and replaces the active profile's
 * whole saved list with them, confirmed first when the profile has restaurants to lose, with an
 * Undo message.
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

			/*
			 * The row's label no longer is the row: an Update button sits beside it (.item still
			 * lays the two out), so .pick takes over the row's own flex layout for the checkbox,
			 * name and badge.
			 */
			.pick {
				display: flex;
				flex: 1;
				align-items: center;
				gap: 0.75rem;
				min-height: var(--tap);
				min-width: 0;
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

	/**
	 * Measures the pinned area and publishes its height as `--pinned-space` on the page root,
	 * so the toast sits above it and `scroll-padding-bottom` keeps focused rows clear of it.
	 * The area grows with the Replace warning line and the confirm card, and stays pinned on
	 * wide screens too, so the static `html.has-pinned` value (sized for Home) is not enough.
	 */
	private resizeObserver: ResizeObserver | undefined;

	/** The `.pinned` element being measured; each render branch makes its own. */
	private measured: Element | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.confirming = false;
		this.ownToast = document.querySelector("app-toast") === null;
		this.reloadStore();
		this.unsubscribe = onRestaurantsChanged(() => this.reloadStore());
		if (typeof ResizeObserver === "function")
			this.resizeObserver = new ResizeObserver(this.onPinnedResize);
		else
			document.documentElement.style.setProperty(
				"--pinned-space",
				PINNED_FALLBACK,
			);
		void this.loadIndex();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.resizeObserver?.disconnect();
		this.resizeObserver = undefined;
		this.measured = undefined;
		document.documentElement.style.removeProperty("--pinned-space");
	}

	override updated(): void {
		const observer = this.resizeObserver;
		if (observer === undefined) return;
		const pinned = this.renderRoot.querySelector(".pinned") ?? undefined;
		if (pinned === this.measured) return;
		if (this.measured !== undefined) observer.unobserve(this.measured);
		if (pinned !== undefined) observer.observe(pinned);
		this.measured = pinned;
	}

	private readonly onPinnedResize = (
		entries: readonly ResizeObserverEntry[],
	): void => {
		const entry = entries.at(-1);
		if (entry === undefined) return;
		const height =
			entry.borderBoxSize?.[0]?.blockSize ??
			entry.target.getBoundingClientRect().height;
		document.documentElement.style.setProperty(
			"--pinned-space",
			`${Math.ceil(height)}px`,
		);
	};

	private reloadStore(): void {
		this.savedIds = new Set(loadRestaurants().map((item) => item.id));
		this.added = loadAddedPresets();
	}

	/** Runs `find` after the next render and focuses what it returns, as data-transfer does. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	/** The pinned area's action: the apply button, or the Go to picker link with nothing ticked. */
	private pinnedAction(): Element | null {
		return this.renderRoot.querySelector(
			'[data-action="apply"], [data-action="go-picker"]',
		);
	}

	/** The page's toast if it mounted one, otherwise our own. */
	private toast(): AppToast | null {
		return (document.querySelector("app-toast") ??
			this.renderRoot.querySelector("app-toast")) as AppToast | null;
	}

	/** The presets the action applies to, in index order. */
	private tickedEntries(index: PresetIndex): PresetEntry[] {
		return index.presets.filter((entry) => this.selected.has(entry.id));
	}

	/** The action button's label; the restaurant count is the index's estimate. */
	private actionLabel(ticked: readonly PresetEntry[]): string {
		if (ticked.length === 0) return t("presets.goPicker");
		const areas = areasText(ticked.length);
		const count = restaurantsText(
			ticked.reduce((sum, entry) => sum + entry.count, 0),
		);
		return this.savedIds.size > 0
			? t("presets.replace", { areas, count })
			: t("presets.use", { areas, count });
	}

	/** An empty profile has nothing to lose, so applying saves right away, no confirm needed. */
	private readonly onApply = (): void => {
		if (this.savedIds.size === 0) {
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
	 * Fetch every ticked file, then replace the saved list with their restaurants. If any file
	 * fails, nothing is saved and the selection is kept. The list and `whattoeat:presets` are
	 * snapshotted right before saving, for Undo.
	 */
	private async save(): Promise<void> {
		const index = this.index;
		if (index === undefined || this.busy) return;
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
		const hadRestaurants = before.list.length > 0;
		const result = replaceWithPresets(files);
		let message: string;
		// `whattoeat:presets` is written only once the list itself was stored: a refused list
		// write must not leave records claiming presets the stored list does not hold.
		if (saveRestaurants(result.list)) {
			saveAddedPresets(result.added);
			message = hadRestaurants
				? t("presets.replaced", { count: result.list.length })
				: t("presets.added", { count: result.list.length });
		} else {
			message = hadRestaurants
				? t("presets.replacedSessionOnly")
				: t("presets.sessionOnly");
		}
		this.snapshot = before;
		this.busy = false;
		this.confirming = false;
		this.selected = new Set();
		this.reloadStore();
		// The apply button (or the confirm card) just went away; keep focus in the pinned area.
		this.focusAfterRender(() => this.pinnedAction());
		await this.updateComplete;
		this.toast()?.show(message, {
			action: t("presets.undo"),
			onAction: this.undo,
		});
	}

	/** Put back the list and `whattoeat:presets` from before the last save. */
	private readonly undo = (): void => {
		const snapshot = this.snapshot;
		if (snapshot === undefined) return;
		this.snapshot = undefined;
		// Same rule as saving: the presets follow the list only once the list was stored.
		if (saveRestaurants(snapshot.list)) saveAddedPresets(snapshot.added);
		this.reloadStore();
		// The toast's Undo button had focus and is gone now.
		this.focusAfterRender(() => this.pinnedAction());
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
		const hasSaved = this.savedIds.size > 0;
		return html`
			${announce}
			<div class="pinned">
				${this.filesError ? html`<p class="error files-error" role="alert">${t("presets.filesError")}</p>` : nothing}
				${
					hasSaved && ticked.length > 0
						? html`<p class="muted replace-warning">${t("presets.replaceWarning", { count: this.savedIds.size, profile: activeProfile().name })}</p>`
						: nothing
				}
				${
					ticked.length === 0
						? html`<a class="button-link action" data-action="go-picker" href=${this.base}>${label}</a>`
						: html`<button
								type="button"
								class="action ${hasSaved ? "danger" : "primary"}"
								data-action="apply"
								?disabled=${this.busy}
								@click=${this.onApply}
							>${label}</button>`
				}
			</div>
		`;
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
		return html`<label>
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

	private renderRow(entry: PresetEntry, query: string, searching: boolean) {
		const state = presetState(entry, this.added, this.savedIds);
		const checked = this.selected.has(entry.id);
		const name = localize(entry.name);
		return html`
			<div class="item preset" data-preset=${entry.id}>
				<label class="pick">
					<input
						type="checkbox"
						.checked=${checked}
						?disabled=${this.busy}
						@change=${(event: Event) =>
							this.toggle(entry.id, (event.target as HTMLInputElement).checked)}
					/>
					<span class="grow">
						<b class="name">${name}</b>
						<small class="sub">${this.renderSubtitle(entry, query, searching)}</small>
					</span>
					${
						state === "added"
							? html`<span class="badge" data-state="in-list">${t("presets.badge.inList")}</span>`
							: nothing
					}
				</label>
				${
					state === "update"
						? html`<button
								type="button"
								class="quiet"
								data-action="update"
								aria-label=${t("presets.updateLabel", { name })}
								?disabled=${this.busy}
								@click=${() => void this.onUpdateClick(entry)}
							>${t("presets.update")}</button>`
						: nothing
				}
			</div>
		`;
	}

	/**
	 * Sync one applied preset's current file into the saved list, via `updatePreset` (Task 1).
	 * Never touches `selected`. Mirrors `save()`'s refused-write handling, but a failed fetch here
	 * leaves everything untouched (no snapshot, no Undo) since nothing was computed yet.
	 */
	private async onUpdateClick(entry: PresetEntry): Promise<void> {
		if (this.busy) return;
		const name = localize(entry.name);
		this.busy = true;
		let files: PresetFile[];
		try {
			files = await fetchPresetFiles(this.base, [entry]);
		} catch {
			this.busy = false;
			this.toast()?.show(t("presets.updateError", { name }));
			return;
		}
		// fetchPresetFiles resolves exactly one file per entry requested.
		const [file] = files;
		if (file === undefined) {
			this.busy = false;
			return;
		}

		const before = { list: loadRestaurants(), added: loadAddedPresets() };
		const result = updatePreset(before.list, file, before.added);
		let message: string;
		// Same rule as saving: the presets record follows the list only once the list was stored.
		if (saveRestaurants(result.list)) {
			saveAddedPresets(result.added);
			message = t("presets.updated", {
				name,
				added: result.counts.added,
				removed: result.counts.removed,
				reverted: result.counts.reverted,
			});
		} else {
			message = t("presets.updatedSessionOnly", { name });
		}
		this.snapshot = before;
		this.busy = false;
		this.reloadStore();
		// The button just disappeared from this row; keep focus on it (now its checkbox).
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(`[data-preset="${entry.id}"] input`),
		);
		await this.updateComplete;
		this.toast()?.show(message, {
			action: t("presets.undo"),
			onAction: this.undo,
		});
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
