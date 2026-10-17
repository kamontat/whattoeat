import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-manager";
import type { AppSheet } from "#components/app-sheet";
import type { TagManager } from "#components/tag-manager";
import { FILTER_KEY } from "#lib/filter";
import { forgetGroupsMemory, loadGroups, saveGroups } from "#lib/groups";
import { setLang } from "#lib/i18n";
import {
	addRestaurant,
	loadRestaurants,
	saveRestaurants,
	updateRestaurant,
} from "#lib/store";

const base = { tags: [], link: "", notes: "" };

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

/** Opens a value's actions (side panel at the default test width) and returns that container. */
const openValue = async (el: TagManager, group: string, value: string) => {
	valueRow(el, group, value)
		.querySelector<HTMLButtonElement>('[data-action="open-value"]')!
		.click();
	await el.updateComplete;
	return $<HTMLElement>(el, ".value-detail")!;
};

/** Opens a custom group's options sheet and returns its content. */
const openGroup = async (el: TagManager, group: string) => {
	card(el, group)
		.querySelector<HTMLButtonElement>('[data-action="group-options"]')!
		.click();
	await el.updateComplete;
	return $<HTMLElement>(el, ".group-options")!;
};

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
		card(el, "cuisine").querySelector('[data-action="group-options"]'),
	).toBeNull();
	expect(
		card(el, "g1").querySelector('[data-action="group-options"]'),
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
	let options = await openGroup(el, "g1");
	await click(el, options, "rename-group");
	options = $(el, ".group-options")!;
	await typeIn(el, options.querySelector<HTMLInputElement>("input")!, "Cost");
	options = $(el, ".group-options")!;
	await click(el, options, "save-group-name");
	expect(loadGroups()).toEqual([{ id: "g1", name: "Cost" }]);
});

test("move up and down reorder custom groups", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
	]);
	const el = await mount();
	const options = await openGroup(el, "g2");
	await click(el, options, "move-up");
	expect(loadGroups().map((def) => def.id)).toEqual(["g2", "g1"]);
	expect(
		$<HTMLElement>(el, ".group-options")!
			.querySelector<HTMLButtonElement>('[data-action="move-up"]')!
			.getAttribute("aria-disabled"),
	).toBe("true");
});

test("deleting a group asks first, then turns its values into tags and drops its filter", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }),
	);
	const el = await mount();
	let options = await openGroup(el, "g1");
	await click(el, options, "delete-group");
	options = $(el, ".group-options")!;
	expect(options.textContent).toContain(
		"Its values on 1 restaurant become plain tags.",
	);
	await click(el, options, "confirm-delete-group");
	expect(loadGroups()).toEqual([]);
	expect(loadRestaurants()[0]?.tags).toEqual(["cheap"]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	expect($(el, 'section.group[data-group="g1"]')).toBeNull();
});

test("with no restaurants, links to the restaurants page and still allows adding groups", async () => {
	const el = await mount();
	expect($(el, ".empty a.button-link")?.getAttribute("href")).toBe(
		"./restaurants",
	);
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
	let detail = await openValue(el, "cuisine", "thia");
	await click(el, detail, "rename-value");
	detail = $(el, ".value-detail")!;
	await typeIn(el, detail.querySelector("input")!, " Thai ");
	detail = $(el, ".value-detail")!;
	await click(el, detail, "save-value");
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
	let detail = await openValue(el, "cuisine", "thai");
	await click(el, detail, "rename-value");
	detail = $(el, ".value-detail")!;
	const input = detail.querySelector<HTMLInputElement>("input")!;
	await typeIn(el, input, "  ");
	detail = $(el, ".value-detail")!;
	await click(el, detail, "save-value");
	detail = $(el, ".value-detail")!;
	expect(detail.querySelector(".error")?.textContent).toBe(
		"Value is required.",
	);
	await typeIn(el, detail.querySelector("input")!, "thai, lao");
	detail = $(el, ".value-detail")!;
	await click(el, detail, "save-value");
	detail = $(el, ".value-detail")!;
	expect(detail.querySelector(".error")?.textContent).toBe(
		"A value cannot contain a comma.",
	);
	expect(loadRestaurants()[0]?.groups["cuisine"]).toEqual(["thai"]);
});

test("renaming onto an existing value asks to merge, and merging keeps one copy", async () => {
	// The group must exist before the restaurant, or its values are saved as plain tags.
	saveGroups([{ id: "g1", name: "Dish" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["noodles", "noodle"] } });
	const el = await mount();
	let detail = await openValue(el, "g1", "noodles");
	await click(el, detail, "rename-value");
	detail = $(el, ".value-detail")!;
	await typeIn(el, detail.querySelector("input")!, "noodle");
	detail = $(el, ".value-detail")!;
	await click(el, detail, "save-value");
	detail = $(el, ".value-detail")!;
	expect(detail.textContent).toContain(
		"noodle already exists. Merge noodles into noodle on 1 restaurant?",
	);
	await click(el, detail, "confirm-merge");
	expect(loadRestaurants()[0]?.groups["g1"]).toEqual(["noodle"]);
});

test("moving a value offers every group but Type and its own, and moves it", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { area: ["cheap"] } });
	const el = await mount();
	let detail = await openValue(el, "area", "cheap");
	await click(el, detail, "move-value");
	detail = $(el, ".value-detail")!;
	const select = detail.querySelector<HTMLSelectElement>("select")!;
	expect([...select.options].map((option) => option.value)).toEqual([
		"cuisine",
		"g1",
		"tags",
	]);
	select.value = "g1";
	select.dispatchEvent(new Event("change"));
	await el.updateComplete;
	detail = $(el, ".value-detail")!;
	await click(el, detail, "confirm-move");
	expect(loadRestaurants()[0]?.groups).toEqual({ g1: ["cheap"] });
});

test("deleting a value asks first, then removes it everywhere", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy", "hot"] });
	const el = await mount();
	let detail = await openValue(el, "tags", "spicy");
	await click(el, detail, "delete-value");
	detail = $(el, ".value-detail")!;
	expect(detail.textContent).toContain("Remove spicy from 1 restaurant?");
	await click(el, detail, "confirm-delete-value");
	expect(loadRestaurants()[0]?.tags).toEqual(["hot"]);
});

test("cancel closes a value prompt without changes", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy"] });
	const el = await mount();
	let detail = await openValue(el, "tags", "spicy");
	await click(el, detail, "delete-value");
	detail = $(el, ".value-detail")!;
	await click(el, detail, "cancel");
	detail = $(el, ".value-detail")!;
	expect(
		detail.querySelector('[data-action="confirm-delete-value"]'),
	).toBeNull();
	expect(loadRestaurants()[0]?.tags).toEqual(["spicy"]);
});

test("prompts count more than one restaurant in the plural", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy"] });
	addRestaurant({ ...base, name: "B", tags: ["spicy"] });
	const el = await mount();
	const detail = await openValue(el, "tags", "spicy");
	await click(el, detail, "delete-value");
	expect($(el, ".value-detail")!.textContent).toContain(
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
	const options = await openGroup(el, "g1");
	await click(el, options, "rename-group");
	shown();
	let detail = await openValue(el, "tags", "spicy");
	await click(el, detail, "rename-value");
	shown();
	detail = $(el, ".value-detail")!;
	expect(detail.querySelector("label")?.textContent).toContain(
		"New name for spicy",
	);
	detail = await openValue(el, "tags", "hot");
	await click(el, detail, "move-value");
	shown();
	detail = $(el, ".value-detail")!;
	expect(detail.querySelector("label")?.textContent).toContain("Move hot to");
});

test("the move action's accessible name starts with its visible 'Move to…' label (WCAG label-in-name)", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy"] });
	const el = await mount();
	const detail = await openValue(el, "tags", "spicy");
	const button = detail.querySelector<HTMLButtonElement>(
		'[data-action="move-value"]',
	)!;
	const visible = button.querySelector("b")!.textContent!.trim();
	expect(visible).toBe("Move to…");
	const label = button.getAttribute("aria-label") ?? "";
	expect(label.startsWith(visible)).toBe(true);
	expect(label).toContain("spicy");
});

test("the move action's accessible name starts with its visible label in Thai too", async () => {
	setLang("th");
	addRestaurant({ ...base, name: "A", tags: ["เผ็ด"] });
	const el = await mount();
	const detail = await openValue(el, "tags", "เผ็ด");
	const button = detail.querySelector<HTMLButtonElement>(
		'[data-action="move-value"]',
	)!;
	const visible = button.querySelector("b")!.textContent!.trim();
	expect(visible).toBe("ย้ายไป…");
	const label = button.getAttribute("aria-label") ?? "";
	expect(label.startsWith(visible)).toBe(true);
	expect(label).toContain("เผ็ด");
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
	let options = await openGroup(el, "g3");
	await click(el, options, "move-up");
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g1", "g3", "g2"]);
	expect(focused(el)).toBe(
		$<HTMLElement>(el, ".group-options")!.querySelector(
			'[data-action="move-up"]',
		),
	);
	options = $(el, ".group-options")!;
	await click(el, options, "move-up");
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g3", "g1", "g2"]);
	expect(focused(el)).toBe(
		$<HTMLElement>(el, ".group-options")!.querySelector(
			'[data-action="move-down"]',
		),
	);
	await openGroup(el, "g1");
	options = $(el, ".group-options")!;
	await click(el, options, "move-down");
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g3", "g2", "g1"]);
	expect(focused(el)).toBe(
		$<HTMLElement>(el, ".group-options")!.querySelector(
			'[data-action="move-up"]',
		),
	);
});

test("focus follows a value whose text has a double quote or backslash", async () => {
	addRestaurant({ ...base, name: "A", tags: ['say "hi"', "a\\b"] });
	const el = await mount();
	// A CSS attribute selector would break on these values, so find the row by comparing the
	// attribute directly, as valueRow's own lookup cannot.
	const row = (value: string) =>
		[...card(el, "tags").querySelectorAll("li.value")].find(
			(li) => li.getAttribute("data-value") === value,
		)!;
	for (const value of ['say "hi"', "a\\b"]) {
		row(value)
			.querySelector<HTMLButtonElement>('[data-action="open-value"]')!
			.click();
		await el.updateComplete;
		let detail = $<HTMLElement>(el, ".value-detail")!;
		await click(el, detail, "rename-value");
		await settle(el);
		detail = $(el, ".value-detail")!;
		expect(focused(el)).toBe(detail.querySelector("input"));
		await click(el, detail, "cancel");
		await settle(el);
		detail = $(el, ".value-detail")!;
		expect(focused(el)).toBe(
			detail.querySelector('[data-action="rename-value"]'),
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
afterEach(() => setWidth(1024));

test("the page has a back link to Restaurants and a large title", async () => {
	const el = await mount();
	const back = $<HTMLAnchorElement>(el, "a.back")!;
	expect(back.getAttribute("href")).toBe("./restaurants");
	expect(back.textContent?.trim()).toBe("Restaurants");
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Tags");
});

test("value rows are buttons with the value and count; Type rows are plain", async () => {
	addRestaurant({
		...base,
		name: "A",
		kinds: ["food"],
		groups: { cuisine: ["thai"] },
	});
	const el = await mount();
	const row = valueRow(el, "cuisine", "thai").querySelector(
		'button.item.value-row[data-action="open-value"]',
	)!;
	expect(row.querySelector(".name")?.textContent?.trim()).toBe("thai");
	expect(row.querySelector(".count")?.textContent?.trim()).toBe("1 restaurant");
	expect(valueRow(el, "kind", "food").querySelector("button")).toBeNull();
});

test("wide: the panel asks you to choose a value, then shows its actions", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	expect($(el, "section.value-panel .pick-hint")).not.toBeNull();
	expect($(el, "app-sheet.value-sheet")).toBeNull();
	const detail = await openValue(el, "cuisine", "thai");
	expect(detail.closest("section.value-panel")).not.toBeNull();
	expect(detail.getAttribute("data-value")).toBe("thai");
	expect(
		[...detail.querySelectorAll("button[data-action]")].map((b) =>
			b.getAttribute("data-action"),
		),
	).toEqual(["rename-value", "move-value", "delete-value"]);
	expect(
		valueRow(el, "cuisine", "thai")
			.querySelector('[data-action="open-value"]')
			?.getAttribute("aria-current"),
	).toBe("true");
});

test("wide: the panel's aria-labelledby always points to a real, visible id", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	const panel = $<HTMLElement>(el, "section.value-panel")!;
	const hintId = panel.getAttribute("aria-labelledby")!;
	const hint = panel.querySelector(`#${hintId}`)!;
	expect(hint.classList.contains("pick-hint")).toBe(true);
	expect(hint.textContent?.trim()).toBe(
		"Choose a value to rename, move or delete it.",
	);
	await openValue(el, "cuisine", "thai");
	const titleId = panel.getAttribute("aria-labelledby")!;
	expect(titleId).not.toBe(hintId);
	expect(panel.querySelector(`#${titleId}`)?.textContent?.trim()).toBe("thai");
});

test("narrow to wide with a value's sheet open moves focus into the panel's Rename button", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	setWidth(1024);
	await settle(el);
	expect($(el, "section.value-panel")).not.toBeNull();
	expect(focused(el)).toBe(
		$(el, ".value-detail")!.querySelector('[data-action="rename-value"]'),
	);
});

test("narrow to wide with a rename prompt open moves focus to its input instead", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	let detail = await openValue(el, "cuisine", "thai");
	await click(el, detail, "rename-value");
	setWidth(1024);
	await settle(el);
	detail = $(el, ".value-detail")!;
	expect(focused(el)).toBe(detail.querySelector("input"));
});

test("wide to narrow with a value selected returns focus to its row, not body, when the sheet closes", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	setWidth(390);
	await settle(el);
	const sheet = $(el, "app-sheet.value-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	sheet.shadowRoot!.querySelector("dialog")!.close();
	await settle(el);
	expect(focused(el)).toBe(
		valueRow(el, "cuisine", "thai").querySelector('[data-action="open-value"]'),
	);
});

test("phone: a value opens its actions in a sheet titled with the value", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	expect($(el, "section.value-panel")).toBeNull();
	await openValue(el, "cuisine", "thai");
	const sheet = $(el, "app-sheet.value-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("thai");
	expect(sheet.getAttribute("subheading")).toBe("Cuisine · 1 restaurant");
});

test("phone: deleting the selected value closes its sheet and focuses the add-group field", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	let detail = await openValue(el, "cuisine", "thai");
	await click(el, detail, "delete-value");
	detail = $(el, ".value-detail")!;
	await click(el, detail, "confirm-delete-value");
	await settle(el);
	expect($(el, "app-sheet.value-sheet")?.hasAttribute("open")).toBe(false);
	// The closed sheet keeps its last content only to draw it sliding away.
	expect($(el, "app-sheet[open] .value-detail")).toBeNull();
	expect(el.shadowRoot!.activeElement?.id).toBe("new-group");
});

/**
 * Patches `<dialog>.close` so its `close` event fires on a later task, like real browsers
 * (happy-dom fires it synchronously), giving other code a chance to run first.
 */
const withAsyncDialogClose = async (run: () => Promise<void>) => {
	const original = HTMLDialogElement.prototype.close;
	HTMLDialogElement.prototype.close = function (
		this: HTMLDialogElement,
		returnValue?: string,
	) {
		const wasOpen = this.open;
		this.removeAttribute("open");
		this.returnValue = returnValue ?? "";
		if (wasOpen) setTimeout(() => this.dispatchEvent(new Event("close")), 0);
	};
	try {
		await run();
	} finally {
		HTMLDialogElement.prototype.close = original;
	}
};

test("phone: deleting a value while its sheet's close event is still in flight still lands focus on the add-group field, not a reused row", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai", "lao"] } });
	setWidth(390);
	const el = await mount();
	await withAsyncDialogClose(async () => {
		let detail = await openValue(el, "cuisine", "thai");
		await click(el, detail, "delete-value");
		detail = $(el, ".value-detail")!;
		await click(el, detail, "confirm-delete-value");
		// The sheet's own `close` event (deferred above, as in real browsers) has not fired
		// yet when our own focus landing runs; let both settle before asserting.
		await settle(el);
		expect($(el, "app-sheet.value-sheet")?.hasAttribute("open")).toBe(false);
		expect(el.shadowRoot!.activeElement?.id).toBe("new-group");
	});
});

test("renaming keeps the detail open on the new name", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	const el = await mount();
	let detail = await openValue(el, "cuisine", "thia");
	detail
		.querySelector<HTMLButtonElement>('[data-action="rename-value"]')!
		.click();
	await el.updateComplete;
	detail = $(el, ".value-detail")!;
	const input = detail.querySelector<HTMLInputElement>("input")!;
	input.value = "thai";
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
	$(el, ".value-detail")!
		.querySelector<HTMLButtonElement>('[data-action="save-value"]')!
		.click();
	await el.updateComplete;
	await el.updateComplete;
	expect($(el, ".value-detail")?.getAttribute("data-value")).toBe("thai");
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"rename-value",
	);
});

test("deleting the selected value closes the detail and focuses the add-group field", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	const detail = await openValue(el, "cuisine", "thai");
	detail
		.querySelector<HTMLButtonElement>('[data-action="delete-value"]')!
		.click();
	await el.updateComplete;
	$(el, ".value-detail")!
		.querySelector<HTMLButtonElement>('[data-action="confirm-delete-value"]')!
		.click();
	await el.updateComplete;
	await el.updateComplete;
	expect($(el, ".value-detail")).toBeNull();
	expect(el.shadowRoot!.activeElement?.id).toBe("new-group");
});

test("another tab removing the selected value closes the detail", async () => {
	const [item] = addRestaurant({
		...base,
		name: "A",
		groups: { cuisine: ["thai"] },
	});
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	updateRestaurant(item!.id, { ...base, name: "A", groups: {} });
	await el.updateComplete;
	expect($(el, ".value-detail")).toBeNull();
});

test("custom groups open their options in a sheet; moves at the ends are disabled with a reason", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
	]);
	const el = await mount();
	expect(
		card(el, "cuisine").querySelector('[data-action="group-options"]'),
	).toBeNull();
	const button = card(el, "g1").querySelector('[data-action="group-options"]')!;
	expect(button.getAttribute("aria-label")).toBe("Price options");
	expect(button.getAttribute("aria-haspopup")).toBe("dialog");
	const options = await openGroup(el, "g1");
	expect($(el, "app-sheet.group-sheet")?.hasAttribute("open")).toBe(true);
	const up = options.querySelector<HTMLButtonElement>(
		'[data-action="move-up"]',
	)!;
	// Stays focusable (not natively disabled) so its reason is reachable, but does nothing.
	expect(up.disabled).toBe(false);
	expect(up.getAttribute("aria-disabled")).toBe("true");
	const reason = up.querySelector(".reason")!;
	expect(reason.textContent?.trim()).toBe("Already the first group");
	expect(up.getAttribute("aria-describedby")).toBe(reason.id);
	expect(reason.id).toBeTruthy();
	const before = loadGroups().map((def) => def.id);
	up.click();
	await el.updateComplete;
	expect(loadGroups().map((def) => def.id)).toEqual(before);
	const down = options.querySelector<HTMLButtonElement>(
		'[data-action="move-down"]',
	)!;
	expect(down.disabled).toBe(false);
	expect(down.getAttribute("aria-disabled")).toBeNull();
	expect(down.getAttribute("aria-describedby")).toBeNull();
});

test("opening a group's options focuses the sheet's heading, not Rename", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await openGroup(el, "g1");
	await settle(el);
	const sheet = $<AppSheet>(el, "app-sheet.group-sheet")!;
	expect(sheet.shadowRoot!.activeElement?.id).toBe("sheet-title");
});

test("phone: opening a value focuses the sheet's heading, not Rename", async () => {
	setWidth(390);
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	await settle(el);
	const sheet = $<AppSheet>(el, "app-sheet.value-sheet")!;
	expect(sheet.shadowRoot!.activeElement?.id).toBe("sheet-title");
});

test("wide: opening a value focuses the panel's Rename button", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	await settle(el);
	expect(focused(el)?.getAttribute("data-action")).toBe("rename-value");
});

test("another tab deleting the open group closes its sheet", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await openGroup(el, "g1");
	saveGroups([]);
	await el.updateComplete;
	expect($(el, "app-sheet.group-sheet")?.hasAttribute("open")).toBe(false);
});

test("another tab removing the group whose options are open leaves a wide-panel value draft intact", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	let detail = await openValue(el, "cuisine", "thai");
	await click(el, detail, "rename-value");
	detail = $(el, ".value-detail")!;
	await typeIn(el, detail.querySelector("input")!, "Thai food");
	await openGroup(el, "g1");
	saveGroups([]);
	await el.updateComplete;
	expect($(el, "app-sheet.group-sheet")?.hasAttribute("open")).toBe(false);
	detail = $(el, ".value-detail")!;
	expect(detail.querySelector<HTMLInputElement>("input")?.value).toBe(
		"Thai food",
	);
});

test("opening a group's options does not drop an open value's draft", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	let detail = await openValue(el, "cuisine", "thai");
	await click(el, detail, "rename-value");
	detail = $(el, ".value-detail")!;
	await typeIn(el, detail.querySelector("input")!, "Thai food");
	await openGroup(el, "g1");
	const sheet = $(el, "app-sheet.group-sheet")!;
	sheet.shadowRoot!.querySelector("dialog")!.close();
	await settle(el);
	detail = $(el, ".value-detail")!;
	expect(detail.querySelector<HTMLInputElement>("input")?.value).toBe(
		"Thai food",
	);
});
