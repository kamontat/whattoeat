import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/restaurant/filter";
import type { AppSheet } from "#components/app-sheet";
import type { RestaurantFilter } from "#components/restaurant/filter";
import type { Filter } from "#lib/filter";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
});

const make = (name: string, extra: Partial<Restaurant> = {}): Restaurant => ({
	id: name,
	name,
	link: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	...extra,
});

const list = [
	make("A", {
		kinds: ["food"],
		tags: ["spicy", "late"],
		groups: { g1: ["cheap"] },
	}),
	make("B", { tags: ["spicy"], groups: { area: ["siam"] } }),
];

const mount = async (filter: Filter = {}) => {
	const el = document.createElement("restaurant-filter");
	el.restaurants = list;
	el.defs = [{ id: "g1", name: "Price" }];
	el.filter = filter;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: RestaurantFilter, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);
const $$ = (el: RestaurantFilter, selector: string) => [
	...el.shadowRoot!.querySelectorAll(selector),
];

test("shows each group that has values, then plain tags, most used first", async () => {
	const el = await mount();
	expect($$(el, ".filter-group h3").map((h) => h.textContent)).toEqual([
		"Type",
		"Area",
		"Price",
		"Tags",
	]);
	expect(
		$$(el, '.chip[data-group="tags"]').map((chip) => chip.textContent?.trim()),
	).toEqual(["spicy", "late"]);
});

test("tapping a chip reports the next filter state", async () => {
	const el = await mount({ tags: { include: ["spicy"], exclude: [] } });
	let reported: Filter | undefined;
	el.addEventListener("filter-change", (event) => {
		reported = (event as CustomEvent<Filter>).detail;
	});
	$<HTMLButtonElement>(
		el,
		'.chip[data-group="tags"][data-tag="spicy"]',
	)!.click();
	expect(reported).toEqual({ tags: { include: [], exclude: ["spicy"] } });
});

test("chips show their state", async () => {
	const el = await mount({ tags: { include: ["spicy"], exclude: ["late"] } });
	const spicy = $(el, '.chip[data-tag="spicy"]')!;
	expect(spicy.getAttribute("data-state")).toBe("include");
	expect(spicy.getAttribute("aria-pressed")).toBe("true");
	expect(spicy.textContent?.trim()).toBe("✓ spicy");
	expect($(el, '.chip[data-tag="late"]')!.textContent?.trim()).toBe("✕ late");
});

test("active values show outside the sheet, and Clear reports the empty filter", async () => {
	const el = await mount({
		tags: { include: ["spicy"], exclude: [] },
		kind: { include: [], exclude: ["food"] },
	});
	expect(
		$$(el, ".summary-chip").map((chip) => chip.getAttribute("data-state")),
	).toEqual(["exclude", "include"]);
	let reported: Filter | undefined;
	el.addEventListener("filter-change", (event) => {
		reported = (event as CustomEvent<Filter>).detail;
	});
	$<HTMLButtonElement>(el, '[data-action="clear-filter"]')!.click();
	expect(reported).toEqual({});
});

test("no active values, no summary row", async () => {
	const el = await mount();
	expect($(el, ".summary")).toBeNull();
});

test("open() opens the sheet and Done closes it", async () => {
	const el = await mount();
	const sheet = $<AppSheet>(el, "app-sheet")!;
	expect(sheet.open).toBe(false);
	el.open();
	await el.updateComplete;
	expect(sheet.open).toBe(true);
	$<HTMLButtonElement>(el, '[data-action="filter-done"]')!.click();
	await el.updateComplete;
	expect(sheet.open).toBe(false);
});
