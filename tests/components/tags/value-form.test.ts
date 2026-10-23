import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tags/value-form";
import {
	type TagValueForm,
	type ValueDraft,
	valueDraft,
} from "#components/tags/value-form";
import type { GroupDef } from "#lib/groups";
import { setLang, t } from "#lib/i18n";
import { nameFromText, type Restaurant } from "#lib/restaurant";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
});

const make = (
	id: string,
	groups: Restaurant["groups"] = {},
	extra: Partial<Restaurant> = {},
): Restaurant => ({
	id,
	name: nameFromText(id),
	tags: [],
	links: [],
	notes: "",
	groups,
	kinds: [],
	createdAt: "2026-10-16T00:00:00.000Z",
	updatedAt: "2026-10-16T00:00:00.000Z",
	...extra,
});

const price: GroupDef = { id: "g1", name: "Price" };

type MountProps = {
	restaurants?: readonly Restaurant[];
	defs?: GroupDef[];
	group: string;
	value: string;
	draft?: ValueDraft;
};

/**
 * Mounts the form wired up like the manager will: a listener writes every `draft-change` back
 * onto `el.draft`, so the tests below can drive the form the same way the real owner does.
 */
const mount = async (props: MountProps) => {
	const el = document.createElement("tag-value-form");
	el.restaurants = props.restaurants ?? [];
	el.defs = props.defs ?? [];
	el.group = props.group;
	el.value = props.value;
	el.draft = props.draft ?? valueDraft(props.group, props.value);
	el.addEventListener("draft-change", (event) => {
		el.draft = (event as CustomEvent<ValueDraft>).detail;
	});
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: TagValueForm, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const $$ = <T extends Element>(el: TagValueForm, selector: string) => [
	...el.shadowRoot!.querySelectorAll<T>(selector),
];

const text = (el: Element | null | undefined) =>
	el?.textContent?.replace(/\s+/g, " ").trim();

const listen = <T>(el: TagValueForm, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

const typeName = async (el: TagValueForm, value: string) => {
	const input = $<HTMLInputElement>(el, "#name")!;
	input.value = value;
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
};

const pickGroup = async (el: TagValueForm, value: string) => {
	const select = $<HTMLSelectElement>(el, "select[name=group]")!;
	select.value = value;
	select.dispatchEvent(new Event("change"));
	await el.updateComplete;
};

const click = async (el: TagValueForm, action: string) => {
	$<HTMLButtonElement>(el, `[data-action="${action}"]`)!.click();
	await el.updateComplete;
};

test("starts with the value's name and its group selected; Type is never offered", async () => {
	const el = await mount({ defs: [price], group: "cuisine", value: "thai" });
	expect($<HTMLInputElement>(el, "#name")!.value).toBe("thai");
	const select = $<HTMLSelectElement>(el, "select[name=group]")!;
	expect($$<HTMLOptionElement>(el, "option").map((o) => o.value)).toEqual([
		"cuisine",
		"area",
		"g1",
		"tags",
	]);
	expect(select.value).toBe("cuisine");
});

test("save reports the new name and group", async () => {
	const el = await mount({ group: "cuisine", value: "thai" });
	const saves = listen<{
		from: { group: string; value: string };
		to: { group: string; value: string };
	}>(el, "value-save");
	await typeName(el, "Thai food");
	await pickGroup(el, "area");
	await click(el, "save");
	expect(saves).toEqual([
		{
			from: { group: "cuisine", value: "thai" },
			to: { group: "area", value: "thai food" },
		},
	]);
});

test("blank or comma names show an error and report nothing", async () => {
	const el = await mount({ group: "cuisine", value: "thai" });
	const saves = listen(el, "value-save");
	await typeName(el, "");
	await click(el, "save");
	expect(text($(el, ".error"))).toBe("Value is required.");
	expect(saves).toEqual([]);

	await typeName(el, "a,b");
	await click(el, "save");
	expect(text($(el, ".error"))).toBe("A value cannot contain a comma.");
	expect(saves).toEqual([]);
});

test("a name that already exists asks to merge first", async () => {
	const restaurants = [
		make("a", { cuisine: ["thai"] }),
		make("b", { cuisine: ["lao"] }),
	];
	const el = await mount({ restaurants, group: "cuisine", value: "lao" });
	const saves = listen<{
		from: { group: string; value: string };
		to: { group: string; value: string };
	}>(el, "value-save");

	await typeName(el, "thai");
	await click(el, "save");

	expect(saves).toEqual([]);
	expect(text($(el, '[role="alert"] p'))).toBe(
		t("tags.mergePrompt.one", { from: "lao", to: "thai" }),
	);

	await click(el, "confirm-merge");
	expect(saves).toEqual([
		{
			from: { group: "cuisine", value: "lao" },
			to: { group: "cuisine", value: "thai" },
		},
	]);
});

test("cancel-merge returns to the fields with the typed name still there", async () => {
	const restaurants = [
		make("a", { cuisine: ["thai"] }),
		make("b", { cuisine: ["lao"] }),
	];
	const el = await mount({ restaurants, group: "cuisine", value: "lao" });

	await typeName(el, "thai");
	await click(el, "save");
	expect($(el, '[role="alert"]')).not.toBeNull();

	await click(el, "cancel-merge");
	expect($(el, '[role="alert"]')).toBeNull();
	expect($<HTMLInputElement>(el, "#name")!.value).toBe("thai");
});

test("delete asks first, then reports value-delete", async () => {
	const restaurants = [make("a", { cuisine: ["thai"] })];
	const el = await mount({ restaurants, group: "cuisine", value: "thai" });
	const deletes = listen<{ group: string; value: string }>(el, "value-delete");

	await click(el, "delete");
	expect(text($(el, '[role="alert"]'))).toBe(
		t("tags.deleteValuePrompt.one", { value: "thai" }),
	);

	await click(el, "confirm-delete");
	expect(deletes).toEqual([{ group: "cuisine", value: "thai" }]);
});

test("cancel-delete returns to the fields", async () => {
	const restaurants = [make("a", { cuisine: ["thai"] })];
	const el = await mount({ restaurants, group: "cuisine", value: "thai" });

	await click(el, "delete");
	await click(el, "cancel-delete");
	expect($(el, '[role="alert"]')).toBeNull();
	expect($<HTMLInputElement>(el, "#name")).not.toBeNull();
});

test("renders from the draft it is given", async () => {
	const el = await mount({
		group: "cuisine",
		value: "thai",
		defs: [price],
		draft: { name: "x", target: "area", step: "edit" },
	});
	expect($<HTMLInputElement>(el, "#name")!.value).toBe("x");
	expect($<HTMLSelectElement>(el, "select[name=group]")!.value).toBe("area");

	el.draft = { name: "x", target: "area", step: "delete" };
	await el.updateComplete;
	expect($(el, '[role="alert"]')).not.toBeNull();
	expect($(el, "#name")).toBeNull();
});

test("focusFirst focuses the name input in edit, or the open prompt's confirm button", async () => {
	const restaurants = [make("a", { cuisine: ["thai"] })];
	const el = await mount({ restaurants, group: "cuisine", value: "thai" });
	el.focusFirst();
	expect(el.shadowRoot!.activeElement).toBe($(el, "#name"));

	await click(el, "delete");
	el.focusFirst();
	expect(el.shadowRoot!.activeElement).toBe(
		$(el, '[data-action="confirm-delete"]'),
	);
});

test("focusFirst in the merge step focuses the confirm-merge button", async () => {
	const restaurants = [
		make("a", { cuisine: ["thai"] }),
		make("b", { cuisine: ["lao"] }),
	];
	const el = await mount({ restaurants, group: "cuisine", value: "lao" });

	await typeName(el, "thai");
	await click(el, "save");
	expect($(el, '[role="alert"]')).not.toBeNull();

	el.focusFirst();
	expect(el.shadowRoot!.activeElement).toBe(
		$(el, '[data-action="confirm-merge"]'),
	);
});

test("renders in Thai", async () => {
	const el = await mount({ group: "cuisine", value: "thai" });
	setLang("th");
	await el.updateComplete;
	// Only the label's own text nodes — not the select's nested option text.
	const labels = $$(el, "label").map((label) =>
		[...label.childNodes]
			.filter((node) => node.nodeType === Node.TEXT_NODE)
			.map((node) => node.textContent)
			.join("")
			.trim(),
	);
	expect(labels).toEqual(["ชื่อ", "กลุ่ม"]);
});
