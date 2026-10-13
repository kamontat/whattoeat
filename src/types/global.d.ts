import type { AppFooter } from "#components/app-footer";
import type { AppHeader } from "#components/app-header";
import type { DataTransferPanel } from "#components/data-transfer";
import type { RandomPicker } from "#components/random-picker";
import type { RestaurantManager } from "#components/restaurant-manager";

declare global {
	interface HTMLElementTagNameMap {
		"app-footer": AppFooter;
		"app-header": AppHeader;
		"data-transfer": DataTransferPanel;
		"random-picker": RandomPicker;
		"restaurant-manager": RestaurantManager;
	}
}

declare module "bun" {
	interface Env {
		/** Google Tag Manager container id, inlined by `bun-server build`; see `#lib/gtm`. */
		BUN_PUBLIC_GTM_ID?: string;
		/** Full commit sha the build came from, inlined by `bun-server build`; see `#lib/build-info`. */
		BUN_PUBLIC_COMMIT_SHA?: string;
		/** ISO 8601 time of the build, inlined by `bun-server build`; see `#lib/build-info`. */
		BUN_PUBLIC_BUILD_DATE?: string;
	}
}
