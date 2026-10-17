import { css, html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import "#components/tag-input";
import { type GroupDef, groupLabel } from "#lib/groups";
import { type MessageKey, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import {
	KINDS,
	type Kind,
	type Restaurant,
	VALUE_GROUPS,
	valuesByUsage,
} from "#lib/restaurant";

export const formStyles = css`
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
`;

export type FormState = {
	name: string;
	location: string;
	notes: string;
	kinds: Kind[];
	tags: string[];
	/** Values by group id: cuisine, area and custom groups. */
	groups: Record<string, string[]>;
};

export const EMPTY_FORM: FormState = {
	name: "",
	location: "",
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
};

/** What the form reads besides its view, and where it reports what the user does. */
export type FormContext = {
	restaurants: readonly Restaurant[];
	defs: readonly GroupDef[];
	onSubmit: (event: Event) => void;
	onInput: (event: Event) => void;
	onKindChange: (event: Event) => void;
	onValuesChange: (group: string, values: string[]) => void;
	onCancelEdit: () => void;
	onAskDelete: (id: string) => void;
	onConfirmDelete: (id: string) => void;
	onCancelDelete: () => void;
};

const HINTS: Record<string, MessageKey> = {
	cuisine: "field.cuisineHint",
	area: "field.areaHint",
};

export const formFromRestaurant = (item: Restaurant): FormState => ({
	name: item.name,
	location: item.location,
	notes: item.notes,
	kinds: item.kinds,
	tags: item.tags,
	groups: { ...item.groups },
});

/** The form with `kind` ticked or unticked, kinds kept in their fixed order. */
export const withKind = (
	form: FormState,
	kind: Kind,
	checked: boolean,
): FormState => {
	const kinds = form.kinds.filter((item) => item !== kind);
	return {
		...form,
		kinds: checked
			? KINDS.filter((item) => item === kind || kinds.includes(item))
			: kinds,
	};
};

/** The form with one group's values (or the tags) replaced. */
export const withValues = (
	form: FormState,
	group: string,
	values: string[],
): FormState =>
	group === "tags"
		? { ...form, tags: values }
		: { ...form, groups: { ...form.groups, [group]: values } };

export function renderForm(view: FormView, ctx: FormContext) {
	const { form, nameError } = view;
	const editing = view.editingId !== undefined;
	return html`
		<form id="restaurant-form" novalidate @submit=${ctx.onSubmit}>
			<label>
				${t("field.name")}
				<input
					id="name"
					name="name"
					autocomplete="off"
					required
					aria-invalid=${nameError ? "true" : "false"}
					aria-describedby=${nameError ? "name-error" : nothing}
					.value=${live(form.name)}
					@input=${ctx.onInput}
				/>
			</label>
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
							@change=${ctx.onKindChange}
						/>
						${t(`kind.${kind}`)}
					</label>`,
				)}
			</fieldset>
			<div class="pair">
				${repeat(
					[...VALUE_GROUPS, ...ctx.defs.map((def) => def.id)],
					(group) => group,
					(group) => renderGroupInput(group, form, ctx),
				)}
			</div>
			<label>
				${t("field.location")}
				<input id="location" name="location" autocomplete="off" .value=${live(form.location)} @input=${ctx.onInput} />
			</label>
			${renderGroupInput("tags", form, ctx)}
			<label>
				${t("field.notes")}
				<textarea id="notes" name="notes" rows="2" .value=${live(form.notes)} @input=${ctx.onInput}></textarea>
			</label>
			<div class="actions form-actions">
				<button type="submit" class="primary">${editing ? t("manager.save") : t("manager.add")}</button>
				${
					editing
						? html`<button type="button" data-action="cancel-edit" @click=${ctx.onCancelEdit}>
								${t("manager.cancel")}
							</button>`
						: nothing
				}
			</div>
			${editing ? renderDelete(view, ctx) : nothing}
		</form>
	`;
}

/** Delete lives at the end of the edit form, behind an inline confirmation. */
function renderDelete(view: FormView, ctx: FormContext) {
	const id = view.editingId;
	if (id === undefined) return nothing;
	const name = ctx.restaurants.find((item) => item.id === id)?.name ?? "";
	return html`<div class="delete-zone">
		${
			view.confirmingId === id
				? html`<p class="delete-prompt" role="alert">${t("manager.deletePrompt", { name })}</p>
						<div class="actions">
							<button type="button" class="danger" data-action="confirm-delete" @click=${() => ctx.onConfirmDelete(id)}>
								${t("manager.confirmDelete")}
							</button>
							<button type="button" data-action="cancel-delete" @click=${() => ctx.onCancelDelete()}>
								${t("manager.cancel")}
							</button>
						</div>`
				: html`<div class="actions">
						<button type="button" class="danger" data-action="delete" @click=${() => ctx.onAskDelete(id)}>
							${icon("trash", 18)}<span>${t("manager.delete")}</span>
						</button>
					</div>`
		}
	</div>`;
}

/** A chip input for one group, suggesting the values other restaurants already use. */
function renderGroupInput(group: string, form: FormState, ctx: FormContext) {
	const hint =
		group === "tags"
			? t("field.tagsHint")
			: t(
					Object.hasOwn(HINTS, group)
						? (HINTS[group] ?? "field.groupHint")
						: "field.groupHint",
				);
	const groups = form.groups;
	const value =
		group === "tags"
			? form.tags
			: Object.hasOwn(groups, group)
				? (groups[group] ?? [])
				: [];
	return html`<tag-input
		data-group=${group}
		.label=${groupLabel(group, ctx.defs)}
		.hint=${hint}
		.value=${value}
		.suggestions=${valuesByUsage(ctx.restaurants, group)}
		@change=${(event: CustomEvent<string[]>) => ctx.onValuesChange(group, event.detail)}
	></tag-input>`;
}
