import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/restaurant/list";
import { RestaurantList } from "#components/restaurant/list";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
});

const make = (id: string, name: string, extra = {}): Restaurant => ({
	id,
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

const mount = async (
	restaurants: Restaurant[],
	props: Partial<Pick<RestaurantList, "query" | "currentId">> = {},
) => {
	const el = document.createElement("restaurant-list");
	el.restaurants = restaurants;
	Object.assign(el, props);
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: RestaurantList, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const names = (el: RestaurantList) =>
	[...el.shadowRoot!.querySelectorAll("li[data-id] .name")].map(
		(node) => node.textContent,
	);

/** Collect every `type` event the element dispatches. */
const listen = <T>(el: RestaurantList, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

test("rows are sorted by name in the current language", async () => {
	const el = await mount([
		make("1", "pho"),
		make("2", "Bun"),
		make("3", "curry"),
	]);
	expect(names(el)).toEqual(["Bun", "curry", "pho"]);
});

test("with no restaurants it shows the empty card, whose Add asks to add one", async () => {
	const el = await mount([]);
	expect($(el, ".empty p")?.textContent?.trim()).toBe(
		"No restaurants yet. Add your first one.",
	);
	const adds = listen<{ name?: string }>(el, "restaurant-add");
	$<HTMLButtonElement>(el, '.empty [data-action="add"]')!.click();
	expect(adds).toEqual([{}]);
});

test("a query keeps only matching rows and marks what matched", async () => {
	const el = await mount([make("1", "Ramen Bar"), make("2", "Pho")], {
		query: "ram",
	});
	expect(names(el)).toEqual(["Ramen Bar"]);
	expect($(el, ".name mark")?.textContent).toBe("Ram");
});

test("a query no name has shows the no-match card with Add and Clear", async () => {
	const el = await mount([make("1", "Pho")], { query: " sushi " });
	expect($(el, ".no-match p")?.textContent?.trim()).toBe(
		'No restaurants match "sushi".',
	);
	const adds = listen<{ name?: string }>(el, "restaurant-add");
	const clears = listen<unknown>(el, "search-clear");
	$<HTMLButtonElement>(el, '[data-action="add-named"]')!.click();
	$<HTMLButtonElement>(el, '[data-action="clear-search-empty"]')!.click();
	expect(adds).toEqual([{ name: "sushi" }]);
	expect(clears).toHaveLength(1);
});

test("a row click asks to edit that restaurant; the current one is marked", async () => {
	const pho = make("1", "Pho", { link: "Ari" });
	const el = await mount([pho, make("2", "Bun")], { currentId: "1" });
	const row = $<HTMLButtonElement>(el, 'li[data-id="1"] button')!;
	expect(row.getAttribute("aria-current")).toBe("true");
	expect(row.getAttribute("aria-label")).toBe("Edit Pho");
	expect($(el, 'li[data-id="2"] button')!.hasAttribute("aria-current")).toBe(
		false,
	);
	const edits = listen<Restaurant>(el, "restaurant-edit");
	row.click();
	expect(edits).toEqual([pho]);
});

test("a row with an http(s) link gets an open-link beside its edit button; other rows don't", async () => {
	const el = await mount([
		make("1", "Pho", { link: "https://maps.example/pho" }),
		make("2", "Bun", { link: "javascript:alert(1)" }),
		make("3", "Cha"),
	]);
	const link = $<HTMLAnchorElement>(el, 'li[data-id="1"] > a.open-link');
	expect(link?.getAttribute("href")).toBe("https://maps.example/pho");
	expect(link?.getAttribute("target")).toBe("_blank");
	expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
	expect(link?.getAttribute("aria-label")).toBe("Open Pho's link");
	expect($(el, 'li[data-id="1"] button a')).toBeNull();
	expect($(el, 'li[data-id="2"] a')).toBeNull();
	expect($(el, 'li[data-id="3"] a')).toBeNull();
});

test("focusRow focuses a shown row and says whether it could", async () => {
	const el = await mount([make("1", "Pho"), make("2", "Bun")], {
		query: "pho",
	});
	expect(el.focusRow("2")).toBe(false);
	expect(el.focusRow("1")).toBe(true);
	expect(el.shadowRoot!.activeElement).toBe($(el, 'li[data-id="1"] button'));
});

test("re-renders in the new language", async () => {
	const el = await mount([]);
	setLang("th");
	await el.updateComplete;
	expect($(el, ".empty p")?.textContent?.trim()).not.toBe(
		"No restaurants yet. Add your first one.",
	);
});

const css = (): string =>
	(RestaurantList.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("the selected row shows an outline in forced-colours", () => {
	const forced = css().indexOf("@media (forced-colors: active)");
	expect(forced).toBeGreaterThan(-1);
	const forcedBlock = css().slice(forced);
	expect(forcedBlock).toMatch(
		/\.list \.row\[aria-current="true"\]\s*\{[^}]*outline:\s*2px solid CanvasText/,
	);
	expect(forcedBlock).toMatch(
		/\.list \.row\[aria-current="true"\]\s*\{[^}]*outline-offset:\s*-2px/,
	);
});

test("a matched part of a name is highlighted, and a row clears the stuck search bar", () => {
	expect(css()).toMatch(
		/\.name mark\s*\{[^}]*background:\s*var\(--color-primary-soft\)/,
	);
	expect(css()).toMatch(/li\[data-id\]\s*\{[^}]*scroll-margin-top:/);
});
