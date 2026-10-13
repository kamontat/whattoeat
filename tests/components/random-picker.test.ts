import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/random-picker";
import { FILTER_KEY } from "#lib/filter";
import { setLang } from "#lib/i18n";
import { addRestaurant, removeRestaurant } from "#lib/store";

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
const root = (el: HTMLElement) => el.shadowRoot!;
const tagButton = (el: HTMLElement, tag: string) =>
	root(el).querySelector<HTMLButtonElement>(`button.tag[data-tag="${tag}"]`);
const cycle = async (
	el: HTMLElement & { updateComplete: Promise<boolean> },
	tag: string,
) => {
	tagButton(el, tag)!.click();
	await el.updateComplete;
};
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

test("picking again with two restaurants always changes the result", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const first = pickedName(el);
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).not.toBe(first);
});

test("updates when restaurants are added after mount", async () => {
	const el = await mount();
	addRestaurant({ ...base, name: "New" });
	await el.updateComplete;
	expect(pickButton(el)).not.toBeNull();
});

test("clears the result when the picked restaurant is deleted", async () => {
	addRestaurant({ ...base, name: "A" });
	const list = addRestaurant({ ...base, name: "B" });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const picked = list.find((r) => r.name === pickedName(el))!;
	removeRestaurant(picked.id);
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
])("has a page heading when %s", async (_label, seed) => {
	if (seed) addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(el.shadowRoot!.querySelector("h1")?.textContent?.trim()).toBe(
		"What to Eat",
	);
});

test("no filter row when no restaurant has tags", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(root(el).querySelector("section.filter")).toBeNull();
});

test("filter chips list tags most used first and cycle off, include, exclude", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["thai", "spicy"] });
	const el = await mount();
	expect(
		[...root(el).querySelectorAll("button.tag")].map((b) =>
			b.getAttribute("data-tag"),
		),
	).toEqual(["thai", "spicy"]);
	const thai = () => tagButton(el, "thai")!;
	expect(thai().getAttribute("data-state")).toBe("off");
	expect(thai().getAttribute("aria-pressed")).toBe("false");
	expect(thai().getAttribute("aria-label")).toBe("thai, not used");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("include");
	expect(thai().getAttribute("aria-pressed")).toBe("true");
	expect(thai().getAttribute("aria-label")).toBe("thai, included");
	expect(thai().textContent?.trim()).toBe("✓ thai");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("exclude");
	expect(thai().getAttribute("aria-label")).toBe("thai, excluded");
	expect(thai().textContent?.trim()).toBe("✕ thai");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("off");
});

test("picks only from restaurants that match the filter", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["japanese"] });
	addRestaurant({ ...base, name: "C", tags: ["thai", "spicy"] });
	const el = await mount();
	await cycle(el, "thai");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	for (let i = 0; i < 10; i++) {
		pickButton(el)!.click();
		await el.updateComplete;
		expect(pickedName(el)).toBe("A");
	}
});

test("an active filter is shown and Clear resets it", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["spicy"] });
	const el = await mount();
	expect(activeLine(el)).toBeUndefined();
	await cycle(el, "thai");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	expect(activeLine(el)).toBe("Filter active: ✓ thai, ✕ spicy Clear");
	root(el)
		.querySelector<HTMLButtonElement>('button[data-action="clear-filter"]')!
		.click();
	await el.updateComplete;
	expect(activeLine(el)).toBeUndefined();
	expect(tagButton(el, "thai")?.getAttribute("data-state")).toBe("off");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({
		include: [],
		exclude: [],
	});
});

test("a filter that matches nothing disables the button and says so", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["japanese", "spicy"] });
	const el = await mount();
	await cycle(el, "japanese");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	expect(pickButton(el)?.disabled).toBe(true);
	expect(root(el).querySelector(".no-match")?.textContent?.trim()).toBe(
		"No restaurant matches this filter.",
	);
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).toBeUndefined();
});

test("the filter is remembered across visits", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	const first = await mount();
	await cycle(first, "thai");
	first.remove();
	const second = await mount();
	expect(tagButton(second, "thai")?.getAttribute("data-state")).toBe("include");
});

test("saved filter tags no longer used by any restaurant are dropped", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ include: ["thai", "gone"], exclude: ["old"] }),
	);
	const el = await mount();
	expect(activeLine(el)).toBe("Filter active: ✓ thai Clear");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({
		include: ["thai"],
		exclude: [],
	});
});

test("the result hides when the filter leaves out the current pick", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["noodle"] });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const other = pickedName(el) === "A" ? "noodle" : "thai";
	await cycle(el, other);
	expect(pickedName(el)).toBeUndefined();
});

test("filter labels render in Thai", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(root(el).querySelector(".filter-title")?.textContent?.trim()).toBe(
		"กรองตามแท็ก",
	);
});
