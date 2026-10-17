import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "#components/app-sheet";
import {
	applyFilter,
	EMPTY_FILTER,
	type Filter,
	type GroupFilter,
	isFilterActive,
	setTagState,
	type TagState,
	tagState,
} from "#lib/filter";
import {
	allGroupIds,
	type GroupDef,
	groupLabel,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import type { Restaurant } from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

/** From this many values, a group gets a search box and lists only its most used until asked. */
const BIG = 10;
/** How many of a big group's most used values show before Show all. */
const TOP = 8;

type Count = { value: string; count: number };

/**
 * The filter as one pill per group. A pill opens its group: a popover under it on wide
 * screens, a sheet with a tab per group on phones. Each value has its own Want and Skip
 * button. It only draws `filter`; each change is reported as `filter-change` (detail: the
 * next filter) for the page to save.
 */
@customElement("filter-bar")
export class FilterBar extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
			}

			/* Phones: one row that scrolls sideways; wide: pills wrap. */
			.bar {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				overflow-x: auto;
				scrollbar-width: none;
				/* Room for the focus ring, which the sideways scroll would otherwise clip. */
				margin: -0.375rem;
				padding: 0.375rem;
			}

			.bar::-webkit-scrollbar {
				display: none;
			}

			.pill-wrap {
				position: relative;
				flex-shrink: 0;
			}

			.pill {
				gap: 0.375rem;
				min-height: 2.5rem;
				padding: 0 0.625rem 0 0.875rem;
				border-color: var(--color-border);
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
				white-space: nowrap;
			}

			.pill.on {
				border-color: var(--color-text);
				font-weight: 600;
			}

			.pill[aria-expanded="true"] {
				border-color: var(--color-primary);
				box-shadow: 0 0 0 1px var(--color-primary);
			}

			.pill .icon {
				transform: rotate(90deg);
				color: var(--color-muted);
				transition: transform var(--duration);
			}

			.pill[aria-expanded="true"] .icon {
				transform: rotate(-90deg);
			}

			.badge {
				display: inline-grid;
				place-items: center;
				min-width: 1.25rem;
				height: 1.25rem;
				padding: 0 0.3125rem;
				border-radius: var(--radius-pill);
				background: var(--color-primary);
				color: var(--color-primary-text);
				font-size: 0.75rem;
				font-variant-numeric: tabular-nums;
			}

			/* Only skipped values: a quieter badge, as the Skip button is. */
			.badge.skip {
				background: var(--color-muted);
				color: var(--color-bg);
			}

			.clear-all {
				flex-shrink: 0;
				min-height: 2.5rem;
				padding: 0 0.5rem;
				font-size: 0.875rem;
				font-weight: 500;
			}

			.popover {
				position: absolute;
				z-index: 20;
				top: calc(100% + 0.375rem);
				left: 0;
				display: flex;
				flex-direction: column;
				width: min(22rem, calc(100vw - 2rem));
				max-height: min(26rem, 70vh);
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
				box-shadow: var(--shadow-lg);
			}

			.pill-wrap.end .popover {
				left: auto;
				right: 0;
			}

			.popover-body {
				overflow-y: auto;
				overscroll-behavior: contain;
				padding: 0.25rem 0.875rem;
			}

			.popover .find-wrap {
				padding: 0.75rem 0.875rem 0.25rem;
			}

			.popover-foot {
				display: flex;
				justify-content: space-between;
				padding: 0.25rem 0.375rem;
				border-top: 1px solid var(--color-border);
			}

			.popover-foot button {
				min-height: 2.5rem;
				padding: 0 0.625rem;
			}

			/* Sheet: the tabs and search box stay put while the rows scroll. */
			.sheet-head {
				position: sticky;
				top: -0.25rem;
				z-index: 1;
				display: grid;
				gap: 0.5rem;
				margin-top: -0.25rem;
				padding-top: 0.25rem;
				background: var(--color-bg);
			}

			.tabs {
				display: flex;
				gap: 0.25rem;
				overflow-x: auto;
				scrollbar-width: none;
				border-bottom: 1px solid var(--color-border);
			}

			.tabs::-webkit-scrollbar {
				display: none;
			}

			.tab {
				flex-shrink: 0;
				gap: 0.375rem;
				min-height: 2.5rem;
				padding: 0 0.625rem;
				border: 0;
				border-bottom: 2px solid transparent;
				border-radius: 0;
				background: transparent;
				color: var(--color-muted);
				font-weight: 500;
			}

			.tab[aria-selected="true"] {
				border-bottom-color: var(--color-primary);
				color: var(--color-text);
				font-weight: 600;
			}

			.tab-actions {
				display: flex;
				justify-content: flex-end;
			}

			.tab-actions button {
				min-height: 2.25rem;
				padding: 0 0.5rem;
			}

			input.find {
				min-height: 2.5rem;
			}

			.section-title {
				padding: 0.75rem 0 0.25rem;
				color: var(--color-muted);
				font-size: 0.75rem;
				font-weight: 600;
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}

			.rows {
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.row {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				min-height: 3rem;
				padding: 0.25rem 0;
			}

			.row + .row {
				border-top: 1px solid var(--color-border);
			}

			.name {
				flex: 1;
				min-width: 0;
				overflow-wrap: anywhere;
			}

			.count {
				margin-inline-start: 0.375rem;
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-variant-numeric: tabular-nums;
			}

			.duo {
				display: inline-flex;
				flex-shrink: 0;
			}

			.duo button {
				gap: 0.25rem;
				min-height: 2.5rem;
				min-width: 4rem;
				padding: 0 0.625rem;
				border-color: var(--color-border);
				color: var(--color-muted);
				font-size: 0.8125rem;
			}

			.duo .want {
				border-radius: var(--radius-sm) 0 0 var(--radius-sm);
			}

			.duo .skip {
				margin-inline-start: -1px;
				border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
			}

			.duo .want[aria-pressed="true"] {
				position: relative;
				border-color: var(--color-primary);
				background: var(--color-primary);
				color: var(--color-primary-text);
			}

			.duo .skip[aria-pressed="true"] {
				position: relative;
				border-color: var(--color-muted);
				background: var(--color-muted);
				color: var(--color-bg);
			}

			.show-all {
				width: 100%;
				margin: 0.5rem 0;
				border-style: dashed;
				background: transparent;
				color: var(--color-link);
				font-size: 0.875rem;
			}

			.no-value {
				padding: 0.75rem 0;
				color: var(--color-muted);
			}

			@media (min-width: 48rem) {
				.bar {
					flex-wrap: wrap;
					overflow: visible;
					margin: 0;
					padding: 0;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Wide screens open a group in a popover; phones in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	@property({ attribute: false })
	restaurants: readonly Restaurant[] = [];

	@property({ attribute: false })
	defs: readonly GroupDef[] = [];

	@property({ attribute: false })
	filter: Filter = EMPTY_FILTER;

	/** Whether plain tags get a pill too. */
	@property({ type: Boolean })
	tags = false;

	/** The group shown in the popover or sheet, if any. */
	@state()
	private openGroup: string | undefined;

	/** What is typed in a big group's search box. */
	@state()
	private query = "";

	/** Whether a big group lists all its values, not only the most used. */
	@state()
	private showAll = false;

	/** Wide: the popover lines up with the pill's right edge when the pill is in the right half. */
	@state()
	private alignEnd = false;

	/**
	 * The open group's chosen values when it opened: listed first in a big group, and left
	 * there while it stays open, so a row never jumps away from under the pointer.
	 */
	private pinned: string[] = [];

	override connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("pointerdown", this.onPointerDown);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("pointerdown", this.onPointerDown);
	}

	/** Wide: pressing anywhere outside the open pill and its popover closes the popover. */
	private readonly onPointerDown = (event: Event): void => {
		if (!this.wide.matches || this.openGroup === undefined) return;
		const wrap = this.renderRoot.querySelector(".pill-wrap.open");
		if (wrap !== null && event.composedPath().includes(wrap)) return;
		this.openGroup = undefined;
	};

	/** Every group that has a value, then plain tags when they are filtered here. */
	private groupIds(): string[] {
		return [...allGroupIds(this.defs), ...(this.tags ? ["tags"] : [])].filter(
			(group) => valueCounts(this.restaurants, group).length > 0,
		);
	}

	private groupFilter(group: string): GroupFilter {
		return (
			(Object.hasOwn(this.filter, group) ? this.filter[group] : undefined) ?? {
				include: [],
				exclude: [],
			}
		);
	}

	private change(next: Filter): void {
		this.dispatchEvent(
			new CustomEvent("filter-change", {
				detail: next,
				bubbles: true,
				composed: true,
			}),
		);
	}

	private set(group: string, value: string, state: TagState): void {
		this.change(setTagState(this.filter, group, value, state));
	}

	private open(group: string): void {
		const current = this.groupFilter(group);
		this.openGroup = group;
		this.query = "";
		this.showAll = false;
		this.pinned = [...current.include, ...current.exclude];
		if (!this.wide.matches) return;
		const pill = this.pill(group);
		this.alignEnd =
			pill !== null &&
			pill.getBoundingClientRect().left > window.innerWidth / 2;
		void this.updateComplete.then(() => {
			this.renderRoot
				.querySelector<HTMLElement>(".popover input, .popover button")
				?.focus();
		});
	}

	private close(returnFocus: boolean): void {
		const group = this.openGroup;
		this.openGroup = undefined;
		if (!returnFocus || group === undefined || !this.wide.matches) return;
		void this.updateComplete.then(() => this.pill(group)?.focus());
	}

	private pill(group: string): HTMLElement | null {
		return this.renderRoot.querySelector<HTMLElement>(
			`button.pill[data-group="${CSS.escape(group)}"]`,
		);
	}

	override render() {
		const groups = this.groupIds();
		if (groups.length === 0) return nothing;
		const wide = this.wide.matches;
		const open =
			this.openGroup !== undefined && groups.includes(this.openGroup)
				? this.openGroup
				: undefined;
		return html`
			<div class="bar" role="group" aria-label=${t("filter.title")}>
				${groups.map((group) => this.renderPill(group, wide && open === group))}
				${
					isFilterActive(this.filter)
						? html`<button type="button" class="quiet clear-all" data-action="clear-filter" @click=${() => this.change(EMPTY_FILTER)}>
								${t("filter.clearAll")}
							</button>`
						: nothing
				}
			</div>
			${wide ? nothing : this.renderSheet(groups, open)}
		`;
	}

	private renderBadge(group: string) {
		const { include, exclude } = this.groupFilter(group);
		const count = include.length + exclude.length;
		if (count === 0) return nothing;
		return html`<span class="badge ${include.length === 0 ? "skip" : ""}" aria-hidden="true">${count}</span><span class="visually-hidden">${t("filter.selectedCount", { count })}</span>`;
	}

	private renderPill(group: string, open: boolean) {
		const active = this.groupFilter(group);
		const on = active.include.length + active.exclude.length > 0;
		return html`<span class="pill-wrap ${open ? "open" : ""} ${open && this.alignEnd ? "end" : ""}">
			<button
				type="button"
				class="pill ${on ? "on" : ""}"
				data-group=${group}
				aria-haspopup="dialog"
				aria-expanded=${open || (!this.wide.matches && this.openGroup === group) ? "true" : "false"}
				@click=${() => (this.openGroup === group ? this.close(true) : this.open(group))}
			>
				${groupLabel(group, this.defs)}${this.renderBadge(group)}${icon("chevron", 16)}
			</button>
			${open ? this.renderPopover(group) : nothing}
		</span>`;
	}

	private renderPopover(group: string) {
		const { include, exclude } = this.groupFilter(group);
		return html`<div
			class="popover"
			role="dialog"
			aria-label=${groupLabel(group, this.defs)}
			@keydown=${(event: KeyboardEvent) => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				this.close(true);
			}}
		>
			${this.renderFind(group)}
			<div class="popover-body">${this.renderRows(group)}</div>
			<div class="popover-foot">
				<button
					type="button"
					class="quiet"
					data-action="clear-group"
					?disabled=${include.length + exclude.length === 0}
					@click=${() => this.clearGroup(group)}
				>
					${t("filter.clear")}
				</button>
				<button type="button" class="quiet" data-action="filter-done" @click=${() => this.close(true)}>
					${t("filter.done")}
				</button>
			</div>
		</div>`;
	}

	private renderSheet(groups: string[], open: string | undefined) {
		const shown = applyFilter(this.restaurants, this.filter).length;
		return html`<app-sheet
			heading=${t("filter.title")}
			?open=${open !== undefined}
			@sheet-close=${() => {
				this.openGroup = undefined;
			}}
		>
			${
				open === undefined
					? nothing
					: html`<div class="sheet-head">
								<div class="tabs" role="tablist" aria-label=${t("filter.title")}>
									${groups.map(
										(group) => html`<button
											type="button"
											class="tab"
											role="tab"
											data-group=${group}
											aria-selected=${group === open ? "true" : "false"}
											aria-controls="filter-values"
											@click=${() => this.open(group)}
										>
											${groupLabel(group, this.defs)}${this.renderBadge(group)}
										</button>`,
									)}
								</div>
								${this.renderFind(open)}
							</div>
							<div id="filter-values" role="tabpanel" aria-label=${groupLabel(open, this.defs)}>
								${
									this.groupFilter(open).include.length +
										this.groupFilter(open).exclude.length >
									0
										? html`<div class="tab-actions">
												<button type="button" class="quiet" data-action="clear-group" @click=${() => this.clearGroup(open)}>
													${t("filter.clear")}
												</button>
											</div>`
										: nothing
								}
								${this.renderRows(open)}
							</div>`
			}
			<button
				slot="footer"
				type="button"
				class="primary"
				data-action="filter-done"
				@click=${() => this.close(false)}
			>
				${shown === 1 ? t("filter.show.one") : t("filter.show.other", { count: shown })}
			</button>
		</app-sheet>`;
	}

	private clearGroup(group: string): void {
		const { include, exclude } = this.groupFilter(group);
		let next = this.filter;
		for (const value of [...include, ...exclude])
			next = setTagState(next, group, value, "off");
		this.change(next);
	}

	private renderFind(group: string) {
		if (valueCounts(this.restaurants, group).length <= BIG) return nothing;
		const label = t("filter.find", { group: groupLabel(group, this.defs) });
		return html`<div class="find-wrap">
			<input
				class="find"
				type="search"
				autocomplete="off"
				placeholder=${label}
				aria-label=${label}
				.value=${this.query}
				@input=${(event: InputEvent) => {
					this.query = (event.target as HTMLInputElement).value;
				}}
			/>
		</div>`;
	}

	/**
	 * A small group: every value. A big one: the matches while searching; otherwise the values
	 * pinned when it opened, the most used, and Show all for the rest, A to Z.
	 */
	private renderRows(group: string) {
		const counts = valueCounts(this.restaurants, group);
		if (counts.length <= BIG) return this.renderList(group, counts);
		const query = this.query.trim().toLocaleLowerCase();
		if (query !== "") {
			const matches = counts.filter(({ value }) =>
				valueLabel(group, value).toLocaleLowerCase().includes(query),
			);
			return html`<h3 class="section-title">
					${matches.length === 1 ? t("filter.matches.one") : t("filter.matches.other", { count: matches.length })}
				</h3>
				${
					matches.length > 0
						? this.renderList(group, matches)
						: html`<p class="no-value">${t("filter.noValue", { query: this.query.trim() })}</p>`
				}`;
		}
		const pinned = this.pinned
			.map((value) => counts.find((item) => item.value === value))
			.filter((item) => item !== undefined);
		const rest = counts.filter((item) => !this.pinned.includes(item.value));
		const more = rest
			.slice(TOP)
			.sort((a, b) =>
				valueLabel(group, a.value).localeCompare(valueLabel(group, b.value)),
			);
		return html`
			${
				pinned.length > 0
					? html`<h3 class="section-title">${t("filter.selected")}</h3>${this.renderList(group, pinned)}`
					: nothing
			}
			<h3 class="section-title">${t("filter.mostUsed")}</h3>
			${this.renderList(group, rest.slice(0, TOP))}
			${
				more.length === 0
					? nothing
					: this.showAll
						? html`<h3 class="section-title">${t("filter.allValues")}</h3>${this.renderList(group, more)}`
						: html`<button type="button" class="show-all" data-action="show-all" @click=${() => {
								this.showAll = true;
							}}>${t("filter.showAll", { count: counts.length })}</button>`
			}
		`;
	}

	private renderList(group: string, counts: Count[]) {
		return html`<ul class="rows">
			${counts.map(({ value, count }) => this.renderRow(group, value, count))}
		</ul>`;
	}

	private renderRow(group: string, value: string, count: number) {
		const state = tagState(this.filter, group, value);
		const label = valueLabel(group, value);
		return html`<li class="row">
			<span class="name"><span class="label">${label}</span><span class="count">${count}</span></span>
			<span class="duo">
				<button
					type="button"
					class="want"
					data-action="want"
					data-value=${value}
					aria-pressed=${state === "include" ? "true" : "false"}
					aria-label=${t("filter.wantValue", { tag: label })}
					@click=${() => this.set(group, value, state === "include" ? "off" : "include")}
				><span aria-hidden="true">✓</span> ${t("filter.want")}</button>
				<button
					type="button"
					class="skip"
					data-action="skip"
					data-value=${value}
					aria-pressed=${state === "exclude" ? "true" : "false"}
					aria-label=${t("filter.skipValue", { tag: label })}
					@click=${() => this.set(group, value, state === "exclude" ? "off" : "exclude")}
				><span aria-hidden="true">✕</span> ${t("filter.skip")}</button>
			</span>
		</li>`;
	}
}
