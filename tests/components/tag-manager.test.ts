import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-manager";
import type { TagManager } from "#components/tag-manager";
import { FILTER_KEY } from "#lib/filter";
import { forgetGroupsMemory, loadGroups, saveGroups } from "#lib/groups";
import { setLang } from "#lib/i18n";
import { addRestaurant, loadRestaurants, saveRestaurants } from "#lib/store";

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
	const el = document.createElement("tag-manager");
	document.body.append(el);
	await el.updateComplete;
	return el;
};
const $ = <T extends Element>(el: TagManager, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);
const card = (el: TagManager, group: string) =>
	$<HTMLElement>(el, `section.tag-group[data-group="${group}"]`)!;
const click = async (el: TagManager, root: ParentNode, action: string) => {
	root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
	await el.updateComplete;
};
const cardTitles = (el: TagManager) =>
	[...el.shadowRoot!.querySelectorAll("section.tag-group h2")].map((h) =>
		h.textContent?.trim(),
	);
const typeIn = async (
	el: TagManager,
	input: HTMLInputElement,
	text: string,
) => {
	input.value = text;
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
};
const valueRow = (el: TagManager, group: string, value: string) =>
	card(el, group).querySelector<HTMLElement>(
		`li.value[data-value="${value}"]`,
	)!;

test("shows a card per group in order, ending with plain tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	expect(cardTitles(el)).toEqual(["Type", "Cuisine", "Area", "Price", "Tags"]);
});

test("each value shows how many restaurants use it, most used first", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thai", "lao"] } });
	const el = await mount();
	const rows = [...card(el, "cuisine").querySelectorAll("li.value")].map(
		(li) => [
			li.getAttribute("data-value"),
			li.querySelector(".count")?.textContent?.trim(),
		],
	);
	expect(rows).toEqual([
		["thai", "2 restaurants"],
		["lao", "1 restaurant"],
	]);
});

test("only custom groups have group actions", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	expect(
		card(el, "cuisine").querySelector('[data-action="rename-group"]'),
	).toBeNull();
	expect(
		card(el, "g1").querySelector('[data-action="rename-group"]'),
	).not.toBeNull();
});

test("adding a group saves it and clears the field; blank and taken names show errors", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	const input = $<HTMLInputElement>(el, "#new-group")!;
	const submit = async () => {
		$<HTMLFormElement>(el, "form.add-group")!.dispatchEvent(
			new Event("submit", { cancelable: true }),
		);
		await el.updateComplete;
	};
	await submit();
	expect($(el, "form.add-group .error")?.textContent).toBe("Name is required.");
	await typeIn(el, input, "area");
	await submit();
	expect($(el, "form.add-group .error")?.textContent).toBe(
		"A group with this name already exists.",
	);
	await typeIn(el, input, "Vibe");
	await submit();
	expect(loadGroups().map((def) => def.name)).toEqual(["Price", "Vibe"]);
	expect(input.value).toBe("");
	expect($(el, "form.add-group .error")).toBeNull();
});

test("renaming a group saves the new name", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await click(el, card(el, "g1"), "rename-group");
	await typeIn(
		el,
		card(el, "g1").querySelector<HTMLInputElement>("input")!,
		"Cost",
	);
	await click(el, card(el, "g1"), "save-group-name");
	expect(loadGroups()).toEqual([{ id: "g1", name: "Cost" }]);
});

test("move up and down reorder custom groups", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
	]);
	const el = await mount();
	await click(el, card(el, "g2"), "move-up");
	expect(loadGroups().map((def) => def.id)).toEqual(["g2", "g1"]);
	expect(
		card(el, "g2").querySelector<HTMLButtonElement>('[data-action="move-up"]')!
			.disabled,
	).toBe(true);
});

test("deleting a group asks first, then turns its values into tags and drops its filter", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }),
	);
	const el = await mount();
	await click(el, card(el, "g1"), "delete-group");
	expect(card(el, "g1").textContent).toContain(
		"Its values on 1 restaurant become plain tags.",
	);
	await click(el, card(el, "g1"), "confirm-delete-group");
	expect(loadGroups()).toEqual([]);
	expect(loadRestaurants()[0]?.tags).toEqual(["cheap"]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	expect($(el, 'section.group[data-group="g1"]')).toBeNull();
});

test("with no restaurants, links to the restaurants page and still allows adding groups", async () => {
	const el = await mount();
	expect($(el, ".empty a")?.getAttribute("href")).toBe("./restaurants");
	expect($(el, "form.add-group")).not.toBeNull();
});

test("follows restaurant and group changes from elsewhere", async () => {
	const el = await mount();
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	await el.updateComplete;
	expect(
		card(el, "g1").querySelector('li.value[data-value="cheap"]'),
	).not.toBeNull();
});

test("renders in Thai", async () => {
	setLang("th");
	const el = await mount();
	expect(cardTitles(el)).toEqual(["ประเภท", "สัญชาติอาหาร", "ย่าน", "แท็ก"]);
});

test("Type values show counts only", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	const el = await mount();
	expect(valueRow(el, "kind", "food").querySelector("button")).toBeNull();
	expect(valueRow(el, "kind", "food").querySelector(".name")?.textContent).toBe(
		"Food",
	);
});

test("renaming a value changes it on every restaurant and in the saved filter", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thia", "lao"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ cuisine: { include: ["thia"], exclude: [] } }),
	);
	const el = await mount();
	await click(el, valueRow(el, "cuisine", "thia"), "rename-value");
	await typeIn(
		el,
		valueRow(el, "cuisine", "thia").querySelector("input")!,
		" Thai ",
	);
	await click(el, valueRow(el, "cuisine", "thia"), "save-value");
	expect(loadRestaurants().map((item) => item.groups["cuisine"])).toEqual([
		["thai"],
		["thai", "lao"],
	]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({
		cuisine: { include: ["thai"], exclude: [] },
	});
});

test("renaming to blank text or text with a comma shows an error and changes nothing", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await click(el, valueRow(el, "cuisine", "thai"), "rename-value");
	const input = valueRow(el, "cuisine", "thai").querySelector("input")!;
	await typeIn(el, input, "  ");
	await click(el, valueRow(el, "cuisine", "thai"), "save-value");
	expect(
		valueRow(el, "cuisine", "thai").querySelector(".error")?.textContent,
	).toBe("Value is required.");
	await typeIn(el, input, "thai, lao");
	await click(el, valueRow(el, "cuisine", "thai"), "save-value");
	expect(
		valueRow(el, "cuisine", "thai").querySelector(".error")?.textContent,
	).toBe("A value cannot contain a comma.");
	expect(loadRestaurants()[0]?.groups["cuisine"]).toEqual(["thai"]);
});

test("renaming onto an existing value asks to merge, and merging keeps one copy", async () => {
	// The group must exist before the restaurant, or its values are saved as plain tags.
	saveGroups([{ id: "g1", name: "Dish" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["noodles", "noodle"] } });
	const el = await mount();
	await click(el, valueRow(el, "g1", "noodles"), "rename-value");
	await typeIn(
		el,
		valueRow(el, "g1", "noodles").querySelector("input")!,
		"noodle",
	);
	await click(el, valueRow(el, "g1", "noodles"), "save-value");
	expect(valueRow(el, "g1", "noodles").textContent).toContain(
		"noodle already exists. Merge noodles into noodle on 1 restaurant?",
	);
	await click(el, valueRow(el, "g1", "noodles"), "confirm-merge");
	expect(loadRestaurants()[0]?.groups["g1"]).toEqual(["noodle"]);
});

test("moving a value offers every group but Type and its own, and moves it", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { area: ["cheap"] } });
	const el = await mount();
	await click(el, valueRow(el, "area", "cheap"), "move-value");
	const select = valueRow(el, "area", "cheap").querySelector("select")!;
	expect([...select.options].map((option) => option.value)).toEqual([
		"cuisine",
		"g1",
		"tags",
	]);
	select.value = "g1";
	select.dispatchEvent(new Event("change"));
	await el.updateComplete;
	await click(el, valueRow(el, "area", "cheap"), "confirm-move");
	expect(loadRestaurants()[0]?.groups).toEqual({ g1: ["cheap"] });
});

test("deleting a value asks first, then removes it everywhere", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy", "hot"] });
	const el = await mount();
	await click(el, valueRow(el, "tags", "spicy"), "delete-value");
	expect(valueRow(el, "tags", "spicy").textContent).toContain(
		"Remove spicy from 1 restaurant?",
	);
	await click(el, valueRow(el, "tags", "spicy"), "confirm-delete-value");
	expect(loadRestaurants()[0]?.tags).toEqual(["hot"]);
});

test("cancel closes a value prompt without changes", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy"] });
	const el = await mount();
	await click(el, valueRow(el, "tags", "spicy"), "delete-value");
	await click(el, valueRow(el, "tags", "spicy"), "cancel");
	expect(
		valueRow(el, "tags", "spicy").querySelector(
			'[data-action="confirm-delete-value"]',
		),
	).toBeNull();
	expect(loadRestaurants()[0]?.tags).toEqual(["spicy"]);
});

test("prompts count more than one restaurant in the plural", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy"] });
	addRestaurant({ ...base, name: "B", tags: ["spicy"] });
	const el = await mount();
	await click(el, valueRow(el, "tags", "spicy"), "delete-value");
	expect(valueRow(el, "tags", "spicy").textContent).toContain(
		"Remove spicy from 2 restaurants?",
	);
});

test("the rename and move controls are not hidden with their label text", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", tags: ["spicy", "hot"] });
	const el = await mount();
	const shown = () => {
		const controls = [...el.shadowRoot!.querySelectorAll("input, select")];
		// The add-group field plus the control of the prompt just opened.
		expect(controls.length).toBe(2);
		for (const control of controls)
			expect(control.closest(".visually-hidden")).toBeNull();
	};
	await click(el, card(el, "g1"), "rename-group");
	shown();
	await click(el, valueRow(el, "tags", "spicy"), "rename-value");
	shown();
	expect(
		valueRow(el, "tags", "spicy").querySelector("label")?.textContent,
	).toContain("New name for spicy");
	await click(el, valueRow(el, "tags", "hot"), "move-value");
	shown();
	expect(
		valueRow(el, "tags", "hot").querySelector("label")?.textContent,
	).toContain("Move hot to");
});

const focused = (el: TagManager) => el.shadowRoot!.activeElement;
const settle = async (el: TagManager) => {
	await el.updateComplete;
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};

test("moving a group keeps focus on the moved group's button, or the other arrow at an end", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
		{ id: "g3", name: "Dish" },
	]);
	const el = await mount();
	await click(el, card(el, "g3"), "move-up");
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g1", "g3", "g2"]);
	expect(focused(el)).toBe(
		card(el, "g3").querySelector('[data-action="move-up"]'),
	);
	await click(el, card(el, "g3"), "move-up");
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g3", "g1", "g2"]);
	expect(focused(el)).toBe(
		card(el, "g3").querySelector('[data-action="move-down"]'),
	);
	await click(el, card(el, "g1"), "move-down");
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g3", "g2", "g1"]);
	expect(focused(el)).toBe(
		card(el, "g1").querySelector('[data-action="move-up"]'),
	);
});

test("focus follows a value whose text has a double quote or backslash", async () => {
	addRestaurant({ ...base, name: "A", tags: ['say "hi"', "a\\b"] });
	const el = await mount();
	const row = (value: string) =>
		[...card(el, "tags").querySelectorAll("li.value")].find(
			(li) => li.getAttribute("data-value") === value,
		)!;
	for (const value of ['say "hi"', "a\\b"]) {
		await click(el, row(value), "rename-value");
		await settle(el);
		expect(focused(el)).toBe(row(value).querySelector("input"));
		await click(el, row(value), "cancel");
		await settle(el);
		expect(focused(el)).toBe(
			row(value).querySelector('[data-action="rename-value"]'),
		);
	}
});

test("warns about stored restaurants that could not be read", async () => {
	localStorage.setItem(
		"whattoeat:restaurants",
		JSON.stringify([{ name: "broken" }, null]),
	);
	const el = await mount();
	expect($(el, ".skipped")?.textContent?.trim()).toBe(
		"2 saved restaurants could not be read and were skipped. They will be removed the next time the list changes.",
	);
});

const withFullStorage = async (run: () => Promise<void>) => {
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		await run();
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		saveRestaurants([]);
		forgetGroupsMemory();
	}
};

test("warns when the browser refuses to save restaurants or groups", async () => {
	const el = await mount();
	expect($(el, ".warning")).toBeNull();
	await withFullStorage(async () => {
		saveGroups([{ id: "g1", name: "Price" }]);
		await el.updateComplete;
		expect($(el, ".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	});
	await withFullStorage(async () => {
		addRestaurant({ ...base, name: "Lost" });
		await el.updateComplete;
		expect($(el, ".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	});
});
