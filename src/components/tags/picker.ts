import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { LangController, t } from "#lib/i18n";
import type { TagGroup } from "#lib/tags";
import { uiStyles } from "#styles/ui";

/**
 * The group picker: a pill strip (phone, small desktop) or a groups column (large desktop) built
 * from the same `TagGroup[]`. Only draws what it is given and reports `group-pick`; the caller
 * owns the picked group and which variant to show.
 */
@customElement("tag-picker")
export class TagPicker extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
			}

			.pills {
				display: flex;
				gap: 0.5rem;
				overflow-x: auto;
			}

			:host([wrap]) .pills {
				flex-wrap: wrap;
				overflow: visible;
			}

			.pill {
				flex: none;
				border-radius: var(--radius-pill);
				padding: 0 0.875rem;
				font-size: 0.875rem;
				white-space: nowrap;
			}

			.columns .item[aria-pressed="true"] {
				background: var(--color-surface-2);
				box-shadow: inset 3px 0 0 var(--color-primary);
			}

			@media (forced-colors: active) {
				.pill[aria-pressed="true"],
				.columns .item[aria-pressed="true"] {
					outline: 2px solid CanvasText;
					outline-offset: -2px;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@property({ attribute: false })
	groups: TagGroup[] = [];

	/** The picked group's id. */
	@property()
	picked = "";

	@property({ reflect: true })
	variant: "pills" | "column" = "pills";

	/** Pills wrap onto more lines instead of scrolling sideways. */
	@property({ type: Boolean, reflect: true })
	wrap = false;

	/** Focuses the picked group's pill or row, if it is rendered. */
	focusPicked(): void {
		this.pillFor(this.picked)?.focus();
	}

	private pillFor(id: string): HTMLElement | undefined {
		return [
			...this.renderRoot.querySelectorAll<HTMLElement>("[data-group]"),
		].find((el) => el.getAttribute("data-group") === id);
	}

	private emit(type: string, detail: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	private pick(group: TagGroup, event: Event): void {
		this.emit("group-pick", group.id);
		const target = event.currentTarget;
		if (
			target instanceof HTMLElement &&
			typeof target.scrollIntoView === "function"
		)
			target.scrollIntoView({ block: "nearest", inline: "nearest" });
	}

	override render() {
		const column = this.variant === "column";
		return html`<div
			role="group"
			aria-label=${t("tags.pickerLabel")}
			class=${column ? "group columns" : "pills"}
		>
			${repeat(
				this.groups,
				(group) => group.id,
				(group) => this.renderButton(group, column),
			)}
		</div>`;
	}

	private renderButton(group: TagGroup, column: boolean) {
		const pressed = group.id === this.picked;
		if (column)
			return html`<button
				type="button"
				class="item"
				data-group=${group.id}
				aria-pressed=${pressed ? "true" : "false"}
				@click=${(event: Event) => this.pick(group, event)}
			>
				<span class="grow">
					<b>${group.label}</b>
					${group.kind === "fixed" ? html`<small class="sub">${t("tags.fixed")}</small>` : nothing}
				</span>
				<span class="trail">${group.values}</span>
			</button>`;
		return html`<button type="button" class="pill ${pressed ? "primary" : ""}" data-group=${group.id} aria-pressed=${pressed ? "true" : "false"} @click=${(event: Event) => this.pick(group, event)}>${group.label} ${group.values}</button>`;
	}
}
