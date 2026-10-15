import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import {
	dropFilterGroup,
	dropFilterValue,
	loadFilter,
	moveFilterValue,
	renameFilterValue,
	saveFilter,
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
				gap: 1.25rem;
			}

			h1 {
				font-size: 1.5rem;
			}

			section.group {
				gap: 0.75rem;
			}

			.group-head {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.group-head h2 {
				font-size: 1.125rem;
			}

			.values {
				display: grid;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			li.value {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 0.75rem;
			}

			li.value .name {
				font-weight: 600;
			}

			/* An open prompt sits where the row's buttons were, on one wrapping row. */
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

			li.value .actions,
			li.value .prompt {
				margin-left: auto;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state() private restaurants: Restaurant[] = [];
	@state() private defs: GroupDef[] = [];
	@state() private prompt: Prompt | undefined;
	@state() private newName = "";
	@state() private addError: NameError | undefined;
	/** Stored restaurants the last load could not read. */
	@state() private skipped = 0;

	private unsubscribe: (() => void)[] = [];

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

	private reload(): void {
		this.defs = loadGroups();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
	}

	/** Runs `find` after the next render and focuses what it returns, for actions that remove the focused button. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	// Group ids and values are compared as attributes rather than put into a selector, where a
	// quote or backslash in a stored value would break it.
	private groupCard(group: string): Element | undefined {
		return [...this.renderRoot.querySelectorAll("section.group")].find(
			(section) => section.getAttribute("data-group") === group,
		);
	}

	private groupAction(group: string, action: string): Element | undefined {
		return (
			this.groupCard(group)?.querySelector(`[data-action="${action}"]`) ??
			undefined
		);
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
		this.focusAfterRender(() => this.groupCard(id)?.querySelector("input"));
	}

	private cancelRename(id: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() => this.groupAction(id, "rename-group"));
	}

	/** Moves a custom group and keeps focus on the button that moved it, or the other arrow once it is disabled. */
	private moveGroupBy(id: string, step: -1 | 1): void {
		saveGroups(moveGroup(this.defs, id, step));
		const [action, other] =
			step < 0 ? ["move-up", "move-down"] : ["move-down", "move-up"];
		this.focusAfterRender(() => {
			const button = this.groupAction(id, action);
			return button instanceof HTMLButtonElement && button.disabled
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
		saveFilter(dropFilterGroup(loadFilter(), id));
		// Restaurants first: if the group list save fails, the next load still turns its values into tags.
		saveRestaurants(result.restaurants);
		saveGroups(result.groups);
		// The whole card is gone now; land focus on the one control guaranteed to remain.
		this.focusAfterRender(() => this.renderRoot.querySelector("#new-group"));
	}

	private valueRow(group: string, value: string): Element | undefined {
		return [
			...(this.groupCard(group)?.querySelectorAll("li.value") ?? []),
		].find((row) => row.getAttribute("data-value") === value);
	}

	private startRenameValue(group: string, value: string): void {
		this.prompt = { kind: "rename-value", group, value, text: value };
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector("input"),
		);
	}

	private cancelRenameValue(group: string, value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector(
				'[data-action="rename-value"]',
			),
		);
	}

	private cancelMerge(group: string, value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector(
				'[data-action="rename-value"]',
			),
		);
	}

	private startMoveValue(group: string, value: string): void {
		this.prompt = {
			kind: "move-value",
			group,
			value,
			to: this.moveTargets(group)[0] ?? "tags",
		};
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector("select"),
		);
	}

	private cancelMoveValue(group: string, value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector('[data-action="move-value"]'),
		);
	}

	private askDeleteValue(group: string, value: string): void {
		this.prompt = { kind: "delete-value", group, value };
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector(
				'[data-action="confirm-delete-value"]',
			),
		);
	}

	private cancelDeleteValue(group: string, value: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() =>
			this.valueRow(group, value)?.querySelector(
				'[data-action="delete-value"]',
			),
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
		saveFilter(renameFilterValue(loadFilter(), group, value, to));
		saveRestaurants(
			renameValue(this.restaurants, group, value, to, new Date()),
		);
		this.focusAfterRender(() =>
			this.valueRow(group, to)?.querySelector('[data-action="rename-value"]'),
		);
	}

	private applyMove(group: string, value: string, to: string): void {
		this.prompt = undefined;
		saveFilter(moveFilterValue(loadFilter(), group, value, to));
		saveRestaurants(moveValue(this.restaurants, group, value, to, new Date()));
		// The row moves to another group's card (or into plain tags); land focus on the one
		// control guaranteed to remain.
		this.focusAfterRender(() => this.renderRoot.querySelector("#new-group"));
	}

	private applyDelete(group: string, value: string): void {
		this.prompt = undefined;
		saveFilter(dropFilterValue(loadFilter(), group, value));
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
		return html`
			<h1>${t("tags.title")}</h1>
			<p class="muted">${t("tags.intro")}</p>
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
							<a href="./restaurants">${t("tags.emptyLink")}</a>
						</div>`
					: nothing
			}
			${repeat(
				groups,
				(group) => group,
				(group) => this.renderGroup(group),
			)}
			${this.renderAddGroup()}
		`;
	}

	private renderGroup(group: string) {
		const index = this.defs.findIndex((def) => def.id === group);
		const custom = index >= 0;
		const label = groupLabel(group, this.defs);
		const values = valueCounts(this.restaurants, group);
		// Hide the normal actions while a prompt for this same group is open, rather than
		// stacking them next to the rename form or the delete confirmation.
		const promptOpen =
			(this.prompt?.kind === "rename-group" ||
				this.prompt?.kind === "delete-group") &&
			this.prompt.id === group;
		return html`
			<section class="card group" data-group=${group} aria-label=${label}>
				<div class="group-head">
					${this.renderGroupTitle(group, label)}
					${custom && !promptOpen ? this.renderGroupActions(group, label, index) : nothing}
				</div>
				${this.renderGroupPrompt(group, label)}
				${
					values.length === 0
						? html`<p class="muted">${t("tags.noValues")}</p>`
						: html`<ul class="values">
								${values.map(({ value, count }) => this.renderValue(group, value, count))}
							</ul>`
				}
			</section>
		`;
	}

	private renderGroupTitle(group: string, label: string) {
		const prompt = this.prompt;
		if (prompt?.kind === "rename-group" && prompt.id === group)
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
		return html`<h2>${label}</h2>`;
	}

	private renderGroupActions(group: string, label: string, index: number) {
		return html`<div class="actions">
			<button
				type="button"
				data-action="rename-group"
				aria-label=${t("tags.renameGroupLabel", { group: label })}
				@click=${() => this.startRename(group, label)}
			>
				${t("tags.rename")}
			</button>
			<button
				type="button"
				data-action="move-up"
				aria-label=${t("tags.moveUp", { group: label })}
				?disabled=${index === 0}
				@click=${() => this.moveGroupBy(group, -1)}
			>↑</button>
			<button
				type="button"
				data-action="move-down"
				aria-label=${t("tags.moveDown", { group: label })}
				?disabled=${index === this.defs.length - 1}
				@click=${() => this.moveGroupBy(group, 1)}
			>↓</button>
			<button
				type="button"
				class="danger"
				data-action="delete-group"
				aria-label=${t("tags.deleteGroupLabel", { group: label })}
				@click=${() => this.askDeleteGroup(group)}
			>
				${t("tags.delete")}
			</button>
		</div>`;
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

	private renderValue(group: string, value: string, count: number) {
		const countText =
			count === 1 ? t("tags.count.one") : t("tags.count.other", { count });
		const prompt = this.prompt;
		const mine =
			prompt !== undefined &&
			prompt.kind !== "rename-group" &&
			prompt.kind !== "delete-group" &&
			prompt.group === group &&
			prompt.value === value
				? prompt
				: undefined;
		return html`<li class="value" data-value=${value}>
			<span class="name">${valueLabel(group, value)}</span>
			<span class="count muted">${countText}</span>
			${group === "kind" ? nothing : this.renderValueBody(group, value, count, mine)}
		</li>`;
	}

	private renderValueBody(
		group: string,
		value: string,
		count: number,
		prompt:
			| Exclude<Prompt, { kind: "rename-group" } | { kind: "delete-group" }>
			| undefined,
	) {
		if (prompt === undefined) {
			return html`<div class="actions">
				<button
					type="button"
					data-action="rename-value"
					aria-label=${t("tags.renameValueLabel", { value })}
					@click=${() => this.startRenameValue(group, value)}
				>
					${t("tags.rename")}
				</button>
				<button
					type="button"
					data-action="move-value"
					aria-label=${t("tags.moveValueLabel", { value })}
					@click=${() => this.startMoveValue(group, value)}
				>
					${t("tags.move")}
				</button>
				<button
					type="button"
					class="danger"
					data-action="delete-value"
					aria-label=${t("tags.deleteValueLabel", { value })}
					@click=${() => this.askDeleteValue(group, value)}
				>
					${t("tags.delete")}
				</button>
			</div>`;
		}
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
