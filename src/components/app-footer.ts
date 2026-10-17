import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
	CHANGELOG_URL,
	commitUrl,
	type Environment,
	pullUrl,
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

	/** Where this page came from; only deployed pages link their commit and the changelog. */
	@property({ attribute: false })
	environment: Environment = build.environment;

	/** Full commit sha this page was built from; set only when deployed. */
	@property({ attribute: false })
	sha: string | undefined = build.sha;

	/** When this page was built; unset on the development server. */
	@property({ attribute: false })
	built: Date | undefined = build.date;

	/** Pull request number of a preview build; unset in production and development. */
	@property({ attribute: false })
	pr: number | undefined = build.pr;

	/** Pull request branch of a preview build; unset in production and development. */
	@property({ attribute: false })
	branch: string | undefined = build.branch;

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
		return html`<div class="item" data-row="built">
			<span class="lead">${icon("clock", 22)}</span>
			<span class="grow"><b>${t("footer.built")}</b></span>
			<small class="trail"><time datetime=${built.toISOString()}>${date}</time></small>
		</div>`;
	}

	/** A preview names its pull request under the source link, which then opens that pull request. */
	private renderSource() {
		const number = this.environment === "preview" ? this.pr : undefined;
		const pr =
			number === undefined
				? nothing
				: html`<small>#${number}${this.branch === undefined ? "" : ` - ${this.branch}`}</small>`;
		return html`<a class="item" data-link="source" href=${number === undefined ? REPO_URL : pullUrl(number)} target="_blank" rel="noopener">
			<span class="lead">${icon("code", 22)}</span>
			<span class="grow"><b>${t("footer.source")}</b>${pr}</span>
			<span class="trail">${icon("chevron", 20)}</span>
		</a>`;
	}

	override render() {
		// The changelog and commit only mean something for a page deployed from a known commit.
		const deployed =
			this.environment === "production" || this.environment === "preview";
		return html`
			<footer class="group">
				<div class="item" data-row="env">
					<span class="lead">${icon("cloud", 22)}</span>
					<span class="grow"><b>${t("footer.env")}</b></span>
					<small class="trail"><code>${this.environment}</code></small>
				</div>
				${this.environment === "development" || this.built === undefined ? nothing : this.renderBuilt(this.built)}
				${
					deployed && this.sha !== undefined
						? html`<a class="item" data-link="commit" href=${commitUrl(this.sha)} target="_blank" rel="noopener">
								<span class="lead">${icon("tag", 22)}</span>
								<span class="grow"><code>${shortSha(this.sha)}</code></span>
								<span class="trail">${icon("chevron", 20)}</span>
							</a>`
						: nothing
				}
				${this.renderSource()}
				${
					deployed
						? html`<a class="item" data-link="changelog" href=${CHANGELOG_URL} target="_blank" rel="noopener">
								<span class="lead">${icon("list", 22)}</span>
								<span class="grow"><b>${t("footer.changelog")}</b></span>
								<span class="trail">${icon("chevron", 20)}</span>
							</a>`
						: nothing
				}
			</footer>
		`;
	}
}
