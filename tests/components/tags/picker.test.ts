import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tags/picker";
import type { TagPicker } from "#components/tags/picker";
import type { GroupDef } from "#lib/groups";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { type TagGroup, tagGroups } from "#lib/tags";

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

/** Type (1 value, food used twice), Cuisine (2 values), Area (0), Price (1, custom), Tags (1). */
const fixtureGroups = (): TagGroup[] =>
	tagGroups(
		[
			make(
				"a",
				{ cuisine: ["thai", "lao"], g1: ["$"] },
				{ kinds: ["food"], tags: ["spicy"] },
			),
			make("b", {}, { kinds: ["food"] }),
		],
		[price],
	);

const mount = async (
	props: Partial<
		Pick<TagPicker, "groups" | "picked" | "variant" | "wrap">
	> = {},
) => {
	const el = document.createElement("tag-picker");
	el.groups = props.groups ?? fixtureGroups();
	el.picked = props.picked ?? "cuisine";
	if (props.variant !== undefined) el.variant = props.variant;
	if (props.wrap !== undefined) el.wrap = props.wrap;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: TagPicker, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

const $$ = <T extends Element>(el: TagPicker, selector: string) => [
	...el.shadowRoot!.querySelectorAll<T>(selector),
];

const text = (el: Element | null | undefined) =>
	el?.textContent?.replace(/\s+/g, " ").trim();

/** Collect every `type` event the element dispatches. */
const listen = <T>(el: TagPicker, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

test("pills show each group with its value count and mark the picked one", async () => {
	const el = await mount();
	const buttons = $$<HTMLButtonElement>(el, "button[data-group]");
	expect(buttons.map((button) => text(button))).toEqual([
		"Type 1",
		"Cuisine 2",
		"Area 0",
		"Price 1",
		"Tags 1",
	]);
	expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
		"false",
		"true",
		"false",
		"false",
		"false",
	]);
});

test("clicking a pill reports group-pick", async () => {
	const el = await mount();
	const picks = listen<string>(el, "group-pick");
	$<HTMLButtonElement>(el, '[data-group="g1"]')!.click();
	expect(picks).toEqual(["g1"]);
});

test("column variant marks Type as fixed", async () => {
	const el = await mount({ variant: "column" });
	expect(el.getAttribute("variant")).toBe("column");
	const kindRow = $<HTMLButtonElement>(el, '[data-group="kind"]')!;
	expect(text(kindRow.querySelector(".sub"))).toBe("fixed");
	const cuisineRow = $<HTMLButtonElement>(el, '[data-group="cuisine"]')!;
	expect(cuisineRow.querySelector(".sub")).toBeNull();
});

test("renders in Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect($(el, '[role="group"]')?.getAttribute("aria-label")).toBe("กลุ่ม");
});
