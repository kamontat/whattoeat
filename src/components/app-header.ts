import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { readBuildInfo } from "#lib/build-info";
import { LangController, type MessageKey, t } from "#lib/i18n";
import { type IconName, icon, logo } from "#lib/icons";
import {
	activeProfile,
	onProfileSwitchedElsewhere,
	PROFILE_EVENT,
	profileInitial,
} from "#lib/profiles";
import { uiStyles } from "#styles/ui";

export type Page =
	| "home"
	| "restaurants"
	| "tags"
	| "history"
	| "settings"
	| "presets"
	| "profiles";

type Tab = { page: Page; path: string; label: MessageKey; icon: IconName };

const TABS: readonly Tab[] = [
	{ page: "home", path: "", label: "nav.home", icon: "dice" },
	{
		page: "restaurants",
		path: "restaurants",
		label: "nav.restaurants",
		icon: "bowl",
	},
	{ page: "history", path: "history", label: "nav.history", icon: "clock" },
	{
		page: "settings",
		path: "settings",
		label: "nav.settings",
		icon: "sliders",
	},
];

/** Browser tab titles; the home page is the app name alone. */
const TITLES: Record<Page, MessageKey | undefined> = {
	home: undefined,
	restaurants: "nav.restaurants",
	tags: "nav.tags",
	history: "nav.history",
	settings: "nav.settings",
	presets: "presets.title",
	profiles: "profiles.title",
};

/** Tags, presets and profiles have no tab of their own: all live under Settings. */
const tabOf = (page: Page): Page =>
	page === "tags" || page === "presets" || page === "profiles"
		? "settings"
		: page;

@customElement("app-header")
export class AppHeader extends LitElement {
	static override styles = [
		uiStyles,
		css`
			.skip {
				position: fixed;
				z-index: 30;
				top: 0.5rem;
				left: 0.5rem;
				padding: 0.75rem 1rem;
				border-radius: var(--radius-sm);
				background: var(--color-text);
				color: var(--color-bg);
				font-weight: 600;
				transform: translateY(-200%);
			}

			.skip:focus {
				transform: none;
			}

			/* Phones: no top bar (pages show their own titles); the nav sits along the bottom edge. */
			.brand {
				display: none;
			}

			nav {
				position: fixed;
				z-index: 20;
				left: 0;
				right: 0;
				bottom: 0;
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				box-sizing: border-box;
				height: var(--tab-bar-height);
				padding: 0.25rem 0.25rem env(safe-area-inset-bottom, 0px);
				border-top: 1px solid var(--color-border);
				background: var(--color-surface);
			}

			/*
			 * A preview build draws an amber line where the page meets the nav, so it is never
			 * mistaken for production. The shadow sits outside the 1px border, leaving the current
			 * tab's marker where it was; the pull request is named in Settings > About.
			 */
			header.preview nav {
				border-top-color: var(--color-preview);
				box-shadow: 0 -5px 0 var(--color-preview);
			}

			nav a {
				position: relative;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.125rem;
				min-height: 3.25rem;
				color: var(--color-muted);
				font-size: 0.6875rem;
				font-weight: 500;
				text-decoration: none;
			}

			nav a[aria-current="page"] {
				color: var(--color-primary);
				font-weight: 600;
			}

			/*
			 * The Settings tab's avatar in place of the gear icon: a solid circle with text that
			 * stays readable against its own background in both themes, regardless of the link's
			 * own (muted or primary) text colour above, because this rule sets .avatar's own
			 * "color" rather than letting it inherit the link's. Same contrast-safe pairing as
			 * .badge/.badge.skip in filter-bar.ts.
			 */
			.avatar {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 22px;
				height: 22px;
				border-radius: 50%;
				background: var(--color-muted);
				color: var(--color-bg);
				font-size: 0.6875rem;
				font-weight: 700;
				line-height: 1;
			}

			nav a[aria-current="page"] .avatar {
				background: var(--color-primary);
				color: var(--color-primary-text);
			}

			.label {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				max-width: 5.5rem;
			}

			/* A short bar on the top edge marks the current tab, so colour is not the only cue. */
			nav a[aria-current="page"]::before {
				content: "";
				position: absolute;
				/* Sits over the bar's 1px top border. */
				top: calc(-0.25rem - 1px);
				width: 1.75rem;
				height: 3px;
				border-radius: 0 0 3px 3px;
				background: currentColor;
			}

			@media (forced-colors: active) {
				nav a[aria-current="page"]::before {
					background: CanvasText;
				}
			}

			/* From 48rem: one top bar, brand on the left, the links beside it. */
			@media (min-width: 48rem) {
				header {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 0.75rem 1.25rem;
					min-height: var(--bar-height);
					padding: 0.375rem 2rem;
					background: var(--color-surface);
					border-bottom: 1px solid var(--color-border);
				}

				/* The top bar is the nav here, so the line moves to its bottom edge. */
				header.preview {
					border-bottom-color: var(--color-preview);
					box-shadow: 0 5px 0 var(--color-preview);
				}

				.brand {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					margin-right: auto;
					color: var(--color-text);
					font-size: var(--brand-size);
					font-weight: 600;
					letter-spacing: -0.01em;
					text-decoration: none;
				}

				/* The mark scales with the brand text. */
				.brand .logo {
					width: calc(var(--brand-size) * 1.5);
					height: calc(var(--brand-size) * 1.5);
				}

				nav {
					position: static;
					display: flex;
					gap: 0.25rem;
					height: auto;
					padding: 0;
					border: 0;
					background: none;
				}

				header.preview nav {
					box-shadow: none;
				}

				nav a {
					flex-direction: row;
					gap: 0.375rem;
					min-height: var(--tap);
					padding: 0 var(--pad-x);
					border-radius: var(--radius-sm);
					font-size: 0.875rem;
				}

				nav a[aria-current="page"] {
					background: var(--color-primary-soft);
					color: var(--color-link);
				}

				nav a[aria-current="page"]::before {
					content: none;
				}

				@media (forced-colors: active) {
					nav a[aria-current="page"] {
						outline: 2px solid CanvasText;
					}
				}
			}
		`,
	];

	@property()
	current: Page = "home";

	/** Relative prefix for every link, for pages nested one or more folders deep. */
	@property()
	base = "./";

	/** Pull request number of a preview build; unset in production and development. */
	@property({ attribute: false })
	pr: number | undefined = readBuildInfo().pr;

	/**
	 * Called when another tab switches, renames or deletes a profile, since this tab's pages
	 * still show the old profile's data. Replaced in tests so a cross-tab switch doesn't
	 * actually navigate.
	 */
	@property({ attribute: false })
	reload: () => void = () => location.reload();

	protected readonly langController = new LangController(this);

	private unsubscribeProfile: (() => void) | undefined;

	/** A same-tab create/switch/rename/delete: just re-render with the new active profile. */
	private readonly onProfileChanged = (): void => {
		this.requestUpdate();
	};

	/** The active profile's id when this page was shown, to spot a switch made while it sat in the back/forward cache. */
	private shownProfileId: string | undefined;

	/**
	 * A page restored from the back/forward cache still holds the profile it was left with,
	 * while its writes would go to whichever profile is active now. Reload it when the active
	 * profile changed meanwhile; a rename alone just needs the new name drawn.
	 */
	private readonly onPageShow = (event: PageTransitionEvent): void => {
		if (!event.persisted) return;
		const { id } = activeProfile();
		if (id !== this.shownProfileId) {
			this.reload();
			return;
		}
		this.requestUpdate();
	};

	override connectedCallback(): void {
		super.connectedCallback();
		this.shownProfileId = activeProfile().id;
		this.unsubscribeProfile = onProfileSwitchedElsewhere(() => this.reload());
		window.addEventListener(PROFILE_EVENT, this.onProfileChanged);
		window.addEventListener("pageshow", this.onPageShow);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribeProfile?.();
		this.unsubscribeProfile = undefined;
		window.removeEventListener(PROFILE_EVENT, this.onProfileChanged);
		window.removeEventListener("pageshow", this.onPageShow);
	}

	/** Keep the browser tab title in the current language; a preview build says so first. */
	override updated(): void {
		const page = TITLES[this.current];
		const title =
			page === undefined ? t("app.title") : `${t(page)} · ${t("app.title")}`;
		document.title =
			this.pr === undefined ? title : `[${t("nav.preview")}] ${title}`;
	}

	/** The Settings tab: the active profile's avatar and name, in place of the gear and its label. */
	private renderSettingsTab(link: Tab, current: boolean) {
		const profile = activeProfile();
		return html`<a
			href=${this.base + link.path}
			aria-current=${current ? "page" : nothing}
			aria-label=${t("nav.settingsProfile", { name: profile.name })}
		>
			<span class="avatar">${profileInitial(profile.name)}</span>
			<span class="label">${profile.name}</span>
		</a>`;
	}

	override render() {
		const tab = tabOf(this.current);
		return html`
			<a class="skip" href="#main">${t("nav.skip")}</a>
			<header class=${this.pr === undefined ? "" : "preview"}>
				<a class="brand" href=${this.base}>${logo()}<span>${t("app.title")}</span></a>
				<nav aria-label=${t("nav.label")}>
					${TABS.map((link) => {
						const current = tab === link.page;
						if (link.page === "settings")
							return this.renderSettingsTab(link, current);
						return html`<a href=${this.base + link.path} aria-current=${current ? "page" : nothing}>
							${icon(link.icon, 22)}<span>${t(link.label)}</span>
						</a>`;
					})}
				</nav>
			</header>
		`;
	}
}
