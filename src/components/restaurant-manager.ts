import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import "#components/tag-input";
import type { TagInput } from "#components/tag-input";
import { getLang, LangController, t } from "#lib/i18n";
import { isLink, type Restaurant, tagsByUsage } from "#lib/restaurant";
import {
	addRestaurant,
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	removeRestaurant,
	updateRestaurant,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

type FormState = {
	name: string;
	tags: string[];
	location: string;
	notes: string;
};

const EMPTY_FORM: FormState = { name: "", tags: [], location: "", notes: "" };

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
	private nameError = false;

	private get tagInput(): TagInput | null {
		return this.renderRoot.querySelector("tag-input");
	}

	/** `updatedAt` of the restaurant when it was loaded into the form. */
	private editingUpdatedAt: string | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			if (this.editingId === undefined) return;
			const editing = this.restaurants.find(
				(item) => item.id === this.editingId,
			);
			if (editing === undefined) this.resetForm();
			// Saved elsewhere (another tab): show the newer version rather than overwrite it.
			else if (editing.updatedAt !== this.editingUpdatedAt)
				this.fillForm(editing);
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private resetForm(): void {
		this.form = EMPTY_FORM;
		this.editingId = undefined;
		this.nameError = false;
		this.tagInput?.clearText();
	}

	private readonly onInput = (event: Event): void => {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		const field = target.name as Exclude<keyof FormState, "tags">;
		this.form = { ...this.form, [field]: target.value };
		if (field === "name") this.nameError = false;
	};

	private readonly onTagsChange = (event: CustomEvent<string[]>): void => {
		this.form = { ...this.form, tags: event.detail };
	};

	private readonly submit = (event: Event): void => {
		event.preventDefault();
		const tags = this.tagInput?.commit() ?? this.form.tags;
		if (this.form.name.trim() === "") {
			this.nameError = true;
			return;
		}
		const input = {
			name: this.form.name,
			tags,
			location: this.form.location,
			notes: this.form.notes,
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
		this.nameError = false;
		this.form = {
			name: item.name,
			tags: item.tags,
			location: item.location,
			notes: item.notes,
		};
	}

	private startEdit(item: Restaurant): void {
		this.confirmingId = undefined;
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
				${this.nameError ? html`<p id="name-error" class="error" role="alert">${t("manager.nameRequired")}</p>` : nothing}
				<tag-input
					.label=${t("field.tags")}
					.hint=${t("field.tagsHint")}
					.value=${this.form.tags}
					.suggestions=${tagsByUsage(this.restaurants)}
					@change=${this.onTagsChange}
				></tag-input>
				<label>
					${t("field.location")}
					<input id="location" name="location" autocomplete="off" .value=${live(this.form.location)} @input=${this.onInput} />
				</label>
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

	private renderRow(item: Restaurant) {
		const confirming = this.confirmingId === item.id;
		return html`
			<li class="card" data-id=${item.id}>
				<span class="name">${item.name}</span>
				${
					item.tags.length > 0
						? html`<ul class="chips">${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}</ul>`
						: nothing
				}
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
