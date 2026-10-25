import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import "#components/app-sheet";
import "#components/app-toast";
import type { AppToast } from "#components/app-toast";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { MediaController, WIDE } from "#lib/media";
import {
	activeProfile,
	checkName,
	copyProfile,
	createProfile,
	deleteProfile,
	loadProfiles,
	type NameError,
	PROFILE_MAX,
	type Profile,
	profileCounts,
	profileCountText,
	profileHistoryText,
	profileInitial,
	renameProfile,
	switchProfile,
} from "#lib/profiles";
import { uiStyles } from "#styles/ui";

/** What the profile form is for: a new profile, or renaming `renamingId`. */
type FormMode = "new" | "rename";

/**
 * The `/settings/profiles` page body, laid out like the Restaurants page: one row per profile
 * (tapping one switches to it) with icon-only Rename, Copy and Delete buttons, and an icon-only
 * "+" that opens the profile form in a side panel on wide screens and a sheet on phones. Rename
 * uses the same form. Delete asks once, in a confirm under its row.
 *
 * Messages go to the page's `<app-toast>` when one is mounted, otherwise to one rendered in
 * this component's own shadow root.
 */
@customElement("profile-manager")
export class ProfileManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/*
			 * Same rhythm as the presets and tags pages: one gap between every part. Phone: fill the
			 * space above the tab bar so the pinned add button ends the column even with few rows.
			 */
			:host {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				min-height: calc(100dvh - 1.25rem - var(--tab-bar-height));
				margin-bottom: calc(var(--tab-bar-height) - var(--tab-bar-space));
			}

			.back {
				display: inline-flex;
				align-self: flex-start;
				align-items: center;
				gap: 0.25rem;
				min-height: var(--tap);
				margin: -0.5rem 0 -0.5rem -0.5rem;
				padding: 0 0.5rem;
				font-weight: 600;
				text-decoration: none;
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

			.layout {
				display: grid;
				gap: 1rem;
			}

			/* One profile: the switching row, then its icon buttons. */
			.group > li + li {
				border-top: 1px solid var(--color-border);
			}

			.profile {
				display: flex;
				align-items: center;
			}

			.profile .item {
				flex: 1;
				min-width: 0;
			}

			.row-actions {
				display: flex;
				flex: none;
				gap: 0.125rem;
				padding-inline-end: 0.375rem;
			}

			/* Icon only: the icon says what, the aria-label says for which profile. */
			.row-actions button {
				width: var(--tap);
				padding: 0;
				border-radius: 50%;
			}

			.row-actions [data-action="delete"] {
				color: var(--color-danger);
			}

			.confirm {
				display: grid;
				gap: 0.75rem;
				padding: 0 var(--pad-x) var(--row-pad-y);
			}

			.profile-form {
				display: grid;
				gap: 0.75rem;
			}

			.edit-panel {
				gap: 1rem;
			}

			.panel-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.panel-head .close {
				flex: none;
				width: var(--tap);
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: var(--color-surface-2);
			}

			/* Icon only: the plus says Add, the aria-label says what for. */
			button.add {
				width: var(--tap);
				padding: 0;
				border-radius: 50%;
			}

			.edit-panel h2 {
				font-size: 1.125rem;
				font-weight: 600;
			}

			/* Phone: the add button stays at the bottom right, just above the tab bar. */
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

			@media (min-width: 48rem) {
				:host {
					min-height: 0;
					margin-bottom: 0;
				}

				.layout.wide {
					grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
					align-items: start;
					gap: 1.5rem;
				}

				.edit-panel {
					position: sticky;
					top: 1rem;
					box-sizing: border-box;
					max-height: calc(100dvh - 2rem);
					overflow-y: auto;
				}
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Wide screens show the form in a side panel; phones open it in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	/** The width class as of the last render, to catch a crossing while the form is open. */
	private wasWide = this.wide.matches;

	/** Relative prefix for the back link; pages one folder under Settings. */
	@property() base = "../";

	@state() private profiles: Profile[] = [];
	@state() private active = "";

	/** Whether the phone form sheet is open. */
	@state() private sheetOpen = false;

	/** Whether the wide side panel is open. */
	@state() private panelOpen = false;

	/**
	 * What the form was last opened for. Kept after it closes, so a sheet sliding away still
	 * shows what it showed.
	 */
	@state() private formMode: FormMode = "new";
	@state() private renamingId: string | undefined;
	@state() private name = "";
	@state() private error: NameError | undefined;

	/** The profile whose delete confirm is showing. */
	@state() private confirmingId: string | undefined;

	/** Render a `<app-toast>` of our own, because the page did not mount one. */
	private ownToast = false;

	override connectedCallback(): void {
		super.connectedCallback();
		this.ownToast = document.querySelector("app-toast") === null;
		this.reload();
	}

	/**
	 * Crossing into the wide layout stops rendering the sheet, so move an open form into the
	 * panel (and focus its title if focus was in the sheet); crossing back opens the sheet for a
	 * form left open in the panel.
	 */
	protected override willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		const wide = this.wide.matches;
		if (wide && this.sheetOpen) {
			const focusWasInSheet =
				this.renderRoot.querySelector("app-sheet")?.containsFocus() ?? false;
			this.sheetOpen = false;
			this.panelOpen = true;
			if (focusWasInSheet)
				this.focusAfterRender(() =>
					this.renderRoot.querySelector("#form-title"),
				);
		} else if (this.wasWide && !wide && this.panelOpen) {
			this.panelOpen = false;
			this.sheetOpen = true;
		}
		this.wasWide = wide;
	}

	private reload(): void {
		this.profiles = loadProfiles();
		this.active = activeProfile().id;
	}

	/** The page's toast if it mounted one, otherwise our own. */
	private toast(): AppToast | null {
		return (document.querySelector("app-toast") ??
			this.renderRoot.querySelector("app-toast")) as AppToast | null;
	}

	/** Runs `find` after the next render and focuses what it returns. */
	private focusAfterRender(find: () => Element | null | undefined): void {
		void this.updateComplete.then(() => {
			const target = find();
			if (target instanceof HTMLElement) target.focus();
		});
	}

	private announce(message: string): void {
		void this.updateComplete.then(() => {
			this.toast()?.show(message);
		});
	}

	private rowButton(id: string): HTMLElement | null {
		return this.renderRoot.querySelector(`.item[data-profile="${id}"]`);
	}

	private actionButton(action: string, id: string): HTMLElement | null {
		return this.renderRoot.querySelector(
			`button[data-action="${action}"][data-profile="${id}"]`,
		);
	}

	private addButton(): HTMLElement | null {
		return this.renderRoot.querySelector("button.add");
	}

	private readonly onSwitch = (id: string): void => {
		if (id === this.active) return;
		switchProfile(id);
		const switched = this.profiles.find((profile) => profile.id === id);
		this.reload();
		this.announce(t("profiles.switched", { name: switched?.name ?? "" }));
	};

	/** Open the form in the sheet (phone) or the panel (wide). */
	private openForm(mode: FormMode, profile?: Profile): void {
		this.formMode = mode;
		this.renamingId = profile?.id;
		this.name = profile?.name ?? "";
		this.error = undefined;
		this.confirmingId = undefined;
		const wide = this.wide.matches;
		this.sheetOpen = !wide;
		this.panelOpen = wide;
		// A sheet puts focus on its own title; the side panel starts at the name.
		if (wide)
			this.focusAfterRender(() =>
				this.renderRoot.querySelector("#profile-name"),
			);
	}

	/** The "+" again on an open new-profile panel hides it. */
	private readonly onAdd = (): void => {
		if (this.panelOpen && this.formMode === "new") {
			this.closeForm();
			return;
		}
		this.openForm("new");
	};

	/** Close the sheet or panel; a closed panel sends focus back to the add button. */
	private closeForm(focus?: () => Element | null | undefined): void {
		this.error = undefined;
		this.sheetOpen = false;
		if (this.panelOpen) {
			this.panelOpen = false;
			this.focusAfterRender(focus ?? (() => this.addButton()));
		} else if (focus !== undefined) this.focusAfterRender(focus);
	}

	/** The sheet closed by its ✕, Esc or the backdrop: that cancels. */
	private readonly onSheetClose = (): void => {
		this.sheetOpen = false;
	};

	private readonly onNameInput = (event: Event): void => {
		this.name = (event.target as HTMLInputElement).value;
		this.error = undefined;
	};

	private readonly onSubmit = (event: Event): void => {
		event.preventDefault();
		const renamingId = this.formMode === "rename" ? this.renamingId : undefined;
		const error = checkName(this.name, renamingId);
		if (error !== undefined) {
			this.error = error;
			return;
		}
		if (renamingId === undefined) {
			const profile = createProfile(this.name);
			this.reload();
			this.closeForm(() => this.rowButton(profile.id));
			this.announce(t("profiles.created", { name: profile.name }));
		} else {
			renameProfile(renamingId, this.name);
			this.reload();
			this.closeForm(() => this.rowButton(renamingId));
		}
	};

	private readonly onCopy = (profile: Profile): void => {
		try {
			const copy = copyProfile(profile.id);
			this.reload();
			this.announce(
				t("profiles.copied", { name: profile.name, copy: copy.name }),
			);
		} catch {
			this.reload();
			this.announce(t("storage.warning"));
		}
	};

	private readonly askDelete = (id: string): void => {
		this.confirmingId = id;
		if (this.panelOpen) {
			this.panelOpen = false;
			this.error = undefined;
		}
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="delete-confirm"]'),
		);
	};

	private readonly cancelDelete = (): void => {
		const id = this.confirmingId;
		this.confirmingId = undefined;
		if (id !== undefined)
			this.focusAfterRender(() => this.actionButton("delete", id));
	};

	private readonly confirmDelete = (): void => {
		const id = this.confirmingId;
		const deleted = this.profiles.find((profile) => profile.id === id);
		if (deleted === undefined) return;
		const index = this.profiles.indexOf(deleted);
		deleteProfile(deleted.id);
		this.confirmingId = undefined;
		if (this.renamingId === deleted.id) this.closeForm();
		this.reload();
		// The row that took its place, or the add button when it was the last row.
		const next = this.profiles[index];
		this.focusAfterRender(() =>
			next === undefined ? this.addButton() : this.rowButton(next.id),
		);
		this.announce(t("profiles.deleted", { name: deleted.name }));
	};

	override render() {
		const wide = this.wide.matches;
		const addLabel = t("profiles.new");
		const add = html`<button
			type="button"
			class="primary add"
			data-action="new"
			aria-label=${addLabel}
			title=${addLabel}
			aria-expanded=${wide ? String(this.panelOpen) : nothing}
			aria-controls=${wide ? "edit-panel" : nothing}
			@click=${this.onAdd}
		>
			${icon("plus", 24)}
		</button>`;
		const formTitle = this.formTitle();
		return html`
			<a class="back" href=${`${this.base}settings`}>${icon("back", 20)}<span>${t("nav.settings")}</span></a>
			<header class="head">
				<h1 class="page-title">${t("profiles.title")}</h1>
				${wide ? html`<div class="head-actions">${add}</div>` : nothing}
			</header>
			<div class="layout ${wide && this.panelOpen ? "wide" : ""}">
				<ul class="group">
					${repeat(
						this.profiles,
						(profile) => profile.id,
						(profile) => this.renderRow(profile),
					)}
				</ul>
				${
					wide && this.panelOpen
						? html`<section id="edit-panel" class="card edit-panel" aria-labelledby="form-title">
								<div class="panel-head">
									<h2 id="form-title" tabindex="-1">${formTitle}</h2>
									<button
										type="button"
										class="close"
										data-action="close-panel"
										aria-label=${t("sheet.close")}
										@click=${() => this.closeForm()}
									>
										${icon("x", 20)}
									</button>
								</div>
								${this.renderForm()}
							</section>`
						: nothing
				}
			</div>
			${
				wide
					? nothing
					: html`<div class="pinned">${add}</div>
							<app-sheet class="form-sheet" heading=${formTitle} ?open=${this.sheetOpen} @sheet-close=${this.onSheetClose}>
								${this.renderForm()}
							</app-sheet>`
			}
			${this.ownToast ? html`<app-toast></app-toast>` : nothing}
		`;
	}

	private formTitle(): string {
		if (this.formMode === "new") return t("profiles.new");
		const renaming = this.profiles.find(
			(profile) => profile.id === this.renamingId,
		);
		return t("profiles.renameTitle", { name: renaming?.name ?? this.name });
	}

	private renderRow(profile: Profile) {
		const isActive = profile.id === this.active;
		const counts = profileCounts(profile.id);
		const confirming = profile.id === this.confirmingId;
		const name = profile.name;
		return html`
			<li>
				<div class="profile">
					<button
						type="button"
						class="item"
						data-profile=${profile.id}
						aria-current=${isActive ? "true" : nothing}
						@click=${() => this.onSwitch(profile.id)}
					>
						<span class="lead avatar">${profileInitial(name)}</span>
						<span class="grow">
							<b>${name}</b>
							<small>${profileCountText(counts.restaurants)}</small>
						</span>
						${isActive ? html`<span class="trail">${icon("check", 20)}</span>` : nothing}
					</button>
					${
						confirming
							? nothing
							: html`<div class="row-actions">
									${this.renderRowAction(profile.id, "rename", "edit", t("profiles.renameLabel", { name }), () => this.openForm("rename", profile))}
									${this.renderRowAction(profile.id, "copy", "copy", t("profiles.copyLabel", { name }), () => this.onCopy(profile))}
									${this.renderRowAction(
										profile.id,
										"delete",
										"trash",
										t("profiles.deleteLabel", { name }),
										() => this.askDelete(profile.id),
										this.profiles.length <= 1,
									)}
								</div>`
					}
				</div>
				${confirming ? this.renderDeleteConfirm(profile, isActive) : nothing}
			</li>
		`;
	}

	private renderRowAction(
		id: string,
		action: "rename" | "copy" | "delete",
		name: "edit" | "copy" | "trash",
		label: string,
		onClick: () => void,
		disabled = false,
	) {
		return html`<button
			type="button"
			class="quiet"
			data-action=${action}
			data-profile=${id}
			aria-label=${label}
			title=${label}
			?disabled=${disabled}
			@click=${onClick}
		>
			${icon(name, 20)}
		</button>`;
	}

	private renderForm() {
		const error = this.error;
		return html`
			<form class="profile-form" @submit=${this.onSubmit}>
				<label>
					${t("profiles.nameLabel")}
					<input
						id="profile-name"
						name="profile-name"
						autocomplete="off"
						maxlength=${PROFILE_MAX}
						aria-invalid=${error ? "true" : "false"}
						aria-describedby=${error ? "profile-name-error" : nothing}
						.value=${live(this.name)}
						@input=${this.onNameInput}
					/>
				</label>
				${this.formMode === "new" ? html`<p class="hint">${t("profiles.newHint")}</p>` : nothing}
				${error ? html`<p id="profile-name-error" class="error" role="alert">${t(error)}</p>` : nothing}
				<div class="actions">
					<button type="submit" class="primary" data-action="save">${t("profiles.save")}</button>
					<button type="button" data-action="cancel" @click=${() => this.closeForm()}>
						${t("settings.cancel")}
					</button>
				</div>
			</form>
		`;
	}

	private renderDeleteConfirm(profile: Profile, isActive: boolean) {
		const counts = profileCounts(profile.id);
		const next = this.profiles.find((item) => item.id !== profile.id);
		const prompt = t("profiles.deletePrompt", {
			name: profile.name,
			restaurants: profileCountText(counts.restaurants),
			history: profileHistoryText(counts.history),
		});
		return html`
			<div class="confirm">
				<p role="alert">${prompt}${
					isActive
						? ` ${t("profiles.deleteSwitch", { next: next?.name ?? "" })}`
						: nothing
				}</p>
				<div class="actions">
					<button
						type="button"
						class="danger"
						data-action="delete-confirm"
						@click=${this.confirmDelete}
					>
						${t("profiles.delete")}
					</button>
					<button type="button" data-action="delete-cancel" @click=${this.cancelDelete}>
						${t("settings.cancel")}
					</button>
				</div>
			</div>
		`;
	}
}
