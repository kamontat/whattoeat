import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { highlight } from "#lib/highlight";
import { icon } from "#lib/icons";
import type { MatchRange } from "#lib/search";
import { uiStyles } from "#styles/ui";

/** One row: a group result (no `value`) or a value, highlighted and marked current by the caller. */
export type ListRow = {
	group: string;
	value?: string;
	name: string;
	sub: string;
	ranges?: readonly MatchRange[];
	readonly?: boolean;
};

/**
 * A list of group or value rows in the restaurants list style. Only draws what it is given and
 * reports `tag-open`; a `readonly` row (Type's values) renders as a static row with no chevron,
 * and the list itself only gets the `readonly` look when every row is.
 */
@customElement("tag-list")
export class TagList extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
			}

			.list .row {
				min-height: 3.5rem;
			}

			.list .row[aria-current="true"] {
				background: var(--color-surface-2);
				box-shadow: inset 3px 0 0 var(--color-primary);
			}

			.name mark {
				border-radius: 3px;
				background: var(--color-primary-soft);
				color: inherit;
				font-weight: 700;
			}

			.list.readonly {
				background: transparent;
				border-style: dashed;
				border-color: var(--color-border);
			}

			.list.readonly .row {
				color: var(--color-muted);
			}

			@media (forced-colors: active) {
				.list .row[aria-current="true"] {
					outline: 2px solid CanvasText;
					outline-offset: -2px;
				}
			}
		`,
	];

	@property({ attribute: false })
	rows: ListRow[] = [];

	@property()
	currentGroup: string | undefined;

	@property()
	currentValue: string | undefined;

	/**
	 * Focuses the row for `group`/`value`, found by walking `li` attributes so a value's text
	 * (quotes, backslashes, …) can never break a selector. False when there is no such row, or
	 * it is read-only and has nothing to focus.
	 */
	focusRow(group: string, value?: string): boolean {
		const button = this.rowElement(
			group,
			value,
		)?.querySelector<HTMLButtonElement>('[data-action="open"]');
		button?.focus();
		return button !== null && button !== undefined;
	}

	private rowElement(
		group: string,
		value: string | undefined,
	): Element | undefined {
		return [...this.renderRoot.querySelectorAll("li[data-group]")].find(
			(li) =>
				li.getAttribute("data-group") === group &&
				(li.getAttribute("data-value") ?? undefined) === value,
		);
	}

	private emit(type: string, detail: unknown): void {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}

	override render() {
		const allReadonly =
			this.rows.length > 0 && this.rows.every((row) => row.readonly);
		return html`<ul class="group list${allReadonly ? " readonly" : ""}">
			${repeat(
				this.rows,
				(row) => `${row.group}:${row.value ?? ""}`,
				(row) => this.renderRow(row),
			)}
		</ul>`;
	}

	private renderRow(row: ListRow) {
		const current =
			row.group === this.currentGroup && row.value === this.currentValue;
		const name = highlight(row.name, row.ranges ?? []);
		if (row.readonly)
			return html`<li data-group=${row.group} data-value=${row.value ?? nothing}>
				<div class="item row static">
					<span class="grow">
						<b class="name">${name}</b>
						<small class="sub">${row.sub}</small>
					</span>
				</div>
			</li>`;
		return html`<li data-group=${row.group} data-value=${row.value ?? nothing}>
			<button
				type="button"
				class="item row"
				data-action="open"
				aria-current=${current ? "true" : nothing}
				@click=${() => this.emit("tag-open", row)}
			>
				<span class="grow">
					<b class="name">${name}</b>
					<small class="sub">${row.sub}</small>
				</span>
				<span class="trail">${icon("chevron", 20)}</span>
			</button>
		</li>`;
	}
}
