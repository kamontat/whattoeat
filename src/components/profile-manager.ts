import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import "#components/app-toast";
import type { AppToast } from "#components/app-toast";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import {
	activeProfile,
	checkName,
	createProfile,
	deleteProfile,
	loadProfiles,
	type NameError,
	PROFILE_MAX,
	type Profile,
	profileCounts,
	profileCountText,
	profileInitial,
	renameProfile,
	switchProfile,
} from "#lib/profiles";
import { uiStyles } from "#styles/ui";

/** The actions row, or whichever inline card stands in for it. */
type Mode = "list" | "new" | "rename" | "delete";

/**
 * The `/settings/profiles` page body: one row per profile (tapping one switches to it), then
 * New / Rename / Delete actions. New and Rename open an inline name form in place of the
 * actions; Delete opens an inline one-step confirm. Nothing here is a modal.
 *
 * Messages go to the page's `<app-toast>` when one is mounted, otherwise to one rendered in
 * this component's own shadow root.
 */
@customElement("profile-manager")
export class ProfileManager extends LitElement {
	static override styles = [
		uiStyles,
		css`
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

			.confirm {
				display: grid;
				gap: 0.75rem;
				padding: 1rem 1.125rem;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	/** Relative prefix for the back link; pages one folder under Settings. */
	@property() base = "../";

	@state() private profiles: Profile[] = [];
	@state() private active = "";
	@state() private mode: Mode = "list";
	@state() private name = "";
	@state() private error: NameError | undefined;

	/** Render a `<app-toast>` of our own, because the page did not mount one. */
	private ownToast = false;

	override connectedCallback(): void {
		super.connectedCallback();
		this.ownToast = document.querySelector("app-toast") === null;
		this.reload();
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

	/** Runs `find` after the next render and focuses what it returns, as preset-picker does. */
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

	private readonly onSwitch = (id: string): void => {
		if (id === this.active) return;
		switchProfile(id);
		const switched = this.profiles.find((profile) => profile.id === id);
		this.reload();
		this.announce(t("profiles.switched", { name: switched?.name ?? "" }));
	};

	private readonly openNew = (): void => {
		this.mode = "new";
		this.name = "";
		this.error = undefined;
		this.focusAfterRender(() => this.renderRoot.querySelector("#profile-name"));
	};

	private readonly openRename = (): void => {
		this.mode = "rename";
		this.name = activeProfile().name;
		this.error = undefined;
		this.focusAfterRender(() => this.renderRoot.querySelector("#profile-name"));
	};

	private readonly openDelete = (): void => {
		this.mode = "delete";
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="delete-confirm"]'),
		);
	};

	private readonly cancelForm = (): void => {
		const opened = this.mode;
		this.mode = "list";
		this.error = undefined;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector(
				`[data-action="${opened === "rename" ? "rename" : "new"}"]`,
			),
		);
	};

	private readonly cancelDelete = (): void => {
		this.mode = "list";
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="delete"]'),
		);
	};

	private readonly onNameInput = (event: Event): void => {
		this.name = (event.target as HTMLInputElement).value;
		this.error = undefined;
	};

	private readonly onSubmit = (event: Event): void => {
		event.preventDefault();
		const mode = this.mode;
		if (mode !== "new" && mode !== "rename") return;
		const exceptId = mode === "rename" ? this.active : undefined;
		const error = checkName(this.name, exceptId);
		if (error !== undefined) {
			this.error = error;
			return;
		}
		if (mode === "new") {
			const profile = createProfile(this.name);
			this.mode = "list";
			this.reload();
			this.focusAfterRender(() =>
				this.renderRoot.querySelector(`[data-profile="${profile.id}"]`),
			);
			this.announce(t("profiles.created", { name: profile.name }));
		} else {
			const id = this.active;
			renameProfile(id, this.name);
			this.mode = "list";
			this.reload();
			this.focusAfterRender(() =>
				this.renderRoot.querySelector(`[data-profile="${id}"]`),
			);
		}
	};

	private readonly confirmDelete = (): void => {
		const deleted = activeProfile();
		deleteProfile(deleted.id);
		this.mode = "list";
		this.reload();
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="new"]'),
		);
		this.announce(t("profiles.deleted", { name: deleted.name }));
	};

	override render() {
		return html`
			<a class="back" href=${`${this.base}settings`}>${icon("back", 20)}<span>${t("nav.settings")}</span></a>
			<h1 class="page-title">${t("profiles.title")}</h1>
			<div class="group">${this.profiles.map((profile) => this.renderRow(profile))}</div>
			${this.renderBottom()}
			${this.ownToast ? html`<app-toast></app-toast>` : nothing}
		`;
	}

	private renderRow(profile: Profile) {
		const isActive = profile.id === this.active;
		const counts = profileCounts(profile.id);
		return html`
			<button
				type="button"
				class="item"
				data-profile=${profile.id}
				aria-current=${isActive ? "true" : nothing}
				@click=${() => this.onSwitch(profile.id)}
			>
				<span class="lead avatar">${profileInitial(profile.name)}</span>
				<span class="grow">
					<b>${profile.name}</b>
					<small>${profileCountText(counts.restaurants)}</small>
				</span>
				${isActive ? html`<span class="trail">${icon("check", 20)}</span>` : nothing}
			</button>
		`;
	}

	private renderBottom() {
		if (this.mode === "new" || this.mode === "rename") return this.renderForm();
		if (this.mode === "delete") return this.renderDeleteConfirm();
		return this.renderActions();
	}

	private renderActions() {
		return html`
			<div class="actions">
				<button type="button" class="primary" data-action="new" @click=${this.openNew}>
					${t("profiles.new")}
				</button>
				<button type="button" data-action="rename" @click=${this.openRename}>
					${t("profiles.rename")}
				</button>
				<button
					type="button"
					class="danger"
					data-action="delete"
					?disabled=${this.profiles.length <= 1}
					@click=${this.openDelete}
				>
					${t("profiles.delete")}
				</button>
			</div>
		`;
	}

	private renderForm() {
		const error = this.error;
		return html`
			<form class="group confirm" @submit=${this.onSubmit}>
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
				${this.mode === "new" ? html`<p class="hint">${t("profiles.newHint")}</p>` : nothing}
				${error ? html`<p id="profile-name-error" class="error" role="alert">${t(error)}</p>` : nothing}
				<div class="actions">
					<button type="submit" class="primary" data-action="save">${t("profiles.save")}</button>
					<button type="button" data-action="cancel" @click=${this.cancelForm}>
						${t("settings.cancel")}
					</button>
				</div>
			</form>
		`;
	}

	private renderDeleteConfirm() {
		const profile = activeProfile();
		const counts = profileCounts(profile.id);
		const next = this.profiles.find((item) => item.id !== profile.id);
		return html`
			<div class="group confirm">
				<p role="alert">${t("profiles.deletePrompt", {
					name: profile.name,
					restaurants: counts.restaurants,
					history: counts.history,
					next: next?.name ?? "",
				})}</p>
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
