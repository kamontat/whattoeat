import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/random-picker";
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
