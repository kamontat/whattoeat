import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
	getLang,
	LANGS,
	type Lang,
	LangController,
	type MessageKey,
	setLang,
	t,
} from "#lib/i18n";
import { type IconName, icon } from "#lib/icons";
import {
	getTheme,
	setTheme,
	THEMES,
	type Theme,
	ThemeController,
} from "#lib/theme";
import { uiStyles } from "#styles/ui";

/** Each language named in itself, so a reader of either language can find their own. */
const LANG_NAMES: Record<Lang, { short: string; full: string }> = {
	en: { short: "EN", full: "English" },
	th: { short: "ไทย", full: "ไทย" },
};

const THEME_LABELS: Record<Theme, MessageKey> = {
	auto: "theme.auto",
	light: "theme.light",
	dark: "theme.dark",
};

const THEME_ICONS: Record<Theme, IconName> = {
	auto: "auto",
	light: "sun",
	dark: "moon",
};

/**
 * Language and theme as native radio groups styled as segmented controls. The full layout is
 * two rows of a grouped list (Settings); `compact` is the pair of switches in the wide top bar.
 */
@customElement("app-preferences")
export class AppPreferences extends LitElement {
	static override styles = [
		uiStyles,
		css`
			fieldset {
				margin: 0;
				padding: 0;
				border: 0;
				min-width: 0;
			}

			.row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: var(--row-pad-y) 0.875rem var(--row-pad-y) var(--pad-x);
			}

			.row + .row {
				border-top: 1px solid var(--color-border);
			}

			.row-label {
				font-weight: 600;
				font-size: var(--row-text);
			}

			.seg {
				flex: none;
			}

			.seg input + span {
				min-width: var(--seg-min);
			}

			:host([compact]) .switches {
				display: flex;
				gap: 0.5rem;
			}

			:host([compact]) .seg input + span {
				min-width: var(--tap);
				padding: 0 0.625rem;
			}
		`,
	];

	/** The top-bar layout: no visible row labels, icons for the theme. */
	@property({ type: Boolean, reflect: true })
	compact = false;

	protected readonly langController = new LangController(this);
	protected readonly themeController = new ThemeController(this);

	private renderLang() {
		const lang = getLang();
		return html`<fieldset class="lang">
			<legend class="visually-hidden">${t("lang.label")}</legend>
			<div class="seg">
				${LANGS.map(
					(code) => html`<label>
						<input
							type="radio"
							name="lang"
							value=${code}
							.checked=${code === lang}
							@change=${() => setLang(code)}
						/>
						<span lang=${code}>
							${
								LANG_NAMES[code].short === LANG_NAMES[code].full
									? LANG_NAMES[code].full
									: html`<span aria-hidden="true">${LANG_NAMES[code].short}</span><span class="visually-hidden">${LANG_NAMES[code].full} (${LANG_NAMES[code].short})</span>`
							}
						</span>
					</label>`,
				)}
			</div>
		</fieldset>`;
	}

	private renderTheme() {
		const theme = getTheme();
		return html`<fieldset class="theme">
			<legend class="visually-hidden">${t("theme.label")}</legend>
			<div class="seg">
				${THEMES.map(
					(name) => html`<label>
						<input
							type="radio"
							name="theme"
							value=${name}
							.checked=${name === theme}
							@change=${() => setTheme(name)}
						/>
						<span>
							${
								this.compact
									? html`${icon(THEME_ICONS[name], 20)}<span class="visually-hidden">${t(THEME_LABELS[name])}</span>`
									: t(THEME_LABELS[name])
							}
						</span>
					</label>`,
				)}
			</div>
		</fieldset>`;
	}

	override render() {
		if (this.compact)
			return html`<div class="switches">${this.renderLang()}${this.renderTheme()}</div>`;
		return html`<div class="group">
			<div class="row">
				<span class="row-label" aria-hidden="true">${t("lang.label")}</span>
				${this.renderLang()}
			</div>
			<div class="row">
				<span class="row-label" aria-hidden="true">${t("theme.label")}</span>
				${this.renderTheme()}
			</div>
		</div>`;
	}
}
