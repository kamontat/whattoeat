import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
	CHANGELOG_URL,
	commitUrl,
	REPO_URL,
	readBuildInfo,
	shortSha,
} from "#lib/build-info";
import { getLang, LangController, t } from "#lib/i18n";
import { uiStyles } from "#styles/ui";

const build = readBuildInfo();

@customElement("app-footer")
export class AppFooter extends LitElement {
	static override styles = [
		uiStyles,
		css`
			footer {
				display: flex;
				flex-wrap: wrap;
				justify-content: center;
				gap: 0.5rem 1rem;
				max-width: 40rem;
				margin: 0 auto;
				padding: 1.5rem 1rem;
				border-top: 1px solid var(--color-border);
				font-size: 0.875rem;
				color: var(--color-muted);
			}

			a {
				color: inherit;
			}

			a:hover {
				color: var(--color-primary);
			}

			code {
				font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			}
		`,
	];

	/** Full commit sha this page was built from; unset in development. */
	@property({ attribute: false })
	sha: string | undefined = build.sha;

	/** When this page was built; unset in development. */
	@property({ attribute: false })
	built: Date | undefined = build.date;

	protected readonly langController = new LangController(this);

	private renderBuilt(built: Date) {
		const lang = getLang();
		// dateStyle and timeStyle refuse timeZoneName, and spelling the fields out turns
		// Thai times into "15 นาฬิกา 30 นาที", so the zone is formatted on its own.
		const zone = new Intl.DateTimeFormat(lang, { timeZoneName: "short" })
			.formatToParts(built)
			.find((part) => part.type === "timeZoneName")?.value;
		const time = new Intl.DateTimeFormat(lang, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(built);
		const date = zone === undefined ? time : `${time} ${zone}`;
		return html`<span>${t("footer.built")} <time datetime=${built.toISOString()}>${date}</time></span>`;
	}

	override render() {
		return html`
			<footer>
				<a data-link="source" href=${REPO_URL} target="_blank" rel="noopener">${t("footer.source")}</a>
				<a data-link="changelog" href=${CHANGELOG_URL} target="_blank" rel="noopener">${t("footer.changelog")}</a>
				${
					this.sha === undefined
						? html`<span>${t("footer.dev")}</span>`
						: html`<a data-link="commit" href=${commitUrl(this.sha)} target="_blank" rel="noopener"><code>${shortSha(this.sha)}</code></a>`
				}
				${this.built === undefined ? nothing : this.renderBuilt(this.built)}
			</footer>
		`;
	}
}
