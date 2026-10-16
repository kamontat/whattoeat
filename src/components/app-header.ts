import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "#components/app-preferences";
import { LangController, type MessageKey, t } from "#lib/i18n";
import { type IconName, icon, logo } from "#lib/icons";
import { uiStyles } from "#styles/ui";

export type Page = "home" | "restaurants" | "tags" | "history" | "settings";

type Tab = { page: Page; href: string; label: MessageKey; icon: IconName };

const TABS: readonly Tab[] = [
	{ page: "home", href: "./", label: "nav.home", icon: "dice" },
	{
		page: "restaurants",
		href: "./restaurants",
		label: "nav.restaurants",
		icon: "bowl",
	},
	{ page: "history", href: "./history", label: "nav.history", icon: "clock" },
	{
		page: "settings",
		href: "./settings",
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
};

/** Tags has no tab of its own: it is part of Restaurants. */
const tabOf = (page: Page): Page => (page === "tags" ? "restaurants" : page);

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
			.brand,
			app-preferences {
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
				padding: 0.25rem 0.25rem env(safe-area-inset-bottom, 0px);
				border-top: 1px solid var(--color-border);
				background: var(--color-surface);
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
					padding: 0;
					border: 0;
					background: none;
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

			/* From 72rem the language and theme switches fit after the links. */
			@media (min-width: 72rem) {
				app-preferences {
					display: block;
				}
			}
		`,
	];

	@property()
	current: Page = "home";

	protected readonly langController = new LangController(this);

	/** Keep the browser tab title in the current language. */
	override updated(): void {
		const page = TITLES[this.current];
		document.title =
			page === undefined ? t("app.title") : `${t(page)} · ${t("app.title")}`;
	}

	override render() {
		const tab = tabOf(this.current);
		return html`
			<a class="skip" href="#main">${t("nav.skip")}</a>
			<header>
				<a class="brand" href="./">${logo()}<span>${t("app.title")}</span></a>
				<nav aria-label=${t("nav.label")}>
					${TABS.map(
						(link) =>
							html`<a href=${link.href} aria-current=${tab === link.page ? "page" : nothing}>
								${icon(link.icon, 22)}<span>${t(link.label)}</span>
							</a>`,
					)}
				</nav>
				<app-preferences compact></app-preferences>
			</header>
		`;
	}
}
