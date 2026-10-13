import type { AppHeader } from "#components/app-header";
import type { DataTransferPanel } from "#components/data-transfer";
import type { RandomPicker } from "#components/random-picker";
import type { RestaurantManager } from "#components/restaurant-manager";
import type { TagInput } from "#components/tag-input";

declare global {
	interface HTMLElementTagNameMap {
		"app-header": AppHeader;
		"data-transfer": DataTransferPanel;
		"random-picker": RandomPicker;
		"restaurant-manager": RestaurantManager;
		"tag-input": TagInput;
	}
}

declare module "bun" {
	interface Env {
		/** Google Tag Manager container id, inlined by `bun-server build`; see `#lib/gtm`. */
		BUN_PUBLIC_GTM_ID?: string;
	}
}
