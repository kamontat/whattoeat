import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { dropFilterGroup, loadFilter, saveFilter } from "#lib/filter";
import {
	addGroup,
	deleteGroup,
	type GroupDef,
	groupLabel,
	loadGroups,
	moveGroup,
	type NameError,
	onGroupsChanged,
	renameGroup,
	saveGroups,
	usingGroup,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { BUILT_IN_GROUPS, type Restaurant } from "#lib/restaurant";
import {
	loadRestaurants,
	onRestaurantsChanged,
	saveRestaurants,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

/** What the page is asking about right now; only one prompt is open at a time. */
type Prompt =
	| { kind: "rename-group"; id: string; text: string; error?: NameError }
	| { kind: "delete-group"; id: string };

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

			li.value .actions {
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
	}

	/** Runs `find` after the next render and focuses what it returns, for actions that remove the focused button. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	private groupAction(group: string, action: string): Element | undefined {
		return (
			this.renderRoot.querySelector(
				`section.group[data-group="${group}"] [data-action="${action}"]`,
			) ?? undefined
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
		this.focusAfterRender(() => this.renderRoot.querySelector(`#rename-${id}`));
	}

	private cancelRename(id: string): void {
		this.prompt = undefined;
		this.focusAfterRender(() => this.groupAction(id, "rename-group"));
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

	override render() {
		const groups = [
			...BUILT_IN_GROUPS,
			...this.defs.map((def) => def.id),
			"tags",
		];
		return html`
			<h1>${t("tags.title")}</h1>
			<p class="muted">${t("tags.intro")}</p>
			${
				this.restaurants.length === 0
					? html`<div class="card empty">
							<p>${t("tags.empty")}</p>
							<a href="./restaurants">${t("tags.emptyLink")}</a>
						</div>`
					: nothing
			}
			${groups.map((group) => this.renderGroup(group))}
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
		const promptOpen = this.prompt?.id === group;
		return html`
			<section class="card group" data-group=${group} aria-labelledby="title-${group}">
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
				class="rename"
				@submit=${(event: Event) => {
					event.preventDefault();
					this.saveGroupName(group, prompt.text);
				}}
			>
				<label class="visually-hidden" for="rename-${group}">${t("tags.addLabel")}</label>
				<input
					id="rename-${group}"
					.value=${live(prompt.text)}
					@input=${(event: Event) => {
						this.prompt = {
							kind: "rename-group",
							id: prompt.id,
							text: (event.target as HTMLInputElement).value,
						};
					}}
				/>
				<button type="submit" class="primary" data-action="save-group-name">${t("tags.save")}</button>
				<button type="button" data-action="cancel" @click=${() => this.cancelRename(group)}>${t("tags.cancel")}</button>
				${prompt.error ? html`<p class="error" role="alert">${t(prompt.error)}</p>` : nothing}
			</form>`;
		return html`<h2 id="title-${group}">${label}</h2>`;
	}

	private renderGroupActions(group: string, label: string, index: number) {
		return html`<div class="actions">
			<button type="button" data-action="rename-group" @click=${() => this.startRename(group, label)}>
				${t("tags.rename")}
			</button>
			<button
				type="button"
				data-action="move-up"
				aria-label=${t("tags.moveUp", { group: label })}
				?disabled=${index === 0}
				@click=${() => saveGroups(moveGroup(this.defs, group, -1))}
			>↑</button>
			<button
				type="button"
				data-action="move-down"
				aria-label=${t("tags.moveDown", { group: label })}
				?disabled=${index === this.defs.length - 1}
				@click=${() => saveGroups(moveGroup(this.defs, group, 1))}
			>↓</button>
			<button type="button" class="danger" data-action="delete-group" @click=${() => this.askDeleteGroup(group)}>
				${t("tags.delete")}
			</button>
		</div>`;
	}

	private renderGroupPrompt(group: string, label: string) {
		const prompt = this.prompt;
		if (prompt?.kind !== "delete-group" || prompt.id !== group) return nothing;
		return html`<div role="alert">
			<p>${t("tags.deleteGroupPrompt", { group: label, count: usingGroup(this.restaurants, group) })}</p>
			<div class="actions">
				<button type="button" class="danger" data-action="confirm-delete-group" @click=${() => this.confirmDeleteGroup(group)}>
					${t("tags.confirmDelete")}
				</button>
				<button type="button" data-action="cancel" @click=${() => this.cancelDeleteGroup(group)}>${t("tags.cancel")}</button>
			</div>
		</div>`;
	}

	/** Task 12 adds the value actions here. */
	private renderValue(group: string, value: string, count: number) {
		return html`<li class="value" data-value=${value}>
			<span class="name">${valueLabel(group, value)}</span>
			<span class="count muted">${count === 1 ? t("tags.count.one") : t("tags.count.other", { count })}</span>
		</li>`;
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
