import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "#components/app-sheet";
import {
	cycleTag,
	EMPTY_FILTER,
	type Filter,
	isFilterActive,
	type TagState,
	tagState,
} from "#lib/filter";
import {
	allGroupIds,
	type GroupDef,
	groupLabel,
	valueLabel,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { type Restaurant, valuesByUsage } from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

const SYMBOL: Record<TagState, string> = {
	off: "",
	include: "✓ ",
	exclude: "✕ ",
};

/**
 * The restaurants page's filter: the active values, and a sheet of every group's values plus
 * plain tags, opened with `open()`. It only draws `filter`; each change is reported as
 * `filter-change` (detail: the next filter) for the page to save.
 */
@customElement("restaurant-filter")
export class RestaurantFilter extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: block;
			}

			.summary {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
			}

			/* Active values: buttons, so tapping one reopens the sheet. */
			.summary-chip {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				/* Transparent, not absent: forced-colours still draws an edge around the chip. */
				border: 1px solid transparent;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
			}

			.summary-chip.include {
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			.summary-chip.exclude {
				border-style: dashed;
				border-color: var(--color-control);
				color: var(--color-muted);
				text-decoration: line-through;
			}

			.filter {
				display: grid;
				gap: 0.875rem;
			}

			.filter-group {
				display: grid;
				gap: 0.375rem;
			}

			.filter-group h3 {
				margin: 0;
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-weight: 500;
			}

			button.tag {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
				line-height: 1.2;
			}

			button.tag.include {
				border-color: var(--color-primary);
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			button.tag.exclude {
				border-style: dashed;
				color: var(--color-muted);
				text-decoration: line-through;
			}

			.active-filter {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.25rem 0.5rem;
				padding-top: 0.75rem;
				border-top: 1px solid var(--color-border);
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.active-filter .quiet {
				min-height: 2.25rem;
				padding: 0 0.5rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@property({ attribute: false })
	restaurants: readonly Restaurant[] = [];

	@property({ attribute: false })
	defs: readonly GroupDef[] = [];

	@property({ attribute: false })
	filter: Filter = EMPTY_FILTER;

	@state()
	private sheetOpen = false;

	open(): void {
		this.sheetOpen = true;
	}

	/** Every group, then plain tags. */
	private groupIds(): string[] {
		return [...allGroupIds(this.defs), "tags"];
	}

	private label(group: string): string {
		return groupLabel(group, this.defs);
	}

	private change(next: Filter): void {
		this.dispatchEvent(
			new CustomEvent("filter-change", {
				detail: next,
				bubbles: true,
				composed: true,
			}),
		);
	}

	/** Active values in group order, included before excluded. */
	private active(): { group: string; value: string; state: TagState }[] {
		return this.groupIds().flatMap((group) => {
			const current = Object.hasOwn(this.filter, group)
				? this.filter[group]
				: undefined;
			if (current === undefined) return [];
			return [
				...current.include.map((value) => ({
					group,
					value,
					state: "include" as const,
				})),
				...current.exclude.map((value) => ({
					group,
					value,
					state: "exclude" as const,
				})),
			];
		});
	}

	override render() {
		const active = this.active();
		const groups = this.groupIds()
			.map((group) => ({
				group,
				values: valuesByUsage(this.restaurants, group),
			}))
			.filter(({ values }) => values.length > 0);
		return html`
			${
				active.length > 0
					? html`<ul class="chips summary" aria-label=${t("filter.title")}>
							${active.map(
								({ group, value, state }) => html`<li class=${state}>
									<button
										type="button"
										class="summary-chip ${state}"
										data-state=${state}
										data-action="open-filter-value"
										aria-haspopup="dialog"
										@click=${() => this.open()}
									><span aria-hidden="true">${SYMBOL[state]}</span>${valueLabel(group, value)}<span class="visually-hidden">, ${t(`filter.state.${state}`)}</span></button>
								</li>`,
							)}
						</ul>`
					: nothing
			}
			<app-sheet
				heading=${t("filter.title")}
				?open=${this.sheetOpen}
				@sheet-close=${() => {
					this.sheetOpen = false;
				}}
			>
				<section class="filter">
					<p class="hint">${t("filter.hint")}</p>
					${groups.map(({ group, values }) => this.renderGroup(group, values))}
					${
						isFilterActive(this.filter)
							? html`<p class="active-filter">
									<span>${t("filter.active", { tags: this.summary(active) })}</span>
									<button type="button" class="quiet" data-action="clear-filter" @click=${() => this.change(EMPTY_FILTER)}>
										${t("filter.clear")}
									</button>
								</p>`
							: nothing
					}
				</section>
				<button
					slot="footer"
					type="button"
					class="primary"
					data-action="filter-done"
					@click=${() => {
						this.sheetOpen = false;
					}}
				>
					${t("filter.done")}
				</button>
			</app-sheet>
		`;
	}

	private summary(
		active: { group: string; value: string; state: TagState }[],
	): string {
		return this.groupIds()
			.map((group) => {
				const values = active
					.filter((item) => item.group === group)
					.map(
						({ value, state }) => `${SYMBOL[state]}${valueLabel(group, value)}`,
					);
				return values.length > 0
					? `${this.label(group)}: ${values.join(", ")}`
					: "";
			})
			.filter((part) => part !== "")
			.join("; ");
	}

	private renderGroup(group: string, values: string[]) {
		const label = this.label(group);
		return html`<div class="filter-group" role="group" aria-labelledby="group-${group}">
			<h3 id="group-${group}">${label}</h3>
			<ul class="chips">
				${values.map((value) => {
					const state = tagState(this.filter, group, value);
					const name = valueLabel(group, value);
					return html`<li>
						<button
							type="button"
							class="chip tag ${state}"
							data-group=${group}
							data-tag=${value}
							data-state=${state}
							aria-pressed=${state === "off" ? "false" : "true"}
							aria-label=${t("filter.tagState", {
								group: label,
								tag: name,
								state: t(`filter.state.${state}`),
							})}
							@click=${() => this.change(cycleTag(this.filter, group, value))}
						>
							${SYMBOL[state]}${name}
						</button>
					</li>`;
				})}
			</ul>
		</div>`;
	}
}
