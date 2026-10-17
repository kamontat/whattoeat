import { expect, test } from "bun:test";
import {
	EMPTY_FORM,
	formFromRestaurant,
	withKind,
	withValues,
} from "#components/restaurant/form";
import type { Restaurant } from "#lib/restaurant";

const item: Restaurant = {
	id: "r1",
	name: "Ramen",
	location: "Soi 1",
	notes: "late",
	kinds: ["food"],
	tags: ["spicy"],
	groups: { cuisine: ["Japanese"] },
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

test("formFromRestaurant copies the fields and does not share the groups object", () => {
	const form = formFromRestaurant(item);
	expect(form).toEqual({
		name: "Ramen",
		location: "Soi 1",
		notes: "late",
		kinds: ["food"],
		tags: ["spicy"],
		groups: { cuisine: ["Japanese"] },
	});
	expect(form.groups).not.toBe(item.groups);
});

test("withKind keeps kinds in their fixed order and unticks", () => {
	const ticked = withKind({ ...EMPTY_FORM, kinds: ["dessert"] }, "food", true);
	expect(ticked.kinds).toEqual(["food", "dessert"]);
	expect(withKind(ticked, "dessert", false).kinds).toEqual(["food"]);
});

test("withValues sets tags or one group's values", () => {
	expect(withValues(EMPTY_FORM, "tags", ["a"]).tags).toEqual(["a"]);
	const form = withValues(EMPTY_FORM, "area", ["Ari"]);
	expect(form.groups).toEqual({ area: ["Ari"] });
	expect(form.tags).toEqual([]);
});
