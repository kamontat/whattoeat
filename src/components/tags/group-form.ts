import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
	addGroup,
	type GroupDef,
	groupLabel,
	moveGroup,
	type NameError,
	renameGroup,
	usingGroup,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import type { Restaurant } from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

export type GroupDraft = {
	name: string;
	step: "edit" | "delete";
	error?: NameError;
};

/**
 * Editor for one custom group: add a new one, rename it, reorder it among its siblings, or delete
 * it. The draft is owned by the caller (the manager hosts this form in a sheet or a panel,
 * different element instances, and a resize must not lose what was typed): this form never
 * mutates `draft`, it only emits `draft-change` with the next one and renders whatever `draft` it
 * is given.
 *
 * `groupId` tells new from edit: `undefined` adds a group (`addGroup`); set, it renames (within
 * `defs`) and offers a Position row (reorders at once, outside the draft) and a delete prompt.
 * Both report `group-save`; the Position row reports `group-move`; delete reports `group-delete`.
 * Cancel reports `form-cancel`. Every event bubbles and is composed.
 */
@customElement("tag-group-form")
export class TagGroupForm extends LitElement {
	static override styles = [
		uiStyles,
		css`
			form {
				display: grid;
				gap: 1rem;
			}

			.position {
				display: grid;
				gap: 0.625rem;
				padding-top: 1rem;
				border-top: 1px solid var(--color-border);
			}

			.position-label {
				font-weight: 600;
			}

			.move-buttons {
				display: flex;
				flex-wrap: wrap;
				gap: 0.625rem;
			}

			.reason,
			.hint {
				color: var(--color-muted);
				font-size: 0.875rem;
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

	/** Where delete and "in use" counts come from. */
	@property({ attribute: false })
	restaurants: readonly Restaurant[] = [];

	/** Every custom group, in their stored order. */
	@property({ attribute: false })
	defs: GroupDef[] = [];

	/** The group being edited; `undefined` means this form is adding a new one. */
	@property()
	groupId: string | undefined = undefined;

	/** What is typed and which step is open. Owned by the caller; this form only reads it. */
	@property({ attribute: false })
	draft: GroupDraft = { name: "", step: "edit" };

	/** Focuses the name input in "edit", or the open prompt's confirm button. */
	focusFirst(): void {
		const selector =
			this.draft.step === "delete" ? '[data-action="confirm-delete"]' : "#name";
		this.renderRoot.querySelector<HTMLElement>(selector)?.focus();
	}

	private emit(type: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	private change(next: GroupDraft): void {
		this.emit("draft-change", next);
	}

	/** `draft` with any error dropped — `exactOptionalPropertyTypes` rejects `error: undefined`. */
	private clean(): Omit<GroupDraft, "error"> {
		const { error: _error, ...rest } = this.draft;
		return rest;
	}

	private action(name: string): HTMLButtonElement | null {
		return this.renderRoot.querySelector<HTMLButtonElement>(
			`[data-action="${name}"]`,
		);
	}

	/** Runs `find` after the next render and focuses what it returns — for the move buttons, whose
	 * disabled state can change once `defs` comes back from the caller with the new order. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	private readonly onNameInput = (event: Event): void => {
		const input = event.target as HTMLInputElement;
		this.change({ ...this.clean(), name: input.value });
	};

	private readonly onSubmit = (event: Event): void => {
		event.preventDefault();
		const id = this.groupId;
		const result =
			id === undefined
				? addGroup(this.defs, this.draft.name)
				: renameGroup(this.defs, id, this.draft.name);
		if (!result.ok) {
			this.change({ ...this.clean(), error: result.error });
			return;
		}
		const savedId = id ?? result.value[result.value.length - 1]?.id ?? "";
		this.emit("group-save", { groups: result.value, id: savedId });
	};

	/** Moves this group by `step`; at either end nothing happens. Keeps focus on the pressed arrow,
	 * or the other one once it is the one now disabled. */
	private move(step: -1 | 1, atEdge: boolean): void {
		if (atEdge) return;
		const id = this.groupId;
		if (id === undefined) return;
		this.emit("group-move", { groups: moveGroup(this.defs, id, step) });
		const [pressed, other] =
			step < 0 ? ["move-up", "move-down"] : ["move-down", "move-up"];
		this.focusAfterRender(() => {
			const button = this.action(pressed);
			return button?.getAttribute("aria-disabled") === "true"
				? this.action(other)
				: button;
		});
	}

	private readonly onDeleteRequest = (): void => {
		this.change({ ...this.clean(), step: "delete" });
	};

	private readonly onConfirmDelete = (): void => {
		const id = this.groupId;
		if (id === undefined) return;
		this.emit("group-delete", { id });
	};

	private readonly onCancelDelete = (): void => {
		this.change({ ...this.draft, step: "edit" });
	};

	override render() {
		const { step } = this.draft;
		return html`
			<form class="group-form" novalidate @submit=${this.onSubmit}>
				${step === "delete" ? this.renderDelete() : this.renderFields()}
			</form>
		`;
	}

	private renderFields() {
		const { draft, groupId } = this;
		const error = draft.error;
		const index =
			groupId === undefined
				? -1
				: this.defs.findIndex((def) => def.id === groupId);
		const first = index <= 0;
		const last = index === this.defs.length - 1;
		return html`
			<label>
				${t("tags.name")}
				<input
					id="name"
					name="name"
					autocomplete="off"
					required
					aria-invalid=${error ? "true" : "false"}
					aria-describedby=${error ? "group-error" : nothing}
					.value=${live(draft.name)}
					@input=${this.onNameInput}
				/>
			</label>
			${error ? html`<p id="group-error" class="error" role="alert">${t(error)}</p>` : nothing}
			${groupId === undefined ? nothing : this.renderPosition(first, last)}
			<div class="actions">
				<button type="submit" class="primary" data-action="save">
					${groupId === undefined ? t("tags.addGroup") : t("tags.save")}
				</button>
				<button type="button" data-action="cancel" @click=${() => this.emit("form-cancel")}>
					${t("tags.cancel")}
				</button>
				${
					groupId === undefined
						? nothing
						: html`<button type="button" class="danger" data-action="delete" @click=${this.onDeleteRequest}>
								${t("tags.deleteGroup")}
							</button>`
				}
			</div>
		`;
	}

	private renderPosition(first: boolean, last: boolean) {
		return html`
			<div class="position">
				<span class="position-label" id="position-label">${t("tags.position")}</span>
				<div class="move-buttons" role="group" aria-labelledby="position-label">
					<button
						type="button"
						data-action="move-up"
						aria-disabled=${first ? "true" : nothing}
						aria-describedby=${first ? "move-up-reason" : nothing}
						@click=${() => this.move(-1, first)}
					>
						${icon("up", 20)}<span>${t("tags.up")}</span>
					</button>
					<button
						type="button"
						data-action="move-down"
						aria-disabled=${last ? "true" : nothing}
						aria-describedby=${last ? "move-down-reason" : nothing}
						@click=${() => this.move(1, last)}
					>
						${icon("down", 20)}<span>${t("tags.down")}</span>
					</button>
				</div>
				${first ? html`<p class="reason" id="move-up-reason">${t("tags.firstGroup")}</p>` : nothing}
				${last ? html`<p class="reason" id="move-down-reason">${t("tags.lastGroup")}</p>` : nothing}
				<p class="hint">${t("tags.orderHint")}</p>
			</div>
		`;
	}

	private renderDelete() {
		const id = this.groupId;
		const label = id === undefined ? "" : groupLabel(id, this.defs);
		const count = id === undefined ? 0 : usingGroup(this.restaurants, id);
		return html`
			<div class="delete-zone">
				<p role="alert">
					${
						count === 1
							? t("tags.deleteGroupPrompt.one", { group: label })
							: t("tags.deleteGroupPrompt.other", { group: label, count })
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
