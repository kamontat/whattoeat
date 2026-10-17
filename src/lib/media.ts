import type { ReactiveController, ReactiveControllerHost } from "lit";

/** The width from which pages use their wide layout; keep in step with the CSS `48rem` breakpoint. */
export const WIDE = "(min-width: 48rem)";

/** The width from which pages use their widest layout; keep in step with the CSS `64rem` breakpoint. */
export const WIDER = "(min-width: 64rem)";

/**
 * Whether a media query matches, re-rendering the host when the answer changes. Listens to the
 * query's `change` event and to window `resize` (happy-dom only updates `matches` on resize).
 */
export class MediaController implements ReactiveController {
	private readonly host: ReactiveControllerHost;
	private list: MediaQueryList | undefined;
	private last = false;

	constructor(
		host: ReactiveControllerHost,
		readonly query: string,
	) {
		this.host = host;
		host.addController(this);
	}

	get matches(): boolean {
		return this.list?.matches ?? window.matchMedia(this.query).matches;
	}

	private readonly onChange = (): void => {
		const next = this.matches;
		if (next === this.last) return;
		this.last = next;
		this.host.requestUpdate();
	};

	hostConnected(): void {
		this.list = window.matchMedia(this.query);
		this.last = this.list.matches;
		this.list.addEventListener("change", this.onChange);
		window.addEventListener("resize", this.onChange);
	}

	hostDisconnected(): void {
		this.list?.removeEventListener("change", this.onChange);
		window.removeEventListener("resize", this.onChange);
		this.list = undefined;
	}
}
