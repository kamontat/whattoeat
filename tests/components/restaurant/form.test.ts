import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/restaurant/form";
import {
	EMPTY_FORM,
	type FormState,
	type FormView,
	formFromRestaurant,
	RestaurantForm,
} from "#components/restaurant/form";
import type { TagInput } from "#components/tag-input";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
});

const make = (id: string, name: string, extra = {}): Restaurant => ({
	id,
	name,
	location: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	...extra,
});

const addView = (form: Partial<FormState> = {}): FormView => ({
	form: { ...EMPTY_FORM, ...form },
	editingId: undefined,
	confirmingId: undefined,
	nameError: undefined,
});

const editView = (
	item: Restaurant,
	extra: Partial<FormView> = {},
): FormView => ({
	form: formFromRestaurant(item),
	editingId: item.id,
	confirmingId: undefined,
	nameError: undefined,
	...extra,
});

const mount = async (
	view: FormView = addView(),
	props: Partial<Pick<RestaurantForm, "restaurants" | "defs">> = {},
) => {
	const el = document.createElement("restaurant-form");
	el.view = view;
	Object.assign(el, props);
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: RestaurantForm, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const groupInput = (el: RestaurantForm, group: string) =>
	$<TagInput>(el, `tag-input[data-group="${group}"]`)!;

const listen = <T>(el: RestaurantForm, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

const type = (el: RestaurantForm, selector: string, value: string): void => {
	const input = $<HTMLInputElement | HTMLTextAreaElement>(el, selector)!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};

const typeInto = async (el: RestaurantForm, group: string, text: string) => {
	const field = groupInput(el, group);
	const box = field.shadowRoot!.querySelector<HTMLInputElement>("input")!;
	box.value = text;
	box.dispatchEvent(new Event("input"));
	await field.updateComplete;
};

const submit = (el: RestaurantForm): void => {
	$<HTMLFormElement>(el, "form")!.dispatchEvent(
		new Event("submit", { bubbles: true, cancelable: true }),
	);
};

/** Act as the owner: apply every change the form reports back to its view. */
const own = (el: RestaurantForm): void => {
	el.addEventListener("form-change", (event) => {
		el.view = { ...el.view, form: (event as CustomEvent<FormState>).detail };
	});
};

test("draws the view's values", async () => {
	const item = make("1", "Old", {
		location: "Here",
		notes: "n",
		kinds: ["food"],
		tags: ["a"],
		groups: { cuisine: ["thai"] },
	});
	const el = await mount(editView(item));
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Old");
	expect($<HTMLInputElement>(el, "#location")?.value).toBe("Here");
	expect($<HTMLTextAreaElement>(el, "#notes")?.value).toBe("n");
	expect(
		$<HTMLInputElement>(el, 'input[name="kinds"][value="food"]')?.checked,
	).toBe(true);
	expect(groupInput(el, "cuisine").value).toEqual(["thai"]);
	expect(groupInput(el, "area").value).toEqual([]);
	expect(groupInput(el, "tags").value).toEqual(["a"]);
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Save");
});

test("an add view says Add and has no Cancel or Delete", async () => {
	const el = await mount();
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("Add");
	expect($(el, '[data-action="cancel-edit"]')).toBeNull();
	expect($(el, '[data-action="delete"]')).toBeNull();
});

test("asks for name, type, groups, location, then tags and notes", async () => {
	const el = await mount(addView(), {
		defs: [
			{ id: "g2", name: "Vibe" },
			{ id: "g1", name: "Price" },
		],
	});
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
		"g2",
		"g1",
		"location",
		"tags",
		"notes",
	]);
	expect(groupInput(el, "g2").label).toBe("Vibe");
});

test("reports every edit as a whole new form state", async () => {
	const el = await mount();
	own(el);
	const changes = listen<FormState>(el, "form-change");
	type(el, "#name", "Cafe");
	type(el, "#location", "Ari");
	type(el, "#notes", "late");
	await el.updateComplete;
	$<HTMLInputElement>(el, 'input[name="kinds"][value="dessert"]')!.click();
	await el.updateComplete;
	$<HTMLInputElement>(el, 'input[name="kinds"][value="food"]')!.click();
	await el.updateComplete;
	await typeInto(el, "cuisine", "thai,");
	await el.updateComplete;
	expect(changes.at(-1)).toEqual({
		name: "Cafe",
		location: "Ari",
		notes: "late",
		kinds: ["food", "dessert"],
		tags: [],
		groups: { cuisine: ["thai"] },
	});
});

test("edits made before the owner hands back a new view build on each other", async () => {
	const el = await mount();
	const changes = listen<FormState>(el, "form-change");
	const submits = listen<FormState>(el, "form-submit");
	type(el, "#name", "Cafe");
	type(el, "#notes", "late");
	submit(el);
	expect(changes.at(-1)).toMatchObject({ name: "Cafe", notes: "late" });
	expect(submits[0]).toMatchObject({ name: "Cafe", notes: "late" });
});

test("submit commits text left in every box", async () => {
	const el = await mount(addView({ name: "Cafe" }), {
		defs: [{ id: "g1", name: "Price" }],
	});
	const submits = listen<FormState>(el, "form-submit");
	await typeInto(el, "cuisine", "Thai, Japanese");
	await typeInto(el, "g1", "cheap");
	await typeInto(el, "tags", "Spicy");
	submit(el);
	expect(submits).toEqual([
		{
			...EMPTY_FORM,
			name: "Cafe",
			tags: ["spicy"],
			groups: { cuisine: ["thai", "japanese"], area: [], g1: ["cheap"] },
		},
	]);
});

test("values of a group no longer drawn stay in the submitted form for the owner to demote", async () => {
	const el = await mount(addView({ name: "Cafe", groups: { gone: ["x"] } }));
	const submits = listen<FormState>(el, "form-submit");
	submit(el);
	expect(submits[0]?.groups).toEqual({ gone: ["x"], cuisine: [], area: [] });
});

test("shows the view's name error on the name field", async () => {
	const el = await mount({ ...addView(), nameError: "manager.nameRequired" });
	expect($(el, "#name-error")?.textContent?.trim()).toBe("Name is required.");
	expect($(el, "#name")?.getAttribute("aria-invalid")).toBe("true");
	expect($(el, "#name")?.getAttribute("aria-describedby")).toBe("name-error");
});

test("suggests each group's values from the other restaurants, most used first", async () => {
	const el = await mount(addView(), {
		restaurants: [
			make("1", "A", { tags: ["thai", "noodle"], groups: { area: ["siam"] } }),
			make("2", "B", { tags: ["noodle"], groups: { area: ["ari", "siam"] } }),
		],
	});
	expect(groupInput(el, "tags").suggestions).toEqual(["noodle", "thai"]);
	expect(groupInput(el, "area").suggestions).toEqual(["siam", "ari"]);
	expect(groupInput(el, "tags").hint).toBe(
		"Press Enter or comma to add, e.g. thai, noodle",
	);
});

test("a group whose id names an Object member gets the plain hint and no values", async () => {
	const el = await mount(addView(), {
		defs: [{ id: "constructor", name: "Odd" }],
	});
	expect(groupInput(el, "constructor").hint).toBe(
		"Press Enter or comma to add",
	);
	expect(groupInput(el, "constructor").value).toEqual([]);
});

test("Cancel asks the owner to drop the edit", async () => {
	const el = await mount(editView(make("1", "A")));
	const cancels = listen<unknown>(el, "form-cancel");
	$<HTMLButtonElement>(el, '[data-action="cancel-edit"]')!.click();
	expect(cancels).toHaveLength(1);
});

test("delete asks first, then confirms, moving focus between the buttons", async () => {
	const item = make("1", "Bye");
	const el = await mount(editView(item), { restaurants: [item] });
	const requests = listen<string>(el, "delete-request");
	const cancels = listen<unknown>(el, "delete-cancel");
	const confirms = listen<string>(el, "delete-confirm");
	$<HTMLButtonElement>(el, '[data-action="delete"]')!.click();
	expect(requests).toEqual(["1"]);
	el.view = { ...el.view, confirmingId: "1" };
	await el.updateComplete;
	expect($(el, ".delete-prompt")?.textContent?.trim()).toBe(
		"Delete Bye? This cannot be undone.",
	);
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"confirm-delete",
	);
	$<HTMLButtonElement>(el, '[data-action="cancel-delete"]')!.click();
	expect(cancels).toHaveLength(1);
	el.view = { ...el.view, confirmingId: undefined };
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"delete",
	);
	$<HTMLButtonElement>(el, '[data-action="delete"]')!.click();
	el.view = { ...el.view, confirmingId: "1" };
	await el.updateComplete;
	$<HTMLButtonElement>(el, '[data-action="confirm-delete"]')!.click();
	expect(confirms).toEqual(["1"]);
});

test("clearText drops text typed but not yet a chip", async () => {
	const el = await mount();
	await typeInto(el, "tags", "spi");
	el.clearText();
	await groupInput(el, "tags").updateComplete;
	expect(
		groupInput(el, "tags").shadowRoot!.querySelector<HTMLInputElement>("input")
			?.value,
	).toBe("");
});

test("focusName focuses the name field", async () => {
	const el = await mount();
	el.focusName();
	expect(el.shadowRoot!.activeElement?.id).toBe("name");
});

test("labels render in Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect($(el, "fieldset.kinds legend")?.textContent?.trim()).toBe("ประเภท");
	expect(groupInput(el, "cuisine").label).toBe("สัญชาติอาหาร");
	expect($(el, 'button[type="submit"]')?.textContent?.trim()).toBe("เพิ่ม");
});

const css = (): string =>
	(RestaurantForm.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("phone: cuisine and area stack in one column and may shrink; side by side only from 48rem", () => {
	expect(css()).toMatch(
		/\.pair\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
	);
	expect(css()).toMatch(/\.pair\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
	const wide = css().slice(css().indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(
		/\.pair\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\),\s*1fr\)\)/,
	);
});

test("phone: Save stays reachable at the bottom of the scrolling sheet", () => {
	expect(css()).toMatch(/\.actions\.form-actions\s*\{[^}]*position:\s*sticky/);
	expect(css()).toMatch(/\.actions\.form-actions\s*\{[^}]*bottom:\s*-1rem/);
	expect(css()).toMatch(
		/\.actions\.form-actions\s*\{[^}]*background:\s*var\(--color-bg\)/,
	);
	const wide = css().slice(css().indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(/\.actions\.form-actions\s*\{[^}]*position:\s*static/);
});

test("phone: focused fields scroll clear of the sticky save row", () => {
	expect(css()).toMatch(
		/form input,\s*form textarea,\s*form tag-input,\s*fieldset\.kinds label\s*\{[^}]*scroll-margin-bottom:\s*5rem/,
	);
	const wide = css().slice(css().indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(
		/form input,\s*form textarea,\s*form tag-input,\s*fieldset\.kinds label\s*\{[^}]*scroll-margin-bottom:\s*0/,
	);
});
