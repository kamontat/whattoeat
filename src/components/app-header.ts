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

			/* Phones: no top bar (pages show large titles); the nav floats at the bottom. */
			.brand,
			app-preferences {
				display: none;
			}

			nav {
				position: fixed;
				z-index: 20;
				left: 0.875rem;
				right: 0.875rem;
				bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 0.25rem;
				padding: 0.375rem;
				border: 1px solid var(--color-border);
				border-radius: 1.5rem;
				background: var(--color-surface);
				box-shadow: var(--shadow);
			}

			nav a {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.125rem;
				min-height: 3.5rem;
				border-radius: 1.125rem;
				color: var(--color-muted);
				font-size: 0.75rem;
				font-weight: 600;
				text-decoration: none;
			}

			nav a[aria-current="page"] {
				background: var(--color-accent);
				color: var(--color-accent-text);
			}

			@media (forced-colors: active) {
				nav a[aria-current="page"] {
					outline: 2px solid CanvasText;
				}
			}

			/* From 48rem: one top bar, brand on the left, the links as a rounded group. */
			@media (min-width: 48rem) {
				header {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 0.75rem 1.5rem;
					min-height: 4.75rem;
					padding: 0.5rem 2.5rem;
					background: var(--color-surface);
					border-bottom: 1px solid var(--color-border);
				}

				.brand {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					margin-right: auto;
					color: var(--color-text);
					font-size: 1.375rem;
					font-weight: 700;
					letter-spacing: -0.01em;
					text-decoration: none;
				}

				nav {
					position: static;
					display: flex;
					gap: 0.375rem;
					border-radius: 1.375rem;
					background: var(--color-bg);
					box-shadow: none;
				}

				nav a {
					flex-direction: row;
					gap: 0.5rem;
					min-height: var(--tap);
					padding: 0 1.125rem;
					border-radius: 1rem;
					font-size: 0.9375rem;
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
								${icon(link.icon)}<span>${t(link.label)}</span>
							</a>`,
					)}
				</nav>
				<app-preferences compact></app-preferences>
			</header>
		`;
	}
}
