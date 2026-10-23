import { afterEach, beforeEach, expect, test } from "bun:test";
import { nameFromText } from "#lib/restaurant";
import "#components/random-picker";
import { RandomPicker } from "#components/random-picker";
import { FILTER_KEY } from "#lib/filter";
import { saveGroups } from "#lib/groups";
import { loadHistory, saveHistory } from "#lib/history";
import { getLang, setLang } from "#lib/i18n";
import { loadPickCount, savePickCount } from "#lib/random";
import {
	addRestaurant,
	loadRestaurants,
	removeRestaurant,
	saveRestaurants,
} from "#lib/store";

const base = { tags: [], links: [], notes: "" };

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
type Lit = HTMLElement & { updateComplete: Promise<boolean> };
const bar = (el: HTMLElement) => root(el).querySelector("filter-bar")!;
const barRoot = (el: HTMLElement) => bar(el).shadowRoot!;
const settle = async (el: Lit) => {
	await el.updateComplete;
	await bar(el).updateComplete;
	await el.updateComplete;
};
const pill = (el: HTMLElement, group: string) =>
	barRoot(el).querySelector<HTMLButtonElement>(
		`button.pill[data-group="${group}"]`,
	);
/** Open a group in the filter bar (a popover when wide, the sheet on phones) unless it is open. */
const openGroup = async (el: Lit, group: string) => {
	if (pill(el, group)?.getAttribute("aria-expanded") === "true") return;
	pill(el, group)!.click();
	await settle(el);
};
const valueButton = (el: HTMLElement, tag: string, action: "want" | "skip") =>
	barRoot(el).querySelector<HTMLButtonElement>(
		`.row button[data-action="${action}"][data-value="${tag}"]`,
	);
/** A value's state in the filter bar: off, include (Want pressed) or exclude (Skip pressed). */
const valueState = async (el: Lit, tag: string, group = "area") => {
	await openGroup(el, group);
	if (valueButton(el, tag, "want")?.getAttribute("aria-pressed") === "true")
		return "include";
	if (valueButton(el, tag, "skip")?.getAttribute("aria-pressed") === "true")
		return "exclude";
	return "off";
};
/** Move a value one step, off to include to exclude to off, by pressing Want or Skip. */
const cycle = async (el: Lit, tag: string, group = "area") => {
	const state = await valueState(el, tag, group);
	valueButton(el, tag, state === "off" ? "want" : "skip")!.click();
	await settle(el);
};
/** The values listed in one group of the filter bar. */
const groupChips = async (el: Lit, group: string) => {
	await openGroup(el, group);
	return [...barRoot(el).querySelectorAll(".row .label")].map((label) =>
		label.textContent?.trim(),
	);
};
const groupTitles = (el: HTMLElement) =>
	[...barRoot(el).querySelectorAll("button.pill")].map((button) =>
		button.textContent?.trim(),
	);
const emptyFilter = {};

test("empty list shows a link to the restaurants page and no button", async () => {
	const el = await mount();
	expect(pickButton(el)).toBeNull();
	expect(
		el
			.shadowRoot!.querySelector('a[href="./restaurants"]')
			?.textContent?.trim(),
	).toBe("Add some restaurants");
});

test("the empty home card links Start with a neighbourhood to ./settings/presets as the primary link, above Add some restaurants as the secondary one", async () => {
	const el = await mount();
	const links = [
		...root(el).querySelectorAll<HTMLAnchorElement>(".card.empty a"),
	];
	expect(links.map((a) => a.textContent?.trim())).toEqual([
		"Start with a neighbourhood",
		"Add some restaurants",
	]);
	const [presetsLink, addLink] = links as [
		HTMLAnchorElement,
		HTMLAnchorElement,
	];
	expect(presetsLink.getAttribute("href")).toBe("./settings/presets");
	expect(presetsLink.classList.contains("button-link")).toBe(true);
	expect(presetsLink.classList.contains("primary")).toBe(true);
	expect(addLink.getAttribute("href")).toBe("./restaurants");
	expect(addLink.classList.contains("button-link")).toBe(true);
	expect(addLink.classList.contains("secondary")).toBe(true);
});

test("the home card is unchanged when restaurants exist", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	expect(root(el).querySelector(".card.empty")).toBeNull();
	expect(root(el).querySelector('a[href="./settings/presets"]')).toBeNull();
});

test("clicking the button shows a restaurant with its details", async () => {
	addRestaurant({
		name: { en: "Jay Fai", th: "" },
		tags: ["street", "crab"],
		links: [{ label: "", url: "https://maps.example/jayfai" }],
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
	const link = el.shadowRoot!.querySelector<HTMLAnchorElement>(".result h2 a");
	expect(link?.textContent?.trim()).toBe("Jay Fai");
	expect(link?.getAttribute("href")).toBe("https://maps.example/jayfai");
	expect(link?.getAttribute("target")).toBe("_blank");
	expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
	expect(el.shadowRoot!.querySelector(".result .links")).toBeNull();
	expect(el.shadowRoot!.querySelector(".result .notes")?.textContent).toBe(
		"Queue early",
	);
	expect(pickButton(el)?.textContent?.trim()).toBe("Pick again");
});

test("a non-http link leaves the name as plain text and is not shown", async () => {
	addRestaurant({
		...base,
		name: { en: "Sneaky", th: "" },
		links: [{ label: "Hack", url: "javascript:alert(1)" }],
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector(".result a")).toBeNull();
	expect(pickedName(el)).toBe("Sneaky");
	expect(el.shadowRoot!.querySelector(".result")?.textContent).not.toContain(
		"javascript:",
	);
});

test("several links: the name opens the top-priority link and every link is an icon named by its label", async () => {
	addRestaurant({
		...base,
		name: { en: "Jay Fai", th: "" },
		links: [
			{ label: "Menu", url: "https://jayfai.example/menu" },
			{ label: "", url: "javascript:alert(1)" },
			{ label: "", url: "https://www.instagram.com/jayfai" },
		],
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(
		el.shadowRoot!.querySelector(".result h2 a")?.getAttribute("href"),
	).toBe("https://www.instagram.com/jayfai");
	const links = [
		...el.shadowRoot!.querySelectorAll<HTMLAnchorElement>(".result .links a"),
	];
	expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
		"Instagram",
		"Menu",
	]);
	expect(links.map((a) => a.getAttribute("title"))).toEqual([
		"Instagram",
		"Menu",
	]);
	expect(links.map((a) => a.textContent?.trim())).toEqual(["", ""]);
	expect(
		links.map((a) => a.querySelector("svg")?.getAttribute("data-icon")),
	).toEqual(["instagram", "book"]);
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"https://www.instagram.com/jayfai",
		"https://jayfai.example/menu",
	]);
	for (const a of links) {
		expect(a.getAttribute("target")).toBe("_blank");
		expect(a.getAttribute("rel")).toBe("noopener noreferrer");
	}
});

test("the name opens the link with the highest priority: main, map, social sites, then website", async () => {
	addRestaurant({
		...base,
		name: { en: "Pho", th: "" },
		links: [
			{ label: "website", url: "https://pho.example" },
			{ label: "facebook", url: "https://www.facebook.com/pho" },
			{ label: "Grab", url: "https://grab.example/pho" },
			{ label: "map", url: "https://maps.example/pho" },
		],
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	expect(
		el.shadowRoot!.querySelector(".result h2 a")?.getAttribute("href"),
	).toBe("https://maps.example/pho");
	expect(
		[...el.shadowRoot!.querySelectorAll(".result .links a")].map((a) => [
			a.getAttribute("aria-label"),
			a.querySelector("svg")?.getAttribute("data-icon"),
		]),
	).toEqual([
		["Map", "pin"],
		["Facebook", "facebook"],
		["Website", "globe"],
		["grab", "external"],
	]);
});

test("shows two different restaurants to choose from", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	addRestaurant({ ...base, name: { en: "C", th: "" } });
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
	for (const name of ["A", "B", "C", "D"])
		addRestaurant({ ...base, name: nameFromText(name) });
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
	addRestaurant({ ...base, name: { en: "New", th: "" } });
	await el.updateComplete;
	expect(pickButton(el)).not.toBeNull();
});

test("drops a deleted restaurant from the result and clears it when none are left", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	const list = addRestaurant({ ...base, name: { en: "C", th: "" } });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const [first = "", second = ""] = pickedNames(el);
	const idOf = (name: string) => list.find((r) => r.name.en === name)!.id;
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
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(pickButton(el)?.textContent?.trim()).toBe("กินอะไรดี?");
});

test.each([
	["empty", false],
	["with restaurants", true],
])("has a visible page heading when %s", async (_label, seed) => {
	if (seed) addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	const heading = el.shadowRoot!.querySelector("h1");
	expect(heading?.textContent?.trim()).toBe("What to Eat");
	expect(heading?.classList.contains("page-title")).toBe(true);
	expect(heading?.classList.contains("visually-hidden")).toBe(false);
});

test("no filter pills when no restaurant has a type, cuisine or area", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" }, tags: ["thai"] });
	const el = await mount();
	expect(barRoot(el).querySelector("button.pill")).toBeNull();
});

test("picks only from restaurants that match the filter", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" }, kinds: ["food"] });
	addRestaurant({ ...base, name: { en: "B", th: "" }, kinds: ["drinks"] });
	addRestaurant({
		...base,
		name: { en: "C", th: "" },
		kinds: ["food", "dessert"],
	});
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

test("an active filter is counted on its pill and Clear all resets it", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { area: ["spicy"] },
	});
	const el = await mount();
	expect(pill(el, "area")?.querySelector(".badge")).toBeNull();
	await cycle(el, "thai");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	expect(pill(el, "area")?.querySelector(".badge")?.textContent).toBe("2");
	barRoot(el)
		.querySelector<HTMLButtonElement>('button[data-action="clear-filter"]')!
		.click();
	await settle(el);
	expect(pill(el, "area")?.querySelector(".badge")).toBeNull();
	expect(await valueState(el, "thai")).toBe("off");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual(
		emptyFilter,
	);
});

test("a filter that matches nothing disables the button and says so", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" }, kinds: ["food"] });
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		kinds: ["drinks", "dessert"],
	});
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
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	const first = await mount();
	await cycle(first, "thai");
	first.remove();
	const second = await mount();
	expect(await valueState(second, "thai")).toBe("include");
});

test("saved filter values no longer used by any restaurant are dropped", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ area: { include: ["thai", "gone"], exclude: ["old"] } }),
	);
	const el = await mount();
	expect(await valueState(el, "thai")).toBe("include");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({
		...emptyFilter,
		area: { include: ["thai"], exclude: [] },
	});
});

test("a filter saved in another tab is picked up without dropping values not yet loaded", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { cuisine: ["thia"] },
	});
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
	expect(await valueState(el, "thai", "cuisine")).toBe("include");
});

test("a value renamed in another tab keeps the picked card on screen", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { cuisine: ["thia"] },
	});
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
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { area: ["noodle"] },
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	await cycle(el, "thai");
	expect(pickedNames(el)).toEqual(["A"]);
	await cycle(el, "thai");
	expect(pickedName(el)).toBeUndefined();
});

test("filter labels render in Thai", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	const el = await mount();
	setLang("th");
	await settle(el);
	expect(barRoot(el).querySelector(".bar")?.getAttribute("aria-label")).toBe(
		"ตัวกรอง",
	);
});

test("the filter shows type, cuisine and area groups, only those in use, and never tags", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		kinds: ["dessert", "food"],
		groups: { cuisine: ["Thai"], area: ["Siam"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		kinds: ["drinks"],
		groups: { area: ["ari"] },
	});
	addRestaurant({
		...base,
		name: { en: "C", th: "" },
		tags: ["spicy"],
		groups: { area: ["siam"] },
	});
	const el = await mount();
	expect(groupTitles(el)).toEqual(["Type", "Cuisine", "Area"]);
	expect(pill(el, "tags")).toBeNull();
	expect(await groupChips(el, "kind")).toEqual(["Food", "Drinks", "Dessert"]);
	expect(await groupChips(el, "cuisine")).toEqual(["thai"]);
	expect(await groupChips(el, "area")).toEqual(["siam", "ari"]);
});

test("values in one group match any, every group must match", async () => {
	addRestaurant({
		...base,
		name: { en: "Noodle", th: "" },
		kinds: ["food"],
		groups: { area: ["siam"] },
	});
	addRestaurant({
		...base,
		name: { en: "Cafe", th: "" },
		kinds: ["drinks"],
		groups: { area: ["siam"] },
	});
	addRestaurant({
		...base,
		name: { en: "Far", th: "" },
		kinds: ["food"],
		groups: { area: ["ari"] },
	});
	addRestaurant({
		...base,
		name: { en: "Bingsu", th: "" },
		kinds: ["dessert"],
		groups: { area: ["siam"] },
	});
	const el = await mount();
	await cycle(el, "siam", "area");
	await cycle(el, "food", "kind");
	await cycle(el, "dessert", "kind");
	expect(countText(el)).toBe("2 of 4 restaurants match");
	for (let i = 0; i < 5; i++) {
		pickButton(el)!.click();
		await el.updateComplete;
		expect(pickedNames(el).sort()).toEqual(["Bingsu", "Noodle"]);
	}
});

test("a picked card shows its type, cuisine and area", async () => {
	addRestaurant({
		...base,
		name: { en: "Cafe", th: "" },
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
		name: { en: "A", th: "" },
		kinds: ["dessert"],
		groups: { cuisine: ["thai"] },
	});
	const el = await mount();
	setLang("th");
	await settle(el);
	expect(groupTitles(el)).toEqual(["ประเภท", "สัญชาติอาหาร"]);
	expect(await groupChips(el, "kind")).toEqual(["ของหวาน"]);
});

const countText = (el: HTMLElement) =>
	root(el).querySelector(".count")?.textContent?.trim();

test("shows how many restaurants there are", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	const el = await mount();
	expect(countText(el)).toBe("2 restaurants");
});

test("uses the singular for one restaurant", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	expect(countText(el)).toBe("1 restaurant");
});

test("with a filter, shows how many of all restaurants match", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { area: ["noodle"] },
	});
	addRestaurant({
		...base,
		name: { en: "C", th: "" },
		groups: { area: ["thai"] },
	});
	const el = await mount();
	await cycle(el, "thai");
	expect(countText(el)).toBe("2 of 3 restaurants match");
	await cycle(el, "thai");
	expect(countText(el)).toBe("1 of 3 restaurants match");
	await cycle(el, "thai");
	expect(countText(el)).toBe("3 restaurants");
});

test("the count follows restaurants added after mount", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	await el.updateComplete;
	expect(countText(el)).toBe("2 restaurants");
});

test("the count renders in Thai", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	addRestaurant({ ...base, name: { en: "B", th: "" } });
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
	addRestaurant({
		name: { en: "Fresh", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
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
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	const el = await mount();
	expect(visitButtons(el)).toHaveLength(0);
	await pickOnce(el);
	expect(visitButtons(el).map((b) => b.textContent?.trim())).toEqual([
		"Eat here",
		"Eat here",
	]);
});

test("Eat here saves a visit and marks only that card", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
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
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	const el = await mount();
	await pickOnce(el);
	const [first, second] = visitButtons(el);
	first!.click();
	second!.click();
	await el.updateComplete;
	expect(loadHistory()).toHaveLength(1);
});

test("focus moves to the visited label", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
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
	for (const name of ["A", "B", "C", "D"])
		addRestaurant({ ...base, name: nameFromText(name) });
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
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	const list = addRestaurant({ ...base, name: { en: "C", th: "" } });
	const el = await mount();
	await pickOnce(el);
	const [first = ""] = pickedNames(el);
	visitButtons(el)[0]!.click();
	await el.updateComplete;
	removeRestaurant(list.find((r) => r.name.en === first)!.id);
	await el.updateComplete;
	expect(root(el).querySelector(".visited-label")).toBeNull();
	expect(visitButtons(el)).toHaveLength(1);
	expect(loadHistory()[0]!.name).toBe(first);
});

test("Eat here renders in Thai", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	setLang("th");
	await pickOnce(el);
	expect(visitButtons(el)[0]?.textContent?.trim()).toBe("กินร้านนี้");
});

test("warns when the browser could not save the visit", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
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

test("a picked card shows the type line under the name and keeps Eat here in its footer", async () => {
	addRestaurant({
		...base,
		name: { en: "Cafe", th: "" },
		tags: ["latte"],
		links: [{ label: "", url: "https://maps.example/cafe" }],
		kinds: ["drinks"],
	});
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const card = root(el).querySelector(".result")!;
	expect([...card.children].map((child) => child.className.trim())).toEqual([
		"",
		"meta",
		"chips",
		"foot",
	]);
	expect(card.querySelector(".foot button.visit")).not.toBeNull();
});

test("custom groups get filter rows after the built-ins, labelled with their names", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["siam"], g1: ["cheap"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { g1: ["fancy"] },
	});
	const el = await mount();
	expect(groupTitles(el)).toEqual(["Area", "Price"]);
	await cycle(el, "cheap", "g1");
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedNames(el)).toEqual(["A"]);
});

test("a restaurant with several cuisines matches each of them", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { cuisine: ["thai", "lao"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { cuisine: ["thai"] },
	});
	const el = await mount();
	await cycle(el, "lao", "cuisine");
	expect(root(el).querySelector(".count")?.textContent).toContain("1 of 2");
});

test("a filter on a deleted group is dropped", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { g1: ["cheap"] },
	});
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }),
	);
	const el = await mount();
	saveGroups([]);
	await el.updateComplete;
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	await settle(el);
	expect(pill(el, "g1")).toBeNull();
});

test("a picked card shows custom values as labelled chips before tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
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
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	expect(root(el).querySelector("h1.page-title")?.textContent?.trim()).toBe(
		"What to Eat",
	);
	expect(root(el).querySelector(".head .count")?.textContent?.trim()).toBe(
		"1 restaurant",
	);
});

test("wide: the filter bar sits under the heading and the pick button in the heading row", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["siam"] },
	});
	const el = await mount();
	expect(root(el).querySelector(".head + filter-bar")).not.toBeNull();
	expect(barRoot(el).querySelector("app-sheet")).toBeNull();
	expect(root(el).querySelector(".head button.pick")).not.toBeNull();
	expect(root(el).querySelector(".pinned")).toBeNull();
	expect(root(el).querySelectorAll("button.pick")).toHaveLength(1);
});

test("phone: a group pill opens the filter sheet", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["siam"] },
	});
	const el = await phone();
	const sheet = barRoot(el).querySelector("app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);
	await openGroup(el, "area");
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Filter");
});

test("phone: the sheet's footer button closes it", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["siam"] },
	});
	const el = await phone();
	await openGroup(el, "area");
	const done = barRoot(el).querySelector<HTMLButtonElement>(
		'app-sheet button[slot="footer"][data-action="filter-done"]',
	)!;
	expect(done.textContent?.trim()).toBe("Show 1 restaurant");
	done.click();
	await settle(el);
	expect(barRoot(el).querySelector("app-sheet")!.hasAttribute("open")).toBe(
		false,
	);
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

test("tiles sit two to a row from 48rem", () => {
	const css = flattenStyles();
	const wide = css.slice(css.indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(
		/\.results\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
	);
	expect(wide).toMatch(/\.results\s*\{[^}]*gap:\s*1rem/);
});

test("the pinned bar sits fully above the tab bar, with nothing peeking below it", () => {
	const pinned = flattenStyles().match(/\.pinned\s*\{[^}]*\}/)?.[0] ?? "";
	expect(pinned).toMatch(/bottom:\s*var\(--tab-bar-height\)/);
	expect(pinned).toMatch(/padding:\s*0\.75rem 0 0\.5rem/);
});

test("phone: the pick button is pinned at the end, once", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await phone();
	expect(root(el).querySelector(".pinned button.pick")).not.toBeNull();
	expect(root(el).querySelector(".head button.pick")).toBeNull();
	expect(root(el).querySelectorAll("button.pick")).toHaveLength(1);
});

test("phone: a filter that matches nothing disables the pinned button", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" }, kinds: ["food"] });
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		kinds: ["drinks", "dessert"],
	});
	const el = await phone();
	await cycle(el, "drinks", "kind");
	await cycle(el, "dessert", "kind");
	await cycle(el, "dessert", "kind");
	expect(
		root(el).querySelector<HTMLButtonElement>(".pinned button.pick")?.disabled,
	).toBe(true);
	expect(root(el).querySelector(".no-match")).not.toBeNull();
});

test("switching layouts keeps the filter", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["siam"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { area: ["asok"] },
	});
	const el = await mount();
	await cycle(el, "siam");
	setWidth(390);
	await settle(el);
	expect(await valueState(el, "siam")).toBe("include");
	setWidth(1024);
	await settle(el);
	expect(await valueState(el, "siam")).toBe("include");
});

test("the picks are announced by name", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	addRestaurant({ ...base, name: { en: "B", th: "" } });
	const el = await mount();
	const announce = () =>
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim();
	expect(announce()).toBe("");
	await pickOnce(el);
	const [a, b] = pickedNames(el);
	expect(announce()).toBe(`Picked ${a} and ${b}`);
});

test("narrowing the filter to one pick does not invent a fresh announcement", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["thai"] },
	});
	addRestaurant({
		...base,
		name: { en: "B", th: "" },
		groups: { area: ["noodle"] },
	});
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
	addRestaurant({ ...base, name: { en: "Solo", th: "" } });
	const el = await mount();
	await pickOnce(el);
	expect(
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim(),
	).toBe("Picked Solo");
});

test("Eat here is a soft button and the result area is not a live region", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
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

test("Clear all is a quiet button", async () => {
	addRestaurant({
		...base,
		name: { en: "A", th: "" },
		groups: { area: ["siam"] },
	});
	const el = await mount();
	await cycle(el, "siam");
	const clear = barRoot(el).querySelector<HTMLButtonElement>(
		'[data-action="clear-filter"]',
	)!;
	expect(clear.textContent?.trim()).toBe("Clear all");
	expect(clear.classList.contains("quiet")).toBe(true);
});

const stepper = (el: HTMLElement) =>
	root(el).querySelector<HTMLElement>(".stepper")!;
const stepButton = (el: HTMLElement, step: "fewer" | "more") =>
	stepper(el).querySelector<HTMLButtonElement>(`button[data-step="${step}"]`)!;
const stepperValue = (el: HTMLElement) =>
	stepper(el).querySelector(".stepper-value")?.textContent?.trim();

test("the pick count stepper is a labelled group that starts at 2", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const el = await mount();
	expect(stepper(el).getAttribute("role")).toBe("group");
	expect(stepper(el).getAttribute("aria-label")).toBe("Restaurants per pick");
	expect(stepButton(el, "fewer").getAttribute("aria-label")).toBe(
		"Fewer restaurants",
	);
	expect(stepButton(el, "more").getAttribute("aria-label")).toBe(
		"More restaurants",
	);
	expect(stepperValue(el)).toBe("2 per pick");
});

test("the stepper sits beside the pick button: in the heading when wide, in the pinned bar on phones", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	const wide = await mount();
	expect(root(wide).querySelector(".head-actions .stepper")).not.toBeNull();
	document.body.innerHTML = "";
	const narrow = await phone();
	expect(root(narrow).querySelector(".pinned .stepper")).not.toBeNull();
	expect(root(narrow).querySelector(".head-actions")).toBeNull();
});

test("More and Fewer change the count, save it, and the next press shows that many", async () => {
	for (const name of ["A", "B", "C", "D", "E", "F"])
		addRestaurant({ ...base, name: nameFromText(name) });
	const el = await mount();
	stepButton(el, "more").click();
	await settle(el);
	stepButton(el, "more").click();
	await settle(el);
	expect(stepperValue(el)).toBe("4 per pick");
	expect(loadPickCount()).toBe(4);
	await pickOnce(el);
	expect(new Set(pickedNames(el)).size).toBe(4);
	stepButton(el, "fewer").click();
	await settle(el);
	expect(loadPickCount()).toBe(3);
});

test("the stepper stops at 1 and at 5", async () => {
	addRestaurant({ ...base, name: { en: "A", th: "" } });
	savePickCount(1);
	const low = await mount();
	expect(stepButton(low, "fewer").disabled).toBe(true);
	expect(stepButton(low, "more").disabled).toBe(false);
	document.body.innerHTML = "";
	savePickCount(5);
	const high = await mount();
	expect(stepperValue(high)).toBe("5 per pick");
	expect(stepButton(high, "more").disabled).toBe(true);
	expect(stepButton(high, "fewer").disabled).toBe(false);
});

test("a press shows two restaurants by default", async () => {
	for (const name of ["A", "B", "C", "D"])
		addRestaurant({ ...base, name: nameFromText(name) });
	const el = await mount();
	await pickOnce(el);
	expect(new Set(pickedNames(el)).size).toBe(2);
});

test("a press shows as many restaurants as the stored pick count", async () => {
	for (const name of ["A", "B", "C", "D", "E", "F"])
		addRestaurant({ ...base, name: nameFromText(name) });
	savePickCount(4);
	const el = await mount();
	await pickOnce(el);
	expect(new Set(pickedNames(el)).size).toBe(4);
});

test("three picks are announced as a list", async () => {
	for (const name of ["A", "B", "C"])
		addRestaurant({ ...base, name: nameFromText(name) });
	savePickCount(3);
	const el = await mount();
	await pickOnce(el);
	const [a, b, c] = pickedNames(el);
	expect(
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim(),
	).toBe(`Picked ${a}, ${b}, and ${c}`);
});
