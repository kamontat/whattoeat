import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/restaurant-manager";
import type { RestaurantManager } from "#components/restaurant-manager";
import type { TagInput } from "#components/tag-input";
import { setLang } from "#lib/i18n";
import {
	addRestaurant,
	loadRestaurants,
	saveRestaurants,
	updateRestaurant,
} from "#lib/store";

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("restaurant-manager");
	document.body.append(el);
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

const tagInput = (el: RestaurantManager) => $<TagInput>(el, "tag-input")!;

const typeTags = async (el: RestaurantManager, text: string): Promise<void> => {
	const field = tagInput(el);
	const box = field.shadowRoot!.querySelector<HTMLInputElement>("input")!;
	box.value = text;
	box.dispatchEvent(new Event("input"));
	await field.updateComplete;
	await el.updateComplete;
};

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

test("shows the empty message with no restaurants", async () => {
	const el = await mount();
	expect($(el, ".empty")?.textContent?.trim()).toBe(
		"No restaurants yet. Add your first one above.",
	);
});

test("a blank name shows an error and saves nothing", async () => {
	const el = await mount();
	type(el, "#name", "   ");
	await submit(el);
	expect($(el, "#name-error")?.textContent?.trim()).toBe("Name is required.");
	expect($(el, "#name")?.getAttribute("aria-invalid")).toBe("true");
	expect(loadRestaurants()).toEqual([]);
});

test("a name already in the list shows an error and saves nothing", async () => {
	addRestaurant({ name: "Jay Fai", tags: [], location: "", notes: "" });
	const el = await mount();
	type(el, "#name", "  jay fai ");
	await submit(el);
	expect($(el, "#name-error")?.textContent?.trim()).toBe(
		"A restaurant with this name already exists.",
	);
	expect($(el, "#name")?.getAttribute("aria-invalid")).toBe("true");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("  jay fai ");
	expect(loadRestaurants()).toHaveLength(1);
});

test("editing can keep the name but not take another one", async () => {
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
	addRestaurant({ name: "B", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "b");
	await submit(el);
	expect($(el, "#name-error")?.textContent?.trim()).toBe(
		"A restaurant with this name already exists.",
	);
	type(el, "#name", "A");
	type(el, "#notes", "kept");
	await submit(el);
	expect($(el, "#name-error")).toBeNull();
	expect(loadRestaurants()).toMatchObject([
		{ name: "A", notes: "kept" },
		{ name: "B" },
	]);
});

test("typing in the name clears the error", async () => {
	const el = await mount();
	await submit(el);
	type(el, "#name", "x");
	await el.updateComplete;
	expect($(el, "#name-error")).toBeNull();
});

test("adds a restaurant with cleaned tags and resets the form", async () => {
	const el = await mount();
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
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual([]);
});

test("a tag typed but not confirmed is saved on submit", async () => {
	const el = await mount();
	type(el, "#name", "Jay Fai");
	await typeTags(el, "Spicy");
	await submit(el);
	expect(loadRestaurants()[0]?.tags).toEqual(["spicy"]);
});

test("a blank name keeps a typed tag as a chip instead of losing it", async () => {
	const el = await mount();
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
	const el = await mount();
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

test("a non-http location in the list renders as text", async () => {
	addRestaurant({
		name: "Sneaky",
		tags: [],
		location: "javascript:alert(1)",
		notes: "",
	});
	const el = await mount();
	expect(el.shadowRoot!.querySelector("li[data-id] a")).toBeNull();
	expect($(el, "li[data-id] .location")?.textContent?.trim()).toBe(
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
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
});

test("cancel edit resets the form without saving", async () => {
	addRestaurant({ name: "Keep", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	type(el, "#name", "Changed");
	await typeTags(el, "half");
	await click(el, 'button[data-action="cancel-edit"]');
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
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
	type(el, "#name", "Fresh");
	await submit(el);
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Fresh"]);
});

test("re-renders labels in Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("เพิ่ม");
});

test("delete moves focus to the confirm button, cancel moves it back", async () => {
	addRestaurant({ name: "Bye", tags: [], location: "", notes: "" });
	const el = await mount();
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

test("a confirmed delete moves focus to the name field", async () => {
	addRestaurant({ name: "Bye", tags: [], location: "", notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.id).toBe("name");
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
	const el = await mount();
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
