import { html, nothing, type TemplateResult } from "lit";
import { customChips, type GroupDef } from "#lib/groups";
import type { Restaurant } from "#lib/restaurant";

/**
 * A restaurant's chips: custom group values first (labelled "Name: value", class `group-chip`),
 * then plain tags. Renders nothing when there are none. Shared by the restaurant form's row and
 * the picker's result card, which both show the same chip list.
 */
export const restaurantChips = (
	item: Restaurant,
	defs: readonly GroupDef[],
): TemplateResult | typeof nothing => {
	const chips = customChips(item, defs);
	return chips.length + item.tags.length > 0
		? html`<ul class="chips">
				${chips.map((chip) => html`<li class="chip group-chip">${chip}</li>`)}
				${item.tags.map((tag) => html`<li class="chip">${tag}</li>`)}
			</ul>`
		: nothing;
};
