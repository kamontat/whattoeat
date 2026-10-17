import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { uiStyles } from "#styles/ui";

const DEFAULT_DURATION = 6000;

/** Options for `AppToast.show`; `action` and its label are supplied already translated. */
export interface ToastOptions {
	action?: string;
	onAction?: () => void;
	/** Milliseconds before it hides itself. Defaults to 6000. */
	duration?: number;
}

/**
 * A small floating message with an optional action button, fixed above the pinned action
 * area. A page mounts one `<app-toast>`; callers find it and call `show(message, options)`.
 * It knows nothing about what it is announcing: the message and the action's label come from
 * the caller, already translated.
 *
 * While hidden it renders nothing, so screen readers never pick up a stale `role="status"`.
 * The auto-hide timer pauses while hovered or focused, and restarts (from the full duration)
 * once the pointer or focus leaves.
 */
@customElement("app-toast")
export class AppToast extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: contents;
			}

			.toast {
				position: fixed;
				z-index: 15;
				left: 0.625rem;
				right: 0.625rem;
				bottom: calc(var(--tab-bar-space) + var(--pinned-space));
				box-sizing: border-box;
				max-width: 28rem;
				margin: 0 auto;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.75rem 1rem;
				border-radius: var(--radius);
				background: var(--color-text);
				color: var(--color-bg);
				font-size: 0.9375rem;
			}

			button[data-action="toast-action"] {
				flex: none;
				min-height: 0;
				padding: 0;
				border: 0;
				background: none;
				color: inherit;
				font: inherit;
				font-weight: 700;
				text-decoration: underline;
			}
		`,
	];

	@state()
	private message = "";

	@state()
	private action: string | undefined;

	@state()
	private visible = false;

	private onAction: (() => void) | undefined;
	private duration = DEFAULT_DURATION;
	private paused = false;
	private timer: ReturnType<typeof setTimeout> | undefined;

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.clearTimer();
	}

	private clearTimer(): void {
		if (this.timer === undefined) return;
		clearTimeout(this.timer);
		this.timer = undefined;
	}

	private startTimer(): void {
		this.clearTimer();
		this.timer = setTimeout(() => this.hide(), this.duration);
	}

	/** Shows `message`, replacing anything currently shown and restarting the timer. */
	show(message: string, options: ToastOptions = {}): void {
		this.message = message;
		this.action = options.action;
		this.onAction = options.onAction;
		this.duration = options.duration ?? DEFAULT_DURATION;
		this.paused = false;
		this.visible = true;
		this.startTimer();
	}

	hide(): void {
		this.clearTimer();
		this.paused = false;
		this.visible = false;
	}

	private readonly pause = (): void => {
		if (!this.visible || this.paused) return;
		this.paused = true;
		this.clearTimer();
	};

	private readonly resume = (): void => {
		if (!this.visible || !this.paused) return;
		this.paused = false;
		this.startTimer();
	};

	private readonly runAction = (): void => {
		const onAction = this.onAction;
		this.hide();
		onAction?.();
	};

	override render() {
		if (!this.visible) return nothing;
		return html`
			<div
				class="toast"
				role="status"
				@mouseenter=${this.pause}
				@mouseleave=${this.resume}
				@focusin=${this.pause}
				@focusout=${this.resume}
			>
				<span>${this.message}</span>
				${
					this.action
						? html`<button
								type="button"
								data-action="toast-action"
								@click=${this.runAction}
							>${this.action}</button>`
						: nothing
				}
			</div>
		`;
	}
}
