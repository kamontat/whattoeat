import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "#components/app-sheet";
import "#components/restaurant/search";
import type {
	RestaurantSearch,
	SearchLabels,
} from "#components/restaurant/search";
import "#components/tags/group-form";
import type { GroupDraft, TagGroupForm } from "#components/tags/group-form";
import "#components/tags/list";
import type { ListRow, TagList } from "#components/tags/list";
import "#components/tags/picker";
import type { TagPicker } from "#components/tags/picker";
import "#components/tags/value-form";
import {
	type TagValueForm,
	type ValueDraft,
	valueDraft,
} from "#components/tags/value-form";
import {
	dropFilterGroup,
	dropFilterValue,
	loadFilter,
	saveFilter,
} from "#lib/filter";
import {
	deleteGroup,
	deleteValue,
	type GroupDef,
	groupLabel,
	isGroupsMemoryOnly,
	loadGroups,
	onGroupsChanged,
	saveGroups,
	usingGroup,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE, WIDER } from "#lib/media";
import { BUILT_IN_GROUPS, type Restaurant } from "#lib/restaurant";
import { noMatch, searchByName, searchWords } from "#lib/search";
import {
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	saveRestaurants,
	skippedCount,
} from "#lib/store";
import {
	editValue,
	type GroupKind,
	loadPick,
	savePick,
	type TagEntry,
	type TagGroup,
	tagEntries,
	tagGroups,
} from "#lib/tags";
import { uiStyles } from "#styles/ui";

/** The one form open at a time: a value's, a custom group's, or a new group's. */
type Form =
	| { kind: "value"; group: string; value: string }
	| { kind: "new-group" }
	| { kind: "group"; id: string };

/** Phone below 48rem, small desktop up to 64rem, large desktop from there. */
type Stage = "phone" | "small" | "large";

type Move = { group: string; value: string };

const restaurantsText = (count: number): string =>
	count === 1 ? t("tags.count.one") : t("tags.count.other", { count });

const valuesText = (count: number): string =>
	count === 1 ? t("tags.values.one") : t("tags.values.other", { count });

const groupsText = (count: number): string =>
	count === 1 ? t("tags.groups.one") : t("tags.groups.other", { count });

/** What kind of group this is, in a search result's sub line; Type counts as built in. */
const kindText = (kind: GroupKind): string =>
	t(`tags.kind.${kind === "fixed" ? "built-in" : kind}`);

const isValueDraft = (draft: ValueDraft | GroupDraft): draft is ValueDraft =>
	"target" in draft;

/**
 * The tags page: a header with a count line and search, the group picker (pills, or a column
 * on large screens), the picked group's values (or search results) and one form, in a side panel
 * on wide screens or a sheet on phones. It owns the stores, the pick, the open form and its draft;
 * the parts under it only draw what they are given and report what was done.
 */
@customElement("tag-manager")
export class TagManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/* Phone: fill the space above the tab bar so the pinned Add ends the column even with little content. */
			:host {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				min-height: calc(100dvh - 1.25rem - var(--tab-bar-height));
				margin-bottom: calc(var(--tab-bar-height) - var(--tab-bar-space));
			}

			.back {
				display: inline-flex;
				align-items: center;
				align-self: flex-start;
				gap: 0.25rem;
				min-height: var(--tap);
				margin: -0.5rem 0 -0.5rem -0.5rem;
				padding: 0 0.5rem;
				font-weight: 600;
				text-decoration: none;
			}

			/*
			 * Phone: the title row, search, pills and the group line stay at the top together, so
			 * switching groups never needs scrolling back up while the values scroll underneath.
			 */
			.top {
				position: sticky;
				top: 0;
				z-index: 4;
				display: grid;
				/* minmax(0, …): the pill strip scrolls inside the column instead of widening it. */
				grid-template-columns: minmax(0, 1fr);
				gap: 0.75rem;
				margin-top: -0.75rem;
				padding-block: 0.75rem;
				background: var(--color-bg);
			}

			.head {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-end;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.head-actions {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}

			.head-actions[hidden] {
				display: none;
			}

			.search-open {
				width: var(--tap);
				min-height: var(--tap);
				padding: 0;
				border-radius: var(--radius-pill);
			}

			/* Icon only: the plus says Add, the aria-label says what for. */
			button.add {
				width: var(--tap);
				padding: 0;
				border-radius: 50%;
			}

			.group-head {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.25rem 0.75rem;
				min-height: var(--tap);
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.group-head .edit-group {
				font-size: 0.875rem;
			}

			.status:empty {
				display: none;
			}

			.layout {
				display: grid;
				gap: 1rem;
			}

			.values-col {
				display: grid;
				gap: 0.75rem;
				align-content: start;
				min-width: 0;
			}

			.edit-panel {
				gap: 1rem;
			}

			.panel-head {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.panel-head h2 {
				font-size: 1.125rem;
				font-weight: 600;
			}

			.panel-sub {
				font-size: 0.875rem;
			}

			.panel-head .close {
				flex: none;
				width: var(--tap);
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: var(--color-surface-2);
			}

			/* Phone: Add stays at the bottom right, just above the tab bar. */
			.pinned {
				position: sticky;
				z-index: 5;
				bottom: var(--tab-bar-height);
				display: flex;
				justify-content: flex-end;
				margin-top: auto;
				padding: 0.75rem 0 0.5rem;
				background: linear-gradient(to bottom, transparent, var(--color-bg) 35%);
			}

			.pinned .add {
				width: 3.5rem;
				min-height: 3.5rem;
				box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
			}

			/* Small desktop: values and the open form side by side. */
			.layout[data-stage="small"].with-panel {
				grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
				align-items: start;
				gap: 1.5rem;
			}

			/* Large desktop: groups, values and the open form in three columns. */
			.layout[data-stage="large"] {
				align-items: start;
				gap: 1.5rem;
			}

			.layout[data-stage="large"].with-picker {
				grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
			}

			.layout[data-stage="large"].with-panel {
				grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			}

			.layout[data-stage="large"].with-picker.with-panel {
				grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr) minmax(0, 1fr);
			}

			@media (min-width: 48rem) {
				:host {
					min-height: 0;
					margin-bottom: 0;
				}

				/* The side panel is the sticky part on wide screens; the top scrolls away. */
				.top {
					position: static;
					margin-top: 0;
					padding-block: 0;
				}

				.edit-panel {
					position: sticky;
					top: 1rem;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** From 48rem the form opens in a side panel and Add moves into the header. */
	protected readonly wide = new MediaController(this, WIDE);

	/** From 64rem the picker becomes a groups column. */
	protected readonly wider = new MediaController(this, WIDER);

	/** Relative prefix for the back and restaurants links, for pages nested under Settings. */
	@property() base = "./";

	@state() private restaurants: Restaurant[] = [];
	@state() private defs: GroupDef[] = [];
	/** Stored restaurants the last load could not read. */
	@state() private skipped = 0;

	/** The group whose values show. */
	@state() private picked = "";

	/** The open form; opening another replaces it. */
	@state() private form: Form | undefined;

	/** What the open form has typed, kept here so it survives the form moving between sheet and panel. */
	@state() private draft: ValueDraft | GroupDraft = { name: "", step: "edit" };

	/** Whether `restaurant-search` is open, and what is typed, as it last reported. */
	@state() private searching = false;
	@state() private query = "";

	/** The last save or delete, read out and shown under the title. */
	@state() private status = "";

	/** What the sheet last showed, kept in it while it slides away after closing. */
	private sheetForm: { form: Form; draft: ValueDraft | GroupDraft } | undefined;

	/** Whether the last render was wide, to notice the phone boundary being crossed. */
	private lastWide: boolean | undefined;

	/**
	 * The picker variant last rendered, to notice the 64rem boundary being crossed: pills and the
	 * groups column are different elements, so crossing it swaps one for the other and drops focus.
	 */
	private lastPickerVariant: "pills" | "column" | undefined;

	/** Captured in `willUpdate`, before a variant swap removes the old picker, so focus can follow. */
	private focusWasInPicker = false;

	private unsubscribe: (() => void)[] = [];

	private get search(): RestaurantSearch | null {
		return this.renderRoot.querySelector("restaurant-search");
	}

	private get picker(): TagPicker | null {
		return this.renderRoot.querySelector("tag-picker");
	}

	private get list(): TagList | null {
		return this.renderRoot.querySelector("tag-list");
	}

	/** The form the user can reach right now: the side panel's, or the phone sheet's. */
	private liveForm(): TagValueForm | TagGroupForm | null {
		const host =
			this.renderRoot.querySelector("#edit-panel") ??
			this.renderRoot.querySelector("app-sheet.form-sheet");
		return host?.querySelector("tag-value-form, tag-group-form") ?? null;
	}

	private stage(): Stage {
		if (this.wider.matches) return "large";
		return this.wide.matches ? "small" : "phone";
	}

	/** The picker variant `stage` renders, or undefined while searching hides the picker entirely. */
	private pickerVariant(stage: Stage): "pills" | "column" | undefined {
		if (this.searching) return undefined;
		return stage === "large" ? "column" : "pills";
	}

	/** Done once this and every part under it has drawn, including updates they set off here. */
	protected override async getUpdateComplete(): Promise<boolean> {
		let done = await super.getUpdateComplete();
		for (;;) {
			const parts = this.renderRoot.querySelectorAll<LitElement>(
				"restaurant-search, tag-picker, tag-list, tag-value-form, tag-group-form, app-sheet",
			);
			await Promise.all([...parts].map((part) => part.updateComplete));
			if (!this.isUpdatePending) return done;
			done = await super.getUpdateComplete();
		}
	}

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

	/**
	 * Before this render replaces the DOM, note whether focus is inside the picker right now — the
	 * only chance to ask, since a variant swap at the 64rem boundary removes the old picker element
	 * (and whatever it held focus) once `render` runs.
	 */
	protected override willUpdate(changed: PropertyValues<this>): void {
		super.willUpdate(changed);
		this.focusWasInPicker = this.shadowRoot?.activeElement === this.picker;
	}

	/**
	 * Crossing the phone boundary with a form open moves it between the sheet and the panel; the
	 * draft lives here, so nothing typed is lost. Into the panel, focus follows to its first
	 * control. Into the sheet, focus the form's opener *now*, before the sheet's own update (a
	 * microtask away) captures the focused element as the place to return to on close.
	 *
	 * Crossing the 64rem boundary swaps the pill picker for the groups column (or back): a
	 * different element, so a pill or row focused before the swap would otherwise land on `body`.
	 */
	protected override updated(changed: PropertyValues<this>): void {
		super.updated(changed);
		const stage = this.stage();
		const variant = this.pickerVariant(stage);
		const lastVariant = this.lastPickerVariant;
		this.lastPickerVariant = variant;
		if (
			lastVariant !== undefined &&
			variant !== undefined &&
			lastVariant !== variant &&
			this.focusWasInPicker
		)
			this.focusAfterRender(() => this.picker?.focusPicked());

		const wide = stage !== "phone";
		const wasWide = this.lastWide;
		this.lastWide = wide;
		const form = this.form;
		if (wasWide === undefined || wasWide === wide || form === undefined) return;
		if (wide) this.focusAfterRender(() => this.liveForm()?.focusFirst());
		else this.focusOpener(form);
	}

	private reload(): void {
		this.defs = loadGroups();
		this.restaurants = loadRestaurants();
		this.skipped = skippedCount();
		const ids = [...BUILT_IN_GROUPS, ...this.defs.map((def) => def.id), "tags"];
		if (!ids.includes(this.picked)) this.picked = loadPick(ids);
		const form = this.form;
		if (
			form?.kind === "value" &&
			!valueCounts(this.restaurants, form.group).some(
				(item) => item.value === form.value,
			)
		)
			this.form = undefined;
		if (form?.kind === "group" && !this.defs.some((def) => def.id === form.id))
			this.form = undefined;
	}

	/** Runs `focus` once this and its parts have drawn what was just changed. */
	private focusAfterRender(focus: () => void): void {
		void this.updateComplete.then(focus);
	}

	/** Clear first, then set the text once that clear has rendered, so the same text is read out again. */
	private announce(text: string): void {
		this.status = "";
		void this.updateComplete.then(() => {
			this.status = text;
		});
	}

	/** The picked group's pill or row; while searching, the search field in its place. */
	private focusPicked(): void {
		if (this.searching) this.search?.focusField();
		else this.picker?.focusPicked();
	}

	/** Back to what opened `form` (its row, Edit group or Add), or the picked group once that is gone. */
	private focusOpener(form: Form): void {
		if (form.kind === "value" && this.list?.focusRow(form.group, form.value))
			return;
		const opener =
			form.kind === "group"
				? this.renderRoot.querySelector<HTMLElement>(
						'.group-head [data-action="edit-group"]',
					)
				: form.kind === "new-group" && !this.searching
					? this.renderRoot.querySelector<HTMLElement>("button.add")
					: null;
		if (opener !== null) opener.focus();
		else this.focusPicked();
	}

	private pickGroup(id: string): void {
		this.picked = id;
		savePick(id);
	}

	/** Opens `form` in the one slot, dropping whatever another form had typed. */
	private openForm(form: Form, draft: ValueDraft | GroupDraft): void {
		this.form = form;
		this.draft = draft;
		this.status = "";
		// A sheet puts focus on its own title; the side panel starts at the first control.
		if (this.stage() !== "phone")
			this.focusAfterRender(() => this.liveForm()?.focusFirst());
	}

	/** A row or a search pick: a group ends search and picks it; a value opens its form. */
	private openRow(group: string, value: string | undefined): void {
		if (value === undefined) {
			this.search?.close();
			this.pickGroup(group);
			this.focusAfterRender(() => this.picker?.focusPicked());
			return;
		}
		// Type's values are fixed and have no form.
		if (group === "kind") return;
		this.openForm({ kind: "value", group, value }, valueDraft(group, value));
	}

	private readonly onGroupPick = (event: CustomEvent<string>): void => {
		this.pickGroup(event.detail);
	};

	private readonly onTagOpen = (event: CustomEvent<ListRow>): void => {
		this.openRow(event.detail.group, event.detail.value);
	};

	private readonly onSearchPick = (event: CustomEvent<TagEntry>): void => {
		const entry = event.detail;
		this.openRow(entry.group, entry.type === "value" ? entry.value : undefined);
	};

	private readonly onSearchChange = (
		event: CustomEvent<{ searching: boolean; query: string }>,
	): void => {
		this.searching = event.detail.searching;
		this.query = event.detail.query;
	};

	/** Search ended by the user: the magnifier comes back, so focus goes to it. */
	private readonly onSearchCancel = (): void => {
		this.focusAfterRender(() =>
			this.renderRoot
				.querySelector<HTMLElement>('[data-action="search"]')
				?.focus(),
		);
	};

	private readonly startAdd = (): void => {
		this.openForm({ kind: "new-group" }, { name: "", step: "edit" });
	};

	private openGroupForm(id: string): void {
		this.openForm(
			{ kind: "group", id },
			{ name: groupLabel(id, this.defs), step: "edit" },
		);
	}

	private readonly onDraftChange = (
		event: CustomEvent<ValueDraft | GroupDraft>,
	): void => {
		this.draft = event.detail;
	};

	/** Cancel or the panel's close: drop the form and go back to what opened it. */
	private readonly onFormCancel = (): void => {
		const form = this.form;
		this.form = undefined;
		if (form !== undefined) this.focusAfterRender(() => this.focusOpener(form));
	};

	/** The sheet closed by ✕, Esc or the backdrop; it returns focus to its opener itself. */
	private readonly onSheetClose = (): void => {
		this.form = undefined;
	};

	private readonly onValueSave = (
		event: CustomEvent<{ from: Move; to: Move }>,
	): void => {
		const { from, to } = event.detail;
		const result = editValue(
			this.restaurants,
			loadFilter(),
			from,
			to,
			new Date(),
		);
		this.form = undefined;
		saveFilter(result.filter);
		saveRestaurants(result.restaurants);
		this.announce(t("tags.saved", { name: valueLabel(to.group, to.value) }));
		this.focusAfterRender(() => {
			if (!this.list?.focusRow(to.group, to.value)) this.focusPicked();
		});
	};

	private readonly onValueDelete = (event: CustomEvent<Move>): void => {
		const { group, value } = event.detail;
		this.form = undefined;
		saveFilter(dropFilterValue(loadFilter(), group, value));
		saveRestaurants(deleteValue(this.restaurants, group, value, new Date()));
		this.announce(t("tags.removed", { value: valueLabel(group, value) }));
		this.focusAfterRender(() => this.focusPicked());
	};

	private readonly onGroupSave = (
		event: CustomEvent<{ groups: GroupDef[]; id: string }>,
	): void => {
		const { groups, id } = event.detail;
		const added = this.form?.kind === "new-group";
		this.form = undefined;
		if (added) this.pickGroup(id);
		saveGroups(groups);
		const name = groupLabel(id, groups);
		this.announce(
			added ? t("tags.added", { group: name }) : t("tags.saved", { name }),
		);
		this.focusAfterRender(() => this.focusPicked());
	};

	/** Reorders at once and keeps the form open; the form's focus relies on `defs` updating now. */
	private readonly onGroupMove = (
		event: CustomEvent<{ groups: GroupDef[] }>,
	): void => {
		saveGroups(event.detail.groups);
		this.defs = event.detail.groups;
	};

	private readonly onGroupDelete = (
		event: CustomEvent<{ id: string }>,
	): void => {
		const { id } = event.detail;
		const name = groupLabel(id, this.defs);
		const result = deleteGroup(this.restaurants, this.defs, id, new Date());
		this.form = undefined;
		this.pickGroup("cuisine");
		saveFilter(dropFilterGroup(loadFilter(), id));
		// Restaurants first: if the group list save fails, the next load still turns its values into tags.
		saveRestaurants(result.restaurants);
		saveGroups(result.groups);
		this.announce(t("tags.removed", { value: name }));
		this.focusAfterRender(() => this.focusPicked());
	};

	override render() {
		const stage = this.stage();
		const wide = stage !== "phone";
		const searching = this.searching;
		const groups = tagGroups(this.restaurants, this.defs);
		const entries = tagEntries(this.restaurants, this.defs);
		const picked =
			groups.find((group) => group.id === this.picked) ?? groups[1];
		const form = this.form;
		if (form !== undefined) this.sheetForm = { form, draft: this.draft };
		const showPicker = !searching && picked !== undefined;
		const valueTotal = groups.reduce((sum, group) => sum + group.values, 0);
		const summary = t("tags.summary", {
			groups: groupsText(groups.length),
			values: valuesText(valueTotal),
		});
		const newGroup = t("tags.newGroup");
		const add = html`<button
			type="button"
			class="primary add"
			data-action="add"
			aria-label=${newGroup}
			title=${newGroup}
			@click=${this.startAdd}
		>
			${icon("plus", 24)}
		</button>`;
		const head = form === undefined ? undefined : this.formHead(form);
		return html`
			<a class="back" href=${`${this.base}settings`}>${icon("back", 20)}<span>${t("nav.settings")}</span></a>
			<div class="top">
				<header class="head">
					<div class=${searching ? "visually-hidden" : ""}>
						<h1 class="page-title">${t("tags.title")}</h1>
						<p class="count page-sub" aria-hidden=${searching ? "true" : nothing}>${summary}</p>
					</div>
					<div class="head-actions" ?hidden=${searching}>
						<button
							type="button"
							class="search-open"
							data-action="search"
							aria-label=${t("tags.searchOpen")}
							@click=${() => this.search?.open()}
						>
							${icon("search", 20)}
						</button>
						${wide ? add : nothing}
					</div>
				</header>
				<restaurant-search
					.restaurants=${entries}
					.labels=${this.searchLabels(entries, summary)}
					@search-change=${this.onSearchChange}
					@search-cancel=${this.onSearchCancel}
					@search-pick=${this.onSearchPick}
				></restaurant-search>
				${
					showPicker && stage !== "large"
						? html`${this.renderPicker(groups, "pills", stage === "small")}${this.renderGroupHead(picked, wide)}`
						: nothing
				}
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
							<a class="button-link" href=${`${this.base}restaurants`}>${t("tags.emptyLink")}</a>
						</div>`
					: nothing
			}
			<p class="status success" role="status">${this.status}</p>
			<div
				class="layout ${showPicker && stage === "large" ? "with-picker" : ""} ${wide && form !== undefined ? "with-panel" : ""}"
				data-stage=${stage}
			>
				${showPicker && stage === "large" ? this.renderPicker(groups, "column", false) : nothing}
				<div class="values-col">
					${showPicker && stage === "large" ? this.renderGroupHead(picked, wide) : nothing}
					${searching ? this.renderResults(entries, groups) : picked === undefined ? nothing : this.renderValues(picked)}
				</div>
				${
					wide && form !== undefined && head !== undefined
						? html`<section id="edit-panel" class="card edit-panel" aria-labelledby="form-title">
								<div class="panel-head">
									<div>
										<h2 id="form-title" tabindex="-1">${head.heading}</h2>
										${head.sub === "" ? nothing : html`<p class="muted panel-sub">${head.sub}</p>`}
									</div>
									<button
										type="button"
										class="close"
										data-action="close-panel"
										aria-label=${t("sheet.close")}
										@click=${this.onFormCancel}
									>
										${icon("x", 20)}
									</button>
								</div>
								${this.renderForm(form, this.draft)}
							</section>`
						: nothing
				}
			</div>
			${wide ? nothing : html`<div class="pinned">${add}</div>${this.renderSheet()}`}
		`;
	}

	/** The tags wording for the search field; no words typed yet shows the count line. */
	private searchLabels(
		entries: readonly TagEntry[],
		summary: string,
	): SearchLabels {
		return {
			open: t("tags.searchOpen"),
			placeholder: t("tags.searchPlaceholder"),
			count: (query) =>
				searchWords(query).length > 0
					? t("tags.searchCount", {
							shown: searchByName(entries, query).length,
							total: entries.length,
						})
					: summary,
			noMatch: (query) => t("tags.noMatch", { query }),
		};
	}

	/** Heading and sub line for the panel or sheet holding `form`. */
	private formHead(form: Form): { heading: string; sub: string } {
		if (form.kind === "new-group")
			return { heading: t("tags.newGroup"), sub: "" };
		if (form.kind === "group")
			return {
				heading: groupLabel(form.id, this.defs),
				sub: t("tags.groupSub", {
					values: valuesText(valueCounts(this.restaurants, form.id).length),
					count: restaurantsText(usingGroup(this.restaurants, form.id)),
				}),
			};
		const count =
			valueCounts(this.restaurants, form.group).find(
				(item) => item.value === form.value,
			)?.count ?? 0;
		return {
			heading: valueLabel(form.group, form.value),
			sub: t("tags.valueSub", {
				group: groupLabel(form.group, this.defs),
				count: restaurantsText(count),
			}),
		};
	}

	/** One sheet for every form; a closed one keeps what it last showed while it slides away. */
	private renderSheet() {
		const shown = this.sheetForm;
		const head = shown === undefined ? undefined : this.formHead(shown.form);
		return html`<app-sheet
			class="form-sheet"
			heading=${head?.heading ?? ""}
			subheading=${head?.sub ?? ""}
			?open=${this.form !== undefined}
			@sheet-close=${this.onSheetClose}
		>
			${shown === undefined ? nothing : this.renderForm(shown.form, shown.draft)}
		</app-sheet>`;
	}

	private renderForm(form: Form, draft: ValueDraft | GroupDraft) {
		if (form.kind === "value")
			return html`<tag-value-form
				.restaurants=${this.restaurants}
				.defs=${this.defs}
				.group=${form.group}
				.value=${form.value}
				.draft=${isValueDraft(draft) ? draft : valueDraft(form.group, form.value)}
				@draft-change=${this.onDraftChange}
				@value-save=${this.onValueSave}
				@value-delete=${this.onValueDelete}
				@form-cancel=${this.onFormCancel}
			></tag-value-form>`;
		return html`<tag-group-form
			.restaurants=${this.restaurants}
			.defs=${this.defs}
			.groupId=${form.kind === "group" ? form.id : undefined}
			.draft=${isValueDraft(draft) ? { name: "", step: "edit" } : draft}
			@draft-change=${this.onDraftChange}
			@group-save=${this.onGroupSave}
			@group-move=${this.onGroupMove}
			@group-delete=${this.onGroupDelete}
			@form-cancel=${this.onFormCancel}
		></tag-group-form>`;
	}

	private renderPicker(
		groups: TagGroup[],
		variant: "pills" | "column",
		wrap: boolean,
	) {
		return html`<tag-picker
			.groups=${groups}
			.picked=${this.picked}
			variant=${variant}
			?wrap=${wrap}
			@group-pick=${this.onGroupPick}
		></tag-picker>`;
	}

	/** The picked group's kind and restaurant total, with Edit group for custom groups. */
	private renderGroupHead(group: TagGroup, wide: boolean) {
		const kind =
			group.kind === "fixed" ? t("tags.fixedNote") : kindText(group.kind);
		return html`<div class="group-head" data-group=${group.id}>
			<p><span class="kind">${kind}</span> · <span class="total">${restaurantsText(group.restaurants)}</span></p>
			${
				group.kind === "custom"
					? html`<button
							type="button"
							class="quiet edit-group"
							data-action="edit-group"
							aria-haspopup=${wide ? nothing : "dialog"}
							@click=${() => this.openGroupForm(group.id)}
						>
							${icon("edit", 18)}<span>${t("tags.editGroup")}</span>
						</button>`
					: nothing
			}
		</div>`;
	}

	private renderValues(group: TagGroup) {
		const values = valueCounts(this.restaurants, group.id);
		if (values.length === 0)
			return html`<p class="muted no-values">${t("tags.noValues")}</p>`;
		return this.renderList(
			values.map(({ value, count }) => ({
				group: group.id,
				value,
				name: valueLabel(group.id, value),
				sub: restaurantsText(count),
				readonly: group.id === "kind",
			})),
		);
	}

	private renderResults(entries: readonly TagEntry[], groups: TagGroup[]) {
		const query = this.query;
		if (noMatch(entries, query))
			return html`<div class="card empty no-match">
				<p>${t("tags.noMatch", { query: query.trim() })}</p>
				<button type="button" data-action="clear-search-empty" @click=${() => this.search?.clear()}>
					${t("search.clear")}
				</button>
			</div>`;
		return this.renderList(
			searchByName(entries, query).map(({ item, ranges }): ListRow => {
				if (item.type === "group") {
					const kind =
						groups.find((group) => group.id === item.group)?.kind ?? "custom";
					return {
						group: item.group,
						name: item.name,
						sub: kindText(kind),
						ranges,
					};
				}
				return {
					group: item.group,
					value: item.value,
					name: item.name,
					sub: t("tags.valueSub", {
						group: groupLabel(item.group, this.defs),
						count: restaurantsText(item.count),
					}),
					ranges,
					readonly: item.group === "kind",
				};
			}),
		);
	}

	/** One template for values and results, so the list element survives switching between them. */
	private renderList(rows: ListRow[]) {
		const form = this.form;
		return html`<tag-list
			.rows=${rows}
			.currentGroup=${form?.kind === "value" ? form.group : form?.kind === "group" ? form.id : undefined}
			.currentValue=${form?.kind === "value" ? form.value : undefined}
			@tag-open=${this.onTagOpen}
		></tag-list>`;
	}
}
