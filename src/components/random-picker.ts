import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { LangController, t } from "#lib/i18n";
import { pickRandom } from "#lib/random";
import { isLink, type Restaurant } from "#lib/restaurant";
import { loadRestaurants, onRestaurantsChanged } from "#lib/store";
import { uiStyles } from "#styles/ui";

@customElement("random-picker")
export class RandomPicker extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: grid;
				gap: 1.5rem;
				justify-items: center;
				padding-top: 2rem;
				text-align: center;
			}

			.pick {
				padding: 1.25rem 2rem;
				font-size: 1.5rem;
				font-weight: 700;
				border-radius: 999px;
			}

			[aria-live] {
				width: 100%;
			}

			.result,
			.empty {
				width: 100%;
				box-sizing: border-box;
				justify-items: center;
			}

			.result h2 {
				font-size: 1.75rem;
			}

			.result .chips {
				justify-content: center;
			}

			.notes {
				white-space: pre-wrap;
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@state()
	private restaurants: Restaurant[] = [];

	@state()
	private picked: Restaurant | undefined;

	private unsubscribe: (() => void) | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			const pickedId = this.picked?.id;
			this.picked = this.restaurants.find((item) => item.id === pickedId);
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	private readonly pick = (): void => {
		this.picked = pickRandom(this.restaurants, this.picked?.id);
	};

	override render() {
		const heading = html`<h1 class="visually-hidden">${t("app.title")}</h1>`;
		if (this.restaurants.length === 0) {
			return html`
				${heading}
				<div class="card empty">
					<p>${t("picker.empty")}</p>
					<a href="./restaurants">${t("picker.addLink")}</a>
				</div>
			`;
		}
		return html`
			${heading}
			<button type="button" class="primary pick" @click=${this.pick}>
				${this.picked ? t("picker.again") : t("picker.button")}
			</button>
			<div aria-live="polite">${this.picked ? this.renderResult(this.picked) : nothing}</div>
		`;
	}

	private renderResult(item: Restaurant) {
		return html`
			<article class="card result">
				<h2>${item.name}</h2>
				${
					item.tags.length > 0
						? html`<ul class="chips">${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}</ul>`
						: nothing
				}
				${
					item.location
						? html`<p class="location">
								${
									isLink(item.location)
										? html`<a href=${item.location} target="_blank" rel="noopener noreferrer">${item.location}</a>`
										: item.location
								}
							</p>`
						: nothing
				}
				${item.notes ? html`<p class="notes">${item.notes}</p>` : nothing}
			</article>
		`;
	}
}
