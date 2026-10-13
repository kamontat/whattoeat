import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/random-picker";
import { FILTER_KEY } from "#lib/filter";
import { loadHistory, saveHistory } from "#lib/history";
import { getLang, setLang } from "#lib/i18n";
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
const pickedNames = (el: HTMLElement) =>
	[...el.shadowRoot!.querySelectorAll(".result h2")].map(
		(h) => h.textContent ?? "",
	);
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

test("the result keeps only picks that still match the filter", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["noodle"] });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	await cycle(el, "thai");
	expect(pickedNames(el)).toEqual(["A"]);
	await cycle(el, "thai");
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
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["noodle"] });
	addRestaurant({ ...base, name: "C", tags: ["thai"] });
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
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
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

const lockButtons = (el: HTMLElement) => [
	...root(el).querySelectorAll<HTMLButtonElement>("button.lock"),
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
	expect(lockButtons(el)).toHaveLength(0);
	await pickOnce(el);
	expect(lockButtons(el).map((b) => b.textContent?.trim())).toEqual([
		"Eat here",
		"Eat here",
	]);
});

test("Eat here saves a lock and marks only that card", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	await pickOnce(el);
	const chosen = pickedNames(el)[1];
	lockButtons(el)[1]!.click();
	await el.updateComplete;
	const history = loadHistory();
	expect(history).toHaveLength(1);
	expect(history[0]!.name).toBe(chosen!);
	const time = new Intl.DateTimeFormat(getLang(), {
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(history[0]!.lockedAt));
	const locked = root(el).querySelectorAll(".result.locked");
	expect(locked).toHaveLength(1);
	expect(locked[0]!.querySelector("h2")?.textContent).toBe(chosen!);
	expect(locked[0]!.querySelector(".locked-label")?.textContent?.trim()).toBe(
		`✓ Locked at ${time}`,
	);
	expect(lockButtons(el)).toHaveLength(0);
	expect(pickedNames(el)).toHaveLength(2);
});

test("a double press saves one lock", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	await pickOnce(el);
	const [first, second] = lockButtons(el);
	first!.click();
	second!.click();
	await el.updateComplete;
	expect(loadHistory()).toHaveLength(1);
});

test("focus moves to the locked label", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	await pickOnce(el);
	lockButtons(el)[0]!.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement?.classList.contains("locked-label")).toBe(true);
});

test("Pick again brings the Eat here buttons back", async () => {
	for (const name of ["A", "B", "C", "D"]) addRestaurant({ ...base, name });
	const el = await mount();
	await pickOnce(el);
	lockButtons(el)[0]!.click();
	await el.updateComplete;
	await pickOnce(el);
	expect(lockButtons(el)).toHaveLength(2);
	expect(root(el).querySelector(".locked-label")).toBeNull();
	expect(loadHistory()).toHaveLength(1);
});

test("deleting the locked restaurant clears the label but keeps the lock", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const list = addRestaurant({ ...base, name: "C" });
	const el = await mount();
	await pickOnce(el);
	const [first = ""] = pickedNames(el);
	lockButtons(el)[0]!.click();
	await el.updateComplete;
	removeRestaurant(list.find((r) => r.name === first)!.id);
	await el.updateComplete;
	expect(root(el).querySelector(".locked-label")).toBeNull();
	expect(lockButtons(el)).toHaveLength(1);
	expect(loadHistory()[0]!.name).toBe(first);
});

test("Eat here renders in Thai", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	setLang("th");
	await pickOnce(el);
	expect(lockButtons(el)[0]?.textContent?.trim()).toBe("กินร้านนี้");
});

test("warns when the browser could not save the lock", async () => {
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
		lockButtons(el)[0]!.click();
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
