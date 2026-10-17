import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import "#components/app-sheet";
import type { AppSheet } from "#components/app-sheet";
import {
	EMPTY_FORM,
	type FormContext,
	type FormState,
	type FormView,
	formFromRestaurant,
	formStyles,
	renderForm,
	withKind,
	withValues,
} from "#components/restaurant/form";
import { listStyles, renderRow, sortByName } from "#components/restaurant/list";
import { RestaurantSearch, searchStyles } from "#components/restaurant/search";
import type { TagInput } from "#components/tag-input";
import { type GroupDef, loadGroups, onGroupsChanged } from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import type { Kind, Restaurant } from "#lib/restaurant";
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

			.tags-link {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				/* Same height as the magnifier beside it, borders included. */
				box-sizing: border-box;
				min-height: var(--tap);
				padding: 0 0.875rem;
				border: 1px solid var(--color-control);
				border-radius: var(--radius-pill);
				background: var(--color-surface);
				color: var(--color-text);
				font-size: 0.875rem;
				font-weight: 500;
				text-decoration: none;
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
		listStyles,
		formStyles,
		searchStyles,
	];

	protected readonly langController = new LangController(this);

	/** Wide screens show the form in a side panel; phones open it in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	private readonly search = new RestaurantSearch(this, {
		sorted: () => sortByName(this.restaurants),
		shortcutEnabled: () => this.wide.matches && this.restaurants.length > 0,
		onPick: (item) => this.startEdit(item),
		onAddNamed: (name) => this.startAddNamed(name),
		focusAfterRender: (find) => this.focusAfterRender(find),
	});

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

	/** Stored entries the last load could not read. */
	@state()
	private skipped = 0;

	/** The form as the open sheet last drew it. */
	private shownView: FormView | undefined;

	/** Drawn in the sheet while it slides away, so its fields do not empty mid-slide. */
	@state()
	private leavingView: FormView | undefined;

	private leaveTimer: ReturnType<typeof setTimeout> | undefined;

	/** The group definitions saved so far, in their stored order. */
	@state()
	private defs: GroupDef[] = [];

	private get tagInputs(): TagInput[] {
		return [...this.renderRoot.querySelectorAll("tag-input")];
	}

	/** `updatedAt` of the restaurant when it was loaded into the form. */
	private editingUpdatedAt: string | undefined;

	private unsubscribe: (() => void) | undefined;
	private unsubscribeGroups: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		this.defs = loadGroups();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			this.skipped = skippedCount();
			// Nothing left to search: end search outright rather than leave a dead "0 of 0" view.
			if (this.search.searching && this.restaurants.length === 0)
				this.search.end();
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
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.unsubscribeGroups?.();
		this.unsubscribeGroups = undefined;
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
					this.renderRoot.querySelector("#form-title"),
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
		};
	}

	private resetForm(): void {
		this.form = EMPTY_FORM;
		this.editingId = undefined;
		this.nameError = undefined;
		for (const input of this.tagInputs) input.clearText();
	}

	private readonly onInput = (event: Event): void => {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		const field = target.name as "name" | "location" | "notes";
		this.form = { ...this.form, [field]: target.value };
		if (field === "name") this.nameError = undefined;
	};

	private readonly onKindChange = (event: Event): void => {
		const box = event.target as HTMLInputElement;
		this.form = withKind(this.form, box.value as Kind, box.checked);
	};

	private readonly submit = (event: Event): void => {
		event.preventDefault();
		// Text still in a box counts as a value, the same as pressing Enter.
		let tags = this.form.tags;
		// A group deleted elsewhere while this form was open unmounts its input, but its values
		// stay in form state until submit demotes them to tags (normalizeInput drops unknown ids).
		const typed: [string, string[]][] = [];
		for (const input of this.tagInputs) {
			const group = input.getAttribute("data-group") ?? "tags";
			const values = input.commit();
			if (group === "tags") tags = values;
			else typed.push([group, values]);
		}
		const groups: Record<string, string[]> = {
			...this.form.groups,
			...Object.fromEntries(typed),
		};
		if (this.form.name.trim() === "") {
			this.nameError = "manager.nameRequired";
			return;
		}
		const input = {
			name: this.form.name,
			location: this.form.location,
			notes: this.form.notes,
			kinds: this.form.kinds,
			tags,
			groups,
		};
		const editingId = this.editingId;
		const name = input.name.trim();
		const wasSearching = this.search.searching;
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
		this.form = formFromRestaurant(item);
	}

	private startEdit(item: Restaurant): void {
		this.confirmingId = undefined;
		this.status = "";
		// Text typed for the previous form must not become a value of this restaurant.
		for (const input of this.tagInputs) input.clearText();
		this.fillForm(item);
		this.sheetOpen = !this.wide.matches;
		this.panelOpen = this.wide.matches;
		// A sheet puts focus on its own title; the side panel starts at the name.
		if (!this.sheetOpen)
			this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
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
			this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	}

	/** The no-match card's Add: a new restaurant already named what was searched for. */
	private startAddNamed(name: string): void {
		this.openAdd();
		this.form = { ...this.form, name };
	}

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
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(
				this.search.searching ? "#search" : ".head button.add",
			),
		);
	}

	/** Swapping the row's buttons removes the focused one, so move focus to its replacement. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	/**
	 * After saving while searching: the saved restaurant's row still has whatever matched it in
	 * view, so land there; a save that took it out of the query (or the sheet closing stole focus)
	 * instead goes back to the field. app-sheet only reclaims focus for its opener when focus is on
	 * `body` or still inside the sheet, so setting it here deliberately wins either way.
	 */
	private focusAfterSave(id: string): void {
		this.focusAfterRender(() => {
			const inResults = this.search
				.results(sortByName(this.restaurants))
				.some(({ item }) => item.id === id);
			return inResults
				? this.renderRoot.querySelector(`li[data-id="${id}"] button`)
				: this.renderRoot.querySelector("#search");
		});
	}

	private askDelete(id: string): void {
		this.confirmingId = id;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="confirm-delete"]'),
		);
	}

	private cancelDelete(): void {
		this.confirmingId = undefined;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="delete"]'),
		);
	}

	private confirmDelete(id: string): void {
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
	}

	private formContext(): FormContext {
		return {
			restaurants: this.restaurants,
			defs: this.defs,
			onSubmit: this.submit,
			onInput: this.onInput,
			onKindChange: this.onKindChange,
			onValuesChange: (group, values) => {
				this.form = withValues(this.form, group, values);
			},
			onCancelEdit: this.cancelEdit,
			onAskDelete: (id) => this.askDelete(id),
			onConfirmDelete: (id) => this.confirmDelete(id),
			onCancelDelete: () => this.cancelDelete(),
		};
	}

	override render() {
		const sorted = sortByName(this.restaurants);
		const wide = this.wide.matches;
		const searching = this.search.searching;
		const editing = this.restaurants.find((item) => item.id === this.editingId);
		const formTitle =
			editing === undefined
				? t("manager.addTitle")
				: t("manager.editTitle", { name: editing.name });
		const count = this.search.countText(sorted);
		const results = this.search.results(sorted);
		const formContext = this.formContext();
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
					<p class="count page-sub" aria-hidden=${searching ? "true" : nothing}>${count}</p>
				</div>
				<div class="head-actions" ?hidden=${searching}>
					${sorted.length > 0 ? this.search.renderOpen() : nothing}
					<a class="tags-link" href="./tags">${icon("tag", 18)}<span>${t("nav.tags")}</span></a>
					${wide ? add : nothing}
				</div>
			</header>
			${this.search.renderRow(sorted, count)}
			</div>
			${this.search.renderAnnounce()}
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
				<div class="list-col">
					${
						sorted.length === 0
							? html`<div class="card empty">
									<p>${t("manager.empty")}</p>
									<button type="button" class="primary" data-action="add" @click=${this.startAdd}>${addLabel}</button>
								</div>`
							: results.length === 0
								? this.search.renderNoMatch()
								: html`<ul class="group list">${repeat(
										results,
										({ item }) => item.id,
										({ item, ranges }) =>
											renderRow(
												item,
												ranges,
												this.editingId === item.id,
												(row) => this.startEdit(row),
											),
									)}</ul>`
					}
				</div>
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
								${renderForm(this.currentView(), formContext)}
							</section>`
						: nothing
				}
			</div>
			${
				wide
					? nothing
					: html`<div class="pinned">${add}</div>
							<app-sheet heading=${formTitle} ?open=${this.sheetOpen} @sheet-close=${this.onSheetClose}>
								${renderForm(this.sheetView(), formContext)}
							</app-sheet>`
			}
		`;
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
