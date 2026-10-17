import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tags/group-form";
import type { GroupDraft, TagGroupForm } from "#components/tags/group-form";
import type { GroupDef } from "#lib/groups";
import { setLang, t } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

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
	name: id,
	tags: [],
	location: "",
	notes: "",
	groups,
	kinds: [],
	createdAt: "2026-10-16T00:00:00.000Z",
	updatedAt: "2026-10-16T00:00:00.000Z",
	...extra,
});

const price: GroupDef = { id: "g1", name: "Price" };
const vibe: GroupDef = { id: "g2", name: "Vibe" };

type MountProps = {
	restaurants?: readonly Restaurant[];
	defs?: GroupDef[];
	groupId?: string;
	draft?: GroupDraft;
};

/**
 * Mounts the form wired up like the manager will: a listener writes every `draft-change` back
 * onto `el.draft`, and `group-move` back onto `el.defs`, so the tests below can drive the form
 * the same way the real owner does.
 */
const mount = async (props: MountProps = {}) => {
	const el = document.createElement("tag-group-form");
	el.restaurants = props.restaurants ?? [];
	el.defs = props.defs ?? [];
	el.groupId = props.groupId;
	el.draft = props.draft ?? { name: "", step: "edit" };
	el.addEventListener("draft-change", (event) => {
		el.draft = (event as CustomEvent<GroupDraft>).detail;
	});
	el.addEventListener("group-move", (event) => {
		const detail = (event as CustomEvent<{ groups: GroupDef[] }>).detail;
		el.defs = detail.groups;
	});
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: TagGroupForm, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const text = (el: Element | null | undefined) =>
	el?.textContent?.replace(/\s+/g, " ").trim();

const listen = <T>(el: TagGroupForm, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

const typeName = async (el: TagGroupForm, value: string) => {
	const input = $<HTMLInputElement>(el, "#name")!;
	input.value = value;
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
};

const click = async (el: TagGroupForm, action: string) => {
	$<HTMLButtonElement>(el, `[data-action="${action}"]`)!.click();
	await el.updateComplete;
};

const focused = (el: TagGroupForm) => el.shadowRoot!.activeElement;
const settle = async (el: TagGroupForm) => {
	await el.updateComplete;
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};

test("new: adding reports the new list and id; blank and taken names show errors", async () => {
	const el = await mount({ defs: [price] });
	const saves = listen<{ groups: GroupDef[]; id: string }>(el, "group-save");

	await click(el, "save");
	expect(text($(el, ".error"))).toBe("Name is required.");
	expect(saves).toEqual([]);

	await typeName(el, "price");
	await click(el, "save");
	expect(text($(el, ".error"))).toBe("A group with this name already exists.");
	expect(saves).toEqual([]);

	await typeName(el, "Mood");
	await click(el, "save");
	expect(saves.length).toBe(1);
	const save = saves[0]!;
	expect(save.groups.length).toBe(2);
	expect(save.id).toBe(save.groups[1]!.id);
});

test("new: shows the add-group button text, no position or delete controls", async () => {
	const el = await mount({ defs: [price] });
	expect(text($(el, '[data-action="save"]'))).toBe(t("tags.addGroup"));
	expect($(el, '[data-action="move-up"]')).toBeNull();
	expect($(el, '[data-action="delete"]')).toBeNull();
});

test("edit: renaming reports the renamed list", async () => {
	const el = await mount({
		defs: [price],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	const saves = listen<{ groups: GroupDef[]; id: string }>(el, "group-save");
	expect(text($(el, '[data-action="save"]'))).toBe(t("tags.save"));
	await typeName(el, "Cost");
	await click(el, "save");
	expect(saves).toEqual([{ groups: [{ id: "g1", name: "Cost" }], id: "g1" }]);
});

test("edit: moves apply at once and are disabled at the ends with a reason", async () => {
	const el = await mount({
		defs: [price, vibe],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	const moves = listen<{ groups: GroupDef[] }>(el, "group-move");

	const up = $<HTMLButtonElement>(el, '[data-action="move-up"]')!;
	expect(up.getAttribute("aria-disabled")).toBe("true");
	expect(text($(el, "#move-up-reason"))).toBe("Already the first group");
	expect(text($(el, ".hint"))).toBe("Order saves right away");

	up.click();
	await el.updateComplete;
	expect(moves).toEqual([]);

	await click(el, "move-down");
	expect(moves).toEqual([
		{
			groups: [
				{ id: "g2", name: "Vibe" },
				{ id: "g1", name: "Price" },
			],
		},
	]);
});

test("edit: cancel never undoes a move", async () => {
	const el = await mount({
		defs: [price, vibe],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	const moves = listen<{ groups: GroupDef[] }>(el, "group-move");
	const cancels = listen(el, "form-cancel");

	await click(el, "move-down");
	expect(moves.length).toBe(1);

	await click(el, "cancel");
	expect(cancels.length).toBe(1);
	expect(moves.length).toBe(1);
});

test("edit: delete asks first with the restaurant count", async () => {
	const restaurants = [make("a", { g1: ["cheap"] })];
	const el = await mount({
		restaurants,
		defs: [price],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	const deletes = listen<{ id: string }>(el, "group-delete");

	await click(el, "delete");
	expect(text($(el, '[role="alert"]'))).toBe(
		t("tags.deleteGroupPrompt.one", { group: "Price" }),
	);

	await click(el, "confirm-delete");
	expect(deletes).toEqual([{ id: "g1" }]);
});

test("edit: cancel-delete returns to the fields", async () => {
	const el = await mount({
		defs: [price],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	await click(el, "delete");
	await click(el, "cancel-delete");
	expect($(el, '[role="alert"]')).toBeNull();
	expect($(el, "#name")).not.toBeNull();
});

test("moving keeps focus on the pressed arrow, or the other one at an end", async () => {
	const defs = [price, vibe, { id: "g3", name: "Dish" }];
	const el = await mount({
		defs,
		groupId: "g3",
		draft: { name: "Dish", step: "edit" },
	});

	await click(el, "move-up");
	await settle(el);
	expect(el.defs.map((def) => def.id)).toEqual(["g1", "g3", "g2"]);
	expect(focused(el)).toBe($(el, '[data-action="move-up"]'));

	await click(el, "move-up");
	await settle(el);
	expect(el.defs.map((def) => def.id)).toEqual(["g3", "g1", "g2"]);
	expect(focused(el)).toBe($(el, '[data-action="move-down"]'));

	const el2 = await mount({
		defs: [price, vibe],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	await click(el2, "move-down");
	await settle(el2);
	expect(el2.defs.map((def) => def.id)).toEqual(["g2", "g1"]);
	expect(focused(el2)).toBe($(el2, '[data-action="move-up"]'));
});

test("editing the name clears the error", async () => {
	const el = await mount({
		defs: [price],
		draft: { name: "", step: "edit", error: "tags.nameRequired" },
	});
	expect($(el, ".error")).not.toBeNull();
	await typeName(el, "M");
	expect(el.draft.error).toBeUndefined();
	expect($(el, ".error")).toBeNull();
});

test("focusFirst focuses the name input in edit, or the confirm-delete button", async () => {
	const el = await mount({
		defs: [price],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	el.focusFirst();
	expect(el.shadowRoot!.activeElement).toBe($(el, "#name"));

	await click(el, "delete");
	el.focusFirst();
	expect(el.shadowRoot!.activeElement).toBe(
		$(el, '[data-action="confirm-delete"]'),
	);
});

test("renders in Thai", async () => {
	const el = await mount({
		defs: [price, vibe],
		groupId: "g1",
		draft: { name: "Price", step: "edit" },
	});
	setLang("th");
	await el.updateComplete;
	expect(text($(el, '[data-action="save"]'))).toBe(t("tags.save"));
	expect(text($(el, '[data-action="delete"]'))).toBe(t("tags.deleteGroup"));
	expect(text($(el, '[data-action="move-down"]'))).toBe(t("tags.down"));
});
