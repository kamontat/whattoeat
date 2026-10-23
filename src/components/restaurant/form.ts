import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import "#components/tag-input";
import type { TagInput } from "#components/tag-input";
import { type GroupDef, groupLabel } from "#lib/groups";
import {
	getLang,
	type Lang,
	LangController,
	type Localized,
	type MessageKey,
	t,
} from "#lib/i18n";
import { icon } from "#lib/icons";
import {
	displayName,
	KINDS,
	type Kind,
	type Restaurant,
	VALUE_GROUPS,
	valuesByUsage,
} from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

export type FormState = {
	name: Localized;
	link: string;
	notes: string;
	kinds: Kind[];
	tags: string[];
	/** Values by group id: cuisine, area and custom groups. */
	groups: Record<string, string[]>;
};

export const EMPTY_FORM: FormState = {
	name: { en: "", th: "" },
	link: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
};

/** Everything the form draws: what is typed, which restaurant, and any open prompt. */
export type FormView = {
	form: FormState;
	editingId: string | undefined;
	confirmingId: string | undefined;
	nameError: "manager.nameRequired" | undefined;
	linkError: "manager.linkInvalid" | undefined;
};

export const EMPTY_VIEW: FormView = {
	form: EMPTY_FORM,
	editingId: undefined,
	confirmingId: undefined,
	nameError: undefined,
	linkError: undefined,
};

export const formFromRestaurant = (item: Restaurant): FormState => ({
	name: item.name,
	link: item.link,
	notes: item.notes,
	kinds: item.kinds,
	tags: item.tags,
	groups: { ...item.groups },
});

const NAME_LABELS: Record<Lang, MessageKey> = {
	en: "field.nameEn",
	th: "field.nameTh",
};

const HINTS: Record<string, MessageKey> = {
	cuisine: "field.cuisineHint",
	area: "field.areaHint",
};

/**
 * The add/edit form for one restaurant. It draws `view` and never changes it: every edit is
 * reported as `form-change` (detail: the new form state) for the owner to hand back, and
 * submit as `form-submit` (detail: the form state with text left in a box committed). Cancel
 * and the delete prompt report `form-cancel`, `delete-request`, `delete-cancel` and
 * `delete-confirm` (detail: the restaurant id).
 */
@customElement("restaurant-form")
export class RestaurantForm extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
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

			/* Phone: cuisine and area stack; a long chip must not push a box past the screen edge. */
			.pair {
				display: grid;
				grid-template-columns: minmax(0, 1fr);
				gap: 1rem;
			}

			.pair > * {
				min-width: 0;
			}

			.delete-zone {
				display: grid;
				gap: 0.625rem;
				padding-top: 1rem;
				border-top: 1px solid var(--color-border);
			}

			/*
			 * Phone: Save and Cancel stay at the bottom of the sheet. Sticky stops at the scroll body's
			 * content edge, so pull it over the body's 1rem bottom padding (app-sheet .body) and pad
			 * that back in, or a strip of the form shows below the row.
			 */
			.actions.form-actions {
				position: sticky;
				bottom: -1rem;
				z-index: 1;
				padding: 0.75rem 0 1.75rem;
				background: var(--color-bg);
			}

			/* Phone: keep a field the browser scrolls to from landing underneath the sticky row. */
			form input,
			form textarea,
			form tag-input,
			fieldset.kinds label {
				scroll-margin-bottom: 5rem;
			}

			@media (min-width: 48rem) {
				/* The panel is short enough that Save doesn't need to stay pinned. */
				.actions.form-actions {
					position: static;
					padding: 0;
					background: none;
				}

				/* The side panel has room for cuisine and area side by side. */
				.pair {
					grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
				}

				form input,
				form textarea,
				form tag-input,
				fieldset.kinds label {
					scroll-margin-bottom: 0;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@property({ attribute: false })
	view: FormView = EMPTY_VIEW;

	/** Every restaurant: where suggestions come from, and the name the delete prompt says. */
	@property({ attribute: false })
	restaurants: readonly Restaurant[] = [];

	/** The custom groups, each drawn as its own input after cuisine and area. */
	@property({ attribute: false })
	defs: readonly GroupDef[] = [];

	/** A button to focus once the owner's answer to a delete prompt has been drawn. */
	private pendingFocus: "delete" | "confirm-delete" | undefined;

	private get tagInputs(): TagInput[] {
		return [...this.renderRoot.querySelectorAll("tag-input")];
	}

	/** Drop text typed in a box but not yet a chip. */
	clearText(): void {
		for (const input of this.tagInputs) input.clearText();
	}

	/** Focus the name field of the current language, which comes first. */
	focusName(): void {
		this.renderRoot.querySelector<HTMLElement>(`#name-${getLang()}`)?.focus();
	}

	/** Swapping the prompt's buttons removes the focused one, so move focus to its replacement. */
	protected override updated(): void {
		if (this.pendingFocus === undefined) return;
		const target = this.renderRoot.querySelector<HTMLElement>(
			`[data-action="${this.pendingFocus}"]`,
		);
		if (target === null) return;
		this.pendingFocus = undefined;
		target.focus();
	}

	private emit(type: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	/** The form as last reported, until the owner hands back a new view. */
	private reported: FormState | undefined;

	/** What the next edit builds on: two edits before the owner answers must not undo each other. */
	private get current(): FormState {
		return this.reported ?? this.view.form;
	}

	protected override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has("view")) this.reported = undefined;
	}

	private change(form: FormState): void {
		this.reported = form;
		this.emit("form-change", form);
	}

	private readonly onInput = (event: Event): void => {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		const field = target.name as "link" | "notes";
		this.change({ ...this.current, [field]: target.value });
	};

	private onNameInput(lang: Lang, event: Event): void {
		const form = this.current;
		const value = (event.target as HTMLInputElement).value;
		this.change({ ...form, name: { ...form.name, [lang]: value } });
	}

	/** Tick or untick one kind, keeping kinds in their fixed order. */
	private readonly onKindChange = (event: Event): void => {
		const box = event.target as HTMLInputElement;
		const kind = box.value as Kind;
		const form = this.current;
		const kinds = form.kinds.filter((item) => item !== kind);
		this.change({
			...form,
			kinds: box.checked
				? KINDS.filter((item) => item === kind || kinds.includes(item))
				: kinds,
		});
	};

	private onValuesChange(group: string, values: string[]): void {
		const form = this.current;
		this.change(
			group === "tags"
				? { ...form, tags: values }
				: { ...form, groups: { ...form.groups, [group]: values } },
		);
	}

	private readonly submit = (event: Event): void => {
		event.preventDefault();
		const form = this.current;
		// Text still in a box counts as a value, the same as pressing Enter.
		let tags = form.tags;
		// A group deleted elsewhere while this form was open unmounts its input, but its values
		// stay in the form until the owner saves them (normalizeInput demotes unknown ids to tags).
		const typed: [string, string[]][] = [];
		for (const input of this.tagInputs) {
			const group = input.getAttribute("data-group") ?? "tags";
			const values = input.commit();
			if (group === "tags") tags = values;
			else typed.push([group, values]);
		}
		this.emit("form-submit", {
			...form,
			tags,
			groups: { ...form.groups, ...Object.fromEntries(typed) },
		});
	};

	override render() {
		const { form, nameError, linkError } = this.view;
		const editing = this.view.editingId !== undefined;
		return html`
			<form id="restaurant-form" novalidate @submit=${this.submit}>
				${this.nameLangs().map(
					(lang) => html`<label>
						${t(NAME_LABELS[lang])}
						<input
							id=${`name-${lang}`}
							name=${`name-${lang}`}
							lang=${lang}
							autocomplete="off"
							aria-invalid=${nameError ? "true" : "false"}
							aria-describedby=${nameError ? "name-error" : nothing}
							.value=${live(form.name[lang])}
							@input=${(event: Event) => this.onNameInput(lang, event)}
						/>
					</label>`,
				)}
				${nameError ? html`<p id="name-error" class="error" role="alert">${t(nameError)}</p>` : nothing}
				<fieldset class="kinds">
					<legend>${t("group.kind")}</legend>
					${KINDS.map(
						(kind) => html`<label>
							<input
								type="checkbox"
								name="kinds"
								value=${kind}
								.checked=${live(form.kinds.includes(kind))}
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
					${t("field.link")}
					<input
						id="link"
						name="link"
						type="url"
						inputmode="url"
						autocomplete="off"
						placeholder="https://"
						aria-invalid=${linkError ? "true" : "false"}
						aria-describedby=${linkError ? "link-error" : nothing}
						.value=${live(form.link)}
						@input=${this.onInput}
					/>
				</label>
				${linkError ? html`<p id="link-error" class="error" role="alert">${t(linkError)}</p>` : nothing}
				${this.renderGroupInput("tags")}
				<label>
					${t("field.notes")}
					<textarea id="notes" name="notes" rows="2" .value=${live(form.notes)} @input=${this.onInput}></textarea>
				</label>
				<div class="actions form-actions">
					<button type="submit" class="primary">${editing ? t("manager.save") : t("manager.add")}</button>
					${
						editing
							? html`<button type="button" data-action="cancel-edit" @click=${() => this.emit("form-cancel")}>
									${t("manager.cancel")}
								</button>`
							: nothing
					}
				</div>
				${editing ? this.renderDelete() : nothing}
			</form>
		`;
	}

	/** Name fields in order: the current language first. */
	private nameLangs(): Lang[] {
		return getLang() === "th" ? ["th", "en"] : ["en", "th"];
	}

	/** Delete lives at the end of the edit form, behind an inline confirmation. */
	private renderDelete() {
		const id = this.view.editingId;
		if (id === undefined) return nothing;
		const item = this.restaurants.find((entry) => entry.id === id);
		const name = item === undefined ? "" : displayName(item);
		return html`<div class="delete-zone">
			${
				this.view.confirmingId === id
					? html`<p class="delete-prompt" role="alert">${t("manager.deletePrompt", { name })}</p>
							<div class="actions">
								<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.emit("delete-confirm", id)}>
									${t("manager.confirmDelete")}
								</button>
								<button
									type="button"
									data-action="cancel-delete"
									@click=${() => {
										this.pendingFocus = "delete";
										this.emit("delete-cancel");
									}}
								>
									${t("manager.cancel")}
								</button>
							</div>`
					: html`<div class="actions">
							<button
								type="button"
								class="danger"
								data-action="delete"
								@click=${() => {
									this.pendingFocus = "confirm-delete";
									this.emit("delete-request", id);
								}}
							>
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
		const { tags, groups } = this.view.form;
		const value =
			group === "tags"
				? tags
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
}
