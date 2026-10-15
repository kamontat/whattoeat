import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
	getLang,
	LANGS,
	LangController,
	type MessageKey,
	setLang,
	t,
} from "#lib/i18n";
import {
	getTheme,
	setTheme,
	THEMES,
	type Theme,
	ThemeController,
} from "#lib/theme";
import { uiStyles } from "#styles/ui";

export type Page = "home" | "restaurants" | "tags" | "history" | "settings";

const THEME_LABELS: Record<Theme, MessageKey> = {
	auto: "theme.auto",
	light: "theme.light",
	dark: "theme.dark",
};

const THEME_ICONS: Record<Theme, string> = {
	auto: "◐",
	light: "☀",
	dark: "☾",
};

const LINKS: readonly { page: Page; href: string; label: MessageKey }[] = [
	{ page: "home", href: "./", label: "nav.home" },
	{ page: "restaurants", href: "./restaurants", label: "nav.restaurants" },
	{ page: "tags", href: "./tags", label: "nav.tags" },
	{ page: "history", href: "./history", label: "nav.history" },
	{ page: "settings", href: "./settings", label: "nav.settings" },
];

@customElement("app-header")
export class AppHeader extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/* Phones: brand and switches on top, nav links below. Wider screens: one row. */
			header {
				display: grid;
				grid-template-columns: auto 1fr;
				grid-template-areas:
					"brand controls"
					"nav nav";
				align-items: center;
				gap: 0.75rem;
				max-width: 40rem;
				margin: 0 auto;
				padding: 1rem;
			}

			.brand {
				grid-area: brand;
				font-size: 1.25rem;
				font-weight: 700;
				color: var(--color-text);
				text-decoration: none;
			}

			nav {
				grid-area: nav;
				display: flex;
				flex-wrap: wrap;
				gap: 0.75rem;
			}

			nav a {
				color: var(--color-muted);
				text-decoration: none;
			}

			nav a[aria-current="page"] {
				color: var(--color-primary);
				font-weight: 700;
			}

			.controls {
				grid-area: controls;
				display: flex;
				flex-wrap: wrap;
				justify-content: flex-end;
				gap: 0.5rem;
			}

			.switch {
				display: flex;
			}

			.switch button {
				padding: 0.25rem 0.625rem;
				font-size: 0.875rem;
				border-radius: 0;
			}

			.switch button:first-child {
				border-radius: var(--radius) 0 0 var(--radius);
			}

			.switch button:last-child {
				border-radius: 0 var(--radius) var(--radius) 0;
			}

			.switch button[aria-pressed="true"] {
				background: var(--color-text);
				border-color: var(--color-text);
				color: var(--color-surface);
			}

			/*
			 * One row only once the header has its full 40rem. Brand, five links and switches need
			 * about all of it in English, so the gaps and switch padding are tighter here than on
			 * phones; the nav takes the free column and wraps inside it rather than pushing it wider.
			 */
			@media (min-width: 44rem) {
				header {
					grid-template-columns: auto minmax(0, 1fr) auto;
					grid-template-areas: "brand nav controls";
					gap: 0.75rem;
				}

				nav {
					gap: 0.25rem 0.5rem;
				}

				.switch button {
					padding-inline: 0.5rem;
				}
			}
		`,
	];

	@property()
	current: Page = "home";

	protected readonly langController = new LangController(this);
	protected readonly themeController = new ThemeController(this);

	/** Keep the browser tab title in the current language. */
	override updated(): void {
		const page = LINKS.find((link) => link.page === this.current);
		document.title =
			page === undefined || page.page === "home"
				? t("app.title")
				: `${t(page.label)} · ${t("app.title")}`;
	}

	override render() {
		const lang = getLang();
		const theme = getTheme();
		return html`
			<header>
				<a class="brand" href="./">${t("app.title")}</a>
				<nav aria-label=${t("nav.label")}>
					${LINKS.map(
						(link) =>
							html`<a href=${link.href} aria-current=${this.current === link.page ? "page" : nothing}>${t(link.label)}</a>`,
					)}
				</nav>
				<div class="controls">
					<div class="switch lang" role="group" aria-label=${t("lang.label")}>
						${LANGS.map(
							(code) =>
								html`<button
									type="button"
									data-lang=${code}
									aria-pressed=${code === lang ? "true" : "false"}
									@click=${() => setLang(code)}
								>
									${code.toUpperCase()}
								</button>`,
						)}
					</div>
					<div class="switch theme" role="group" aria-label=${t("theme.label")}>
						${THEMES.map(
							(name) =>
								html`<button
									type="button"
									data-theme=${name}
									aria-label=${t(THEME_LABELS[name])}
									title=${t(THEME_LABELS[name])}
									aria-pressed=${name === theme ? "true" : "false"}
									@click=${() => setTheme(name)}
								>
									${THEME_ICONS[name]}
								</button>`,
						)}
					</div>
				</div>
			</header>
		`;
	}
}
