import type { AppFooter } from "#components/app-footer";
import type { AppHeader } from "#components/app-header";
import type { AppPreferences } from "#components/app-preferences";
import type { AppSheet } from "#components/app-sheet";
import type { AppToast } from "#components/app-toast";
import type { DataTransferPanel } from "#components/data-transfer";
import type { HistoryClear } from "#components/history-clear";
import type { PresetPicker } from "#components/preset-picker";
import type { RandomPicker } from "#components/random-picker";
import type { RestaurantForm } from "#components/restaurant/form";
import type { RestaurantList } from "#components/restaurant/list";
import type { RestaurantSearch } from "#components/restaurant/search";
import type { RestaurantManager } from "#components/restaurant-manager";
import type { TagInput } from "#components/tag-input";
import type { TagManager } from "#components/tag-manager";
import type { TagGroupForm } from "#components/tags/group-form";
import type { TagList } from "#components/tags/list";
import type { TagPicker } from "#components/tags/picker";
import type { TagValueForm } from "#components/tags/value-form";
import type { VisitHistory } from "#components/visit-history";

declare global {
	interface HTMLElementTagNameMap {
		"app-footer": AppFooter;
		"app-header": AppHeader;
		"app-preferences": AppPreferences;
		"app-sheet": AppSheet;
		"app-toast": AppToast;
		"data-transfer": DataTransferPanel;
		"history-clear": HistoryClear;
		"visit-history": VisitHistory;
		"preset-picker": PresetPicker;
		"random-picker": RandomPicker;
		"restaurant-form": RestaurantForm;
		"restaurant-list": RestaurantList;
		"restaurant-manager": RestaurantManager;
		"restaurant-search": RestaurantSearch;
		"tag-group-form": TagGroupForm;
		"tag-input": TagInput;
		"tag-list": TagList;
		"tag-manager": TagManager;
		"tag-picker": TagPicker;
		"tag-value-form": TagValueForm;
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
