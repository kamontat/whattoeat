import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-manager";
import type { AppSheet } from "#components/app-sheet";
import type { TagManager } from "#components/tag-manager";
import type { TagGroupForm } from "#components/tags/group-form";
import type { TagList } from "#components/tags/list";
import type { TagPicker } from "#components/tags/picker";
import type { TagValueForm } from "#components/tags/value-form";
import { FILTER_KEY, LIST_FILTER_KEY } from "#lib/filter";
import { forgetGroupsMemory, loadGroups, saveGroups } from "#lib/groups";
import { setLang } from "#lib/i18n";
import {
	addRestaurant,
	loadRestaurants,
	saveRestaurants,
	updateRestaurant,
} from "#lib/store";
import { PICK_KEY } from "#lib/tags";

const base = { tags: [], link: "", notes: "" };

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	setLang("en");
});
afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
	sessionStorage.clear();
});

const mount = async () => {
	const el = document.createElement("tag-manager");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

/** The page's parts (tag-*, restaurant-search) each have a shadow root; look inside them too. */
const isPart = (node: Element): boolean =>
	node.localName.startsWith("tag-") || node.localName === "restaurant-search";

/** Every match in `el` and its parts, in document order. */
const $$ = <T extends Element>(root: Element, selector: string): T[] => {
	const found: T[] = [];
	const walk = (parent: ParentNode): void => {
		for (const node of parent.querySelectorAll("*")) {
			if (node.matches(selector)) found.push(node as T);
			if (isPart(node) && node.shadowRoot !== null) walk(node.shadowRoot);
		}
	};
	walk(root.shadowRoot ?? root);
	return found;
};
const $ = <T extends Element>(root: Element, selector: string): T | null =>
	$$<T>(root, selector)[0] ?? null;

/** The focused element, looking through the page's parts. */
const focused = (el: TagManager): Element | null => {
	let active = el.shadowRoot!.activeElement;
	while (active !== null && isPart(active) && active.shadowRoot !== null) {
		const inner = active.shadowRoot.activeElement;
		if (inner === null) break;
		active = inner;
	}
	return active;
};

const settle = async (el: TagManager) => {
	await el.updateComplete;
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};

const typeIn = async (
	el: TagManager,
	input: HTMLInputElement,
	text: string,
) => {
	input.value = text;
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await el.updateComplete;
};

const clickOn = async (el: TagManager, button: Element | null) => {
	(button as HTMLElement).click();
	await el.updateComplete;
};

/** The one group picker shown (pills or column); null while searching. */
const picker = (el: TagManager) =>
	el.shadowRoot!.querySelector<TagPicker>("tag-picker");
const pickerIds = (el: TagManager) =>
	[...picker(el)!.shadowRoot!.querySelectorAll("[data-group]")].map((b) =>
		b.getAttribute("data-group"),
	);
const pressed = (el: TagManager) =>
	picker(el)!
		.shadowRoot!.querySelector('[aria-pressed="true"]')
		?.getAttribute("data-group");
const pillFor = (el: TagManager, id: string) =>
	[
		...picker(el)!.shadowRoot!.querySelectorAll<HTMLElement>("[data-group]"),
	].find((b) => b.getAttribute("data-group") === id)!;
const pick = async (el: TagManager, id: string) => {
	await clickOn(el, pillFor(el, id));
};

const list = (el: TagManager) =>
	el.shadowRoot!.querySelector<TagList>("tag-list");
/** The rows of the values (or search results) list. */
const rows = (el: TagManager) => [
	...list(el)!.shadowRoot!.querySelectorAll<HTMLElement>("li[data-group]"),
];
const rowFor = (el: TagManager, group: string, value?: string) =>
	rows(el).find(
		(li) =>
			li.getAttribute("data-group") === group &&
			(li.getAttribute("data-value") ?? undefined) === value,
	);
const rowButton = (el: TagManager, group: string, value?: string) =>
	rowFor(el, group, value)?.querySelector<HTMLButtonElement>(
		'[data-action="open"]',
	) ?? null;

/** Where the open form lives: the side panel on wide screens, the open sheet on phones. */
const formHost = (el: TagManager) =>
	el.shadowRoot!.querySelector<HTMLElement>("#edit-panel") ??
	el.shadowRoot!.querySelector<HTMLElement>("app-sheet.form-sheet[open]");
const valueForm = (el: TagManager) =>
	formHost(el)?.querySelector<TagValueForm>("tag-value-form") ?? null;
const groupForm = (el: TagManager) =>
	formHost(el)?.querySelector<TagGroupForm>("tag-group-form") ?? null;
const inForm = <T extends Element>(form: Element, selector: string) =>
	form.shadowRoot!.querySelector<T>(selector)!;

/** Picks the group, opens the value's form and returns it. */
const openValue = async (el: TagManager, group: string, value: string) => {
	if (picker(el) !== null && pressed(el) !== group) await pick(el, group);
	await clickOn(el, rowButton(el, group, value));
	return valueForm(el)!;
};

/** Picks the custom group, opens its Edit group form and returns it. */
const openGroup = async (el: TagManager, id: string) => {
	if (pressed(el) !== id) await pick(el, id);
	await clickOn(el, $(el, '.head-actions [data-action="edit-group"]'));
	return groupForm(el)!;
};

const clickAdd = async (el: TagManager) => {
	await clickOn(el, $(el, 'button.add[data-action="add"]'));
};

const openSearch = async (el: TagManager) => {
	await clickOn(el, $(el, '[data-action="search"]'));
};
const searchInput = (el: TagManager) => $<HTMLInputElement>(el, "#search")!;
const typeSearch = async (el: TagManager, text: string) => {
	await typeIn(el, searchInput(el), text);
};

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

// Layout

test("large: groups column, values column, no pills", async () => {
	const el = await mount();
	expect($(el, 'tag-picker[variant="column"]')).not.toBeNull();
	expect($(el, 'tag-picker[variant="pills"]')).toBeNull();
	expect($(el, ".layout")?.getAttribute("data-stage")).toBe("large");
	expect(picker(el)!.closest(".layout")).not.toBeNull();
});

test("small: wrapping pills and a two-column list", async () => {
	setWidth(900);
	const el = await mount();
	expect($(el, 'tag-picker[variant="pills"][wrap]')).not.toBeNull();
	expect($(el, 'tag-picker[variant="column"]')).toBeNull();
	expect($(el, ".layout")?.getAttribute("data-stage")).toBe("small");
	expect($(el, ".head-actions button.add")).not.toBeNull();
});

test("phone: pills in the sticky top, pinned add, one form sheet", async () => {
	setWidth(390);
	const el = await mount();
	const pills = picker(el)!;
	expect(pills.getAttribute("variant")).toBe("pills");
	expect(pills.hasAttribute("wrap")).toBe(false);
	expect(pills.closest(".top")).not.toBeNull();
	expect($(el, ".group-head")).toBeNull();
	expect($(el, ".pinned button.add")).not.toBeNull();
	expect($(el, ".head-actions button.add")).toBeNull();
	expect($(el, "section#edit-panel")).toBeNull();
	expect(el.shadowRoot!.querySelectorAll("app-sheet.form-sheet").length).toBe(
		1,
	);
	expect($(el, ".layout")?.getAttribute("data-stage")).toBe("phone");
});

test("the picker lists groups in order, ending with plain tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	expect(pickerIds(el)).toEqual(["kind", "cuisine", "area", "g1", "tags"]);
});

test("the subtitle counts the picked group's values and restaurants", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: "A",
		tags: ["spicy"],
		groups: { cuisine: ["thai", "lao"] },
	});
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thai"] } });
	const el = await mount();
	expect($(el, "p.count")?.textContent?.trim()).toBe(
		"2 values · 2 restaurants",
	);
	await pick(el, "g1");
	expect($(el, "p.count")?.textContent?.trim()).toBe(
		"0 values · 0 restaurants",
	);
});

test("Cuisine is picked first and the pick is remembered for the session", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	let el = await mount();
	expect(pressed(el)).toBe("cuisine");
	await pick(el, "g1");
	expect(pressed(el)).toBe("g1");
	el.remove();
	el = await mount();
	expect(pressed(el)).toBe("g1");
	el.remove();
	sessionStorage.setItem(PICK_KEY, "gone");
	el = await mount();
	expect(pressed(el)).toBe("cuisine");
});

// Values

test("values show how many restaurants use them, most used first", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thai", "lao"] } });
	const el = await mount();
	expect(
		rows(el).map((li) => [
			li.getAttribute("data-value"),
			li.querySelector(".name")?.textContent?.trim(),
			li.querySelector(".sub")?.textContent?.trim(),
		]),
	).toEqual([
		["thai", "thai", "2 restaurants"],
		["lao", "lao", "1 restaurant"],
	]);
	expect(rowButton(el, "cuisine", "thai")).not.toBeNull();
});

test("Type values are read-only, with the usual subtitle and no note", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	const el = await mount();
	await pick(el, "kind");
	expect(list(el)!.shadowRoot!.querySelector("button")).toBeNull();
	expect(list(el)!.shadowRoot!.querySelector("ul.readonly")).not.toBeNull();
	expect(rowFor(el, "kind", "food")?.querySelector(".name")?.textContent).toBe(
		"Food",
	);
	expect($(el, ".group-head")).toBeNull();
	expect($(el, "p.count")?.textContent?.trim()).toBe("1 value · 1 restaurant");
});

test("only custom groups have Edit group, in the header actions", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	expect($(el, '[data-action="edit-group"]')).toBeNull();
	await pick(el, "g1");
	const edit = $(el, '.head-actions [data-action="edit-group"]')!;
	expect(edit.getAttribute("aria-label")).toBe("Edit Price");
	expect(edit.getAttribute("title")).toBe("Edit Price");
});

test("plain tags explain they are not filtered", async () => {
	const el = await mount();
	await pick(el, "tags");
	expect($(el, "p.count")?.textContent?.trim()).toBe(
		"0 values · not used by the home filter",
	);
	expect($(el, "p.muted.no-values")?.textContent?.trim()).toBe(
		"No values yet.",
	);
});

// Groups

test("adding a group picks it and says so", async () => {
	const el = await mount();
	const before = loadGroups().length;
	await clickAdd(el);
	const form = groupForm(el)!;
	expect(form.groupId).toBeUndefined();
	expect($(el, "#form-title")?.textContent?.trim()).toBe("New group");
	await typeIn(el, inForm(form, "#name"), "Mood");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	await settle(el);
	const groups = loadGroups();
	expect(groups.length).toBe(before + 1);
	expect(pressed(el)).toBe(groups.at(-1)!.id);
	expect($(el, ".status")?.textContent?.trim()).toBe("Added Mood");
	expect(groupForm(el)).toBeNull();
	expect(focused(el)).toBe(pillFor(el, groups.at(-1)!.id));
});

test("adding a group with a blank or taken name shows the error", async () => {
	const el = await mount();
	await clickAdd(el);
	let form = groupForm(el)!;
	await clickOn(el, inForm(form, '[data-action="save"]'));
	form = groupForm(el)!;
	expect(inForm(form, ".error").textContent).toBe("Name is required.");
	await typeIn(el, inForm(form, "#name"), "area");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	expect(inForm(groupForm(el)!, ".error").textContent).toBe(
		"A group with this name already exists.",
	);
	expect(loadGroups()).toEqual([]);
});

test("renaming a group saves the new name", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	const form = await openGroup(el, "g1");
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Price");
	expect(inForm<HTMLInputElement>(form, "#name").value).toBe("Price");
	await typeIn(el, inForm(form, "#name"), "Cost");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	await settle(el);
	expect(loadGroups()).toEqual([{ id: "g1", name: "Cost" }]);
	expect($(el, ".status")?.textContent?.trim()).toBe("Saved Cost");
	expect(groupForm(el)).toBeNull();
	expect(focused(el)).toBe(pillFor(el, "g1"));
});

test("moving a group reorders at once and keeps the form open", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
	]);
	const el = await mount();
	const form = await openGroup(el, "g2");
	await clickOn(el, inForm(form, '[data-action="move-up"]'));
	await settle(el);
	expect(loadGroups().map((def) => def.id)).toEqual(["g2", "g1"]);
	expect(pickerIds(el)).toEqual([
		"kind",
		"cuisine",
		"area",
		"g2",
		"g1",
		"tags",
	]);
	const open = groupForm(el)!;
	expect(open.groupId).toBe("g2");
	expect(
		inForm(open, '[data-action="move-up"]').getAttribute("aria-disabled"),
	).toBe("true");
	expect(focused(el)).toBe(inForm(open, '[data-action="move-down"]'));
});

test("deleting a group turns its values into tags, drops its filter and picks Cuisine", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ g1: { include: ["cheap"], exclude: [] } }),
	);
	const el = await mount();
	let form = await openGroup(el, "g1");
	await clickOn(el, inForm(form, '[data-action="delete"]'));
	form = groupForm(el)!;
	expect(form.shadowRoot!.textContent).toContain(
		"Its values on 1 restaurant become plain tags.",
	);
	await clickOn(el, inForm(form, '[data-action="confirm-delete"]'));
	await settle(el);
	expect(loadGroups()).toEqual([]);
	expect(loadRestaurants()[0]?.tags).toEqual(["cheap"]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({});
	expect(pickerIds(el)).not.toContain("g1");
	expect(pressed(el)).toBe("cuisine");
	expect(groupForm(el)).toBeNull();
	expect(focused(el)).toBe(pillFor(el, "cuisine"));
});

// Values: edit

test("editing a value renames it everywhere and in the saved filter", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	addRestaurant({ ...base, name: "B", groups: { cuisine: ["thia", "lao"] } });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ cuisine: { include: ["thia"], exclude: [] } }),
	);
	const el = await mount();
	const form = await openValue(el, "cuisine", "thia");
	expect($(el, "#form-title")?.textContent?.trim()).toBe("thia");
	expect(rowButton(el, "cuisine", "thia")?.getAttribute("aria-current")).toBe(
		"true",
	);
	await typeIn(el, inForm(form, "#name"), " Thai ");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	await settle(el);
	expect(loadRestaurants().map((item) => item.groups["cuisine"])).toEqual([
		["thai"],
		["thai", "lao"],
	]);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({
		cuisine: { include: ["thai"], exclude: [] },
	});
	expect($(el, ".status")?.textContent?.trim()).toBe("Saved thai");
	expect(valueForm(el)).toBeNull();
	expect(focused(el)).toBe(rowButton(el, "cuisine", "thai"));
});

test("editing a value to blank text or text with a comma shows an error and changes nothing", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	let form = await openValue(el, "cuisine", "thai");
	await typeIn(el, inForm(form, "#name"), "  ");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	form = valueForm(el)!;
	expect(inForm(form, ".error").textContent).toBe("Value is required.");
	await typeIn(el, inForm(form, "#name"), "thai, lao");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	expect(inForm(valueForm(el)!, ".error").textContent).toBe(
		"A value cannot contain a comma.",
	);
	expect(loadRestaurants()[0]?.groups["cuisine"]).toEqual(["thai"]);
});

test("editing a value's group moves it", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { area: ["cheap"] } });
	const el = await mount();
	const form = await openValue(el, "area", "cheap");
	const select = inForm<HTMLSelectElement>(form, "select");
	expect([...select.options].map((option) => option.value)).toEqual([
		"cuisine",
		"area",
		"g1",
		"tags",
	]);
	select.value = "g1";
	select.dispatchEvent(new Event("change"));
	await el.updateComplete;
	await clickOn(el, inForm(valueForm(el)!, '[data-action="save"]'));
	await settle(el);
	expect(loadRestaurants()[0]?.groups).toEqual({ g1: ["cheap"] });
	expect(valueForm(el)).toBeNull();
	// The row went to another group: focus the picked group instead.
	expect(focused(el)).toBe(pillFor(el, "area"));
});

test("renaming onto an existing value asks to merge, and merging keeps one copy", async () => {
	// The group must exist before the restaurant, or its values are saved as plain tags.
	saveGroups([{ id: "g1", name: "Dish" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["noodles", "noodle"] } });
	const el = await mount();
	let form = await openValue(el, "g1", "noodles");
	await typeIn(el, inForm(form, "#name"), "noodle");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	form = valueForm(el)!;
	expect(form.shadowRoot!.textContent).toContain(
		"noodle already exists. Merge noodles into noodle on 1 restaurant?",
	);
	await clickOn(el, inForm(form, '[data-action="confirm-merge"]'));
	expect(loadRestaurants()[0]?.groups["g1"]).toEqual(["noodle"]);
});

test("deleting a value asks first, then removes it everywhere", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicy", "hot"] });
	addRestaurant({ ...base, name: "B", tags: ["spicy"] });
	const el = await mount();
	let form = await openValue(el, "tags", "spicy");
	await clickOn(el, inForm(form, '[data-action="delete"]'));
	form = valueForm(el)!;
	expect(form.shadowRoot!.textContent).toContain(
		"Remove spicy from 2 restaurants?",
	);
	await clickOn(el, inForm(form, '[data-action="confirm-delete"]'));
	await settle(el);
	expect(loadRestaurants().map((item) => item.tags)).toEqual([["hot"], []]);
	expect($(el, ".status")?.textContent?.trim()).toBe("Removed spicy");
	expect(valueForm(el)).toBeNull();
	expect(focused(el)).toBe(pillFor(el, "tags"));
});

test("cancel and the panel's close drop the form and return focus to its opener", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	const form = await openValue(el, "cuisine", "thai");
	await clickOn(el, inForm(form, '[data-action="cancel"]'));
	await settle(el);
	expect(valueForm(el)).toBeNull();
	expect(focused(el)).toBe(rowButton(el, "cuisine", "thai"));
	await openGroup(el, "g1");
	await clickOn(el, $(el, '[data-action="close-panel"]'));
	await settle(el);
	expect($(el, "#edit-panel")).toBeNull();
	expect(focused(el)).toBe($(el, '[data-action="edit-group"]'));
	await clickAdd(el);
	await clickOn(el, inForm(groupForm(el)!, '[data-action="cancel"]'));
	await settle(el);
	expect(focused(el)).toBe($(el, ".head button.add"));
});

// Search

const seedSearch = () => {
	saveGroups([{ id: "g1", name: "Jam" }]);
	addRestaurant({
		...base,
		name: "A",
		tags: ["jazz"],
		groups: { cuisine: ["japanese"] },
	});
};

test("search finds groups and values across groups and highlights them", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ja");
	expect(picker(el)).toBeNull();
	expect(
		rows(el).map((li) => [
			li.querySelector(".name")?.textContent?.trim(),
			li.querySelector(".sub")?.textContent?.trim(),
		]),
	).toEqual([
		["Jam", "0 values"],
		["japanese", "Cuisine · 1 restaurant"],
		["jazz", "Tags · 1 restaurant"],
	]);
	for (const li of rows(el)) expect(li.querySelector("mark")).not.toBeNull();
	expect($(el, ".search-count")?.textContent?.trim()).toBe("3 of 7 tags");
});

test("search: Type values are read-only results", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "foo");
	const row = rowFor(el, "kind", "food")!;
	expect(row.querySelector("button")).toBeNull();
});

test("a group result ends search and picks that group", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ja");
	await clickOn(el, rowButton(el, "g1"));
	await settle(el);
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	expect(pressed(el)).toBe("g1");
	expect(focused(el)).toBe(pillFor(el, "g1"));
});

test("a value result opens its form and search stays open", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ja");
	await clickOn(el, rowButton(el, "cuisine", "japanese"));
	const form = valueForm(el)!;
	expect(form.group).toBe("cuisine");
	expect(form.value).toBe("japanese");
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(picker(el)).toBeNull();
});

test("Enter with one match opens it", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "jaz");
	searchInput(el).dispatchEvent(
		new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
	);
	await el.updateComplete;
	const form = valueForm(el)!;
	expect(form.value).toBe("jazz");
});

test("no match offers to clear the search", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "qq");
	expect($(el, ".no-match p")?.textContent?.trim()).toBe('No tags match "qq".');
	expect(list(el)).toBeNull();
	await clickOn(el, $(el, '[data-action="clear-search-empty"]'));
	expect(searchInput(el).value).toBe("");
	expect($(el, ".no-match")).toBeNull();
});

// One form slot

test("opening another form replaces the open one", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	const form = await openValue(el, "cuisine", "thai");
	await typeIn(el, inForm(form, "#name"), "thai food");
	await clickAdd(el);
	const group = groupForm(el)!;
	expect(group.groupId).toBeUndefined();
	expect(inForm<HTMLInputElement>(group, "#name").value).toBe("");
	expect(valueForm(el)).toBeNull();
});

test("picking another group leaves the open form alone", async () => {
	addRestaurant({
		...base,
		name: "A",
		groups: { cuisine: ["thai"], area: ["ari"] },
	});
	const el = await mount();
	const form = await openValue(el, "cuisine", "thai");
	await typeIn(el, inForm(form, "#name"), "thai food");
	await pick(el, "area");
	const open = valueForm(el)!;
	expect(open.value).toBe("thai");
	expect(inForm<HTMLInputElement>(open, "#name").value).toBe("thai food");
});

// Focus and resize

test("focus follows a value whose text has a double quote or backslash", async () => {
	addRestaurant({ ...base, name: "A", tags: ['say "hi"', "a\\b"] });
	const el = await mount();
	for (const value of ['say "hi"', "a\\b"]) {
		const form = await openValue(el, "tags", value);
		await settle(el);
		expect(focused(el)).toBe(inForm(form, "#name"));
		await clickOn(el, inForm(form, '[data-action="cancel"]'));
		await settle(el);
		expect(focused(el)).toBe(rowButton(el, "tags", value));
	}
});

test("wide: opening a value focuses the form's name field", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	const form = await openValue(el, "cuisine", "thai");
	await settle(el);
	expect(focused(el)).toBe(inForm(form, "#name"));
	expect(form.closest("section#edit-panel")).not.toBeNull();
	expect($(el, "#edit-panel .panel-sub")?.textContent?.trim()).toBe(
		"Cuisine · 1 restaurant",
	);
});

test("phone: opening a value focuses the sheet's heading", async () => {
	setWidth(390);
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	await settle(el);
	const sheet = $<AppSheet>(el, "app-sheet.form-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("thai");
	expect(sheet.getAttribute("subheading")).toBe("Cuisine · 1 restaurant");
	expect(sheet.shadowRoot!.activeElement?.id).toBe("sheet-title");
});

test("phone: Edit group and add open their forms in the sheet", async () => {
	setWidth(390);
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await openGroup(el, "g1");
	const sheet = $<AppSheet>(el, "app-sheet.form-sheet")!;
	expect(sheet.getAttribute("heading")).toBe("Price");
	expect(sheet.getAttribute("subheading")).toBe(
		"Custom group · 0 values · 0 restaurants",
	);
	sheet.shadowRoot!.querySelector("dialog")!.close();
	await settle(el);
	expect(sheet.hasAttribute("open")).toBe(false);
	await clickOn(el, $(el, ".pinned button.add"));
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("New group");
	expect(groupForm(el)?.groupId).toBeUndefined();
});

test("phone: deleting the selected value closes its sheet and focuses the picked pill", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	let form = await openValue(el, "cuisine", "thai");
	await clickOn(el, inForm(form, '[data-action="delete"]'));
	form = valueForm(el)!;
	await clickOn(el, inForm(form, '[data-action="confirm-delete"]'));
	await settle(el);
	expect($(el, "app-sheet.form-sheet")?.hasAttribute("open")).toBe(false);
	expect(focused(el)).toBe(pillFor(el, "cuisine"));
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

test("phone: deleting a value while its sheet's close event is still in flight still lands focus on the picked pill", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai", "lao"] } });
	setWidth(390);
	const el = await mount();
	await withAsyncDialogClose(async () => {
		let form = await openValue(el, "cuisine", "thai");
		await clickOn(el, inForm(form, '[data-action="delete"]'));
		form = valueForm(el)!;
		await clickOn(el, inForm(form, '[data-action="confirm-delete"]'));
		await settle(el);
		expect($(el, "app-sheet.form-sheet")?.hasAttribute("open")).toBe(false);
		expect(focused(el)).toBe(pillFor(el, "cuisine"));
	});
});

test("narrow to wide with a value's sheet open moves focus into the panel", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	setWidth(1024);
	await settle(el);
	const form = valueForm(el)!;
	expect(form.closest("section#edit-panel")).not.toBeNull();
	expect(focused(el)).toBe(inForm(form, "#name"));
});

test("wide to narrow with a value selected returns focus to its row, not body, when the sheet closes", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	setWidth(390);
	await settle(el);
	const sheet = $(el, "app-sheet.form-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	sheet.shadowRoot!.querySelector("dialog")!.close();
	await settle(el);
	expect(focused(el)).toBe(rowButton(el, "cuisine", "thai"));
});

test("small to large with a form open keeps its typed name", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(900);
	const el = await mount();
	const form = await openValue(el, "cuisine", "thai");
	await typeIn(el, inForm(form, "#name"), "x");
	setWidth(1024);
	await settle(el);
	expect($(el, ".layout")?.getAttribute("data-stage")).toBe("large");
	expect(inForm<HTMLInputElement>(valueForm(el)!, "#name").value).toBe("x");
});

test("small to large and back keeps focus on the picker's picked group, not body", async () => {
	setWidth(900);
	const el = await mount();
	pillFor(el, "cuisine").focus();
	expect(focused(el)).toBe(pillFor(el, "cuisine"));

	setWidth(1024);
	await settle(el);
	expect($(el, ".layout")?.getAttribute("data-stage")).toBe("large");
	expect(focused(el)).toBe(pillFor(el, "cuisine"));

	setWidth(900);
	await settle(el);
	expect($(el, ".layout")?.getAttribute("data-stage")).toBe("small");
	expect(focused(el)).toBe(pillFor(el, "cuisine"));
});

test("phone to wide and back keeps a group form's typed name", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	setWidth(390);
	const el = await mount();
	const form = await openGroup(el, "g1");
	await typeIn(el, inForm(form, "#name"), "Cost");
	setWidth(1024);
	await settle(el);
	expect(inForm<HTMLInputElement>(groupForm(el)!, "#name").value).toBe("Cost");
	setWidth(390);
	await settle(el);
	expect(inForm<HTMLInputElement>(groupForm(el)!, "#name").value).toBe("Cost");
});

// Other tabs

test("follows restaurant and group changes from elsewhere", async () => {
	const el = await mount();
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({ ...base, name: "A", groups: { g1: ["cheap"] } });
	await el.updateComplete;
	expect(pickerIds(el)).toContain("g1");
	await pick(el, "g1");
	expect(rowFor(el, "g1", "cheap")).not.toBeUndefined();
});

test("another tab removing the selected value closes the form", async () => {
	const [item] = addRestaurant({
		...base,
		name: "A",
		groups: { cuisine: ["thai"] },
	});
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	updateRestaurant(item!.id, { ...base, name: "A", groups: {} });
	await el.updateComplete;
	expect(valueForm(el)).toBeNull();
	expect($(el, "#edit-panel")).toBeNull();
});

test("another tab deleting the open group closes its form and picks Cuisine", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await openGroup(el, "g1");
	saveGroups([]);
	await el.updateComplete;
	expect(groupForm(el)).toBeNull();
	expect(pressed(el)).toBe("cuisine");
});

// Kept as is

test("with no restaurants, links to the restaurants page and still allows adding groups", async () => {
	const el = await mount();
	expect($(el, ".empty a.button-link")?.getAttribute("href")).toBe(
		"./restaurants",
	);
	await clickAdd(el);
	const form = groupForm(el)!;
	await typeIn(el, inForm(form, "#name"), "Vibe");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	expect(loadGroups().map((def) => def.name)).toEqual(["Vibe"]);
});

test("renders in Thai", async () => {
	setLang("th");
	const el = await mount();
	expect(
		[...picker(el)!.shadowRoot!.querySelectorAll("[data-group] b")].map((b) =>
			b.textContent?.trim(),
		),
	).toEqual(["ประเภท", "สัญชาติอาหาร", "ย่าน", "แท็ก"]);
	expect($(el, "p.count")?.textContent?.trim()).toBe("0 ค่า · 0 ร้าน");
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

test("the page has a back link to Settings and a large title", async () => {
	const el = await mount();
	const back = $<HTMLAnchorElement>(el, "a.back")!;
	expect(back.getAttribute("href")).toBe("./settings");
	expect(back.textContent?.trim()).toBe("Settings");
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Tags");
	expect($(el, '[data-action="search"]')?.getAttribute("aria-label")).toBe(
		"Search tags",
	);
	expect($(el, "button.add")?.getAttribute("aria-label")).toBe("New group");
});

test("base prefixes the back link and the restaurants link", async () => {
	const el = await mount();
	el.base = "../";
	await el.updateComplete;
	expect($(el, "a.back")?.getAttribute("href")).toBe("../settings");
	expect($(el, ".empty a.button-link")?.getAttribute("href")).toBe(
		"../restaurants",
	);
});

test("editing a plain tag renames it in the restaurants page filter too", async () => {
	addRestaurant({ ...base, name: "A", tags: ["spicey"] });
	localStorage.setItem(
		LIST_FILTER_KEY,
		JSON.stringify({ tags: { include: ["spicey"], exclude: [] } }),
	);
	const el = await mount();
	const form = await openValue(el, "tags", "spicey");
	await typeIn(el, inForm(form, "#name"), "spicy");
	await clickOn(el, inForm(form, '[data-action="save"]'));
	await settle(el);
	expect(JSON.parse(localStorage.getItem(LIST_FILTER_KEY)!)).toEqual({
		tags: { include: ["spicy"], exclude: [] },
	});
});

test("moving a value into plain tags keeps it in the restaurants page filter only", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const filter = JSON.stringify({ area: { include: [], exclude: ["siam"] } });
	localStorage.setItem(FILTER_KEY, filter);
	localStorage.setItem(LIST_FILTER_KEY, filter);
	const el = await mount();
	const form = await openValue(el, "area", "siam");
	const select = inForm<HTMLSelectElement>(form, "select");
	select.value = "tags";
	select.dispatchEvent(new Event("change"));
	await el.updateComplete;
	await clickOn(el, inForm(valueForm(el)!, '[data-action="save"]'));
	await settle(el);
	expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({});
	expect(JSON.parse(localStorage.getItem(LIST_FILTER_KEY)!)).toEqual({
		tags: { include: [], exclude: ["siam"] },
	});
});

test("deleting a value or a group drops it from the restaurants page filter too", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...base,
		name: "A",
		groups: { g1: ["cheap"], area: ["ari"] },
	});
	localStorage.setItem(
		LIST_FILTER_KEY,
		JSON.stringify({
			g1: { include: ["cheap"], exclude: [] },
			area: { include: ["ari"], exclude: [] },
		}),
	);
	const el = await mount();
	const form = await openValue(el, "area", "ari");
	await clickOn(el, inForm(form, '[data-action="delete"]'));
	await clickOn(el, inForm(valueForm(el)!, '[data-action="confirm-delete"]'));
	await settle(el);
	const group = await openGroup(el, "g1");
	await clickOn(el, inForm(group, '[data-action="delete"]'));
	await clickOn(el, inForm(groupForm(el)!, '[data-action="confirm-delete"]'));
	await settle(el);
	expect(JSON.parse(localStorage.getItem(LIST_FILTER_KEY)!)).toEqual({});
});
