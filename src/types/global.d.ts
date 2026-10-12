import type { HelloWorld } from "#components/hello-world";

declare global {
	interface HTMLElementTagNameMap {
		"hello-world": HelloWorld;
	}
}

declare module "bun" {
	interface Env {
		/** Google Tag Manager container id, inlined by `bun-server build`; see `#lib/gtm`. */
		BUN_PUBLIC_GTM_ID?: string;
	}
}
