import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { uiStyles } from "#styles/ui";

/** The focused element, looking inside open shadow roots. */
export const deepActiveElement = (): HTMLElement | null => {
	let active = document.activeElement;
	while (active?.shadowRoot?.activeElement)
		active = active.shadowRoot.activeElement;
	return active instanceof HTMLElement ? active : null;
};

/**
 * A modal sheet: slides up from the bottom on phones, centred from 48rem. Built on `<dialog>`
 * so focus moves in, the page behind is inert and Esc closes it.
 */
@customElement("app-sheet")
export class AppSheet extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: contents;
			}

			dialog {
				box-sizing: border-box;
				width: 100%;
				max-width: 100%;
				max-height: 90dvh;
				margin: auto auto 0;
				padding: 0;
				border: 0;
				border-radius: var(--radius-lg) var(--radius-lg) 0 0;
				background: var(--color-bg);
				color: var(--color-text);
				box-shadow: var(--shadow-lg);
			}

			dialog[open] {
				animation: slide-up var(--duration) ease-out;
			}

			dialog::backdrop {
				background: var(--scrim);
			}

			@keyframes slide-up {
				from {
					transform: translateY(100%);
				}
			}

			.box {
				display: flex;
				flex-direction: column;
				max-height: 90dvh;
			}

			.grabber {
				align-self: center;
				width: 2.5rem;
				height: 0.3125rem;
				margin: 0.5rem 0 0.125rem;
				border-radius: 3px;
				background: var(--color-control);
			}

			.head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.25rem 0.625rem 0.25rem 1.25rem;
			}

			h2 {
				font-size: 1.375rem;
				font-weight: 700;
			}

			.sub {
				color: var(--color-muted);
				font-size: 0.9375rem;
			}

			.close {
				width: var(--tap);
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: var(--color-surface-2);
			}

			.body {
				display: grid;
				gap: 1rem;
				padding: 0.25rem 1.25rem 1rem;
				overflow-y: auto;
			}

			.foot {
				display: flex;
				gap: 0.625rem;
				padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
				border-top: 1px solid var(--color-border);
			}

			.foot[hidden] {
				display: none;
			}

			::slotted([slot="footer"]) {
				flex: 1;
			}

			@media (min-width: 48rem) {
				dialog {
					max-width: 32rem;
					margin: auto;
					border-radius: var(--radius-lg);
				}

				.grabber {
					display: none;
				}
			}
		`,
	];

	@property()
	heading = "";

	@property()
	subheading = "";

	@property({ type: Boolean, reflect: true })
	open = false;

	@state()
	private hasFooter = false;

	@query("dialog")
	private dialog!: HTMLDialogElement;

	/** Where focus was when the sheet opened; it goes back there on close. */
	private opener: HTMLElement | null = null;

	protected readonly langController = new LangController(this);

	protected override updated(changed: PropertyValues<this>): void {
		if (!changed.has("open")) return;
		if (this.open && !this.dialog.open) {
			this.opener = deepActiveElement();
			this.dialog.showModal();
		} else if (!this.open && this.dialog.open) {
			this.dialog.close();
		}
	}

	/** The dialog closed: by the Close button, Esc, a backdrop tap or `open = false`. */
	private readonly onClose = (): void => {
		this.open = false;
		this.dispatchEvent(
			new CustomEvent("sheet-close", { bubbles: true, composed: true }),
		);
		const opener = this.opener;
		this.opener = null;
		opener?.focus();
	};

	/** A click on the dialog itself, not its content box, is a tap on the backdrop. */
	private readonly onClick = (event: MouseEvent): void => {
		if (event.target === this.dialog) this.dialog.close();
	};

	private readonly onFooterChange = (event: Event): void => {
		this.hasFooter =
			(event.target as HTMLSlotElement).assignedElements().length > 0;
	};

	override render() {
		return html`
			<dialog aria-labelledby="sheet-title" @close=${this.onClose} @click=${this.onClick}>
				<div class="box">
					<span class="grabber" aria-hidden="true"></span>
					<div class="head">
						<div>
							<h2 id="sheet-title">${this.heading}</h2>
							${this.subheading ? html`<p class="sub">${this.subheading}</p>` : nothing}
						</div>
						<button
							type="button"
							class="close"
							data-action="close-sheet"
							aria-label=${t("sheet.close")}
							@click=${() => this.dialog.close()}
						>
							${icon("x", 20)}
						</button>
					</div>
					<div class="body"><slot></slot></div>
					<div class="foot" ?hidden=${!this.hasFooter}>
						<slot name="footer" @slotchange=${this.onFooterChange}></slot>
					</div>
				</div>
			</dialog>
		`;
	}
}
