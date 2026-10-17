import { afterEach, beforeEach, expect, test } from "bun:test";
import { AppSheet } from "#components/app-sheet";
import "#components/restaurant-manager";
import { RestaurantManager } from "#components/restaurant-manager";
import type { TagInput } from "#components/tag-input";
import { saveGroups } from "#lib/groups";
import { setLang } from "#lib/i18n";
import {
	addRestaurant,
	loadRestaurants,
	removeRestaurant,
	saveRestaurants,
	updateRestaurant,
} from "#lib/store";
import { uiStyles } from "#styles/ui";

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const blank = { tags: [], location: "", notes: "" };

const mount = async () => {
	const el = document.createElement("restaurant-manager");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

/** Mount (wide) and open the add form in the side panel. */
const mountForm = async () => {
	const el = await mount();
	el.shadowRoot!.querySelector<HTMLButtonElement>(".head button.add")!.click();
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: RestaurantManager, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const type = (el: RestaurantManager, selector: string, value: string): void => {
	const input = $<HTMLInputElement | HTMLTextAreaElement>(el, selector)!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};

const groupInput = (el: RestaurantManager, group: string) =>
	$<TagInput>(el, `tag-input[data-group="${group}"]`)!;
const tagInput = (el: RestaurantManager) => groupInput(el, "tags");

const typeInto = async (
	el: RestaurantManager,
	group: string,
	text: string,
): Promise<void> => {
	const field = groupInput(el, group);
	const box = field.shadowRoot!.querySelector<HTMLInputElement>("input")!;
	box.value = text;
	box.dispatchEvent(new Event("input"));
	await field.updateComplete;
	await el.updateComplete;
};
const typeTags = (el: RestaurantManager, text: string) =>
	typeInto(el, "tags", text);

const tagChips = (el: RestaurantManager) =>
	[...tagInput(el).shadowRoot!.querySelectorAll(".chip-text")].map(
		(c) => c.textContent,
	);

const submit = async (el: RestaurantManager): Promise<void> => {
	$<HTMLFormElement>(el, "form")!.dispatchEvent(
		new Event("submit", { bubbles: true, cancelable: true }),
	);
	await el.updateComplete;
};

const rowNames = (el: RestaurantManager) =>
	[...el.shadowRoot!.querySelectorAll("li[data-id] .name")].map(
		(n) => n.textContent,
	);

const click = async (
	el: RestaurantManager,
	selector: string,
): Promise<void> => {
	$<HTMLButtonElement>(el, selector)!.click();
	await el.updateComplete;
};

test("the heading links to the tags page", async () => {
	const el = await mount();
	const link = $<HTMLAnchorElement>(el, "a.tags-link");
	expect(link?.getAttribute("href")).toBe("./tags");
	expect(link?.textContent?.trim()).toBe("Tags");
	expect(link?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
	setLang("th");
	await el.updateComplete;
	expect($<HTMLAnchorElement>(el, "a.tags-link")?.textContent?.trim()).toBe(
		"แท็ก",
	);
});

test("shows the empty message with no restaurants", async () => {
	const el = await mount();
	expect($(el, ".empty p")?.textContent?.trim()).toBe(
		"No restaurants yet. Add your first one.",
	);
	expect($(el, ".empty")?.classList.contains("card")).toBe(true);
});

test("a blank name shows an error and saves nothing", async () => {
	const el = await mountForm();
	type(el, "#name", "   ");
	await submit(el);
	expect($(el, "#name-error")?.textContent?.trim()).toBe("Name is required.");
	expect($(el, "#name")?.getAttribute("aria-invalid")).toBe("true");
	expect(loadRestaurants()).toEqual([]);
});

test("a name already in the list saves another restaurant", async () => {
	addRestaurant({ name: "Jay Fai", tags: [], location: "", notes: "" });
	const el = await mountForm();
	type(el, "#name", "Jay Fai");
	await submit(el);
	expect($(el, "#name-error")).toBeNull();
	expect(loadRestaurants().map((item) => item.name)).toEqual([
		"Jay Fai",
		"Jay Fai",
	]);
});

test("editing can take another restaurant's name", async () => {
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
	addRestaurant({ name: "B", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "B");
	await submit(el);
	expect($(el, "#name-error")).toBeNull();
	expect(loadRestaurants()).toMatchObject([{ name: "B" }, { name: "B" }]);
});

test("typing in the name clears the error", async () => {
	const el = await mountForm();
	await submit(el);
	type(el, "#name", "x");
	await el.updateComplete;
	expect($(el, "#name-error")).toBeNull();
});

test("adds a restaurant with cleaned tags and resets the form", async () => {
	const el = await mountForm();
	type(el, "#name", " Jay Fai ");
	await typeTags(el, " Thai, ,noodle ,thai,");
	type(el, "#location", "Bangkok");
	type(el, "#notes", "Queue early");
	await submit(el);
	expect(loadRestaurants()).toMatchObject([
		{
			name: "Jay Fai",
			tags: ["thai", "noodle"],
			location: "Bangkok",
			notes: "Queue early",
		},
	]);
	expect(rowNames(el)).toEqual(["Jay Fai"]);
	await click(el, ".head button.add");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual([]);
});

test("a tag typed but not confirmed is saved on submit", async () => {
	const el = await mountForm();
	type(el, "#name", "Jay Fai");
	await typeTags(el, "Spicy");
	await submit(el);
	expect(loadRestaurants()[0]?.tags).toEqual(["spicy"]);
});

test("a blank name keeps a typed tag as a chip instead of losing it", async () => {
	const el = await mountForm();
	await typeTags(el, "spicy");
	await submit(el);
	expect(loadRestaurants()).toEqual([]);
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual(["spicy"]);
});

test("suggests existing tags, most used first", async () => {
	addRestaurant({
		name: "A",
		tags: ["thai", "noodle"],
		location: "",
		notes: "",
	});
	addRestaurant({ name: "B", tags: ["noodle"], location: "", notes: "" });
	const el = await mountForm();
	expect(tagInput(el).suggestions).toEqual(["noodle", "thai"]);
	expect(tagInput(el).label).toBe("Tags");
	expect(tagInput(el).hint).toBe(
		"Press Enter or comma to add, e.g. thai, noodle",
	);
});

test("lists restaurants sorted by name", async () => {
	addRestaurant({ name: "Zab", tags: [], location: "", notes: "" });
	addRestaurant({ name: "Ant", tags: [], location: "", notes: "" });
	const el = await mount();
	expect(rowNames(el)).toEqual(["Ant", "Zab"]);
});

test("rows show the name and type line only; location and notes stay in the form", async () => {
	addRestaurant({
		name: "Sneaky",
		tags: ["x"],
		location: "javascript:alert(1)",
		notes: "secret",
		kinds: ["food"],
	});
	const el = await mount();
	const row = $(el, "li[data-id]")!;
	expect(row.querySelector(".name")?.textContent?.trim()).toBe("Sneaky");
	expect(row.querySelector(".meta")?.textContent?.trim()).toBe("Food");
	expect(row.querySelector("a")).toBeNull();
	expect(row.textContent).not.toContain("javascript:alert(1)");
	expect(row.textContent).not.toContain("secret");
	await click(el, 'li[data-id] button[data-action="edit"]');
	expect($<HTMLInputElement>(el, "#location")?.value).toBe(
		"javascript:alert(1)",
	);
});

test("edit fills the form and save updates the restaurant", async () => {
	addRestaurant({
		name: "Old",
		tags: ["a", "b"],
		location: "Here",
		notes: "n",
	});
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Old");
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual(["a", "b"]);
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Save");
	type(el, "#name", "New");
	await submit(el);
	expect(loadRestaurants()).toMatchObject([
		{ name: "New", tags: ["a", "b"], location: "Here", notes: "n" },
	]);
	expect(loadRestaurants()).toHaveLength(1);
	await click(el, ".head button.add");
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
});

const kindBox = (el: RestaurantManager, kind: string) =>
	$<HTMLInputElement>(el, `input[name="kinds"][value="${kind}"]`)!;

const toggleKind = async (
	el: RestaurantManager,
	kind: string,
): Promise<void> => {
	kindBox(el, kind).click();
	await el.updateComplete;
};

test("type boxes are labelled and a second click unticks", async () => {
	const el = await mountForm();
	expect($(el, "fieldset.kinds legend")?.textContent?.trim()).toBe("Type");
	expect(
		[...el.shadowRoot!.querySelectorAll("fieldset.kinds label")].map((l) =>
			l.textContent?.trim(),
		),
	).toEqual(["Food", "Drinks", "Dessert"]);
	type(el, "#name", "Shop");
	await toggleKind(el, "food");
	await toggleKind(el, "food");
	await submit(el);
	expect(loadRestaurants()[0]?.kinds).toEqual([]);
});

test("adds a restaurant with several cuisines and areas, committing text left in each box", async () => {
	const el = await mountForm();
	type(el, "#name", "Cafe");
	await typeInto(el, "cuisine", "Thai, Japanese");
	await typeInto(el, "area", "Siam");
	await submit(el);
	expect(loadRestaurants()[0]?.groups).toEqual({
		cuisine: ["thai", "japanese"],
		area: ["siam"],
	});
});

test("each custom group gets its own input, in stored order, before plain tags", async () => {
	saveGroups([
		{ id: "g2", name: "Vibe" },
		{ id: "g1", name: "Price" },
	]);
	const el = await mountForm();
	const groups = [...el.shadowRoot!.querySelectorAll("tag-input")].map(
		(input) => [input.getAttribute("data-group"), input.label],
	);
	expect(groups).toEqual([
		["cuisine", "Cuisine"],
		["area", "Area"],
		["g2", "Vibe"],
		["g1", "Price"],
		["tags", "Tags"],
	]);
});

test("saves custom group values", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mountForm();
	type(el, "#name", "Cafe");
	await typeInto(el, "g1", "cheap");
	await typeTags(el, "spicy");
	await submit(el);
	expect(loadRestaurants()[0]).toMatchObject({
		groups: { g1: ["cheap"] },
		tags: ["spicy"],
	});
});

test("suggests each group's values, most used first", async () => {
	addRestaurant({
		...blank,
		name: "A",
		groups: { cuisine: ["thai"], area: ["siam"] },
	});
	addRestaurant({
		...blank,
		name: "B",
		groups: { cuisine: ["thai", "lao"], area: ["ari"] },
	});
	const el = await mountForm();
	expect(groupInput(el, "cuisine").suggestions).toEqual(["thai", "lao"]);
	expect(groupInput(el, "area").suggestions).toEqual(["ari", "siam"]);
});

test("edit fills type and every group", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	addRestaurant({
		...blank,
		name: "A",
		kinds: ["food"],
		groups: { cuisine: ["thai"], g1: ["cheap"] },
	});
	const el = await mount();
	await click(el, '[data-action="edit"]');
	expect(groupInput(el, "cuisine").value).toEqual(["thai"]);
	expect(groupInput(el, "g1").value).toEqual(["cheap"]);
	expect(groupInput(el, "area").value).toEqual([]);
});

test("a group added in another tab shows up in the open form", async () => {
	const el = await mountForm();
	saveGroups([{ id: "g1", name: "Price" }]);
	await el.updateComplete;
	expect(groupInput(el, "g1")).not.toBeNull();
});

test("a group renamed in another tab relabels its input and keeps the values typed so far", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mountForm();
	await typeInto(el, "g1", "cheap,");
	saveGroups([{ id: "g1", name: "Cost" }]);
	await el.updateComplete;
	expect(groupInput(el, "g1").label).toBe("Cost");
	expect(groupInput(el, "g1").value).toEqual(["cheap"]);
});

test("a custom group deleted in another tab before submit moves its typed values into tags", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mountForm();
	type(el, "#name", "Cafe");
	await typeInto(el, "g1", "cheap,");
	// Another tab deletes the group while this form is still open.
	saveGroups([]);
	await el.updateComplete;
	await submit(el);
	const saved = loadRestaurants()[0];
	expect(saved?.tags).toContain("cheap");
	expect(saved?.groups["g1"]).toBeUndefined();
});

test("text typed in a group's box stays with that group when another tab reorders the groups", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
	]);
	const el = await mountForm();
	type(el, "#name", "Cafe");
	await typeInto(el, "g1", "cheap");
	saveGroups([
		{ id: "g2", name: "Vibe" },
		{ id: "g1", name: "Price" },
	]);
	await el.updateComplete;
	await submit(el);
	const saved = loadRestaurants()[0];
	expect(saved?.groups["g1"]).toEqual(["cheap"]);
	expect(saved?.groups["g2"]).toBeUndefined();
});

test("a group whose id names an Object member gets the plain hint and no values", async () => {
	saveGroups([{ id: "constructor", name: "Odd" }]);
	const el = await mountForm();
	expect(groupInput(el, "constructor").hint).toBe(
		"Press Enter or comma to add",
	);
	expect(groupInput(el, "constructor").value).toEqual([]);
});

test("type and group labels render in Thai", async () => {
	const el = await mountForm();
	setLang("th");
	await el.updateComplete;
	expect($(el, "fieldset.kinds legend")?.textContent?.trim()).toBe("ประเภท");
	expect(groupInput(el, "cuisine").label).toBe("สัญชาติอาหาร");
	expect(groupInput(el, "area").label).toBe("ย่าน");
});

test("cancel edit resets the form without saving", async () => {
	addRestaurant({ name: "Keep", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	type(el, "#name", "Changed");
	await typeTags(el, "half");
	await click(el, 'button[data-action="cancel-edit"]');
	await click(el, ".head button.add");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	await tagInput(el).updateComplete;
	expect(
		tagInput(el).shadowRoot!.querySelector<HTMLInputElement>("input")?.value,
	).toBe("");
	expect(tagChips(el)).toEqual([]);
	expect(loadRestaurants()[0]?.name).toBe("Keep");
});

test("delete needs confirmation", async () => {
	addRestaurant({ name: "Bye", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	expect(loadRestaurants()).toHaveLength(1);
	await click(el, 'button[data-action="cancel-delete"]');
	expect($(el, 'button[data-action="confirm-delete"]')).toBeNull();
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect(loadRestaurants()).toEqual([]);
	expect($(el, ".empty")).not.toBeNull();
});

test("an edit saved elsewhere reloads the open form instead of being overwritten", async () => {
	const [item] = addRestaurant({
		name: "Mine",
		tags: [],
		location: "",
		notes: "",
	});
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	// Another tab saves a newer version of the same restaurant.
	updateRestaurant(
		item!.id,
		{ name: "Theirs", tags: ["new"], location: "", notes: "" },
		new Date(Date.now() + 1000),
	);
	await el.updateComplete;
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Theirs");
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual(["new"]);
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Save");
});

test("deleting the restaurant being edited resets the form", async () => {
	addRestaurant({ name: "Editing", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	await click(el, ".head button.add");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
	type(el, "#name", "Fresh");
	await submit(el);
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Fresh"]);
});

test("re-renders labels in Thai", async () => {
	const el = await mountForm();
	setLang("th");
	await el.updateComplete;
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("เพิ่ม");
});

test("delete moves focus to the confirm button, cancel moves it back", async () => {
	addRestaurant({ name: "Bye", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"confirm-delete",
	);
	await click(el, 'button[data-action="cancel-delete"]');
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"delete",
	);
});

test("warns when the browser refuses to save", async () => {
	const el = await mount();
	expect($(el, ".warning")).toBeNull();
	const real = globalThis.localStorage;
	const full = {
		getItem: () => null,
		setItem: () => {
			throw new Error("QuotaExceededError");
		},
	};
	Object.defineProperty(globalThis, "localStorage", {
		value: full,
		configurable: true,
	});
	try {
		addRestaurant({ name: "Lost", tags: [], location: "", notes: "" });
		await el.updateComplete;
		expect($(el, ".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		saveRestaurants([]);
	}
});

test("starting an edit drops text left in the tag box", async () => {
	addRestaurant({ name: "A", tags: ["x"], location: "", notes: "" });
	addRestaurant({ name: "B", tags: ["y"], location: "", notes: "" });
	const el = await mountForm();
	await typeTags(el, "spi");
	const editB = [...el.shadowRoot!.querySelectorAll("li[data-id]")]
		.find((row) => row.querySelector(".name")?.textContent === "B")!
		.querySelector<HTMLButtonElement>('[data-action="edit"]')!;
	editB.click();
	await el.updateComplete;
	await submit(el);
	expect(loadRestaurants().find((r) => r.name === "B")?.tags).toEqual(["y"]);
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

test("the form asks for name, type, groups, location, then tags and notes", async () => {
	const el = await mountForm();
	const order = [
		...el.shadowRoot!.querySelectorAll(
			"#name, fieldset.kinds, tag-input, #location, #notes",
		),
	].map(
		(node) =>
			(node instanceof HTMLElement && node.getAttribute("data-group")) ||
			node.id ||
			node.className,
	);
	expect(order).toEqual([
		"name",
		"kinds",
		"cuisine",
		"area",
		"location",
		"tags",
		"notes",
	]);
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

test("the title shows the count, with the Tags link beside it", async () => {
	addRestaurant({ ...blank, name: "A" });
	addRestaurant({ ...blank, name: "B" });
	const el = await mount();
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Restaurants");
	expect($(el, ".head .count")?.textContent?.trim()).toBe("2 restaurants");
	expect($(el, ".head a.tags-link")).not.toBeNull();
});

test("rows are buttons named for editing, in a grouped list", async () => {
	addRestaurant({ ...blank, name: "Jay Fai" });
	const el = await mount();
	const row = $<HTMLButtonElement>(el, "ul.group li[data-id] button.item.row")!;
	expect(row.getAttribute("data-action")).toBe("edit");
	expect(row.getAttribute("aria-label")).toBe("Edit Jay Fai");
	expect(row.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("the row's type line is linked for screen readers via aria-describedby", async () => {
	addRestaurant({ ...blank, name: "Sneaky", kinds: ["food"] });
	const el = await mount();
	const row = $<HTMLButtonElement>(el, "li[data-id] button.item.row")!;
	const describedBy = row.getAttribute("aria-describedby");
	expect(describedBy).not.toBeNull();
	const meta = $(el, `#${describedBy}`);
	expect(meta?.textContent?.trim()).toBe("Food");
});

test("a row with no type line has no aria-describedby", async () => {
	addRestaurant({ ...blank, name: "Plain" });
	const el = await mount();
	const row = $<HTMLButtonElement>(el, "li[data-id] button.item.row")!;
	expect(row.getAttribute("aria-describedby")).toBeNull();
});

test("the selected row shows an outline in forced-colours", () => {
	const css = ownStyles();
	const forced = css.indexOf("@media (forced-colors: active)");
	expect(forced).toBeGreaterThan(-1);
	const forcedBlock = css.slice(forced);
	expect(forcedBlock).toMatch(
		/\.list \.row\[aria-current="true"\]\s*\{[^}]*outline:\s*2px solid CanvasText/,
	);
	expect(forcedBlock).toMatch(
		/\.list \.row\[aria-current="true"\]\s*\{[^}]*outline-offset:\s*-2px/,
	);
});

test("wide: the form sits in a side panel titled for editing, then for adding", async () => {
	addRestaurant({ ...blank, name: "Jay Fai" });
	const el = await mount();
	expect($(el, "app-sheet")).toBeNull();
	expect($(el, ".pinned")).toBeNull();
	expect($(el, ".head button.add")).not.toBeNull();
	await click(el, 'button[data-action="edit"]');
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Edit Jay Fai");
	expect(
		$(el, 'button[data-action="edit"]')?.getAttribute("aria-current"),
	).toBe("true");
	await click(el, ".head button.add");
	expect($(el, "#form-title")?.textContent?.trim()).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.id).toBe("name");
});

test("Delete is only in the edit form, never in rows or the add form", async () => {
	addRestaurant({ ...blank, name: "A" });
	const el = await mount();
	expect($(el, 'li[data-id] [data-action="delete"]')).toBeNull();
	expect($(el, 'form [data-action="delete"]')).toBeNull();
	await click(el, 'button[data-action="edit"]');
	expect($(el, 'form [data-action="delete"]')).not.toBeNull();
	expect($(el, 'li[data-id] [data-action="delete"]')).toBeNull();
});

test("the delete prompt names the restaurant", async () => {
	addRestaurant({ ...blank, name: "Bye" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	expect($(el, ".delete-prompt")?.textContent?.trim()).toBe(
		"Delete Bye? This cannot be undone.",
	);
});

test("saving and deleting are confirmed in the status line", async () => {
	const el = await mountForm();
	type(el, "#name", "Fresh");
	await submit(el);
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved Fresh",
	);
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Deleted Fresh",
	);
});

test("saving the same name twice re-announces the status instead of leaving it unchanged", async () => {
	const el = await mountForm();
	type(el, "#name", "Fresh");
	await submit(el);
	const status = () => $(el, 'p.status[role="status"]')?.textContent?.trim();
	expect(status()).toBe("Saved Fresh");
	await click(el, 'button[data-action="edit"]');
	// Resubmit with the name unchanged: the message is the same string as before.
	$<HTMLFormElement>(el, "form")!.dispatchEvent(
		new Event("submit", { bubbles: true, cancelable: true }),
	);
	await el.updateComplete;
	expect(status()).toBe("");
	await el.updateComplete;
	expect(status()).toBe("Saved Fresh");
});

test("starting an edit clears an old status", async () => {
	addRestaurant({ ...blank, name: "Other" });
	const el = await mountForm();
	type(el, "#name", "Fresh");
	await submit(el);
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved Fresh",
	);
	await click(el, 'button[data-action="edit"]');
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe("");
});

test("phone: Add is pinned and opens the form in a sheet", async () => {
	const el = await phone();
	expect($(el, "section.edit-panel")).toBeNull();
	const add = $<HTMLButtonElement>(
		el,
		'.pinned button.add[data-action="add"]',
	)!;
	const sheet = $(el, "app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(sheet.querySelector("form#restaurant-form")).not.toBeNull();
	add.click();
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("New restaurant");
});

test("phone: tapping a row opens its edit sheet; saving closes it", async () => {
	addRestaurant({ ...blank, name: "Old" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	const sheet = $(el, "app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Edit Old");
	type(el, "#name", "New");
	await submit(el);
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(loadRestaurants()[0]?.name).toBe("New");
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved New",
	);
});

const settleFocus = async (el: RestaurantManager) => {
	await el.updateComplete;
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};

test("phone: opening Add or a row focuses the sheet's heading, not the name field", async () => {
	addRestaurant({ ...blank, name: "Old" });
	const el = await phone();
	const sheet = $<AppSheet>(el, "app-sheet")!;
	await click(el, '.pinned button[data-action="add"]');
	await settleFocus(el);
	expect(sheet.shadowRoot!.activeElement?.id).toBe("sheet-title");
	sheet.open = false;
	await settleFocus(el);
	await click(el, 'li[data-id] button[data-action="edit"]');
	await settleFocus(el);
	expect(sheet.shadowRoot!.activeElement?.id).toBe("sheet-title");
});

test("wide: opening a row focuses the name field in the side panel", async () => {
	addRestaurant({ ...blank, name: "Old" });
	const el = await mount();
	await click(el, 'li[data-id] button[data-action="edit"]');
	await settleFocus(el);
	expect(el.shadowRoot!.activeElement?.id).toBe("name");
});

test("phone: while the closed sheet slides away it still shows what it showed, then drops it", async () => {
	addRestaurant({ ...blank, name: "Old" });
	const el = await phone();
	const sheet = $<AppSheet>(el, "app-sheet")!;
	sheet.style.setProperty("--duration", "30ms");
	await click(el, 'li[data-id] button[data-action="edit"]');
	sheet.open = false;
	await settleFocus(el);
	expect(sheet.hasAttribute("open")).toBe(false);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Old");
	expect($(el, '[data-action="delete"]')).not.toBeNull();
	await new Promise((resolve) => setTimeout(resolve, 60));
	await el.updateComplete;
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect($(el, '[data-action="delete"]')).toBeNull();
});

test("phone: closing the sheet discards the edit", async () => {
	addRestaurant({ ...blank, name: "Keep" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "Changed");
	const sheet = $(el, "app-sheet")!;
	sheet.shadowRoot!.querySelector("dialog")!.close();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect(loadRestaurants()[0]?.name).toBe("Keep");
});

test("phone: deleting from the sheet closes it", async () => {
	addRestaurant({ ...blank, name: "Bye" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect(loadRestaurants()).toEqual([]);
	expect($(el, "app-sheet")!.hasAttribute("open")).toBe(false);
});

test("phone: another tab deleting the restaurant being edited closes the sheet", async () => {
	const [item] = addRestaurant({ ...blank, name: "Gone" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	removeRestaurant(item!.id);
	await el.updateComplete;
	expect($(el, "app-sheet")!.hasAttribute("open")).toBe(false);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
});

test("rotating to wide keeps the edit in the panel", async () => {
	addRestaurant({ ...blank, name: "Mine" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "Mine 2");
	setWidth(1024);
	await el.updateComplete;
	expect($(el, "app-sheet")).toBeNull();
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Edit Mine");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Mine 2");
});

test("narrowing the window mid-edit moves the edit into the sheet instead of dropping it", async () => {
	addRestaurant({ ...blank, name: "Mine" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	type(el, "#name", "Mine 2");
	setWidth(390);
	await el.updateComplete;
	const sheet = $(el, "app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Edit Mine");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Mine 2");
});

test("narrowing the window with a blank add form still open opens the sheet for it", async () => {
	const el = await mountForm();
	type(el, "#name", "New place");
	setWidth(390);
	await el.updateComplete;
	const sheet = $(el, "app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("New place");
});

test("narrowing the window with no edit in progress leaves the sheet closed", async () => {
	addRestaurant({ ...blank, name: "Mine" });
	const el = await mount();
	setWidth(390);
	await el.updateComplete;
	expect($(el, "app-sheet")!.hasAttribute("open")).toBe(false);
});

// The shared uiStyles entry has its own unrelated `:host` rule; skip it so the regexes below
// only ever see this component's own styles.
const ownStyles = (): string =>
	(RestaurantManager.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("phone: cuisine and area stack in one column and may shrink; side by side only from 48rem", () => {
	const css = ownStyles();
	expect(css).toMatch(
		/\.pair\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
	);
	expect(css).toMatch(/\.pair\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
	const wide = css.slice(css.indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(
		/\.pair\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\),\s*1fr\)\)/,
	);
});

test("phone: the sticky Save row covers the sheet's bottom padding, so no form content peeks out below it", () => {
	const sheetCss = (AppSheet.styles as unknown[])
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	// The offset below must match the sheet body's bottom padding.
	expect(sheetCss).toMatch(/\.body\s*\{[^}]*padding:\s*0\.25rem 1\.25rem 1rem/);
	const row =
		ownStyles().match(/\.actions\.form-actions\s*\{([^}]*)\}/)?.[1] ?? "";
	expect(row).toContain("bottom: -1rem");
	expect(row).toContain("padding: 0.75rem 0 1.75rem");
});

test("phone: the component fills the space above the tab bar so the pinned Add ends the column, even on a short list", () => {
	const css = ownStyles();
	expect(css).toMatch(
		/:host\s*\{[^}]*min-height:\s*calc\(100dvh - 1\.25rem - var\(--tab-bar-height\)\)/,
	);
	expect(css).toMatch(
		/:host\s*\{[^}]*margin-bottom:\s*calc\(var\(--tab-bar-height\) - var\(--tab-bar-space\)\)/,
	);
	expect(css).toMatch(/\.pinned\s*\{[^}]*margin-top:\s*auto/);
	const wideIndex = css.indexOf("@media (min-width: 48rem)");
	expect(wideIndex).toBeGreaterThan(-1);
	const wideBlock = css.slice(wideIndex);
	expect(wideBlock).toMatch(/:host\s*\{[^}]*min-height:\s*0/);
	expect(wideBlock).toMatch(/:host\s*\{[^}]*margin-bottom:\s*0/);
});

test("the form's Save/Cancel row has the form-actions class", async () => {
	const el = await mountForm();
	expect($(el, "form .actions.form-actions")).not.toBeNull();
});

test("phone: Save stays reachable at the bottom of the scrolling sheet", () => {
	const css = ownStyles();
	expect(css).toMatch(/\.actions\.form-actions\s*\{[^}]*position:\s*sticky/);
	expect(css).toMatch(/\.actions\.form-actions\s*\{[^}]*bottom:\s*-1rem/);
	expect(css).toMatch(
		/\.actions\.form-actions\s*\{[^}]*background:\s*var\(--color-bg\)/,
	);
	const wideIndex = css.indexOf("@media (min-width: 48rem)");
	expect(wideIndex).toBeGreaterThan(-1);
	const wideBlock = css.slice(wideIndex);
	expect(wideBlock).toMatch(
		/\.actions\.form-actions\s*\{[^}]*position:\s*static/,
	);
});

test("phone: focused fields scroll clear of the sticky save row", () => {
	const css = ownStyles();
	expect(css).toMatch(
		/form input,\s*form textarea,\s*form tag-input,\s*fieldset\.kinds label\s*\{[^}]*scroll-margin-bottom:\s*5rem/,
	);
	const wideIndex = css.indexOf("@media (min-width: 48rem)");
	expect(wideIndex).toBeGreaterThan(-1);
	const wideBlock = css.slice(wideIndex);
	expect(wideBlock).toMatch(
		/form input,\s*form textarea,\s*form tag-input,\s*fieldset\.kinds label\s*\{[^}]*scroll-margin-bottom:\s*0/,
	);
});

test("wide: the side panel starts hidden and the list takes the full width", async () => {
	addRestaurant({ ...blank, name: "A" });
	const el = await mount();
	expect($(el, "section.edit-panel")).toBeNull();
	expect($(el, "form#restaurant-form")).toBeNull();
	expect($(el, ".layout")?.classList.contains("wide")).toBe(false);
});

test("Add is an icon button labelled for screen readers", async () => {
	const el = await mount();
	const add = $<HTMLButtonElement>(el, '.head button.add[data-action="add"]')!;
	expect(add.textContent?.trim()).toBe("");
	expect(add.getAttribute("aria-label")).toBe("Add restaurant");
	expect(add.getAttribute("title")).toBe("Add restaurant");
	expect(add.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
	setLang("th");
	await el.updateComplete;
	expect(add.getAttribute("aria-label")).toBe("เพิ่มร้าน");
});

test("phone: the pinned Add is an icon button labelled for screen readers", async () => {
	const el = await phone();
	const add = $<HTMLButtonElement>(el, ".pinned button.add")!;
	expect(add.textContent?.trim()).toBe("");
	expect(add.getAttribute("aria-label")).toBe("Add restaurant");
});

test("wide: Add toggles the panel open and closed, dropping what was typed", async () => {
	addRestaurant({ ...blank, name: "A" });
	const el = await mount();
	const add = () => $<HTMLButtonElement>(el, ".head button.add")!;
	expect(add().getAttribute("aria-expanded")).toBe("false");
	await click(el, ".head button.add");
	expect($(el, "section.edit-panel #form-title")?.textContent?.trim()).toBe(
		"New restaurant",
	);
	expect($(el, ".layout")?.classList.contains("wide")).toBe(true);
	expect(add().getAttribute("aria-expanded")).toBe("true");
	expect(add().getAttribute("aria-controls")).toBe("edit-panel");
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.id).toBe("name");
	type(el, "#name", "Half typed");
	await click(el, ".head button.add");
	expect($(el, "section.edit-panel")).toBeNull();
	expect(add().getAttribute("aria-expanded")).toBe("false");
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe("add");
	await click(el, ".head button.add");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
});

test("wide: Add while editing switches the panel to a new restaurant instead of closing it", async () => {
	addRestaurant({ ...blank, name: "Jay Fai" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Edit Jay Fai");
	await click(el, ".head button.add");
	expect($(el, "#form-title")?.textContent?.trim()).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
});

test("wide: the panel's close button hides it and drops the edit", async () => {
	addRestaurant({ ...blank, name: "Keep" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	type(el, "#name", "Changed");
	const close = $<HTMLButtonElement>(
		el,
		'section.edit-panel button[data-action="close-panel"]',
	)!;
	expect(close.getAttribute("aria-label")).toBe("Close");
	await click(el, 'button[data-action="close-panel"]');
	expect($(el, "section.edit-panel")).toBeNull();
	expect(loadRestaurants()[0]?.name).toBe("Keep");
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe("add");
});

test("wide: saving, cancelling and deleting close the panel and return focus to Add", async () => {
	addRestaurant({ ...blank, name: "A" });
	const el = await mount();
	const focused = async () => {
		await el.updateComplete;
		return el.shadowRoot!.activeElement?.getAttribute("data-action");
	};

	await click(el, ".head button.add");
	type(el, "#name", "B");
	await submit(el);
	expect($(el, "section.edit-panel")).toBeNull();
	expect(await focused()).toBe("add");

	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="cancel-edit"]');
	expect($(el, "section.edit-panel")).toBeNull();
	expect(await focused()).toBe("add");

	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect($(el, "section.edit-panel")).toBeNull();
	expect(await focused()).toBe("add");
});

test("wide: a blank name keeps the panel open with its error", async () => {
	const el = await mount();
	await click(el, ".head button.add");
	await submit(el);
	expect($(el, "section.edit-panel")).not.toBeNull();
	expect($(el, "#name-error")).not.toBeNull();
});

test("wide: another tab deleting the restaurant being edited closes the panel", async () => {
	const [item] = addRestaurant({ ...blank, name: "Gone" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	removeRestaurant(item!.id);
	await el.updateComplete;
	expect($(el, "section.edit-panel")).toBeNull();
});

test("the empty list has its own Add button that opens the form", async () => {
	const el = await mount();
	const add = $<HTMLButtonElement>(el, '.empty button[data-action="add"]')!;
	expect(add.textContent?.trim()).toBe("Add restaurant");
	add.click();
	await el.updateComplete;
	expect($(el, "section.edit-panel #form-title")?.textContent?.trim()).toBe(
		"New restaurant",
	);
});

const searchInput = (el: RestaurantManager) =>
	$<HTMLInputElement>(el, "#search")!;
const openSearch = async (el: RestaurantManager) => {
	$<HTMLButtonElement>(el, '[data-action="search"]')!.click();
	await el.updateComplete;
};
const typeSearch = async (el: RestaurantManager, text: string) => {
	type(el, "#search", text);
	await el.updateComplete;
};
const seedSearch = () => {
	for (const name of [
		"Bankara Ramen",
		"Café Tartine",
		"Jay Fai",
		"Ramen Champion",
	])
		addRestaurant({ ...blank, name });
};

test("search: the header button shows only once there is a restaurant", async () => {
	const el = await mount();
	expect($(el, '[data-action="search"]')).toBeNull();
	addRestaurant({ ...blank, name: "Jay Fai" });
	await el.updateComplete;
	const button = $(el, '.head-actions [data-action="search"]')!;
	expect(button.getAttribute("aria-label")).toBe("Search restaurants");
	expect(button.nextElementSibling?.classList.contains("tags-link")).toBe(true);
});

test("search: opening focuses the field inside the tap, so iOS opens the keyboard", async () => {
	seedSearch();
	const el = await mount();
	$<HTMLButtonElement>(el, '[data-action="search"]')!.click();
	// No await: the focus must already have moved when the click handler returns.
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
	await el.updateComplete;
	// The title stays in the accessibility tree (visually hidden) while the actions go dark.
	expect($(el, ".head-actions")?.hasAttribute("hidden")).toBe(true);
	expect($(el, ".head > div")?.classList.contains("visually-hidden")).toBe(
		true,
	);
	expect($(el, ".head h1.page-title")?.textContent?.trim()).toBe("Restaurants");
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	const input = searchInput(el);
	expect(input.type).toBe("search");
	expect(input.getAttribute("aria-label")).toBe("Search restaurants");
	expect(input.placeholder).toBe("Search by name");
	expect(input.getAttribute("autocomplete")).toBe("off");
	expect(input.getAttribute("autocapitalize")).toBe("off");
	expect(input.getAttribute("spellcheck")).toBe("false");
	expect(input.getAttribute("enterkeyhint")).toBe("search");
});

test("search: typing narrows the list to matching names, A to Z, with the match in a mark", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	expect(rowNames(el)).toEqual(["Bankara Ramen", "Ramen Champion"]);
	const marks = [
		...el.shadowRoot!.querySelectorAll("li[data-id] .name mark"),
	].map((mark) => mark.textContent);
	expect(marks).toEqual(["Ram", "Ram"]);
	expect($(el, "li[data-id] button.row")?.getAttribute("aria-label")).toBe(
		"Edit Bankara Ramen",
	);
	await typeSearch(el, "cafe");
	expect(rowNames(el)).toEqual(["Café Tartine"]);
	expect($(el, "li[data-id] .name mark")?.textContent).toBe("Café");
	await typeSearch(el, "champion ramen");
	expect(rowNames(el)).toEqual(["Ramen Champion"]);
});

test("search: the count shows at once; screen readers hear it after typing pauses", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	expect($(el, ".search-count")?.textContent?.trim()).toBe("4 restaurants");
	await typeSearch(el, "ram");
	expect($(el, ".search-count")?.textContent?.trim()).toBe(
		"2 of 4 restaurants",
	);
	const live = $(el, '.search-announce[role="status"]')!;
	expect(live.textContent?.trim()).toBe("");
	await new Promise((resolve) => setTimeout(resolve, 550));
	await el.updateComplete;
	expect(live.textContent?.trim()).toBe("2 of 4 restaurants");
});

test("search: clear empties the field but stays in search with focus in the field", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	expect($(el, '[data-action="clear-search"]')).toBeNull();
	await typeSearch(el, "ram");
	await click(el, '[data-action="clear-search"]');
	expect(searchInput(el).value).toBe("");
	expect(rowNames(el)).toHaveLength(4);
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("search: a pointerdown on clear does not blur the field first, so the keyboard stays up", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	const clear = $<HTMLButtonElement>(el, '[data-action="clear-search"]')!;
	const event = new PointerEvent("pointerdown", {
		bubbles: true,
		cancelable: true,
	});
	clear.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
});

test("search: Cancel and Escape end search, restore the header and focus the button", async () => {
	seedSearch();
	const el = await mount();
	for (const end of ["cancel", "escape"]) {
		await openSearch(el);
		await typeSearch(el, "ram");
		if (end === "cancel") await click(el, '[data-action="cancel-search"]');
		else {
			searchInput(el).dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
			await el.updateComplete;
		}
		await el.updateComplete;
		expect($(el, ".head-actions")?.hasAttribute("hidden")).toBe(false);
		expect($(el, ".head > div")?.classList.contains("visually-hidden")).toBe(
			false,
		);
		expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
		expect(rowNames(el)).toHaveLength(4);
		expect(searchInput(el).value).toBe("");
		expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
			"search",
		);
	}
});

test("search: is translated to Thai", async () => {
	seedSearch();
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect($(el, '[data-action="search"]')?.getAttribute("aria-label")).toBe(
		"ค้นหาร้านอาหาร",
	);
	await openSearch(el);
	expect(searchInput(el).placeholder).toBe("ค้นหาด้วยชื่อ");
	expect($(el, '[data-action="cancel-search"]')?.textContent?.trim()).toBe(
		"ยกเลิก",
	);
	await typeSearch(el, "ram");
	expect($(el, ".search-count")?.textContent?.trim()).toBe("2 จาก 4 ร้าน");
});

test("the magnifier and the Tags link are the same height", () => {
	const css = (RestaurantManager.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(/\.tags-link\s*\{[^}]*min-height:\s*var\(--tap\)/);
	// A link's min-height leaves out its border unless it is border-box, like the button.
	expect(css).toMatch(/\.tags-link\s*\{[^}]*box-sizing:\s*border-box/);
	expect(css).toMatch(/\.search-open\s*\{[^}]*min-height:\s*var\(--tap\)/);
});

test("search: field, clear and cancel are tap sized; the input text is 16px", () => {
	const css = (RestaurantManager.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(/\.search-field\s*\{[^}]*min-height:\s*var\(--tap\)/);
	expect(css).toMatch(/\.search-open\s*\{[^}]*min-height:\s*var\(--tap\)/);
	expect(css).toMatch(/\.search-row\[hidden\]/);
	expect(css).toMatch(
		/\.name mark\s*\{[^}]*background:\s*var\(--color-primary-soft\)/,
	);
	// The search input gets its 16px text from the shared ui rule, not iOS's 13px default
	// zoom-trigger size, and the component's own rule must not override it back down.
	expect((uiStyles as unknown as { cssText: string }).cssText).toMatch(
		/input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*1rem/,
	);
	expect(css).not.toMatch(/\.search-field input\s*\{[^}]*font-size/);
});

test("search: the field drops iOS's default search styling", () => {
	const css = (RestaurantManager.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(
		/\.search-field input\s*\{[^}]*appearance:\s*none[^}]*-webkit-appearance:\s*none/,
	);
	expect(css).toMatch(
		/\.search-field input::-webkit-search-decoration\s*\{[^}]*display:\s*none/,
	);
});

test("search: no match shows one card that offers to add the name or clear", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "  zaab ");
	expect($(el, "ul.list")).toBeNull();
	const card = $(el, ".card.empty.no-match")!;
	expect(card.querySelector("p")?.textContent?.trim()).toBe(
		'No restaurants match "zaab".',
	);
	expect(
		card.querySelector('[data-action="add-named"]')?.textContent?.trim(),
	).toBe('Add "zaab"');
	await click(el, '[data-action="clear-search-empty"]');
	expect(rowNames(el)).toHaveLength(4);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("phone: Add from a search opens the new form with the name filled in", async () => {
	seedSearch();
	const el = await phone();
	await openSearch(el);
	await typeSearch(el, "Zaab Ari");
	await click(el, '[data-action="add-named"]');
	expect($(el, "app-sheet")?.hasAttribute("open")).toBe(true);
	expect($(el, "app-sheet")?.getAttribute("heading")).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Zaab Ari");
});

test("wide: Add from a search fills the side panel's name", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "Zaab Ari");
	await click(el, '[data-action="add-named"]');
	expect($(el, "#form-title")?.textContent?.trim()).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Zaab Ari");
});

test("phone: Add from a search focuses the saved row, now shown among the results", async () => {
	seedSearch();
	const el = await phone();
	await openSearch(el);
	await typeSearch(el, "Zaab");
	await click(el, '[data-action="add-named"]');
	await submit(el);
	await settleFocus(el);
	expect(rowNames(el)).toEqual(["Zaab"]);
	const row = [...el.shadowRoot!.querySelectorAll("li[data-id]")].find(
		(li) => li.querySelector(".name")?.textContent === "Zaab",
	)!;
	expect(el.shadowRoot!.activeElement).toBe(
		row.querySelector('button[data-action="edit"]'),
	);
});

test("search: editing a result keeps the search; a rename out of it drops the row", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "Bankara Tonkotsu");
	await submit(el);
	await el.updateComplete;
	expect(searchInput(el).value).toBe("ram");
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(rowNames(el)).toEqual(["Ramen Champion"]);
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved Bankara Tonkotsu",
	);
	// Renamed out of the query: its row is gone, so focus goes back to the search field.
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("search: a restaurant added in another tab shows up if it matches", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	addRestaurant({ ...blank, name: "Ramen Nagi" });
	await el.updateComplete;
	expect(rowNames(el)).toEqual([
		"Bankara Ramen",
		"Ramen Champion",
		"Ramen Nagi",
	]);
});

test("search: deleting every restaurant mid-search shows the empty list card", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	saveRestaurants([]);
	await el.updateComplete;
	expect($(el, ".card.empty:not(.no-match)")).not.toBeNull();
	expect($(el, ".no-match")).toBeNull();
	// An empty list ends the search outright instead of leaving a dead "0 of 0" view behind.
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	expect($(el, ".head-actions")?.hasAttribute("hidden")).toBe(false);
	expect($(el, ".head > div")?.classList.contains("visually-hidden")).toBe(
		false,
	);
	expect($(el, ".search-count")).toBeNull();
	expect(searchInput(el).value).toBe("");
	await new Promise((resolve) => setTimeout(resolve, 550));
	await el.updateComplete;
	expect($(el, '.search-announce[role="status"]')?.textContent?.trim()).toBe(
		"",
	);
});

const slash = (target: EventTarget = document.body) =>
	target.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "/",
			bubbles: true,
			composed: true,
			cancelable: true,
		}),
	);

test("wide: / opens search, but not while typing in a field", async () => {
	seedSearch();
	const el = await mountForm();
	slash($<HTMLInputElement>(el, "#name")!);
	await el.updateComplete;
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	slash();
	await el.updateComplete;
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("phone: / does nothing", async () => {
	seedSearch();
	const el = await phone();
	slash();
	await el.updateComplete;
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
});

test("wide: / does nothing while a sheet is open", async () => {
	seedSearch();
	const el = await mount();
	document.documentElement.classList.add("sheet-open");
	try {
		slash();
		await el.updateComplete;
		expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	} finally {
		document.documentElement.classList.remove("sheet-open");
	}
});

test("wide: / while already searching moves focus back to the field, from outside a typing control", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	const row = $<HTMLButtonElement>(
		el,
		'li[data-id] button[data-action="edit"]',
	)!;
	row.focus();
	const event = new KeyboardEvent("keydown", {
		key: "/",
		bubbles: true,
		composed: true,
		cancelable: true,
	});
	row.dispatchEvent(event);
	await el.updateComplete;
	expect(event.defaultPrevented).toBe(true);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("search: the no-match card is translated to Thai", async () => {
	seedSearch();
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	await openSearch(el);
	await typeSearch(el, "zaab");
	expect($(el, ".no-match p")?.textContent?.trim()).toBe("ไม่มีร้านที่ตรงกับ “zaab”");
	expect($(el, '[data-action="add-named"]')?.textContent?.trim()).toBe(
		"เพิ่ม “zaab”",
	);
	expect($(el, '[data-action="clear-search-empty"]')?.textContent?.trim()).toBe(
		"ล้างการค้นหา",
	);
});

const pressEnter = (el: RestaurantManager) => {
	const event = new KeyboardEvent("keydown", {
		key: "Enter",
		bubbles: true,
		cancelable: true,
	});
	searchInput(el).dispatchEvent(event);
	return event;
};

test("phone: the title row and the search row stay stuck to the top while the list scrolls", async () => {
	seedSearch();
	const el = await phone();
	const top = $(el, ".top")!;
	expect(top.querySelector(".head")).not.toBeNull();
	expect(top.querySelector(".search-row")).not.toBeNull();
	const css = (RestaurantManager.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(
		/\.top\s*\{[^}]*position:\s*sticky[^}]*top:\s*0[^}]*background:\s*var\(--color-bg\)/,
	);
	// Wide screens keep a sticky side panel, so the top row scrolls normally there.
	expect(css).toMatch(
		/@media \(min-width: 48rem\)[\s\S]*\.top\s*\{[^}]*position:\s*static/,
	);
	// A focused row never hides under the stuck bar.
	expect(css).toMatch(/li\[data-id\]\s*\{[^}]*scroll-margin-top:/);
});

test("search: the Search key with one match opens that restaurant", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "champion");
	const event = pressEnter(el);
	await el.updateComplete;
	expect(event.defaultPrevented).toBe(true);
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Edit Ramen Champion");
	expect(searchInput(el).value).toBe("champion");
});

test("phone: the Search key with one match opens its edit sheet", async () => {
	seedSearch();
	const el = await phone();
	await openSearch(el);
	await typeSearch(el, "jay");
	pressEnter(el);
	await el.updateComplete;
	expect($(el, "app-sheet")?.hasAttribute("open")).toBe(true);
	expect($(el, "app-sheet")?.getAttribute("heading")).toBe("Edit Jay Fai");
});

test("search: the Search key with several matches hides the keyboard and keeps the results", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	const event = pressEnter(el);
	await el.updateComplete;
	expect(event.defaultPrevented).toBe(true);
	expect(el.shadowRoot!.activeElement?.id).not.toBe("search");
	expect(rowNames(el)).toEqual(["Bankara Ramen", "Ramen Champion"]);
	expect($(el, "section.edit-panel")).toBeNull();
});

test("search: the no-match Add keeps an already open add panel open, with the name filled in", async () => {
	seedSearch();
	const el = await mountForm();
	await openSearch(el);
	await typeSearch(el, "zaab");
	await click(el, '[data-action="add-named"]');
	expect($(el, "section.edit-panel #form-title")?.textContent?.trim()).toBe(
		"New restaurant",
	);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("zaab");
});

test("search: closing the panel while searching returns focus to the search field", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	await click(el, 'li[data-id] button[data-action="edit"]');
	await click(el, 'button[data-action="close-panel"]');
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("search: no match drops the count line; screen readers hear the no-match message", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "zaab");
	expect($(el, ".search-count")).toBeNull();
	await new Promise((resolve) => setTimeout(resolve, 550));
	await el.updateComplete;
	expect($(el, ".search-announce")?.textContent?.trim()).toBe(
		'No restaurants match "zaab".',
	);
});

test("search: screen readers hear the count once, from the line under the field", async () => {
	seedSearch();
	const el = await mount();
	const headerCount = $(el, ".head .count")!;
	expect(headerCount.hasAttribute("aria-hidden")).toBe(false);
	await openSearch(el);
	await typeSearch(el, "ram");
	// The title stays for screen readers while searching, but its count would repeat the
	// visible "2 of 4 restaurants" line, so it is hidden from them.
	expect(headerCount.getAttribute("aria-hidden")).toBe("true");
	expect($(el, ".search-count")?.hasAttribute("aria-hidden")).toBe(false);
	await click(el, '[data-action="cancel-search"]');
	expect(headerCount.hasAttribute("aria-hidden")).toBe(false);
});
