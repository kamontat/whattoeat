import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
	checkValue,
	type GroupDef,
	groupLabel,
	type ValueError,
	valueCounts,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { valueTargets, wouldMerge } from "#lib/tags";
import { uiStyles } from "#styles/ui";

export type ValueDraft = {
	name: string;
	target: string;
	step: "edit" | "merge" | "delete";
	error?: ValueError;
};

/** The starting draft for editing `value` in `group`: its name typed as-is, staying in its group. */
export const valueDraft = (group: string, value: string): ValueDraft => ({
	name: value,
	target: group,
	step: "edit",
});

/** How many restaurants use `value` in `group` right now — what a merge or delete would affect. */
const sourceCount = (
	restaurants: readonly Restaurant[],
	group: string,
	value: string,
): number =>
	valueCounts(restaurants, group).find((entry) => entry.value === value)
		?.count ?? 0;

/**
 * Editor for one value: rename it, move it to another group, or delete it. The draft is owned by
 * the caller (the manager hosts this form in a sheet or a panel, different element instances, and
 * a resize must not lose what was typed): this form never mutates `draft`, it only emits
 * `draft-change` with the next one and renders whatever `draft` it is given.
 *
 * Save checks the typed name; a blank or comma-containing name shows an error inline. A name that
 * already exists in the target group asks to merge first (step `"merge"`); otherwise it reports
 * `value-save` straight away. Delete asks first too (step `"delete"`) before reporting
 * `value-delete`. Cancel reports `form-cancel`. Every event bubbles and is composed.
 */
@customElement("tag-value-form")
export class TagValueForm extends LitElement {
	static override styles = [
		uiStyles,
		css`
			form {
				display: grid;
				gap: 1rem;
			}

			.delete-zone {
				display: grid;
				gap: 0.625rem;
				padding-top: 1rem;
				border-top: 1px solid var(--color-border);
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Where suggestions and merge/delete counts come from. */
	@property({ attribute: false })
	restaurants: readonly Restaurant[] = [];

	/** The custom groups, offered (after cuisine and area) as places to move the value to. */
	@property({ attribute: false })
	defs: GroupDef[] = [];

	/** The group the value currently lives in. */
	@property()
	group = "";

	/** The value being edited. */
	@property()
	value = "";

	/** What is typed and which step is open. Owned by the caller; this form only reads it. */
	@property({ attribute: false })
	draft: ValueDraft = valueDraft("", "");

	/** Focuses the name input in "edit", or the open prompt's confirm button. */
	focusFirst(): void {
		const selector =
			this.draft.step === "merge"
				? '[data-action="confirm-merge"]'
				: this.draft.step === "delete"
					? '[data-action="confirm-delete"]'
					: "#name";
		this.renderRoot.querySelector<HTMLElement>(selector)?.focus();
	}

	private emit(type: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	private change(next: ValueDraft): void {
		this.emit("draft-change", next);
	}

	/** `draft` with any error dropped — `exactOptionalPropertyTypes` rejects `error: undefined`. */
	private clean(): Omit<ValueDraft, "error"> {
		const { error: _error, ...rest } = this.draft;
		return rest;
	}

	private readonly onNameInput = (event: Event): void => {
		const input = event.target as HTMLInputElement;
		this.change({ ...this.clean(), name: input.value });
	};

	private readonly onGroupChange = (event: Event): void => {
		const select = event.target as HTMLSelectElement;
		this.change({ ...this.clean(), target: select.value });
	};

	private readonly onSubmit = (event: Event): void => {
		event.preventDefault();
		const checked = checkValue(this.draft.name);
		if (!checked.ok) {
			this.change({ ...this.clean(), error: checked.error });
			return;
		}
		const from = { group: this.group, value: this.value };
		const to = { group: this.draft.target, value: checked.value };
		if (wouldMerge(this.restaurants, from, to)) {
			this.change({ ...this.clean(), step: "merge" });
			return;
		}
		this.emit("value-save", { from, to });
	};

	private readonly onDeleteRequest = (): void => {
		this.change({ ...this.clean(), step: "delete" });
	};

	private readonly onConfirmMerge = (): void => {
		const checked = checkValue(this.draft.name);
		if (!checked.ok) return;
		this.emit("value-save", {
			from: { group: this.group, value: this.value },
			to: { group: this.draft.target, value: checked.value },
		});
	};

	private readonly onCancelMerge = (): void => {
		this.change({ ...this.draft, step: "edit" });
	};

	private readonly onConfirmDelete = (): void => {
		this.emit("value-delete", { group: this.group, value: this.value });
	};

	private readonly onCancelDelete = (): void => {
		this.change({ ...this.draft, step: "edit" });
	};

	override render() {
		const { step } = this.draft;
		return html`
			<form class="value-form" novalidate @submit=${this.onSubmit}>
				${
					step === "merge"
						? this.renderMerge()
						: step === "delete"
							? this.renderDelete()
							: this.renderFields()
				}
			</form>
		`;
	}

	private renderFields() {
		const { draft } = this;
		const error = draft.error;
		return html`
			<label>
				${t("tags.name")}
				<input
					id="name"
					name="name"
					autocomplete="off"
					required
					aria-invalid=${error ? "true" : "false"}
					aria-describedby=${error ? "value-error" : nothing}
					.value=${live(draft.name)}
					@input=${this.onNameInput}
				/>
			</label>
			<label>
				${t("tags.group")}
				<select name="group" @change=${this.onGroupChange}>
					${valueTargets(this.defs).map(
						(id) =>
							html`<option value=${id} ?selected=${id === draft.target}>
								${groupLabel(id, this.defs)}
							</option>`,
					)}
				</select>
			</label>
			${error ? html`<p id="value-error" class="error" role="alert">${t(error)}</p>` : nothing}
			<div class="actions">
				<button type="submit" class="primary" data-action="save">${t("tags.save")}</button>
				<button type="button" data-action="cancel" @click=${() => this.emit("form-cancel")}>
					${t("tags.cancel")}
				</button>
				<button type="button" class="danger" data-action="delete" @click=${this.onDeleteRequest}>
					${t("tags.delete")}
				</button>
			</div>
		`;
	}

	private renderMerge() {
		const { draft } = this;
		const checked = checkValue(draft.name);
		const to = checked.ok ? checked.value : draft.name;
		const count = sourceCount(this.restaurants, this.group, this.value);
		return html`
			<div role="alert">
				<p>
					${
						count === 1
							? t("tags.mergePrompt.one", { from: this.value, to })
							: t("tags.mergePrompt.other", { from: this.value, to, count })
					}
				</p>
				<div class="actions">
					<button type="button" class="primary" data-action="confirm-merge" @click=${this.onConfirmMerge}>
						${t("tags.confirmMerge")}
					</button>
					<button type="button" data-action="cancel-merge" @click=${this.onCancelMerge}>
						${t("tags.cancel")}
					</button>
				</div>
			</div>
		`;
	}

	private renderDelete() {
		const count = sourceCount(this.restaurants, this.group, this.value);
		return html`
			<div class="delete-zone">
				<p role="alert">
					${
						count === 1
							? t("tags.deleteValuePrompt.one", { value: this.value })
							: t("tags.deleteValuePrompt.other", { value: this.value, count })
					}
				</p>
				<div class="actions">
					<button type="button" class="danger" data-action="confirm-delete" @click=${this.onConfirmDelete}>
						${t("tags.confirmDelete")}
					</button>
					<button type="button" data-action="cancel-delete" @click=${this.onCancelDelete}>
						${t("tags.cancel")}
					</button>
				</div>
			</div>
		`;
	}
}
