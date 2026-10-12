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
import { uiStyles } from "#styles/ui";

export type Page = "home" | "restaurants" | "settings";

const LINKS: readonly { page: Page; href: string; label: MessageKey }[] = [
	{ page: "home", href: "./", label: "nav.home" },
	{ page: "restaurants", href: "./restaurants", label: "nav.restaurants" },
	{ page: "settings", href: "./settings", label: "nav.settings" },
];

@customElement("app-header")
export class AppHeader extends LitElement {
	static override styles = [
		uiStyles,
		css`
			header {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				max-width: 40rem;
				margin: 0 auto;
				padding: 1rem;
			}

			.brand {
				font-size: 1.25rem;
				font-weight: 700;
				color: var(--color-text);
				text-decoration: none;
			}

			nav {
				display: flex;
				flex-wrap: wrap;
				gap: 1rem;
			}

			nav a {
				color: var(--color-muted);
				text-decoration: none;
			}

			nav a[aria-current="page"] {
				color: var(--color-primary);
				font-weight: 700;
			}

			.lang {
				display: flex;
			}

			.lang button {
				padding: 0.25rem 0.625rem;
				font-size: 0.875rem;
			}

			.lang button:first-child {
				border-radius: var(--radius) 0 0 var(--radius);
			}

			.lang button:last-child {
				border-radius: 0 var(--radius) var(--radius) 0;
			}

			.lang button[aria-pressed="true"] {
				background: var(--color-text);
				border-color: var(--color-text);
				color: var(--color-surface);
			}
		`,
	];

	@property()
	current: Page = "home";

	protected readonly langController = new LangController(this);

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
		return html`
			<header>
				<a class="brand" href="./">${t("app.title")}</a>
				<nav aria-label=${t("nav.label")}>
					${LINKS.map(
						(link) =>
							html`<a href=${link.href} aria-current=${this.current === link.page ? "page" : nothing}>${t(link.label)}</a>`,
					)}
				</nav>
				<div class="lang" role="group" aria-label=${t("lang.label")}>
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
			</header>
		`;
	}
}
