import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { getLang, LangController, type MessageKey, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import {
	type AddedPreset,
	fetchIndex,
	type Localized,
	loadAddedPresets,
	localize,
	type PresetEntry,
	type PresetIndex,
	type PresetState,
	presetState,
} from "#lib/presets";
import { loadRestaurants, onRestaurantsChanged } from "#lib/store";
import { uiStyles } from "#styles/ui";

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
 * presets grouped by district with search and a city filter. Ticking rows and saving them is
 * added in a later task; for now every row renders in Add mode.
 */
@customElement("preset-picker")
export class PresetPicker extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1rem;
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
	 * Add mode shows a locked "Added" row and a tickable "Update" one; Replace mode (a later
	 * task) shows "In your list" for both, starting unticked. Row rendering already reads this
	 * field so that task only has to flip it.
	 */
	private mode: "add" | "replace" = "add";

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
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
	}

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
			${this.renderBody()}
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
					? html`<p class="muted no-match">${t("presets.noMatch", { query })}</p>`
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
