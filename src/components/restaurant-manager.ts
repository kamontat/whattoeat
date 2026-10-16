import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import "#components/app-sheet";
import "#components/tag-input";
import type { TagInput } from "#components/tag-input";
import {
	type GroupDef,
	groupLabel,
	loadGroups,
	onGroupsChanged,
} from "#lib/groups";
import { getLang, LangController, type MessageKey, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import {
	isNameTaken,
	KINDS,
	type Kind,
	metaLine,
	type Restaurant,
	VALUE_GROUPS,
	valuesByUsage,
} from "#lib/restaurant";
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

type FormState = {
	name: string;
	location: string;
	notes: string;
	kinds: Kind[];
	tags: string[];
	/** Values by group id: cuisine, area and custom groups. */
	groups: Record<string, string[]>;
};

const EMPTY_FORM: FormState = {
	name: "",
	location: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
};

const HINTS: Record<string, MessageKey> = {
	cuisine: "field.cuisineHint",
	area: "field.areaHint",
};

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

			.tags-link {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				min-height: 2.25rem;
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

			.list .row {
				min-height: 3.5rem;
			}

			.list .meta {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.list .row[aria-current="true"] {
				background: var(--color-surface-2);
				box-shadow: inset 3px 0 0 var(--color-primary);
			}

			@media (forced-colors: active) {
				.list .row[aria-current="true"] {
					outline: 2px solid CanvasText;
					outline-offset: -2px;
				}
			}

			.edit-panel {
				gap: 1rem;
			}

			.edit-panel h2 {
				font-size: 1.125rem;
				font-weight: 600;
			}

			form {
				display: grid;
				gap: 1rem;
			}

			/* Type: each checkbox is a pill that fills in when ticked. */
			fieldset.kinds {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				border: 0;
			}

			fieldset.kinds legend {
				padding: 0;
				margin-bottom: 0.375rem;
				font-weight: 600;
			}

			fieldset.kinds label {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				min-height: 2.25rem;
				padding: 0 0.875rem 0 0.625rem;
				border: 1px solid var(--color-control);
				border-radius: var(--radius-pill);
				background: var(--color-surface);
				font-weight: 500;
				cursor: pointer;
			}

			fieldset.kinds label:has(input:checked) {
				border-color: var(--color-primary);
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			fieldset.kinds label:has(input:focus-visible) {
				outline: 3px solid var(--color-focus);
				outline-offset: 2px;
			}

			fieldset.kinds input {
				width: 1rem;
				height: 1rem;
				margin: 0;
				padding: 0;
				accent-color: var(--color-primary);
			}

			/* Cuisine and area side by side when there is room. */
			.pair {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
				gap: 1rem;
			}

			.delete-zone {
				display: grid;
				gap: 0.625rem;
				padding-top: 1rem;
				border-top: 1px solid var(--color-border);
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
				min-height: 3rem;
				padding: 0 1.25rem;
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
	private nameError: "manager.nameRequired" | "manager.nameTaken" | undefined;

	/** Stored entries the last load could not read. */
	@state()
	private skipped = 0;

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
			if (this.editingId === undefined) return;
			const editing = this.restaurants.find(
				(item) => item.id === this.editingId,
			);
			if (editing === undefined) {
				this.resetForm();
				this.sheetOpen = false;
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
	}

	/**
	 * Crossing into the wide layout stops rendering the phone sheet entirely, which removes its
	 * modal `<dialog>` from the DOM without ever firing a close: close it here instead, so it does
	 * not reopen by itself if the screen narrows again. If focus was inside it, send focus to the
	 * panel's heading rather than losing it.
	 *
	 * Crossing back to narrow while an edit (or an unsaved add) is in progress would otherwise
	 * hide it behind a closed sheet: open the sheet instead, with the same form state.
	 */
	protected override willUpdate(): void {
		const wide = this.wide.matches;
		if (wide && this.sheetOpen) {
			const focusWasInSheet =
				this.renderRoot.querySelector("app-sheet")?.containsFocus() ?? false;
			this.sheetOpen = false;
			if (focusWasInSheet)
				this.focusAfterRender(() =>
					this.renderRoot.querySelector("#form-title"),
				);
		} else if (
			this.wasWide &&
			!wide &&
			(this.editingId !== undefined || this.form.name !== "")
		) {
			this.sheetOpen = true;
		}
		this.wasWide = wide;
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
		const kind = box.value as Kind;
		const kinds = this.form.kinds.filter((item) => item !== kind);
		this.form = {
			...this.form,
			kinds: box.checked
				? KINDS.filter((item) => item === kind || kinds.includes(item))
				: kinds,
		};
	};

	private onValuesChange(group: string, values: string[]): void {
		this.form =
			group === "tags"
				? { ...this.form, tags: values }
				: { ...this.form, groups: { ...this.form.groups, [group]: values } };
	}

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
		if (isNameTaken(loadRestaurants(), this.form.name, this.editingId)) {
			this.nameError = "manager.nameTaken";
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
		// Reset before saving so the store's change callback already sees a clean form.
		this.resetForm();
		this.sheetOpen = false;
		if (editingId === undefined) addRestaurant(input);
		else updateRestaurant(editingId, input);
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
		this.form = {
			name: item.name,
			location: item.location,
			notes: item.notes,
			kinds: item.kinds,
			tags: item.tags,
			groups: { ...item.groups },
		};
	}

	private startEdit(item: Restaurant): void {
		this.confirmingId = undefined;
		this.status = "";
		// Text typed for the previous form must not become a value of this restaurant.
		for (const input of this.tagInputs) input.clearText();
		this.fillForm(item);
		this.sheetOpen = !this.wide.matches;
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	}

	private readonly startAdd = (): void => {
		this.confirmingId = undefined;
		this.status = "";
		this.resetForm();
		this.sheetOpen = !this.wide.matches;
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
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
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	};

	/** Swapping the row's buttons removes the focused one, so move focus to its replacement. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
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
		removeRestaurant(id);
		this.resetForm();
		// Clear first, then set the real text once that clear has rendered: deleting the same name
		// again still changes the live region's text, so it is announced again.
		this.status = "";
		void this.updateComplete.then(() => {
			this.status = t("manager.deleted", { name });
		});
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	}

	override render() {
		const sorted = [...this.restaurants].sort((a, b) =>
			a.name.localeCompare(b.name, getLang()),
		);
		const wide = this.wide.matches;
		const editing = this.restaurants.find((item) => item.id === this.editingId);
		const formTitle =
			editing === undefined
				? t("manager.addTitle")
				: t("manager.editTitle", { name: editing.name });
		const count =
			sorted.length === 1
				? t("picker.count.one")
				: t("picker.count.other", { count: sorted.length });
		const add = html`<button type="button" class="primary add" data-action="add" @click=${this.startAdd}>
			${icon("plus", 20)}<span>${t("manager.add")}</span>
		</button>`;
		return html`
			<header class="head">
				<div>
					<h1 class="page-title">${t("manager.title")}</h1>
					<p class="count page-sub">${count}</p>
				</div>
				<div class="head-actions">
					<a class="tags-link" href="./tags">${icon("tag", 18)}<span>${t("nav.tags")}</span></a>
					${wide ? add : nothing}
				</div>
			</header>
			${isMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			<p class="status success" role="status">${this.status}</p>
			<div class="layout ${wide ? "wide" : ""}">
				<div class="list-col">
					${
						sorted.length === 0
							? html`<p class="muted empty">${t("manager.empty")}</p>`
							: html`<ul class="group list">${sorted.map((item) => this.renderRow(item))}</ul>`
					}
				</div>
				${
					wide
						? html`<section class="card edit-panel" aria-labelledby="form-title">
								<h2 id="form-title" tabindex="-1">${formTitle}</h2>
								${this.renderForm()}
							</section>`
						: nothing
				}
			</div>
			${
				wide
					? nothing
					: html`<div class="pinned">${add}</div>
							<app-sheet heading=${formTitle} ?open=${this.sheetOpen} @sheet-close=${this.onSheetClose}>
								${this.renderForm()}
							</app-sheet>`
			}
		`;
	}

	private renderForm() {
		const editing = this.editingId !== undefined;
		return html`
			<form id="restaurant-form" novalidate @submit=${this.submit}>
				<label>
					${t("field.name")}
					<input
						id="name"
						name="name"
						autocomplete="off"
						required
						aria-invalid=${this.nameError ? "true" : "false"}
						aria-describedby=${this.nameError ? "name-error" : nothing}
						.value=${live(this.form.name)}
						@input=${this.onInput}
					/>
				</label>
				${this.nameError ? html`<p id="name-error" class="error" role="alert">${t(this.nameError)}</p>` : nothing}
				<fieldset class="kinds">
					<legend>${t("group.kind")}</legend>
					${KINDS.map(
						(kind) => html`<label>
							<input
								type="checkbox"
								name="kinds"
								value=${kind}
								.checked=${live(this.form.kinds.includes(kind))}
								@change=${this.onKindChange}
							/>
							${t(`kind.${kind}`)}
						</label>`,
					)}
				</fieldset>
				<div class="pair">
					${repeat(
						[...VALUE_GROUPS, ...this.defs.map((def) => def.id)],
						(group) => group,
						(group) => this.renderGroupInput(group),
					)}
				</div>
				<label>
					${t("field.location")}
					<input id="location" name="location" autocomplete="off" .value=${live(this.form.location)} @input=${this.onInput} />
				</label>
				${this.renderGroupInput("tags")}
				<label>
					${t("field.notes")}
					<textarea id="notes" name="notes" rows="2" .value=${live(this.form.notes)} @input=${this.onInput}></textarea>
				</label>
				<div class="actions">
					<button type="submit" class="primary">${editing ? t("manager.save") : t("manager.add")}</button>
					${
						editing
							? html`<button type="button" data-action="cancel-edit" @click=${this.cancelEdit}>
									${t("manager.cancel")}
								</button>`
							: nothing
					}
				</div>
				${editing ? this.renderDelete() : nothing}
			</form>
		`;
	}

	/** Delete lives at the end of the edit form, behind an inline confirmation. */
	private renderDelete() {
		const id = this.editingId;
		if (id === undefined) return nothing;
		const name = this.restaurants.find((item) => item.id === id)?.name ?? "";
		return html`<div class="delete-zone">
			${
				this.confirmingId === id
					? html`<p class="delete-prompt" role="alert">${t("manager.deletePrompt", { name })}</p>
							<div class="actions">
								<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(id)}>
									${t("manager.confirmDelete")}
								</button>
								<button type="button" data-action="cancel-delete" @click=${() => this.cancelDelete()}>
									${t("manager.cancel")}
								</button>
							</div>`
					: html`<div class="actions">
							<button type="button" class="danger" data-action="delete" @click=${() => this.askDelete(id)}>
								${icon("trash", 18)}<span>${t("manager.delete")}</span>
							</button>
						</div>`
			}
		</div>`;
	}

	/** A chip input for one group, suggesting the values other restaurants already use. */
	private renderGroupInput(group: string) {
		const hint =
			group === "tags"
				? t("field.tagsHint")
				: t(
						Object.hasOwn(HINTS, group)
							? (HINTS[group] ?? "field.groupHint")
							: "field.groupHint",
					);
		const groups = this.form.groups;
		const value =
			group === "tags"
				? this.form.tags
				: Object.hasOwn(groups, group)
					? (groups[group] ?? [])
					: [];
		return html`<tag-input
			data-group=${group}
			.label=${groupLabel(group, this.defs)}
			.hint=${hint}
			.value=${value}
			.suggestions=${valuesByUsage(this.restaurants, group)}
			@change=${(event: CustomEvent<string[]>) => this.onValuesChange(group, event.detail)}
		></tag-input>`;
	}

	private renderRow(item: Restaurant) {
		const meta = metaLine(item);
		const metaId = `meta-${item.id}`;
		return html`<li data-id=${item.id}>
			<button
				type="button"
				class="item row"
				data-action="edit"
				aria-current=${this.editingId === item.id ? "true" : nothing}
				aria-label=${t("manager.editTitle", { name: item.name })}
				aria-describedby=${meta ? metaId : nothing}
				@click=${() => this.startEdit(item)}
			>
				<span class="grow">
					<b class="name">${item.name}</b>
					${meta ? html`<small class="meta" id=${metaId}>${meta}</small>` : nothing}
				</span>
				<span class="trail">${icon("chevron", 20)}</span>
			</button>
		</li>`;
	}
}
