import type { AppHeader } from "#components/app-header";
import type { RandomPicker } from "#components/random-picker";

declare global {
	interface HTMLElementTagNameMap {
		"app-header": AppHeader;
		"random-picker": RandomPicker;
	}
}

declare module "bun" {
	interface Env {
		/** Google Tag Manager container id, inlined by `bun-server build`; see `#lib/gtm`. */
		BUN_PUBLIC_GTM_ID?: string;
	}
}
