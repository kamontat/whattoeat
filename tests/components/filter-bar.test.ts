import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/filter-bar";
import type { FilterBar } from "#components/filter-bar";
import type { Filter } from "#lib/filter";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};
const setWidth = (width: number) => {
	(window as unknown as HappyWindow).happyDOM.setViewport({
		width,
		height: 900,
	});
	window.dispatchEvent(new Event("resize"));
};

beforeEach(() => {
	setLang("en");
	setWidth(390);
});

afterEach(() => {
	document.body.innerHTML = "";
	setWidth(1024);
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
		groups: { g1: ["cheap"], area: ["ari"] },
	}),
	make("B", { tags: ["spicy"], groups: { area: ["siam"] } }),
	make("C", { kinds: ["drinks"], groups: { area: ["siam"] } }),
];

/** A group with 20 values: "dish 01" is used by every restaurant, the rest by one each. */
const dishes = Array.from(
	{ length: 20 },
	(_, i) => `dish ${String(i + 1).padStart(2, "0")}`,
);
const bigList = dishes.map((dish, i) =>
	make(`R${i}`, { groups: { g2: i === 0 ? [dish] : ["dish 01", dish] } }),
);

const mount = async (
	filter: Filter = {},
	options: { tags?: boolean; restaurants?: Restaurant[] } = {},
) => {
	const el = document.createElement("filter-bar");
	el.restaurants = options.restaurants ?? list;
	el.defs = [
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Dish" },
	];
	el.filter = filter;
	el.tags = options.tags ?? false;
	el.addEventListener("filter-change", (event) => {
		el.filter = (event as CustomEvent<Filter>).detail;
	});
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: FilterBar, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);
const $$ = (el: FilterBar, selector: string) => [
	...el.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];
const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();
const click = async (el: FilterBar, selector: string) => {
	$<HTMLElement>(el, selector)!.click();
	await el.updateComplete;
};
const openGroup = (el: FilterBar, group: string) =>
	click(el, `button.pill[data-group="${group}"]`);
const rowNames = (el: FilterBar) =>
	$$(el, ".row .label").map((label) => label.textContent);

test("one pill per group in use, in group order; plain tags only when asked", async () => {
	const el = await mount();
	expect($$(el, "button.pill").map((pill) => pill.dataset["group"])).toEqual([
		"kind",
		"area",
		"g1",
	]);
	const withTags = await mount({}, { tags: true });
	expect(
		$$(withTags, "button.pill").map((pill) => pill.dataset["group"]),
	).toEqual(["kind", "area", "g1", "tags"]);
	expect(text($(withTags, 'button.pill[data-group="tags"]'))).toBe("Tags");
});

test("a pill counts its active values; a skip-only group is marked as skip", async () => {
	const el = await mount({
		area: { include: ["ari"], exclude: ["siam"] },
		kind: { include: [], exclude: ["food"] },
	});
	expect(text($(el, 'button.pill[data-group="area"] .badge'))).toBe("2");
	expect(text($(el, 'button.pill[data-group="area"] .visually-hidden'))).toBe(
		"2 selected",
	);
	expect(
		$(el, 'button.pill[data-group="area"]')!.classList.contains("on"),
	).toBe(true);
	expect($(el, 'button.pill[data-group="kind"] .badge.skip')).not.toBeNull();
	expect($(el, 'button.pill[data-group="area"] .badge.skip')).toBeNull();
	expect($(el, 'button.pill[data-group="g1"] .badge')).toBeNull();
});

test("Clear all shows only with an active filter and reports the empty filter", async () => {
	expect($(await mount(), '[data-action="clear-filter"]')).toBeNull();
	const el = await mount({ area: { include: ["ari"], exclude: [] } });
	let reported: Filter | undefined;
	el.addEventListener("filter-change", (event) => {
		reported = (event as CustomEvent<Filter>).detail;
	});
	await click(el, '[data-action="clear-filter"]');
	expect(reported).toEqual({});
});

test("phone: a pill opens the sheet on its group, and tabs switch groups", async () => {
	const el = await mount();
	const sheet = $<HTMLElement & { open: boolean }>(el, "app-sheet")!;
	expect(sheet.open).toBe(false);
	await openGroup(el, "area");
	expect(sheet.open).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Filter");
	expect(
		$$(el, '[role="tab"]').map((tab) => [
			tab.dataset["group"],
			tab.getAttribute("aria-selected"),
		]),
	).toEqual([
		["kind", "false"],
		["area", "true"],
		["g1", "false"],
	]);
	expect(rowNames(el)).toEqual(["siam", "ari"]);
	await click(el, '[role="tab"][data-group="kind"]');
	expect(rowNames(el)).toEqual(["Food", "Drinks"]);
});

test("each row shows its restaurant count and Want and Skip buttons", async () => {
	const el = await mount();
	await openGroup(el, "area");
	const row = $$(el, ".row")[0]!;
	expect(text(row.querySelector(".count"))).toBe("2");
	const want = row.querySelector('button[data-action="want"]')!;
	const skip = row.querySelector('button[data-action="skip"]')!;
	expect(text(want)).toBe("✓ Want");
	expect(want.getAttribute("aria-label")).toBe("Want siam");
	expect(skip.getAttribute("aria-label")).toBe("Skip siam");
	expect(want.getAttribute("aria-pressed")).toBe("false");
	expect(skip.getAttribute("aria-pressed")).toBe("false");
});

test("Want includes, Skip excludes, and pressing the lit button again clears", async () => {
	const el = await mount();
	const reports: Filter[] = [];
	el.addEventListener("filter-change", (event) => {
		reports.push((event as CustomEvent<Filter>).detail);
	});
	await openGroup(el, "area");
	const want = '.row button[data-action="want"][data-value="ari"]';
	const skip = '.row button[data-action="skip"][data-value="ari"]';
	await click(el, want);
	expect($(el, want)!.getAttribute("aria-pressed")).toBe("true");
	await click(el, skip);
	expect($(el, want)!.getAttribute("aria-pressed")).toBe("false");
	expect($(el, skip)!.getAttribute("aria-pressed")).toBe("true");
	await click(el, skip);
	expect(reports).toEqual([
		{ area: { include: ["ari"], exclude: [] } },
		{ area: { include: [], exclude: ["ari"] } },
		{},
	]);
});

test("the sheet clears one group and its footer shows the match count, then closes", async () => {
	const el = await mount({
		area: { include: ["siam"], exclude: [] },
		kind: { include: ["food"], exclude: [] },
	});
	await openGroup(el, "area");
	expect(text($(el, '[data-action="filter-done"]'))).toBe("Show 0 restaurants");
	await click(el, '[data-action="clear-group"]');
	expect(el.filter).toEqual({ kind: { include: ["food"], exclude: [] } });
	expect(text($(el, '[data-action="filter-done"]'))).toBe("Show 1 restaurant");
	await click(el, '[data-action="filter-done"]');
	expect($<HTMLElement & { open: boolean }>(el, "app-sheet")!.open).toBe(false);
});

test("wide: a pill opens a popover under it instead of a sheet", async () => {
	setWidth(1024);
	const el = await mount();
	expect($(el, "app-sheet")).toBeNull();
	await openGroup(el, "area");
	const pill = $(el, 'button.pill[data-group="area"]')!;
	expect(pill.getAttribute("aria-expanded")).toBe("true");
	const popover = $(el, ".popover");
	expect(popover?.parentElement?.querySelector(".pill")).toBe(pill);
	expect(popover?.getAttribute("role")).toBe("dialog");
	expect(popover?.getAttribute("aria-label")).toBe("Area");
	expect(rowNames(el)).toEqual(["siam", "ari"]);
	await openGroup(el, "area");
	expect($(el, ".popover")).toBeNull();
});

test("wide: Done and Escape close the popover and return focus to its pill", async () => {
	setWidth(1024);
	const el = await mount();
	await openGroup(el, "area");
	await click(el, '.popover [data-action="filter-done"]');
	expect($(el, ".popover")).toBeNull();
	expect(el.shadowRoot!.activeElement?.getAttribute("data-group")).toBe("area");
	await openGroup(el, "kind");
	$(el, ".popover")!.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
			composed: true,
		}),
	);
	await el.updateComplete;
	expect($(el, ".popover")).toBeNull();
	expect(el.shadowRoot!.activeElement?.getAttribute("data-group")).toBe("kind");
});

test("wide: pressing outside the popover closes it", async () => {
	setWidth(1024);
	const el = await mount();
	await openGroup(el, "area");
	$(el, ".popover")!.dispatchEvent(
		new Event("pointerdown", { bubbles: true, composed: true }),
	);
	await el.updateComplete;
	expect($(el, ".popover")).not.toBeNull();
	document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
	await el.updateComplete;
	expect($(el, ".popover")).toBeNull();
});

test("a small group lists every value, with no search box", async () => {
	const el = await mount();
	await openGroup(el, "area");
	expect($(el, "input.find")).toBeNull();
	expect($(el, ".section-title")).toBeNull();
});

test("a big group shows a search box, the 8 most used, and Show all for the rest A to Z", async () => {
	const el = await mount({}, { restaurants: bigList });
	await openGroup(el, "g2");
	const find = $<HTMLInputElement>(el, "input.find")!;
	expect(find.getAttribute("aria-label")).toBe("Find in Dish");
	expect($$(el, ".section-title").map(text)).toEqual(["Most used"]);
	expect(rowNames(el)).toEqual(dishes.slice(0, 8));
	expect(text($(el, '[data-action="show-all"]'))).toBe("Show all 20");
	await click(el, '[data-action="show-all"]');
	expect($$(el, ".section-title").map(text)).toEqual(["Most used", "All, A–Z"]);
	expect(rowNames(el)).toEqual(dishes);
	expect($(el, '[data-action="show-all"]')).toBeNull();
});

test("typing in a big group's search box lists only the matches", async () => {
	const el = await mount({}, { restaurants: bigList });
	await openGroup(el, "g2");
	const find = $<HTMLInputElement>(el, "input.find")!;
	find.value = "1";
	find.dispatchEvent(new Event("input"));
	await el.updateComplete;
	expect($$(el, ".section-title").map(text)).toEqual(["11 matches"]);
	expect(rowNames(el)).toEqual([
		"dish 01",
		"dish 10",
		"dish 11",
		"dish 12",
		"dish 13",
		"dish 14",
		"dish 15",
		"dish 16",
		"dish 17",
		"dish 18",
		"dish 19",
	]);
	find.value = "ramen";
	find.dispatchEvent(new Event("input"));
	await el.updateComplete;
	expect(rowNames(el)).toEqual([]);
	expect(text($(el, ".no-value"))).toBe("Nothing matches “ramen”.");
});

test("a big group pins the values chosen before it opened, and a new choice stays in place", async () => {
	const el = await mount(
		{ g2: { include: ["dish 15"], exclude: ["dish 20"] } },
		{ restaurants: bigList },
	);
	await openGroup(el, "g2");
	expect($$(el, ".section-title").map(text)).toEqual(["Selected", "Most used"]);
	expect(rowNames(el).slice(0, 2)).toEqual(["dish 15", "dish 20"]);
	await click(el, '.row button[data-action="want"][data-value="dish 02"]');
	expect(rowNames(el).slice(0, 3)).toEqual(["dish 15", "dish 20", "dish 01"]);
});

test("labels render in Thai", async () => {
	setLang("th");
	const el = await mount({ area: { include: ["ari"], exclude: [] } });
	expect(text($(el, '[data-action="clear-filter"]'))).toBe("ล้างทั้งหมด");
	await openGroup(el, "area");
	expect(text($(el, '.row button[data-action="want"]'))).toBe("✓ เอา");
	expect(text($(el, '.row button[data-action="skip"]'))).toBe("✕ ไม่เอา");
});
