import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import "#components/app-sheet";
import type { AppSheet } from "#components/app-sheet";
import "#components/restaurant/form";
import {
	EMPTY_FORM,
	type FormState,
	type FormView,
	formFromRestaurant,
	type RestaurantForm,
} from "#components/restaurant/form";
import "#components/restaurant/filter";
import type { RestaurantFilter } from "#components/restaurant/filter";
import "#components/restaurant/list";
import type { RestaurantList } from "#components/restaurant/list";
import "#components/restaurant/search";
import type { RestaurantSearch } from "#components/restaurant/search";
import {
	applyFilter,
	EMPTY_FILTER,
	type Filter,
	isFilterActive,
	LIST_FILTER,
	loadFilter,
	onFilterChanged,
	pruneFilter,
	saveFilter,
} from "#lib/filter";
import {
	allGroupIds,
	type GroupDef,
	loadGroups,
	onGroupsChanged,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import { isLink, type Restaurant } from "#lib/restaurant";
import { countText, searchByName, searchWords } from "#lib/search";
import {
	addRestaurant,
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	removeRestaurant,
	skippedCount,
	updateRestaurant,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

/**
 * The restaurants page: the header, `restaurant-search`, `restaurant-list` and
 * `restaurant-form` (in a side panel on wide screens, a sheet on phones). It owns the store and
 * the form's state; the parts below it only draw what they are given and report what is done.
 */
@customElement("restaurant-manager")
export class RestaurantManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/* Phone: fill the space above the tab bar so the pinned Add ends the column even with little content. */
			:host {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				min-height: calc(100dvh - 1.25rem - var(--tab-bar-height));
				margin-bottom: calc(var(--tab-bar-height) - var(--tab-bar-space));
			}

			/*
			 * Phone: the title row (and the search row while searching) stays at the top, so search
			 * is one tap away in a long list and results scroll underneath the field.
			 */
			.top {
				position: sticky;
				top: 0;
				z-index: 4;
				display: grid;
				gap: 1rem;
				margin-top: -0.75rem;
				padding-block: 0.75rem;
				background: var(--color-bg);
			}

			.head {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-end;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.head-actions {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}

			.head-actions[hidden] {
				display: none;
			}

			.search-open {
				width: var(--tap);
				min-height: var(--tap);
				padding: 0;
				border-radius: var(--radius-pill);
			}

			/* A pill as tall as the magnifier beside it. */
			.filter-open {
				gap: 0.375rem;
				min-height: var(--tap);
				padding: 0 0.875rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
			}

			.status:empty {
				display: none;
			}

			.layout {
				display: grid;
				gap: 1rem;
			}

			.edit-panel {
				gap: 1rem;
			}

			.panel-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.panel-head .close {
				flex: none;
				width: var(--tap);
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: var(--color-surface-2);
			}

			/* Icon only: the plus says Add, the aria-label says what for. */
			button.add {
				width: var(--tap);
				padding: 0;
				border-radius: 50%;
			}

			.edit-panel h2 {
				font-size: 1.125rem;
				font-weight: 600;
			}

			/* Phone: Add stays at the bottom right, just above the tab bar. */
			.pinned {
				position: sticky;
				z-index: 5;
				bottom: var(--tab-bar-height);
				display: flex;
				justify-content: flex-end;
				margin-top: auto;
				padding: 0.75rem 0 0.5rem;
				background: linear-gradient(to bottom, transparent, var(--color-bg) 35%);
			}

			.pinned .add {
				width: 3.5rem;
				min-height: 3.5rem;
				box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
			}

			@media (min-width: 48rem) {
				:host {
					min-height: 0;
					margin-bottom: 0;
				}

				.layout.wide {
					grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
					align-items: start;
					gap: 1.5rem;
				}

				.edit-panel {
					position: sticky;
					top: 1rem;
				}

				/* The side panel is the sticky part on wide screens; the top row scrolls away. */
				.top {
					position: static;
					margin-top: 0;
					padding-block: 0;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Wide screens show the form in a side panel; phones open it in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	/** The width class as of the last render, to catch a wide-to-narrow crossing mid-edit. */
	private wasWide = this.wide.matches;

	/** Whether the phone form sheet is open. */
	@state()
	private sheetOpen = false;

	/** Whether the wide side panel is open; it starts hidden so the list gets the full width. */
	@state()
	private panelOpen = false;

	/** The last save or delete, read out and shown under the title. */
	@state()
	private status = "";

	@state()
	private restaurants: Restaurant[] = [];

	@state()
	private form: FormState = EMPTY_FORM;

	@state()
	private editingId: string | undefined;

	@state()
	private confirmingId: string | undefined;

	@state()
	private nameError: "manager.nameRequired" | undefined;

	@state()
	private linkError: "manager.linkInvalid" | undefined;

	/** Stored entries the last load could not read. */
	@state()
	private skipped = 0;

	/** Whether `restaurant-search` is open, as it last reported. */
	@state()
	private searching = false;

	/** What `restaurant-search` last reported as typed. */
	@state()
	private query = "";

	/** The form as the open sheet last drew it. */
	private shownView: FormView | undefined;

	/** Drawn in the sheet while it slides away, so its fields do not empty mid-slide. */
	@state()
	private leavingView: FormView | undefined;

	private leaveTimer: ReturnType<typeof setTimeout> | undefined;

	/** The group definitions saved so far, in their stored order. */
	@state()
	private defs: GroupDef[] = [];

	/** `updatedAt` of the restaurant when it was loaded into the form. */
	private editingUpdatedAt: string | undefined;

	/** This page's own filter, apart from Home's; it filters plain tags too. */
	@state()
	private filter: Filter = EMPTY_FILTER;

	private unsubscribe: (() => void) | undefined;
	private unsubscribeGroups: (() => void) | undefined;
	private unsubscribeFilter: (() => void) | undefined;

	/** The restaurants the filter keeps. */
	private get shown(): Restaurant[] {
		return applyFilter(this.restaurants, this.filter);
	}

	/** Drop filter values no restaurant uses any more; save only when that changed something. */
	private pruneFilter(): void {
		const pruned = pruneFilter(
			this.filter,
			this.restaurants,
			[...allGroupIds(this.defs), "tags"],
			LIST_FILTER,
		);
		if (JSON.stringify(pruned) !== JSON.stringify(this.filter))
			saveFilter(pruned, LIST_FILTER);
		this.filter = pruned;
	}

	private readonly setFilter = (next: Filter): void => {
		this.filter = next;
		saveFilter(next, LIST_FILTER);
	};

	/** How many values the filter includes or excludes, across every group. */
	private activeValueCount(): number {
		return Object.values(this.filter).reduce(
			(count, group) => count + group.include.length + group.exclude.length,
			0,
		);
	}

	/** Whether any restaurant has a value the filter could use. */
	private hasFilterValues(): boolean {
		return this.restaurants.some(
			(item) =>
				item.kinds.length > 0 ||
				item.tags.length > 0 ||
				Object.values(item.groups).some((values) => values.length > 0),
		);
	}

	private get search(): RestaurantSearch | null {
		return this.renderRoot.querySelector("restaurant-search");
	}

	private get filterPart(): RestaurantFilter | null {
		return this.renderRoot.querySelector("restaurant-filter");
	}

	private get list(): RestaurantList | null {
		return this.renderRoot.querySelector("restaurant-list");
	}

	private get forms(): RestaurantForm[] {
		return [...this.renderRoot.querySelectorAll("restaurant-form")];
	}

	/** Done once this and every part under it has drawn, including updates they set off here. */
	protected override async getUpdateComplete(): Promise<boolean> {
		let done = await super.getUpdateComplete();
		for (;;) {
			const parts = this.renderRoot.querySelectorAll<LitElement>(
				"restaurant-search, restaurant-filter, restaurant-list, restaurant-form",
			);
			await Promise.all([...parts].map((part) => part.updateComplete));
			if (!this.isUpdatePending) return done;
			done = await super.getUpdateComplete();
		}
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		this.defs = loadGroups();
		this.filter = loadFilter(LIST_FILTER);
		this.pruneFilter();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			this.skipped = skippedCount();
			this.pruneFilter();
			if (this.editingId === undefined) return;
			const editing = this.restaurants.find(
				(item) => item.id === this.editingId,
			);
			if (editing === undefined) {
				this.resetForm();
				this.sheetOpen = false;
				this.panelOpen = false;
			}
			// Saved elsewhere (another tab): show the newer version rather than overwrite it.
			else if (editing.updatedAt !== this.editingUpdatedAt)
				this.fillForm(editing);
		});
		this.unsubscribeGroups = onGroupsChanged(() => {
			this.defs = loadGroups();
			this.restaurants = loadRestaurants();
			this.pruneFilter();
		});
		// Another tab saved the filter (for example after renaming a value): take it as it is.
		// Pruning waits for the restaurant change that tab saves next.
		this.unsubscribeFilter = onFilterChanged(() => {
			this.filter = loadFilter(LIST_FILTER);
		}, LIST_FILTER);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.unsubscribeGroups?.();
		this.unsubscribeGroups = undefined;
		this.unsubscribeFilter?.();
		this.unsubscribeFilter = undefined;
		clearTimeout(this.leaveTimer);
	}

	/**
	 * Crossing into the wide layout stops rendering the phone sheet entirely, which removes its
	 * modal `<dialog>` from the DOM without ever firing a close: close it here instead, so it does
	 * not reopen by itself if the screen narrows again. If focus was inside it, send focus to the
	 * panel's heading rather than losing it.
	 *
	 * Crossing back to narrow with the panel open would otherwise hide its form behind a closed
	 * sheet: open the sheet instead, with the same form state.
	 */
	protected override willUpdate(changed: PropertyValues): void {
		if (changed.has("sheetOpen"))
			this.trackLeaving(changed.get("sheetOpen") as boolean | undefined);
		const wide = this.wide.matches;
		if (wide && this.sheetOpen) {
			const focusWasInSheet =
				this.renderRoot.querySelector("app-sheet")?.containsFocus() ?? false;
			this.sheetOpen = false;
			this.panelOpen = true;
			if (focusWasInSheet)
				this.focusAfterRender(() =>
					this.renderRoot.querySelector<HTMLElement>("#form-title")?.focus(),
				);
		} else if (this.wasWide && !wide && this.panelOpen) {
			this.panelOpen = false;
			this.sheetOpen = true;
		}
		this.wasWide = wide;
	}

	/** Keep the last drawn form for as long as the closed sheet is still sliding away. */
	private trackLeaving(wasOpen: boolean | undefined): void {
		clearTimeout(this.leaveTimer);
		this.leavingView = undefined;
		if (!wasOpen || this.sheetOpen) return;
		const ms =
			this.renderRoot.querySelector<AppSheet>("app-sheet")?.leaveDuration() ??
			0;
		if (ms <= 0 || this.shownView === undefined) return;
		this.leavingView = this.shownView;
		this.leaveTimer = setTimeout(() => {
			this.leavingView = undefined;
		}, ms);
	}

	private currentView(): FormView {
		return {
			form: this.form,
			editingId: this.editingId,
			confirmingId: this.confirmingId,
			nameError: this.nameError,
			linkError: this.linkError,
		};
	}

	private resetForm(): void {
		this.form = EMPTY_FORM;
		this.editingId = undefined;
		this.nameError = undefined;
		this.linkError = undefined;
		for (const form of this.forms) form.clearText();
	}

	private readonly onFormChange = (event: CustomEvent<FormState>): void => {
		if (event.detail.name !== this.form.name) this.nameError = undefined;
		if (event.detail.link !== this.form.link) this.linkError = undefined;
		this.form = event.detail;
	};

	private readonly onFormSubmit = (event: CustomEvent<FormState>): void => {
		const input = event.detail;
		const link = input.link.trim();
		if (input.name.trim() === "") this.nameError = "manager.nameRequired";
		if (link !== "" && !isLink(link)) this.linkError = "manager.linkInvalid";
		if (this.nameError !== undefined || this.linkError !== undefined) return;
		const editingId = this.editingId;
		const name = input.name.trim();
		const wasSearching = this.searching;
		// Reset before saving so the store's change callback already sees a clean form.
		this.resetForm();
		this.sheetOpen = false;
		this.closePanel();
		const list =
			editingId === undefined
				? addRestaurant(input)
				: updateRestaurant(editingId, input);
		const savedId = editingId ?? list.at(-1)?.id;
		if (wasSearching && savedId !== undefined) this.focusAfterSave(savedId);
		// Clear first, then set the real text once that clear has rendered: saving the same name
		// again still changes the live region's text, so it is announced again.
		this.status = "";
		void this.updateComplete.then(() => {
			this.status = t("manager.saved", { name });
		});
	};

	private fillForm(item: Restaurant): void {
		this.editingId = item.id;
		this.editingUpdatedAt = item.updatedAt;
		this.nameError = undefined;
		this.linkError = undefined;
		this.form = formFromRestaurant(item);
	}

	private startEdit(item: Restaurant): void {
		this.confirmingId = undefined;
		this.status = "";
		// Text typed for the previous form must not become a value of this restaurant.
		for (const form of this.forms) form.clearText();
		this.fillForm(item);
		this.sheetOpen = !this.wide.matches;
		this.panelOpen = this.wide.matches;
		// A sheet puts focus on its own title; the side panel starts at the name.
		if (!this.sheetOpen)
			this.focusAfterRender(() => this.forms[0]?.focusName());
	}

	/** Add again on an open add panel hides it; on an edit it switches to a new restaurant. */
	private readonly startAdd = (): void => {
		if (this.panelOpen && this.editingId === undefined) {
			this.confirmingId = undefined;
			this.status = "";
			this.resetForm();
			this.closePanel();
			return;
		}
		this.openAdd();
	};

	private openAdd(): void {
		this.confirmingId = undefined;
		this.status = "";
		this.resetForm();
		this.sheetOpen = !this.wide.matches;
		this.panelOpen = this.wide.matches;
		// A sheet puts focus on its own title; the side panel starts at the name.
		if (!this.sheetOpen)
			this.focusAfterRender(() => this.forms[0]?.focusName());
	}

	/** The list's Add: from the no-match card, a new restaurant already named what was searched for. */
	private readonly onListAdd = (
		event: CustomEvent<{ name?: string }>,
	): void => {
		const { name } = event.detail;
		if (name === undefined) {
			this.startAdd();
			return;
		}
		this.openAdd();
		this.form = { ...this.form, name };
	};

	private readonly onSearchChange = (
		event: CustomEvent<{ searching: boolean; query: string }>,
	): void => {
		this.searching = event.detail.searching;
		this.query = event.detail.query;
	};

	/** Search ended by the user: the magnifier comes back, so focus goes to it. */
	private readonly onSearchCancel = (): void => {
		this.focusAfterRender(() =>
			this.renderRoot
				.querySelector<HTMLElement>('[data-action="search"]')
				?.focus(),
		);
	};

	/** The sheet closed by ✕, Esc or the backdrop: drop whatever was typed. */
	private readonly onSheetClose = (): void => {
		this.sheetOpen = false;
		this.confirmingId = undefined;
		this.status = "";
		this.resetForm();
	};

	private readonly cancelEdit = (): void => {
		this.status = "";
		this.resetForm();
		this.sheetOpen = false;
		this.closePanel();
	};

	/** The panel's close button: drop whatever was typed. */
	private readonly onPanelClose = (): void => {
		this.confirmingId = undefined;
		this.status = "";
		this.resetForm();
		this.closePanel();
	};

	/** Hide the side panel; its button goes away, so focus returns to Add (hidden while searching). */
	private closePanel(): void {
		if (!this.panelOpen) return;
		this.panelOpen = false;
		this.focusAfterRender(() => {
			if (this.searching) this.search?.focusField();
			else
				this.renderRoot.querySelector<HTMLElement>(".head button.add")?.focus();
		});
	}

	/** Move focus once this and its parts have drawn what was just changed. */
	private focusAfterRender(focus: () => void): void {
		void this.updateComplete.then(focus);
	}

	/**
	 * After saving while searching: the saved restaurant's row still has whatever matched it in
	 * view, so land there; a save that took it out of the query (or the sheet closing stole focus)
	 * instead goes back to the field. app-sheet only reclaims focus for its opener when focus is on
	 * `body` or still inside the sheet, so setting it here deliberately wins either way.
	 */
	private focusAfterSave(id: string): void {
		this.focusAfterRender(() => {
			if (!this.list?.focusRow(id)) this.search?.focusField();
		});
	}

	private readonly onDeleteRequest = (event: CustomEvent<string>): void => {
		this.confirmingId = event.detail;
	};

	private readonly onDeleteCancel = (): void => {
		this.confirmingId = undefined;
	};

	private readonly onDeleteConfirm = (event: CustomEvent<string>): void => {
		const id = event.detail;
		const name = this.restaurants.find((item) => item.id === id)?.name ?? "";
		this.confirmingId = undefined;
		this.sheetOpen = false;
		this.closePanel();
		removeRestaurant(id);
		this.resetForm();
		// Clear first, then set the real text once that clear has rendered: deleting the same name
		// again still changes the live region's text, so it is announced again.
		this.status = "";
		void this.updateComplete.then(() => {
			this.status = t("manager.deleted", { name });
		});
	};

	override render() {
		const wide = this.wide.matches;
		const searching = this.searching;
		const query = searching ? this.query : "";
		const shown = this.shown;
		const filterCount = this.activeValueCount();
		const editing = this.restaurants.find((item) => item.id === this.editingId);
		const formTitle =
			editing === undefined
				? t("manager.addTitle")
				: t("manager.editTitle", { name: editing.name });
		const addLabel = t("manager.addLabel");
		const add = html`<button
			type="button"
			class="primary add"
			data-action="add"
			aria-label=${addLabel}
			title=${addLabel}
			aria-expanded=${wide ? String(this.panelOpen) : nothing}
			aria-controls=${wide ? "edit-panel" : nothing}
			@click=${this.startAdd}
		>
			${icon("plus", 24)}
		</button>`;
		return html`
			<div class="top">
			<header class="head">
				<div class=${searching ? "visually-hidden" : ""}>
					<h1 class="page-title">${t("manager.title")}</h1>
					<p class="count page-sub" aria-hidden=${searching ? "true" : nothing}>${this.countLine(shown, query)}</p>
				</div>
				<div class="head-actions" ?hidden=${searching}>
					${
						this.restaurants.length > 0
							? html`<button
									type="button"
									class="search-open"
									data-action="search"
									aria-label=${t("search.open")}
									@click=${() => this.search?.open()}
								>
									${icon("search", 20)}
								</button>`
							: nothing
					}
					${
						this.hasFilterValues()
							? html`<button
									type="button"
									class="filter-open"
									data-action="open-filter"
									aria-haspopup="dialog"
									@click=${() => this.filterPart?.open()}
								>
									${icon("funnel", 18)}<span>${filterCount > 0 ? t("filter.openCount", { count: filterCount }) : t("filter.title")}</span>
								</button>`
							: nothing
					}
					${wide ? add : nothing}
				</div>
			</header>
			<restaurant-search
				.restaurants=${shown}
				@search-change=${this.onSearchChange}
				@search-cancel=${this.onSearchCancel}
				@search-pick=${(event: CustomEvent<Restaurant>) => this.startEdit(event.detail)}
			></restaurant-search>
			<restaurant-filter
				.restaurants=${this.restaurants}
				.defs=${this.defs}
				.filter=${this.filter}
				@filter-change=${(event: CustomEvent<Filter>) => this.setFilter(event.detail)}
			></restaurant-filter>
			</div>
			${isMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			<p class="status success" role="status">${this.status}</p>
			<div class="layout ${wide && this.panelOpen ? "wide" : ""}">
				${
					shown.length === 0 && this.restaurants.length > 0
						? html`<div class="list-col card empty filter-no-match">
								<p>${t("filter.noMatch")}</p>
								<button type="button" data-action="clear-list-filter" @click=${() => this.setFilter(EMPTY_FILTER)}>
									${t("filter.clear")}
								</button>
							</div>`
						: html`<restaurant-list
								class="list-col"
								.restaurants=${shown}
								.query=${query}
								.currentId=${this.editingId}
								@restaurant-edit=${(event: CustomEvent<Restaurant>) => this.startEdit(event.detail)}
								@restaurant-add=${this.onListAdd}
								@search-clear=${() => this.search?.clear()}
							></restaurant-list>`
				}
				${
					wide && this.panelOpen
						? html`<section id="edit-panel" class="card edit-panel" aria-labelledby="form-title">
								<div class="panel-head">
									<h2 id="form-title" tabindex="-1">${formTitle}</h2>
									<button
										type="button"
										class="close"
										data-action="close-panel"
										aria-label=${t("sheet.close")}
										@click=${this.onPanelClose}
									>
										${icon("x", 20)}
									</button>
								</div>
								${this.renderForm(this.currentView())}
							</section>`
						: nothing
				}
			</div>
			${
				wide
					? nothing
					: html`<div class="pinned">${add}</div>
							<app-sheet class="form-sheet" heading=${formTitle} ?open=${this.sheetOpen} @sheet-close=${this.onSheetClose}>
								${this.renderForm(this.sheetView())}
							</app-sheet>`
			}
		`;
	}

	/** The title's count: how many the filter and search keep of all of them, when either narrows. */
	private countLine(shown: readonly Restaurant[], query: string): string {
		if (!isFilterActive(this.filter)) return countText(this.restaurants, query);
		const kept =
			searchWords(query).length > 0
				? searchByName(shown, query).length
				: shown.length;
		return t("search.count", { shown: kept, total: this.restaurants.length });
	}

	private renderForm(view: FormView) {
		return html`<restaurant-form
			.view=${view}
			.restaurants=${this.restaurants}
			.defs=${this.defs}
			@form-change=${this.onFormChange}
			@form-submit=${this.onFormSubmit}
			@form-cancel=${this.cancelEdit}
			@delete-request=${this.onDeleteRequest}
			@delete-cancel=${this.onDeleteCancel}
			@delete-confirm=${this.onDeleteConfirm}
		></restaurant-form>`;
	}

	/** The open sheet draws the live form; a sliding-away one keeps what it last drew. */
	private sheetView(): FormView {
		if (!this.sheetOpen && this.leavingView !== undefined)
			return this.leavingView;
		const view = this.currentView();
		if (this.sheetOpen) this.shownView = view;
		return view;
	}
}
