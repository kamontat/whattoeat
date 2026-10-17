import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/restaurant/search";
import { RestaurantSearch } from "#components/restaurant/search";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

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
	setWidth(1024);
});

afterEach(() => {
	document.body.innerHTML = "";
	setWidth(1024);
});

const make = (name: string): Restaurant => ({
	id: name,
	name,
	location: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
});

const SEED = ["Bankara Ramen", "Café Tartine", "Jay Fai", "Ramen Champion"].map(
	make,
);

type Change = { searching: boolean; query: string };

const mount = async (restaurants: Restaurant[] = SEED) => {
	const el = document.createElement("restaurant-search");
	el.restaurants = restaurants;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: RestaurantSearch, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const field = (el: RestaurantSearch) => $<HTMLInputElement>(el, "#search")!;

const listen = <T>(el: RestaurantSearch, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

const typeSearch = async (el: RestaurantSearch, text: string) => {
	field(el).value = text;
	field(el).dispatchEvent(
		new Event("input", { bubbles: true, composed: true }),
	);
	await el.updateComplete;
};

const key = (target: EventTarget, name: string) => {
	const event = new KeyboardEvent("keydown", {
		key: name,
		bubbles: true,
		composed: true,
		cancelable: true,
	});
	target.dispatchEvent(event);
	return event;
};

const pause = () => new Promise((resolve) => setTimeout(resolve, 550));

test("closed, the row is hidden; open() shows it and focuses the field inside the tap", async () => {
	const el = await mount();
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	const changes = listen<Change>(el, "search-change");
	el.open();
	// No await: iOS only opens the keyboard for a focus made during the tap.
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
	await el.updateComplete;
	expect(el.searching).toBe(true);
	expect(changes).toEqual([{ searching: true, query: "" }]);
	const input = field(el);
	expect(input.type).toBe("search");
	expect(input.getAttribute("aria-label")).toBe("Search restaurants");
	expect(input.placeholder).toBe("Search by name");
	expect(input.getAttribute("autocomplete")).toBe("off");
	expect(input.getAttribute("autocapitalize")).toBe("off");
	expect(input.getAttribute("spellcheck")).toBe("false");
	expect(input.getAttribute("enterkeyhint")).toBe("search");
});

test("typing reports the query and updates the count line at once", async () => {
	const el = await mount();
	el.open();
	await el.updateComplete;
	expect($(el, ".search-count")?.textContent?.trim()).toBe("4 restaurants");
	const changes = listen<Change>(el, "search-change");
	await typeSearch(el, "ram");
	expect(changes).toEqual([{ searching: true, query: "ram" }]);
	expect($(el, ".search-count")?.textContent?.trim()).toBe(
		"2 of 4 restaurants",
	);
});

test("screen readers hear the count, or the no-match message, once typing pauses", async () => {
	const el = await mount();
	el.open();
	await typeSearch(el, "ram");
	const live = $(el, '.search-announce[role="status"]')!;
	expect(live.textContent?.trim()).toBe("");
	await pause();
	await el.updateComplete;
	expect(live.textContent?.trim()).toBe("2 of 4 restaurants");
	await typeSearch(el, "zaab");
	expect($(el, ".search-count")).toBeNull();
	await pause();
	await el.updateComplete;
	expect(live.textContent?.trim()).toBe('No restaurants match "zaab".');
});

test("clear empties the field, stays open and keeps focus in the field", async () => {
	const el = await mount();
	el.open();
	await el.updateComplete;
	expect($(el, '[data-action="clear-search"]')).toBeNull();
	await typeSearch(el, "ram");
	const changes = listen<Change>(el, "search-change");
	$<HTMLButtonElement>(el, '[data-action="clear-search"]')!.click();
	await el.updateComplete;
	expect(field(el).value).toBe("");
	expect(changes).toEqual([{ searching: true, query: "" }]);
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("a pointerdown on clear does not blur the field first, so the keyboard stays up", async () => {
	const el = await mount();
	el.open();
	await typeSearch(el, "ram");
	const event = new PointerEvent("pointerdown", {
		bubbles: true,
		cancelable: true,
	});
	$(el, '[data-action="clear-search"]')!.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
});

test("Cancel and Escape end search and say so", async () => {
	const el = await mount();
	for (const end of ["cancel", "escape"]) {
		el.open();
		await typeSearch(el, "ram");
		const changes = listen<Change>(el, "search-change");
		const cancels = listen<unknown>(el, "search-cancel");
		if (end === "cancel")
			$<HTMLButtonElement>(el, '[data-action="cancel-search"]')!.click();
		else key(field(el), "Escape");
		await el.updateComplete;
		expect(changes.at(-1)).toEqual({ searching: false, query: "" });
		expect(cancels).toHaveLength(1);
		expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
		expect(field(el).value).toBe("");
	}
});

test("the Search key with one match picks it; with several it puts the keyboard away", async () => {
	const el = await mount();
	el.open();
	await typeSearch(el, "champion");
	const picks = listen<Restaurant>(el, "search-pick");
	expect(key(field(el), "Enter").defaultPrevented).toBe(true);
	expect(picks.map((item) => item.name)).toEqual(["Ramen Champion"]);
	await typeSearch(el, "ram");
	field(el).focus();
	key(field(el), "Enter");
	expect(picks).toHaveLength(1);
	expect(el.shadowRoot!.activeElement?.id).not.toBe("search");
});

test("losing every restaurant mid-search ends it without a cancel", async () => {
	const el = await mount();
	el.open();
	await typeSearch(el, "ram");
	const changes = listen<Change>(el, "search-change");
	const cancels = listen<unknown>(el, "search-cancel");
	el.restaurants = [];
	await el.updateComplete;
	await el.updateComplete;
	expect(changes).toEqual([{ searching: false, query: "" }]);
	expect(cancels).toHaveLength(0);
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	expect($(el, ".search-count")).toBeNull();
	await pause();
	await el.updateComplete;
	expect($(el, ".search-announce")?.textContent?.trim()).toBe("");
});

const slash = (target: EventTarget = document.body) => key(target, "/");

test("wide: / opens search, but not while typing in a field", async () => {
	const el = await mount();
	const box = document.createElement("input");
	document.body.append(box);
	slash(box);
	await el.updateComplete;
	expect(el.searching).toBe(false);
	slash();
	await el.updateComplete;
	expect(el.searching).toBe(true);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("wide: / while already searching brings focus back to the field", async () => {
	const el = await mount();
	el.open();
	await el.updateComplete;
	const button = document.createElement("button");
	document.body.append(button);
	button.focus();
	const event = slash(button);
	expect(event.defaultPrevented).toBe(true);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("/ does nothing on a phone, with nothing to search, or while a sheet is open", async () => {
	setWidth(390);
	const el = await mount();
	slash();
	await el.updateComplete;
	expect(el.searching).toBe(false);
	setWidth(1024);
	el.restaurants = [];
	await el.updateComplete;
	slash();
	await el.updateComplete;
	expect(el.searching).toBe(false);
	el.restaurants = SEED;
	document.documentElement.classList.add("sheet-open");
	try {
		slash();
		await el.updateComplete;
		expect(el.searching).toBe(false);
	} finally {
		document.documentElement.classList.remove("sheet-open");
	}
});

test("stops listening for / once removed", async () => {
	const el = await mount();
	el.remove();
	slash();
	await el.updateComplete;
	expect(el.searching).toBe(false);
});

test("is translated to Thai", async () => {
	const el = await mount();
	setLang("th");
	el.open();
	await typeSearch(el, "ram");
	expect(field(el).placeholder).toBe("ค้นหาด้วยชื่อ");
	expect($(el, '[data-action="cancel-search"]')?.textContent?.trim()).toBe(
		"ยกเลิก",
	);
	expect($(el, ".search-count")?.textContent?.trim()).toBe("2 จาก 4 ร้าน");
});

const css = (): string =>
	(RestaurantSearch.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("its row and count lay out as items of the parent's grid", () => {
	expect(css()).toMatch(/:host\s*\{[^}]*display:\s*contents/);
	expect(css()).toMatch(/\.search-row\[hidden\]/);
});

test("field, clear and cancel are tap sized; the input text is 16px", () => {
	expect(css()).toMatch(/\.search-field\s*\{[^}]*min-height:\s*var\(--tap\)/);
	// The input gets its 16px text from the shared ui rule, not iOS's 13px default
	// zoom-trigger size, and this component's own rule must not override it back down.
	expect((uiStyles as unknown as { cssText: string }).cssText).toMatch(
		/input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*1rem/,
	);
	expect(css()).not.toMatch(/\.search-field input\s*\{[^}]*font-size/);
});

test("the field drops iOS's default search styling", () => {
	expect(css()).toMatch(
		/\.search-field input\s*\{[^}]*appearance:\s*none[^}]*-webkit-appearance:\s*none/,
	);
	expect(css()).toMatch(
		/\.search-field input::-webkit-search-decoration\s*\{[^}]*display:\s*none/,
	);
});
