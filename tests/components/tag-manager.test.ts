import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-manager";
import type { TagManager } from "#components/tag-manager";
import { FILTER_KEY } from "#lib/filter";
import { loadGroups, saveGroups } from "#lib/groups";
import { setLang } from "#lib/i18n";
import { addRestaurant, loadRestaurants } from "#lib/store";

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
	$<HTMLElement>(el, `section.group[data-group="${group}"]`)!;
const click = async (el: TagManager, root: ParentNode, action: string) => {
	root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
	await el.updateComplete;
};
const cardTitles = (el: TagManager) =>
	[...el.shadowRoot!.querySelectorAll("section.group h2")].map((h) =>
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
		"Its values on 1 restaurants become plain tags.",
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
