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
import { icon } from "#lib/icons";
import { uiStyles } from "#styles/ui";

const build = readBuildInfo();

@customElement("app-footer")
export class AppFooter extends LitElement {
	static override styles = [
		uiStyles,
		css`
			code {
				font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			}

			.item .trail {
				margin-left: auto;
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
		return html`<div class="item">
			<span class="lead">${icon("clock", 22)}</span>
			<span class="grow"><span>${t("footer.built")} <time datetime=${built.toISOString()}>${date}</time></span></span>
		</div>`;
	}

	override render() {
		return html`
			<footer class="group">
				<a class="item" data-link="source" href=${REPO_URL} target="_blank" rel="noopener">
					<span class="lead">${icon("code", 22)}</span>
					<span class="grow"><b>${t("footer.source")}</b></span>
					<span class="trail">${icon("chevron", 20)}</span>
				</a>
				<a class="item" data-link="changelog" href=${CHANGELOG_URL} target="_blank" rel="noopener">
					<span class="lead">${icon("list", 22)}</span>
					<span class="grow"><b>${t("footer.changelog")}</b></span>
					<span class="trail">${icon("chevron", 20)}</span>
				</a>
				${
					this.sha === undefined
						? html`<div class="item"><span class="lead">${icon("tag", 22)}</span><span class="grow">${t("footer.dev")}</span></div>`
						: html`<a class="item" data-link="commit" href=${commitUrl(this.sha)} target="_blank" rel="noopener">
								<span class="lead">${icon("tag", 22)}</span>
								<span class="grow"><code>${shortSha(this.sha)}</code></span>
								<span class="trail">${icon("chevron", 20)}</span>
							</a>`
				}
				${this.built === undefined ? nothing : this.renderBuilt(this.built)}
			</footer>
		`;
	}
}
