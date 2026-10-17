import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import "#components/app-sheet";
import {
	dropFilterGroup,
	dropFilterValue,
	moveFilterValue,
	renameFilterValue,
	updateSavedFilters,
} from "#lib/filter";
import {
	addGroup,
	checkValue,
	deleteGroup,
	deleteValue,
	type GroupDef,
	groupLabel,
	isGroupsMemoryOnly,
	loadGroups,
	moveGroup,
	moveValue,
	type NameError,
	onGroupsChanged,
	renameGroup,
	renameValue,
	saveGroups,
	usingGroup,
	type ValueError,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import {
	BUILT_IN_GROUPS,
	type Restaurant,
	VALUE_GROUPS,
} from "#lib/restaurant";
import {
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	saveRestaurants,
	skippedCount,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

/** What the page is asking about right now; only one prompt is open at a time. */
type Prompt =
	| { kind: "rename-group"; id: string; text: string; error?: NameError }
	| { kind: "delete-group"; id: string }
	| {
			kind: "rename-value";
			group: string;
			value: string;
			text: string;
			error?: ValueError;
	  }
	| { kind: "merge"; group: string; value: string; to: string }
	| { kind: "move-value"; group: string; value: string; to: string }
	| { kind: "delete-value"; group: string; value: string };

@customElement("tag-manager")
export class TagManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1rem;
			}

			.back {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				min-height: var(--tap);
				margin: -0.5rem 0 -0.5rem -0.5rem;
				padding: 0 0.5rem;
				font-weight: 600;
				text-decoration: none;
			}

			.layout {
				display: grid;
				gap: 1rem;
			}

			.groups-col {
				display: grid;
				gap: 1rem;
				align-content: start;
			}

			.group-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.group-head h2 {
				font-size: 1rem;
				font-weight: 600;
			}

			.options {
				width: var(--tap);
				padding: 0;
			}

			.values .item .count {
				white-space: nowrap;
			}

			.value-row[aria-current="true"] {
				background: var(--color-surface-2);
				box-shadow: inset 3px 0 0 var(--color-primary);
			}

			.item[aria-disabled="true"] {
				opacity: 1;
				color: var(--color-muted);
				cursor: not-allowed;
			}

			.reason {
				color: var(--color-muted);
			}

			.value-panel {
				gap: 0.75rem;
			}

			.value-panel h2 {
				font-size: 1.125rem;
				font-weight: 600;
			}

			/* An open prompt sits on one wrapping row. */
			.prompt {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}

			.prompt label {
				display: flex;
				align-items: center;
				font-weight: 400;
			}

			.prompt select {
				font: inherit;
				padding: 0.5rem 0.75rem;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
				color: inherit;
			}

			.prompt .error {
				flex-basis: 100%;
			}

			@media (forced-colors: active) {
				.value-row[aria-current="true"] {
					outline: 2px solid CanvasText;
					outline-offset: -2px;
				}
			}

			@media (min-width: 48rem) {
				.layout.wide {
					grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
					align-items: start;
					gap: 1.5rem;
				}

				.value-panel {
					position: sticky;
					top: 1rem;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	protected readonly wide = new MediaController(this, WIDE);

	@state() private restaurants: Restaurant[] = [];
	@state() private defs: GroupDef[] = [];
	@state() private prompt: Prompt | undefined;
	@state() private newName = "";
	@state() private addError: NameError | undefined;
	/** Stored restaurants the last load could not read. */
	@state() private skipped = 0;

	/** The value whose actions are open (sheet on phones, side panel when wide). */
	@state() private selected: { group: string; value: string } | undefined;

	/** The custom group whose options sheet is open. */
	@state() private optionsFor: string | undefined;

	/** What each sheet last showed, kept in it while it slides away after closing. */
	private lastSelected: { group: string; value: string } | undefined;
	private lastOptionsFor: string | undefined;

	private unsubscribe: (() => void)[] = [];

	/** The layout as of the last render, to notice the narrow/wide boundary being crossed. */
	private lastWide: boolean | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.reload();
		this.unsubscribe = [
			onRestaurantsChanged(() => this.reload()),
			onGroupsChanged(() => this.reload()),
		];
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		for (const stop of this.unsubscribe) stop();
		this.unsubscribe = [];
	}

	protected override updated(changed: PropertyValues<this>): void {
		super.updated(changed);
		const nowWide = this.wide.matches;
		const wasWide = this.lastWide;
		this.lastWide = nowWide;
		if (wasWide === undefined || wasWide === nowWide) return;
		const selected = this.selected;
		if (selected === undefined) return;
		if (nowWide) {
			// The sheet is gone and the side panel has taken its place; land focus on whatever
			// of it is live right now, same as opening a value fresh.
			this.focusAfterRender(() => this.panelCurrentControl());
		} else {
			// The panel is gone and a sheet is about to open in its place. Focus the value's own
			// row *now*, before AppSheet's own update (a microtask away) captures the opener via
			// the currently focused element — otherwise it would capture whatever (if anything)
			// happened to be focused before this resize, and return focus there once the sheet
			// closes instead of to this row.
			const row = this.valueRowButton(selected.group, selected.value);
			if (row instanceof HTMLElement) row.focus();
		}
	}

	/** The open value's row button in the groups column, found by walking rows so a value's
	 * text cannot break a selector. */
	private valueRowButton(group: string, value: string): Element | undefined {
		const section = [...this.renderRoot.querySelectorAll(".tag-group")].find(
			(el) => el.getAttribute("data-group") === group,
		);
		const row = section
			? [...section.querySelectorAll("li.value")].find(
					(li) => li.getAttribute("data-value") === value,
				)
			: undefined;
		return row?.querySelector('[data-action="open-value"]') ?? undefined;
	}

	/** The wide panel's live control right now: an open prompt's input or select, else Rename. */
	private panelCurrentControl(): Element | undefined {
		const detail = this.valueDetail();
		return (
			detail?.querySelector("input, select") ??
			detail?.querySelector('[data-action="rename-value"]') ??
			undefined
		);
	}

	private reload(): void {
		this.defs = loadGroups();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		const selected = this.selected;
		if (
			selected !== undefined &&
			!valueCounts(this.restaurants, selected.group).some(
				(item) => item.value === selected.value,
			)
		) {
			this.selected = undefined;
			if (this.prompt !== undefined && "value" in this.prompt)
				this.prompt = undefined;
		}
		if (
			this.optionsFor !== undefined &&
			!this.defs.some((def) => def.id === this.optionsFor)
		) {
			this.optionsFor = undefined;
			// Only a group prompt is stale here (e.g. its own rename form); a value's open
			// rename, move or delete prompt belongs to the wide panel, not this group's sheet,
			// and must survive it closing.
			if (
				this.prompt?.kind === "rename-group" ||
				this.prompt?.kind === "delete-group"
			)
				this.prompt = undefined;
		}
	}

	/** Runs `find` after the next render and focuses what it returns, for actions that remove the focused button. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	/** The open value's actions container (only one exists at a time). */
	private valueDetail(): Element | undefined {
		return this.renderRoot.querySelector(".value-detail") ?? undefined;
	}

	private groupAction(group: string, action: string): Element | undefined {
		const options = this.renderRoot.querySelector(".group-options");
		if (options?.getAttribute("data-group") !== group) return undefined;
		return options.querySelector(`[data-action="${action}"]`) ?? undefined;
	}

	private readonly addNewGroup = (event: Event): void => {
		event.preventDefault();
		const result = addGroup(this.defs, this.newName);
		if (!result.ok) {
			this.addError = result.error;
			return;
		}
		this.addError = undefined;
		this.newName = "";
		saveGroups(result.value);
	};

	private saveGroupName(id: string, text: string): void {
		const result = renameGroup(this.defs, id, text);
		if (!result.ok) {
			this.prompt = { kind: "rename-group", id, text, error: result.error };
			return;
		}
		this.prompt = undefined;
		saveGroups(result.value);
		this.focusAfterRender(() => this.groupAction(id, "rename-group"));
	}

	private startRename(id: string, label: string): void {
		this.prompt = { kind: "rename-group", id, text: label };
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(".group-options input"),
		);
	}

	private cancelRename(id: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() => this.groupAction(id, "rename-group"));
	}

	/** Moves a custom group and keeps focus on the button that moved it, or the other arrow once it is disabled. */
	private moveGroupBy(id: string, step: -1 | 1, atEdge: boolean): void {
		if (atEdge) return;
		saveGroups(moveGroup(this.defs, id, step));
		const [action, other] =
			step < 0 ? ["move-up", "move-down"] : ["move-down", "move-up"];
		this.focusAfterRender(() => {
			const button = this.groupAction(id, action);
			return button instanceof HTMLButtonElement &&
				button.getAttribute("aria-disabled") === "true"
				? this.groupAction(id, other)
				: button;
		});
	}

	private askDeleteGroup(id: string): void {
		this.prompt = { kind: "delete-group", id };
		this.focusAfterRender(() => this.groupAction(id, "confirm-delete-group"));
	}

	private cancelDeleteGroup(id: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() => this.groupAction(id, "delete-group"));
	}

	private confirmDeleteGroup(id: string): void {
		const result = deleteGroup(this.restaurants, this.defs, id, new Date());
		this.prompt = undefined;
		this.optionsFor = undefined;
		updateSavedFilters((filter) => dropFilterGroup(filter, id));
		// Restaurants first: if the group list save fails, the next load still turns its values into tags.
		saveRestaurants(result.restaurants);
		saveGroups(result.groups);
		// The whole card is gone now; land focus on the one control guaranteed to remain.
		this.focusAfterRender(() => this.renderRoot.querySelector("#new-group"));
	}

	private openValue(group: string, value: string): void {
		this.prompt = undefined;
		this.selected = { group, value };
		// On a phone the sheet puts focus on its own title.
		if (!this.wide.matches) return;
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="rename-value"]'),
		);
	}

	private readonly closeValue = (): void => {
		this.selected = undefined;
		if (this.prompt !== undefined && "value" in this.prompt)
			this.prompt = undefined;
	};

	private openGroupOptions(group: string): void {
		// The value panel is not modal on wide screens, so a value's open rename, move or
		// delete prompt must survive opening a group's options; only a stale group prompt
		// (e.g. another group's rename form) is cleared here.
		if (
			this.prompt?.kind === "rename-group" ||
			this.prompt?.kind === "delete-group"
		)
			this.prompt = undefined;
		// The sheet puts focus on its own title.
		this.optionsFor = group;
	}

	private readonly closeGroupOptions = (): void => {
		this.optionsFor = undefined;
		if (
			this.prompt?.kind === "rename-group" ||
			this.prompt?.kind === "delete-group"
		)
			this.prompt = undefined;
	};

	private startRenameValue(group: string, value: string): void {
		this.prompt = { kind: "rename-value", group, value, text: value };
		this.focusAfterRender(() => this.valueDetail()?.querySelector("input"));
	}

	private cancelRenameValue(_group: string, _value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="rename-value"]'),
		);
	}

	private cancelMerge(_group: string, _value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="rename-value"]'),
		);
	}

	private startMoveValue(group: string, value: string): void {
		this.prompt = {
			kind: "move-value",
			group,
			value,
			to: this.moveTargets(group)[0] ?? "tags",
		};
		this.focusAfterRender(() => this.valueDetail()?.querySelector("select"));
	}

	private cancelMoveValue(_group: string, _value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="move-value"]'),
		);
	}

	private askDeleteValue(group: string, value: string): void {
		this.prompt = { kind: "delete-value", group, value };
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="confirm-delete-value"]'),
		);
	}

	private cancelDeleteValue(_group: string, _value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="delete-value"]'),
		);
	}

	private saveValueName(group: string, value: string, text: string): void {
		const checked = checkValue(text);
		if (!checked.ok) {
			this.prompt = {
				kind: "rename-value",
				group,
				value,
				text,
				error: checked.error,
			};
			return;
		}
		const to = checked.value;
		if (
			to !== value &&
			valueCounts(this.restaurants, group).some((item) => item.value === to)
		) {
			this.prompt = { kind: "merge", group, value, to };
			return;
		}
		this.applyRename(group, value, to);
	}

	private applyRename(group: string, value: string, to: string): void {
		this.prompt = undefined;
		this.selected = { group, value: to };
		updateSavedFilters((filter) => renameFilterValue(filter, group, value, to));
		saveRestaurants(
			renameValue(this.restaurants, group, value, to, new Date()),
		);
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="rename-value"]'),
		);
	}

	private applyMove(group: string, value: string, to: string): void {
		this.prompt = undefined;
		this.selected = undefined;
		updateSavedFilters((filter, scope) =>
			moveFilterValue(filter, group, value, to, scope),
		);
		saveRestaurants(moveValue(this.restaurants, group, value, to, new Date()));
		// The row moves to another group's card (or into plain tags); land focus on the one
		// control guaranteed to remain.
		this.focusAfterRender(() => this.renderRoot.querySelector("#new-group"));
	}

	private applyDelete(group: string, value: string): void {
		this.prompt = undefined;
		this.selected = undefined;
		updateSavedFilters((filter) => dropFilterValue(filter, group, value));
		saveRestaurants(deleteValue(this.restaurants, group, value, new Date()));
		// The row is gone now; land focus on the one control guaranteed to remain.
		this.focusAfterRender(() => this.renderRoot.querySelector("#new-group"));
	}

	/** Groups a value can move to: every group but Type and its own, then plain tags. */
	private moveTargets(group: string): string[] {
		return [...VALUE_GROUPS, ...this.defs.map((def) => def.id), "tags"].filter(
			(id) => id !== group,
		);
	}

	override render() {
		const groups = [
			...BUILT_IN_GROUPS,
			...this.defs.map((def) => def.id),
			"tags",
		];
		const wide = this.wide.matches;
		const selected = this.selected;
		if (selected !== undefined) this.lastSelected = selected;
		if (this.optionsFor !== undefined) this.lastOptionsFor = this.optionsFor;
		const sheetValue = this.lastSelected;
		const sheetGroup = this.lastOptionsFor;
		const detailTitle =
			selected === undefined ? "" : valueLabel(selected.group, selected.value);
		const detailSub =
			selected === undefined
				? ""
				: this.valueSubtitle(selected.group, selected.value);
		const optionsLabel =
			this.optionsFor === undefined
				? ""
				: groupLabel(this.optionsFor, this.defs);
		return html`
			<a class="back" href="./restaurants">${icon("back", 20)}<span>${t("nav.restaurants")}</span></a>
			<div>
				<h1 class="page-title">${t("tags.title")}</h1>
				<p class="page-sub">${t("tags.intro")}</p>
			</div>
			${isMemoryOnly() || isGroupsMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			${
				this.restaurants.length === 0
					? html`<div class="card empty">
							<p>${t("tags.empty")}</p>
							<a class="button-link" href="./restaurants">${t("tags.emptyLink")}</a>
						</div>`
					: nothing
			}
			<div class="layout ${wide ? "wide" : ""}">
				<div class="groups-col">
					${repeat(
						groups,
						(group) => group,
						(group) => this.renderGroup(group),
					)}
					${this.renderAddGroup()}
				</div>
				${
					wide
						? html`<section
								class="card value-panel"
								aria-labelledby=${selected === undefined ? "value-hint" : "value-title"}
							>
								${
									selected === undefined
										? html`<p class="muted pick-hint" id="value-hint">${t("tags.pickHint")}</p>`
										: html`<div>
												<h2 id="value-title">${detailTitle}</h2>
												<p class="muted">${detailSub}</p>
											</div>
											${this.renderValueDetail(selected.group, selected.value)}`
								}
							</section>`
						: html`<app-sheet
								class="value-sheet"
								heading=${detailTitle}
								subheading=${detailSub}
								?open=${selected !== undefined}
								@sheet-close=${this.closeValue}
							>
								${sheetValue === undefined ? nothing : this.renderValueDetail(sheetValue.group, sheetValue.value)}
							</app-sheet>`
				}
			</div>
			<app-sheet
				class="group-sheet"
				heading=${optionsLabel}
				?open=${this.optionsFor !== undefined}
				@sheet-close=${this.closeGroupOptions}
			>
				${sheetGroup === undefined ? nothing : this.renderGroupOptions(sheetGroup)}
			</app-sheet>
		`;
	}

	/** How many restaurants currently use this value, or 0 once it is gone. */
	private countFor(group: string, value: string): number {
		return (
			valueCounts(this.restaurants, group).find((item) => item.value === value)
				?.count ?? 0
		);
	}

	private valueSubtitle(group: string, value: string): string {
		const count = this.countFor(group, value);
		return t("tags.valueSub", {
			group: groupLabel(group, this.defs),
			count:
				count === 1 ? t("tags.count.one") : t("tags.count.other", { count }),
		});
	}

	private renderGroup(group: string) {
		const custom = this.defs.some((def) => def.id === group);
		const label = groupLabel(group, this.defs);
		const values = valueCounts(this.restaurants, group);
		return html`
			<section class="card tag-group" data-group=${group} aria-label=${label}>
				<div class="group-head">
					<h2>${label}</h2>
					${
						custom
							? html`<button
									type="button"
									class="quiet options"
									data-action="group-options"
									aria-haspopup="dialog"
									aria-label=${t("tags.groupOptions", { group: label })}
									@click=${() => this.openGroupOptions(group)}
								>
									${icon("dots", 20)}
								</button>`
							: nothing
					}
				</div>
				${
					values.length === 0
						? html`<p class="muted">${t("tags.noValues")}</p>`
						: html`<ul class="group values">
								${repeat(
									values,
									({ value }) => value,
									({ value, count }) => this.renderValue(group, value, count),
								)}
							</ul>`
				}
			</section>
		`;
	}

	private renderValue(group: string, value: string, count: number) {
		const countText =
			count === 1 ? t("tags.count.one") : t("tags.count.other", { count });
		const label = valueLabel(group, value);
		const current =
			this.selected?.group === group && this.selected.value === value;
		return html`<li class="value" data-value=${value}>
			${
				group === "kind"
					? html`<div class="item static">
							<span class="grow"><b class="name">${label}</b></span>
							<span class="count muted">${countText}</span>
						</div>`
					: html`<button
							type="button"
							class="item value-row"
							data-action="open-value"
							aria-haspopup=${this.wide.matches ? nothing : "dialog"}
							aria-current=${current ? "true" : nothing}
							@click=${() => this.openValue(group, value)}
						>
							<span class="grow"><b class="name">${label}</b></span>
							<span class="count muted">${countText}</span>
							<span class="trail">${icon("chevron", 18)}</span>
						</button>`
			}
		</li>`;
	}

	private renderValueDetail(group: string, value: string) {
		const count = this.countFor(group, value);
		const prompt = this.prompt;
		const mine =
			prompt !== undefined &&
			prompt.kind !== "rename-group" &&
			prompt.kind !== "delete-group" &&
			prompt.group === group &&
			prompt.value === value
				? prompt
				: undefined;
		return html`<div class="value-detail" data-group=${group} data-value=${value}>
			${
				mine === undefined
					? html`<ul class="group actions-list">
							<li>
								<button
									type="button"
									class="item"
									data-action="rename-value"
									aria-label=${t("tags.renameValueLabel", { value })}
									@click=${() => this.startRenameValue(group, value)}
								>
									<span class="lead">${icon("edit", 20)}</span>
									<span class="grow"><b>${t("tags.rename")}</b></span>
								</button>
							</li>
							<li>
								<button
									type="button"
									class="item"
									data-action="move-value"
									aria-label=${t("tags.moveValueLabel", { value })}
									@click=${() => this.startMoveValue(group, value)}
								>
									<span class="lead">${icon("move", 20)}</span>
									<span class="grow"><b>${t("tags.move")}</b><small>${t("tags.anotherGroup")}</small></span>
								</button>
							</li>
							<li>
								<button
									type="button"
									class="item danger"
									data-action="delete-value"
									aria-label=${t("tags.deleteValueLabel", { value })}
									@click=${() => this.askDeleteValue(group, value)}
								>
									<span class="lead">${icon("trash", 20)}</span>
									<span class="grow"><b>${t("tags.delete")}</b></span>
								</button>
							</li>
						</ul>`
					: this.renderValueBody(group, value, count, mine)
			}
		</div>`;
	}

	private renderGroupOptions(group: string) {
		const index = this.defs.findIndex((def) => def.id === group);
		const label = groupLabel(group, this.defs);
		const prompt = this.prompt;
		const first = index === 0;
		const last = index === this.defs.length - 1;
		let body: unknown;
		if (prompt?.kind === "rename-group" && prompt.id === group)
			body = this.renderGroupTitle(group, prompt);
		else if (prompt?.kind === "delete-group" && prompt.id === group)
			body = this.renderGroupPrompt(group, label);
		else
			body = html`<ul class="group actions-list">
				<li>
					<button
						type="button"
						class="item"
						data-action="rename-group"
						aria-label=${t("tags.renameGroupLabel", { group: label })}
						@click=${() => this.startRename(group, label)}
					>
						<span class="lead">${icon("edit", 20)}</span>
						<span class="grow"><b>${t("tags.rename")}</b></span>
					</button>
				</li>
				<li>
					<button
						type="button"
						class="item"
						data-action="move-up"
						aria-disabled=${first ? "true" : nothing}
						aria-describedby=${first ? `move-up-reason-${group}` : nothing}
						@click=${() => this.moveGroupBy(group, -1, first)}
					>
						<span class="lead">${icon("up", 20)}</span>
						<span class="grow"
							><b>${t("tags.moveUp", { group: label })}</b>${
								first
									? html`<small class="reason" id="move-up-reason-${group}" aria-hidden="true">${t("tags.firstGroup")}</small>`
									: nothing
							}</span
						>
					</button>
				</li>
				<li>
					<button
						type="button"
						class="item"
						data-action="move-down"
						aria-disabled=${last ? "true" : nothing}
						aria-describedby=${last ? `move-down-reason-${group}` : nothing}
						@click=${() => this.moveGroupBy(group, 1, last)}
					>
						<span class="lead">${icon("down", 20)}</span>
						<span class="grow"
							><b>${t("tags.moveDown", { group: label })}</b>${
								last
									? html`<small class="reason" id="move-down-reason-${group}" aria-hidden="true">${t("tags.lastGroup")}</small>`
									: nothing
							}</span
						>
					</button>
				</li>
				<li>
					<button
						type="button"
						class="item danger"
						data-action="delete-group"
						aria-label=${t("tags.deleteGroupLabel", { group: label })}
						@click=${() => this.askDeleteGroup(group)}
					>
						<span class="lead">${icon("trash", 20)}</span>
						<span class="grow"><b>${t("tags.delete")}</b></span>
					</button>
				</li>
			</ul>`;
		return html`<div class="group-options" data-group=${group}>${body}</div>`;
	}

	/** The rename-group form; only called once the caller has confirmed the open prompt is this group's rename. */
	private renderGroupTitle(
		group: string,
		prompt: Extract<Prompt, { kind: "rename-group" }>,
	) {
		return html`<form
			class="rename prompt"
			@submit=${(event: Event) => {
				event.preventDefault();
				this.saveGroupName(group, prompt.text);
			}}
		>
			<label>
				<span class="visually-hidden">${t("tags.addLabel")}</span>
				<input
					.value=${live(prompt.text)}
					@input=${(event: Event) => {
						this.prompt = {
							kind: "rename-group",
							id: prompt.id,
							text: (event.target as HTMLInputElement).value,
						};
					}}
				/>
			</label>
			<button type="submit" class="primary" data-action="save-group-name">${t("tags.save")}</button>
			<button type="button" data-action="cancel" @click=${() => this.cancelRename(group)}>${t("tags.cancel")}</button>
			${prompt.error ? html`<p class="error" role="alert">${t(prompt.error)}</p>` : nothing}
		</form>`;
	}

	private renderGroupPrompt(group: string, label: string) {
		const prompt = this.prompt;
		if (prompt?.kind !== "delete-group" || prompt.id !== group) return nothing;
		const count = usingGroup(this.restaurants, group);
		return html`<div role="alert">
			<p>${count === 1 ? t("tags.deleteGroupPrompt.one", { group: label }) : t("tags.deleteGroupPrompt.other", { group: label, count })}</p>
			<div class="actions">
				<button type="button" class="danger" data-action="confirm-delete-group" @click=${() => this.confirmDeleteGroup(group)}>
					${t("tags.confirmDelete")}
				</button>
				<button type="button" data-action="cancel" @click=${() => this.cancelDeleteGroup(group)}>${t("tags.cancel")}</button>
			</div>
		</div>`;
	}

	private renderValueBody(
		group: string,
		value: string,
		count: number,
		prompt: Exclude<
			Prompt,
			{ kind: "rename-group" } | { kind: "delete-group" }
		>,
	) {
		switch (prompt.kind) {
			case "rename-value":
				return html`<form
					class="rename prompt"
					@submit=${(event: Event) => {
						event.preventDefault();
						this.saveValueName(group, value, prompt.text);
					}}
				>
					<label>
						<span class="visually-hidden">${t("tags.renameLabel", { value })}</span>
						<input
							.value=${live(prompt.text)}
							@input=${(event: Event) => {
								this.prompt = {
									kind: "rename-value",
									group,
									value,
									text: (event.target as HTMLInputElement).value,
								};
							}}
						/>
					</label>
					<button type="submit" class="primary" data-action="save-value">${t("tags.save")}</button>
					<button type="button" data-action="cancel" @click=${() => this.cancelRenameValue(group, value)}>${t("tags.cancel")}</button>
					${prompt.error ? html`<p class="error" role="alert">${t(prompt.error)}</p>` : nothing}
				</form>`;
			case "merge":
				return html`<div class="prompt" role="alert">
					<p>${count === 1 ? t("tags.mergePrompt.one", { from: value, to: prompt.to }) : t("tags.mergePrompt.other", { from: value, to: prompt.to, count })}</p>
					<div class="actions">
						<button type="button" class="primary" data-action="confirm-merge" @click=${() => this.applyRename(group, value, prompt.to)}>
							${t("tags.confirmMerge")}
						</button>
						<button type="button" data-action="cancel" @click=${() => this.cancelMerge(group, value)}>${t("tags.cancel")}</button>
					</div>
				</div>`;
			case "move-value":
				return html`<form
					class="prompt"
					@submit=${(event: Event) => {
						event.preventDefault();
						this.applyMove(group, value, prompt.to);
					}}
				>
					<label>
						<span class="visually-hidden">${t("tags.moveLabel", { value })}</span>
						<select
							name="target"
							.value=${live(prompt.to)}
							@change=${(event: Event) => {
								this.prompt = {
									kind: "move-value",
									group,
									value,
									to: (event.target as HTMLSelectElement).value,
								};
							}}
						>
							${this.moveTargets(group).map(
								(id) =>
									html`<option value=${id}>${groupLabel(id, this.defs)}</option>`,
							)}
						</select>
					</label>
					<button type="submit" class="primary" data-action="confirm-move">${t("tags.confirmMove")}</button>
					<button type="button" data-action="cancel" @click=${() => this.cancelMoveValue(group, value)}>${t("tags.cancel")}</button>
				</form>`;
			case "delete-value":
				return html`<div class="prompt" role="alert">
					<p>${count === 1 ? t("tags.deleteValuePrompt.one", { value }) : t("tags.deleteValuePrompt.other", { value, count })}</p>
					<div class="actions">
						<button type="button" class="danger" data-action="confirm-delete-value" @click=${() => this.applyDelete(group, value)}>
							${t("tags.confirmDelete")}
						</button>
						<button type="button" data-action="cancel" @click=${() => this.cancelDeleteValue(group, value)}>${t("tags.cancel")}</button>
					</div>
				</div>`;
		}
	}

	private renderAddGroup() {
		return html`<form class="card add-group" novalidate @submit=${this.addNewGroup}>
			<h2>${t("tags.addTitle")}</h2>
			<label>
				${t("tags.addLabel")}
				<input
					id="new-group"
					autocomplete="off"
					aria-invalid=${this.addError ? "true" : "false"}
					.value=${live(this.newName)}
					@input=${(event: Event) => {
						this.newName = (event.target as HTMLInputElement).value;
						this.addError = undefined;
					}}
				/>
			</label>
			${this.addError ? html`<p class="error" role="alert">${t(this.addError)}</p>` : nothing}
			<div class="actions"><button type="submit" class="primary">${t("tags.add")}</button></div>
		</form>`;
	}
}
