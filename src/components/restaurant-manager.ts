import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { restaurantChips } from "#components/restaurant-chips";
import "#components/tag-input";
import type { TagInput } from "#components/tag-input";
import {
	type GroupDef,
	groupLabel,
	loadGroups,
	onGroupsChanged,
} from "#lib/groups";
import { getLang, LangController, type MessageKey, t } from "#lib/i18n";
import {
	isLink,
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
			:host {
				display: grid;
				gap: 1.5rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			.list {
				display: grid;
				gap: 0.75rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.name {
				font-size: 1.125rem;
				font-weight: 700;
			}

			.location {
				overflow-wrap: anywhere;
			}

			.notes {
				white-space: pre-wrap;
			}

			form.card {
				gap: 1rem;
				padding: 1.25rem;
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
				padding: 0.375rem 0.875rem 0.375rem 0.625rem;
				border: 1px solid var(--color-border);
				border-radius: 999px;
				background: var(--color-bg);
				font-weight: 500;
				cursor: pointer;
			}

			fieldset.kinds label:has(input:checked) {
				border-color: var(--color-primary);
				color: var(--color-primary);
				font-weight: 600;
			}

			fieldset.kinds label:has(input:focus-visible) {
				outline: 2px solid var(--color-primary);
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

			li.card {
				gap: 0.375rem;
			}

			li.card .meta {
				color: var(--color-primary);
				font-weight: 600;
			}

			li.card .actions {
				margin-top: 0.375rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

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
			if (editing === undefined) this.resetForm();
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
		// Reset before saving so the store's change callback already sees a clean form.
		this.resetForm();
		if (editingId === undefined) addRestaurant(input);
		else updateRestaurant(editingId, input);
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
		// Text typed for the previous form must not become a value of this restaurant.
		for (const input of this.tagInputs) input.clearText();
		this.fillForm(item);
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	}

	/** Swapping the row's buttons removes the focused one, so move focus to its replacement. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	private rowAction(id: string, action: string): Element | undefined {
		const row = [...this.renderRoot.querySelectorAll("li[data-id]")].find(
			(item) => item.getAttribute("data-id") === id,
		);
		return row?.querySelector(`[data-action="${action}"]`) ?? undefined;
	}

	private askDelete(id: string): void {
		this.confirmingId = id;
		this.focusAfterRender(() => this.rowAction(id, "confirm-delete"));
	}

	private cancelDelete(id: string): void {
		this.confirmingId = undefined;
		this.focusAfterRender(() => this.rowAction(id, "delete"));
	}

	private confirmDelete(id: string): void {
		this.confirmingId = undefined;
		removeRestaurant(id);
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	}

	override render() {
		const sorted = [...this.restaurants].sort((a, b) =>
			a.name.localeCompare(b.name, getLang()),
		);
		return html`
			<h1>${t("manager.title")}</h1>
			${isMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			${this.renderForm()}
			${
				sorted.length === 0
					? html`<p class="muted empty">${t("manager.empty")}</p>`
					: html`<ul class="list">${sorted.map((item) => this.renderRow(item))}</ul>`
			}
		`;
	}

	private renderForm() {
		const editing = this.editingId !== undefined;
		return html`
			<form class="card" novalidate @submit=${this.submit}>
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
							? html`<button type="button" data-action="cancel-edit" @click=${() => this.resetForm()}>
									${t("manager.cancel")}
								</button>`
							: nothing
					}
				</div>
			</form>
		`;
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
		const confirming = this.confirmingId === item.id;
		return html`
			<li class="card" data-id=${item.id}>
				<span class="name">${item.name}</span>
				${metaLine(item) ? html`<span class="meta muted">${metaLine(item)}</span>` : nothing}
				${
					item.location
						? html`<span class="location muted">
								${
									isLink(item.location)
										? html`<a href=${item.location} target="_blank" rel="noopener noreferrer">${item.location}</a>`
										: item.location
								}
							</span>`
						: nothing
				}
				${item.notes ? html`<span class="notes muted">${item.notes}</span>` : nothing}
				${restaurantChips(item, this.defs)}
				<div class="actions">
					${
						confirming
							? html`
									<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(item.id)}>
										${t("manager.confirmDelete")}
									</button>
									<button
										type="button"
										data-action="cancel-delete"
										@click=${() => this.cancelDelete(item.id)}
									>
										${t("manager.cancel")}
									</button>
								`
							: html`
									<button type="button" data-action="edit" @click=${() => this.startEdit(item)}>${t("manager.edit")}</button>
									<button
										type="button"
										class="danger"
										data-action="delete"
										@click=${() => this.askDelete(item.id)}
									>
										${t("manager.delete")}
									</button>
								`
					}
				</div>
			</li>
		`;
	}
}
