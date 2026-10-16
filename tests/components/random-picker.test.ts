import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/random-picker";
import { RandomPicker } from "#components/random-picker";
import { FILTER_KEY } from "#lib/filter";
import { saveGroups } from "#lib/groups";
import { loadHistory, saveHistory } from "#lib/history";
import { getLang, setLang } from "#lib/i18n";
import {
	addRestaurant,
	loadRestaurants,
	removeRestaurant,
	saveRestaurants,
} from "#lib/store";

const base = { tags: [], location: "", notes: "" };

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("random-picker");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const pickButton = (el: HTMLElement) =>
	el.shadowRoot!.querySelector<HTMLButtonElement>("button.pick");
const pickedName = (el: HTMLElement) =>
	el.shadowRoot!.querySelector(".result h2")?.textContent;
const pickedNames = (el: HTMLElement) =>
	[...el.shadowRoot!.querySelectorAll(".result h2")].map(
		(h) => h.textContent ?? "",
	);
const root = (el: HTMLElement) => el.shadowRoot!;
const tagButton = (el: HTMLElement, tag: string, group = "area") =>
	root(el).querySelector<HTMLButtonElement>(
		`button.tag[data-group="${group}"][data-tag="${tag}"]`,
	);
const cycle = async (
	el: HTMLElement & { updateComplete: Promise<boolean> },
	tag: string,
	group = "area",
) => {
	tagButton(el, tag, group)!.click();
	await el.updateComplete;
};
const emptyFilter = {};
const activeLine = (el: HTMLElement) =>
	root(el)
		.querySelector(".active-filter")
		?.textContent?.replace(/\s+/g, " ")
		.trim();

test("empty list shows a link to the restaurants page and no button", async () => {
	const el = await mount();
	expect(pickButton(el)).toBeNull();
	expect(
		el
			.shadowRoot!.querySelector('a[href="./restaurants"]')
			?.textContent?.trim(),
	).toBe("Add some restaurants");
});

test("clicking the button shows a restaurant with its details", async () => {
	addRestaurant({
		name: "Jay Fai",
		tags: ["street", "crab"],
		location: "https://maps.example/jayfai",
		notes: "Queue early",
	});
	const el = await mount();
	expect(pickButton(el)?.textContent?.trim()).toBe("What should I eat?");
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).toBe("Jay Fai");
	expect(
		[...el.shadowRoot!.querySelectorAll(".result .chip")].map(
			(c) => c.textContent,
		),
	).toEqual(["street", "crab"]);
	const link = el.shadowRoot!.querySelector<HTMLAnchorElement>(".result a");
	expect(link?.getAttribute("href")).toBe("https://maps.example/jayfai");
	expect(link?.getAttribute("target")).toBe("_blank");
	expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
	expect(el.shadowRoot!.querySelector(".result .notes")?.textContent).toBe(
		"Queue early",
	);
	expect(pickButton(el)?.textContent?.trim()).toBe("Pick again");
});

test("a non-http location renders as text, not a link", async () => {
	addRestaurant({ ...base, name: "Sneaky", location: "javascript:alert(1)" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector(".result a")).toBeNull();
	expect(
		el.shadowRoot!.querySelector(".result .location")?.textContent?.trim(),
	).toBe("javascript:alert(1)");
});

test("shows two different restaurants to choose from", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	addRestaurant({ ...base, name: "C" });
	const el = await mount();
	for (let i = 0; i < 10; i++) {
		pickButton(el)!.click();
		await el.updateComplete;
		const names = pickedNames(el);
		expect(names).toHaveLength(2);
		expect(new Set(names).size).toBe(2);
	}
});

test("picking again with four restaurants shows two new ones", async () => {
	for (const name of ["A", "B", "C", "D"]) addRestaurant({ ...base, name });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const first = pickedNames(el);
	pickButton(el)!.click();
	await el.updateComplete;
	for (const name of pickedNames(el)) expect(first).not.toContain(name);
});

test("updates when restaurants are added after mount", async () => {
	const el = await mount();
	addRestaurant({ ...base, name: "New" });
	await el.updateComplete;
	expect(pickButton(el)).not.toBeNull();
});

test("drops a deleted restaurant from the result and clears it when none are left", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const list = addRestaurant({ ...base, name: "C" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const [first = "", second = ""] = pickedNames(el);
	const idOf = (name: string) => list.find((r) => r.name === name)!.id;
	removeRestaurant(idOf(first));
	await el.updateComplete;
	expect(pickedNames(el)).toEqual([second]);
	expect(pickButton(el)?.textContent?.trim()).toBe("Pick again");
	removeRestaurant(idOf(second));
	await el.updateComplete;
	expect(pickedName(el)).toBeUndefined();
	expect(pickButton(el)?.textContent?.trim()).toBe("What should I eat?");
});

test("re-renders in Thai when the language changes", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(pickButton(el)?.textContent?.trim()).toBe("กินอะไรดี?");
});

test.each([
	["empty", false],
	["with restaurants", true],
])("has a visible page heading when %s", async (_label, seed) => {
	if (seed) addRestaurant({ ...base, name: "A" });
	const el = await mount();
	const heading = el.shadowRoot!.querySelector("h1");
	expect(heading?.textContent?.trim()).toBe("What to Eat");
	expect(heading?.classList.contains("page-title")).toBe(true);
	expect(heading?.classList.contains("visually-hidden")).toBe(false);
});

test("no filter row when no restaurant has a type, cuisine or area", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	const el = await mount();
	expect(root(el).querySelector("section.filter")).toBeNull();
});

test("filter chips list values most used first and cycle off, include, exclude", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "C", groups: { area: ["spicy"] } });
	const el = await mount();
	expect(
		[...root(el).querySelectorAll("button.tag")].map((b) =>
			b.getAttribute("data-tag"),
		),
	).toEqual(["thai", "spicy"]);
	const thai = () => tagButton(el, "thai")!;
	expect(thai().getAttribute("data-state")).toBe("off");
	expect(thai().getAttribute("aria-pressed")).toBe("false");
	expect(thai().getAttribute("aria-label")).toBe("Area: thai, not used");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("include");
	expect(thai().getAttribute("aria-pressed")).toBe("true");
	expect(thai().getAttribute("aria-label")).toBe("Area: thai, included");
	expect(thai().textContent?.trim()).toBe("✓ thai");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("exclude");
	expect(thai().getAttribute("aria-label")).toBe("Area: thai, excluded");
	expect(thai().textContent?.trim()).toBe("✕ thai");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("off");
});

test("phone: the sheet's filter section relies on the sheet's own heading, not a second name", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	const section = root(el).querySelector("app-sheet section.filter")!;
	expect(section.hasAttribute("aria-label")).toBe(false);
	expect(section.hasAttribute("aria-labelledby")).toBe(false);
});

test("wide: the filter panel's section is named by its own heading", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await mount();
	const section = root(el).querySelector("aside.filter-panel section.filter")!;
	expect(section.getAttribute("aria-labelledby")).toBe("filter-title");
	expect(section.hasAttribute("aria-label")).toBe(false);
});

test("picks only from restaurants that match the filter", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	addRestaurant({ ...base, name: "B", kinds: ["drinks"] });
	addRestaurant({ ...base, name: "C", kinds: ["food", "dessert"] });
	const el = await mount();
	await cycle(el, "food", "kind");
	await cycle(el, "dessert", "kind");
	await cycle(el, "dessert", "kind");
	for (let i = 0; i < 10; i++) {
		pickButton(el)!.click();
		await el.updateComplete;
		expect(pickedName(el)).toBe("A");
	}
});

test("an active filter is shown and Clear resets it", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["spicy"] } });
	const el = await mount();
	expect(activeLine(el)).toBeUndefined();
	await cycle(el, "thai");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	expect(activeLine(el)).toBe("Filter active: Area: ✓ thai, ✕ spicy Clear");
	root(el)
		.querySelector<HTMLButtonElement>('button[data-action="clear-filter"]')!
		.click();
	await el.updateComplete;
	expect(activeLine(el)).toBeUndefined();
	expect(tagButton(el, "thai")?.getAttribute("data-state")).toBe("off");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual(
		emptyFilter,
	);
});

test("a filter that matches nothing disables the button and says so", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	addRestaurant({ ...base, name: "B", kinds: ["drinks", "dessert"] });
	const el = await mount();
	await cycle(el, "drinks", "kind");
	await cycle(el, "dessert", "kind");
	await cycle(el, "dessert", "kind");
	expect(pickButton(el)?.disabled).toBe(true);
	expect(root(el).querySelector(".no-match")?.textContent?.trim()).toBe(
		"No restaurant matches this filter.",
	);
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).toBeUndefined();
});

test("the filter is remembered across visits", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	const first = await mount();
	await cycle(first, "thai");
	first.remove();
	const second = await mount();
	expect(tagButton(second, "thai")?.getAttribute("data-state")).toBe("include");
});

test("saved filter values no longer used by any restaurant are dropped", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ area: { include: ["thai", "gone"], exclude: ["old"] } }),
	);
	const el = await mount();
	expect(activeLine(el)).toBe("Filter active: Area: ✓ thai Clear");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({
		...emptyFilter,
		area: { include: ["thai"], exclude: [] },
	});
});

test("a filter saved in another tab is picked up without dropping values not yet loaded", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ cuisine: { include: ["thia"], exclude: [] } }),
	);
	const el = await mount();
	// Another tab renames thia to thai: filter first, then restaurants.
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ cuisine: { include: ["thai"], exclude: [] } }),
	);
	window.dispatchEvent(new StorageEvent("storage", { key: FILTER_KEY }));
	await el.updateComplete;
	const [item] = loadRestaurants();
	saveRestaurants([{ ...item!, groups: { cuisine: ["thai"] } }]);
	await el.updateComplete;
	expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({
		cuisine: { include: ["thai"], exclude: [] },
	});
	expect(tagButton(el, "thai", "cuisine")?.getAttribute("data-state")).toBe(
		"include",
	);
});

test("a value renamed in another tab keeps the picked card on screen", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ cuisine: { include: ["thia"], exclude: [] } }),
	);
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedNames(el)).toEqual(["A"]);
	// Another tab renames thia to thai: the filter arrives before the restaurants.
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ cuisine: { include: ["thai"], exclude: [] } }),
	);
	window.dispatchEvent(new StorageEvent("storage", { key: FILTER_KEY }));
	await el.updateComplete;
	expect(pickedNames(el)).toEqual(["A"]);
	const [item] = loadRestaurants();
	saveRestaurants([{ ...item!, groups: { cuisine: ["thai"] } }]);
	await el.updateComplete;
	expect(pickedNames(el)).toEqual(["A"]);
});

test("the result keeps only picks that still match the filter", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["noodle"] } });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	await cycle(el, "thai");
	expect(pickedNames(el)).toEqual(["A"]);
	await cycle(el, "thai");
	expect(pickedName(el)).toBeUndefined();
});

test("filter labels render in Thai", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(root(el).querySelector(".filter-title")?.textContent?.trim()).toBe(
		"ตัวกรอง",
	);
});

const groupTitles = (el: HTMLElement) =>
	[...root(el).querySelectorAll(".filter-group h3")].map((h) =>
		h.textContent?.trim(),
	);
const groupChips = (el: HTMLElement, group: string) =>
	[...root(el).querySelectorAll(`button.tag[data-group="${group}"]`)].map((b) =>
		b.textContent?.trim(),
	);

test("the filter shows type, cuisine and area groups, only those in use, and never tags", async () => {
	addRestaurant({
		...base,
		name: "A",
		kinds: ["dessert", "food"],
		groups: { cuisine: ["Thai"], area: ["Siam"] },
	});
	addRestaurant({
		...base,
		name: "B",
		kinds: ["drinks"],
		groups: { area: ["ari"] },
	});
	addRestaurant({
		...base,
		name: "C",
		tags: ["spicy"],
		groups: { area: ["siam"] },
	});
	const el = await mount();
	expect(groupTitles(el)).toEqual(["Type", "Cuisine", "Area"]);
	expect(root(el).querySelector('button.tag[data-group="tags"]')).toBeNull();
	expect(groupChips(el, "kind")).toEqual(["Food", "Drinks", "Dessert"]);
	expect(groupChips(el, "cuisine")).toEqual(["thai"]);
	expect(groupChips(el, "area")).toEqual(["siam", "ari"]);
	expect(tagButton(el, "food", "kind")?.getAttribute("aria-label")).toBe(
		"Type: Food, not used",
	);
	await cycle(el, "food", "kind");
	expect(tagButton(el, "food", "kind")?.textContent?.trim()).toBe("✓ Food");
	expect(tagButton(el, "food", "kind")?.getAttribute("aria-label")).toBe(
		"Type: Food, included",
	);
});

test("values in one group match any, every group must match", async () => {
	addRestaurant({
		...base,
		name: "Noodle",
		kinds: ["food"],
		groups: { area: ["siam"] },
	});
	addRestaurant({
		...base,
		name: "Cafe",
		kinds: ["drinks"],
		groups: { area: ["siam"] },
	});
	addRestaurant({
		...base,
		name: "Far",
		kinds: ["food"],
		groups: { area: ["ari"] },
	});
	addRestaurant({
		...base,
		name: "Bingsu",
		kinds: ["dessert"],
		groups: { area: ["siam"] },
	});
	const el = await mount();
	await cycle(el, "siam", "area");
	await cycle(el, "food", "kind");
	await cycle(el, "dessert", "kind");
	expect(countText(el)).toBe("2 of 4 restaurants match");
	expect(activeLine(el)).toBe(
		"Filter active: Type: ✓ Food, ✓ Dessert; Area: ✓ siam Clear",
	);
	for (let i = 0; i < 5; i++) {
		pickButton(el)!.click();
		await el.updateComplete;
		expect(pickedNames(el).sort()).toEqual(["Bingsu", "Noodle"]);
	}
});

test("a picked card shows its type, cuisine and area", async () => {
	addRestaurant({
		...base,
		name: "Cafe",
		kinds: ["drinks", "dessert"],
		groups: { cuisine: ["japanese"], area: ["ari"] },
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(root(el).querySelector(".result .meta")?.textContent?.trim()).toBe(
		"Drinks, Dessert · japanese · ari",
	);
});

test("group titles and types render in Thai", async () => {
	addRestaurant({
		...base,
		name: "A",
		kinds: ["dessert"],
		groups: { cuisine: ["thai"] },
	});
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(groupTitles(el)).toEqual(["ประเภท", "สัญชาติอาหาร"]);
	expect(groupChips(el, "kind")).toEqual(["ของหวาน"]);
});

const countText = (el: HTMLElement) =>
	root(el).querySelector(".count")?.textContent?.trim();

test("shows how many restaurants there are", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	expect(countText(el)).toBe("2 restaurants");
});

test("uses the singular for one restaurant", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(countText(el)).toBe("1 restaurant");
});

test("with a filter, shows how many of all restaurants match", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["noodle"] } });
	addRestaurant({ ...base, name: "C", groups: { area: ["thai"] } });
	const el = await mount();
	await cycle(el, "thai");
	expect(countText(el)).toBe("2 of 3 restaurants match");
	await cycle(el, "thai");
	expect(countText(el)).toBe("1 of 3 restaurants match");
	await cycle(el, "thai");
	expect(countText(el)).toBe("3 restaurants");
});

test("the count follows restaurants added after mount", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	addRestaurant({ ...base, name: "B" });
	await el.updateComplete;
	expect(countText(el)).toBe("2 restaurants");
});

test("the count renders in Thai", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(countText(el)).toBe("2 ร้าน");
	await cycle(el, "thai");
	expect(countText(el)).toBe("1 จาก 2 ร้านที่ตรงกัน");
});

test("warns about stored entries that could not be read until a save drops them", async () => {
	localStorage.setItem(
		"whattoeat:restaurants",
		JSON.stringify([{ name: "broken" }, null]),
	);
	const el = await mount();
	expect(el.shadowRoot!.querySelector(".skipped")?.textContent?.trim()).toBe(
		"2 saved restaurants could not be read and were skipped. They will be removed the next time the list changes.",
	);
	addRestaurant({ name: "Fresh", tags: [], location: "", notes: "" });
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector(".skipped")).toBeNull();
});

test("uses the singular when one stored entry could not be read", async () => {
	localStorage.setItem("whattoeat:restaurants", "{not json");
	const el = await mount();
	expect(el.shadowRoot!.querySelector(".skipped")?.textContent?.trim()).toBe(
		"1 saved restaurant could not be read and was skipped. It will be removed the next time the list changes.",
	);
});

const visitButtons = (el: HTMLElement) => [
	...root(el).querySelectorAll<HTMLButtonElement>("button.visit"),
];
const pickOnce = async (
	el: HTMLElement & { updateComplete: Promise<boolean> },
) => {
	pickButton(el)!.click();
	await el.updateComplete;
};

test("each picked card has an Eat here button", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	expect(visitButtons(el)).toHaveLength(0);
	await pickOnce(el);
	expect(visitButtons(el).map((b) => b.textContent?.trim())).toEqual([
		"Eat here",
		"Eat here",
	]);
});

test("Eat here saves a visit and marks only that card", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	await pickOnce(el);
	const chosen = pickedNames(el)[1];
	visitButtons(el)[1]!.click();
	await el.updateComplete;
	const history = loadHistory();
	expect(history).toHaveLength(1);
	expect(history[0]!.name).toBe(chosen!);
	const time = new Intl.DateTimeFormat(getLang(), {
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(history[0]!.visitedAt));
	const visited = root(el).querySelectorAll(".result.visited");
	expect(visited).toHaveLength(1);
	expect(visited[0]!.querySelector("h2")?.textContent).toBe(chosen!);
	expect(visited[0]!.querySelector(".visited-label")?.textContent?.trim()).toBe(
		`✓ Going here · ${time}`,
	);
	expect(visitButtons(el)).toHaveLength(0);
	expect(pickedNames(el)).toHaveLength(2);
});

test("a double press saves one visit", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	await pickOnce(el);
	const [first, second] = visitButtons(el);
	first!.click();
	second!.click();
	await el.updateComplete;
	expect(loadHistory()).toHaveLength(1);
});

test("focus moves to the visited label", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	await pickOnce(el);
	visitButtons(el)[0]!.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement?.classList.contains("visited-label")).toBe(
		true,
	);
});

test("Pick again brings the Eat here buttons back", async () => {
	for (const name of ["A", "B", "C", "D"]) addRestaurant({ ...base, name });
	const el = await mount();
	await pickOnce(el);
	visitButtons(el)[0]!.click();
	await el.updateComplete;
	await pickOnce(el);
	expect(visitButtons(el)).toHaveLength(2);
	expect(root(el).querySelector(".visited-label")).toBeNull();
	expect(loadHistory()).toHaveLength(1);
});

test("deleting the visited restaurant clears the label but keeps the visit", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const list = addRestaurant({ ...base, name: "C" });
	const el = await mount();
	await pickOnce(el);
	const [first = ""] = pickedNames(el);
	visitButtons(el)[0]!.click();
	await el.updateComplete;
	removeRestaurant(list.find((r) => r.name === first)!.id);
	await el.updateComplete;
	expect(root(el).querySelector(".visited-label")).toBeNull();
	expect(visitButtons(el)).toHaveLength(1);
	expect(loadHistory()[0]!.name).toBe(first);
});

test("Eat here renders in Thai", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	setLang("th");
	await pickOnce(el);
	expect(visitButtons(el)[0]?.textContent?.trim()).toBe("กินร้านนี้");
});

test("warns when the browser could not save the visit", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	await pickOnce(el);
	expect(root(el).querySelector(".warning")).toBeNull();
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		visitButtons(el)[0]!.click();
		await el.updateComplete;
		expect(root(el).querySelector(".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		saveHistory([]);
	}
});

test("a picked card shows the type line before the location and keeps Eat here in its footer", async () => {
	addRestaurant({
		...base,
		name: "Cafe",
		tags: ["latte"],
		location: "Ari",
		kinds: ["drinks"],
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const card = root(el).querySelector(".result")!;
	expect([...card.children].map((child) => child.className.trim())).toEqual([
		"",
		"meta",
		"location",
		"chips",
		"foot",
	]);
	expect(card.querySelector(".foot button.visit")).not.toBeNull();
});

test("custom groups get filter rows after the built-ins, labelled with their names", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: "A",
		groups: { area: ["siam"], g1: ["cheap"] },
	});
	addRestaurant({ ...base, name: "B", groups: { g1: ["fancy"] } });
	const el = await mount();
	const titles = [...root(el).querySelectorAll(".filter-group h3")].map(
		(h) => h.textContent,
	);
	expect(titles).toEqual(["Area", "Price"]);
	await cycle(el, "cheap", "g1");
	expect(activeLine(el)).toContain("Price: ✓ cheap");
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedNames(el)).toEqual(["A"]);
});

test("a restaurant with several cuisines matches each of them", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai", "lao"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await cycle(el, "lao", "cuisine");
	expect(root(el).querySelector(".count")?.textContent).toContain("1 of 2");
});

test("a filter on a deleted group is dropped", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }),
	);
	const el = await mount();
	saveGroups([]);
	await el.updateComplete;
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	expect(root(el).querySelector(".filter-group")).toBeNull();
});

test("a picked card shows custom values as labelled chips before tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: "A",
		tags: ["spicy"],
		groups: { g1: ["cheap"] },
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const chips = [...root(el).querySelectorAll(".result .chip")].map(
		(c) => c.textContent,
	);
	expect(chips).toEqual(["Price: cheap", "spicy"]);
});

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
const phone = async () => {
	setWidth(390);
	return mount();
};

afterEach(() => setWidth(1024));

test("shows the app name as a visible title with the count under it", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(root(el).querySelector("h1.page-title")?.textContent?.trim()).toBe(
		"What to Eat",
	);
	expect(root(el).querySelector(".head .count")?.textContent?.trim()).toBe(
		"1 restaurant",
	);
});

test("wide: the filter sits in a side panel and the pick button in the heading row", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await mount();
	expect(
		root(el).querySelector("aside.filter-panel section.filter"),
	).not.toBeNull();
	expect(root(el).querySelector("app-sheet")).toBeNull();
	expect(root(el).querySelector(".head button.pick")).not.toBeNull();
	expect(root(el).querySelector(".pinned")).toBeNull();
	expect(root(el).querySelectorAll("button.pick")).toHaveLength(1);
});

test("wide: no groups in use means no panel and no empty column", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	expect(root(el).querySelector(".layout.with-panel")).toBeNull();
});

test("phone: the filter opens in a sheet from a Filter button", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	const open = root(el).querySelector<HTMLButtonElement>(
		'button.filter-open[data-action="open-filter"]',
	)!;
	expect(open.textContent?.trim()).toBe("Filter");
	expect(open.getAttribute("aria-haspopup")).toBe("dialog");
	const sheet = root(el).querySelector("app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(sheet.querySelector("section.filter")).not.toBeNull();
	open.click();
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Filter");
});

test("phone: Done closes the sheet", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	root(el)
		.querySelector<HTMLButtonElement>('[data-action="open-filter"]')!
		.click();
	await el.updateComplete;
	const done = root(el).querySelector<HTMLButtonElement>(
		'app-sheet button[slot="footer"][data-action="filter-done"]',
	)!;
	expect(done.textContent?.trim()).toBe("Done");
	done.click();
	await el.updateComplete;
	expect(root(el).querySelector("app-sheet")!.hasAttribute("open")).toBe(false);
});

test("phone: the Filter button counts active values and the summary lists them", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam", "asok"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["asok"] } });
	const el = await phone();
	await cycle(el, "siam");
	await cycle(el, "asok");
	await cycle(el, "asok");
	expect(
		root(el).querySelector('[data-action="open-filter"]')?.textContent?.trim(),
	).toBe("Filter · 2 on");
	expect(
		[...root(el).querySelectorAll("ul.summary li")].map((li) => [
			li.className,
			li.textContent?.trim(),
		]),
	).toEqual([
		// Visible text is still "✓ siam" / "✕ asok"; ", included" / ", excluded" is a
		// visually hidden addition to the chip's accessible name (minor 9).
		["include", "✓ siam, included"],
		["exclude", "✕ asok, excluded"],
	]);
	expect(root(el).querySelector("ul.summary")?.getAttribute("aria-label")).toBe(
		"Filter",
	);
});

test("phone: tapping an active summary chip opens the filter sheet", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	await cycle(el, "siam");
	const sheet = root(el).querySelector("app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);
	const chip = root(el).querySelector<HTMLButtonElement>(
		'ul.summary button[data-action="open-filter-value"]',
	)!;
	expect(chip.getAttribute("aria-haspopup")).toBe("dialog");
	chip.click();
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(true);
});

test("phone: the component fills the space above the tab bar so the pinned bar ends the column, even on a short first screen", () => {
	const css = [RandomPicker.styles]
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(
		/:host\s*\{[^}]*min-height:\s*calc\(100dvh - 1\.25rem - var\(--tab-bar-height\)\)/,
	);
	expect(css).toMatch(/\.pinned\s*\{[^}]*margin-top:\s*auto/);
});

const flattenStyles = (): string =>
	[RandomPicker.styles]
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("tiles stay one column between 48rem and 60rem; two columns from 60rem", () => {
	const css = flattenStyles();
	const mid = css.indexOf("@media (min-width: 48rem)");
	const wide = css.indexOf("@media (min-width: 60rem)");
	expect(mid).toBeGreaterThan(-1);
	expect(wide).toBeGreaterThan(mid);
	const midBlock = css.slice(mid, wide);
	expect(midBlock).not.toMatch(/\.results\s*\{[^}]*grid-template-columns/);
	expect(midBlock).toMatch(/\.results\s*\{[^}]*gap:\s*1rem/);
	const wideBlock = css.slice(wide);
	expect(wideBlock).toMatch(
		/\.results\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
	);
});

test("the pinned bar sits fully above the tab bar, with nothing peeking below it", () => {
	const pinned = flattenStyles().match(/\.pinned\s*\{[^}]*\}/)?.[0] ?? "";
	expect(pinned).toMatch(/bottom:\s*var\(--tab-bar-height\)/);
	expect(pinned).toMatch(/padding:\s*0\.75rem 0 0\.5rem/);
});

test("phone: the pick button is pinned at the end, once", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await phone();
	expect(root(el).querySelector(".pinned button.pick")).not.toBeNull();
	expect(root(el).querySelector(".head button.pick")).toBeNull();
	expect(root(el).querySelectorAll("button.pick")).toHaveLength(1);
});

test("phone: a filter that matches nothing disables the pinned button", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	addRestaurant({ ...base, name: "B", kinds: ["drinks", "dessert"] });
	const el = await phone();
	await cycle(el, "drinks", "kind");
	await cycle(el, "dessert", "kind");
	await cycle(el, "dessert", "kind");
	expect(
		root(el).querySelector<HTMLButtonElement>(".pinned button.pick")?.disabled,
	).toBe(true);
	expect(root(el).querySelector(".no-match")).not.toBeNull();
});

test("rotating past 48rem while the sheet is open does not reopen it on the way back", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	root(el)
		.querySelector<HTMLButtonElement>('[data-action="open-filter"]')!
		.click();
	await el.updateComplete;
	expect(root(el).querySelector("app-sheet")!.hasAttribute("open")).toBe(true);
	setWidth(1024);
	await el.updateComplete;
	setWidth(390);
	await el.updateComplete;
	expect(root(el).querySelector("app-sheet")?.hasAttribute("open")).toBe(false);
});

test("rotating past 48rem while focus is inside the sheet moves it to the panel title instead of losing it", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	root(el)
		.querySelector<HTMLButtonElement>('[data-action="open-filter"]')!
		.click();
	await el.updateComplete;
	tagButton(el, "siam")!.focus();
	setWidth(1024);
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement?.id).toBe("filter-title");
});

test("switching layouts keeps the filter", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["asok"] } });
	const el = await mount();
	await cycle(el, "siam");
	setWidth(390);
	await el.updateComplete;
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	expect(tagButton(el, "siam")?.getAttribute("data-state")).toBe("include");
	setWidth(1024);
	await el.updateComplete;
	expect(root(el).querySelector("aside.filter-panel")).not.toBeNull();
	expect(tagButton(el, "siam")?.getAttribute("data-state")).toBe("include");
});

test("the picks are announced by name", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	const announce = () =>
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim();
	expect(announce()).toBe("");
	await pickOnce(el);
	const [a, b] = pickedNames(el);
	expect(announce()).toBe(`Picked ${a} and ${b}`);
});

test("narrowing the filter to one pick does not invent a fresh announcement", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["noodle"] } });
	const el = await mount();
	await pickOnce(el);
	const [a, b] = pickedNames(el);
	const announce = () =>
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim();
	const before = announce();
	expect(before).toBe(`Picked ${a} and ${b}`);
	await cycle(el, "thai");
	expect(pickedNames(el)).toEqual(["A"]);
	// Trimming the result is not a new pick, so the announcement is left as it was.
	expect(announce()).toBe(before);
});

test("a pick from one restaurant is announced alone", async () => {
	addRestaurant({ ...base, name: "Solo" });
	const el = await mount();
	await pickOnce(el);
	expect(
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim(),
	).toBe("Picked Solo");
});

test("Eat here is a soft button and the result area is not a live region", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	await pickOnce(el);
	expect(
		root(el).querySelector("button.visit")?.classList.contains("soft"),
	).toBe(true);
	expect(root(el).querySelector(".results")?.hasAttribute("aria-live")).toBe(
		false,
	);
});

test("the empty state links to Restaurants as a button-styled link", async () => {
	const el = await mount();
	expect(
		root(el).querySelector('a.button-link[href="./restaurants"]'),
	).not.toBeNull();
});

/** Cycle a value while the panel is hidden: open it, click, hide it again. */
const cycleHidden = async (
	el: HTMLElement & { updateComplete: Promise<boolean> },
	tag: string,
) => {
	root(el)
		.querySelector<HTMLButtonElement>('[data-action="show-filter"]')!
		.click();
	await el.updateComplete;
	await cycle(el, tag);
	root(el)
		.querySelector<HTMLButtonElement>('[data-action="hide-filter"]')!
		.click();
	await el.updateComplete;
};

test("wide: Hide collapses the filter panel, remembers it, and a Filter button brings it back", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await mount();
	const hide = root(el).querySelector<HTMLButtonElement>(
		'aside.filter-panel button[data-action="hide-filter"]',
	)!;
	expect(hide.textContent?.trim()).toBe("Hide");
	expect(hide.getAttribute("aria-label")).toBe("Hide filter");
	expect(hide.getAttribute("aria-expanded")).toBe("true");
	hide.click();
	await el.updateComplete;
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	expect(root(el).querySelector(".layout.with-panel")).toBeNull();
	expect(localStorage.getItem("whattoeat:filter-panel")).toBe("hidden");
	const show = root(el).querySelector<HTMLButtonElement>(
		'.head button[data-action="show-filter"]',
	)!;
	expect(show.textContent?.trim()).toBe("Filter");
	expect(show.getAttribute("aria-expanded")).toBe("false");
	await el.updateComplete;
	expect(root(el).activeElement).toBe(show);
	show.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).querySelector("aside.filter-panel")).not.toBeNull();
	expect(localStorage.getItem("whattoeat:filter-panel")).toBeNull();
	expect(root(el).activeElement?.getAttribute("data-action")).toBe(
		"hide-filter",
	);
});

test("wide: a hidden panel stays hidden on the next visit and its button counts active values", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam", "asok"] } });
	localStorage.setItem("whattoeat:filter-panel", "hidden");
	const el = await mount();
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	await cycleHidden(el, "siam");
	expect(
		root(el).querySelector('[data-action="show-filter"]')?.textContent?.trim(),
	).toBe("Filter · 1 on");
});

test("phone: the remembered hidden panel does not affect the sheet", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	localStorage.setItem("whattoeat:filter-panel", "hidden");
	const el = await phone();
	expect(root(el).querySelector('[data-action="open-filter"]')).not.toBeNull();
	expect(root(el).querySelector('[data-action="show-filter"]')).toBeNull();
});
