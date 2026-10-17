import { afterEach, beforeEach, expect, test } from "bun:test";
import type { ListRow } from "#components/tags/list";
import { TagList } from "#components/tags/list";
import { setLang } from "#lib/i18n";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
});

const mount = async (
	rows: ListRow[],
	props: Partial<Pick<TagList, "currentGroup" | "currentValue">> = {},
) => {
	const el = document.createElement("tag-list");
	el.rows = rows;
	Object.assign(el, props);
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = <T extends Element>(el: TagList, selector: string) =>
	el.shadowRoot!.querySelector<T>(selector);

/** Collect every `type` event the element dispatches. */
const listen = <T>(el: TagList, type: string): T[] => {
	const seen: T[] = [];
	el.addEventListener(type, (event) =>
		seen.push((event as CustomEvent<T>).detail),
	);
	return seen;
};

test("rows are buttons with name, sub line and chevron; readonly rows are not", async () => {
	const mixed = await mount([
		{ group: "cuisine", value: "thai", name: "thai", sub: "2 restaurants" },
		{
			group: "kind",
			value: "food",
			name: "Food",
			sub: "3 restaurants",
			readonly: true,
		},
	]);
	const thaiButton = $<HTMLButtonElement>(
		mixed,
		'li[data-group="cuisine"][data-value="thai"] button[data-action="open"]',
	);
	expect(thaiButton).not.toBeNull();
	expect(thaiButton?.querySelector(".sub")?.textContent).toBe("2 restaurants");
	expect(thaiButton?.querySelector(".trail")).not.toBeNull();
	expect(
		$(mixed, 'li[data-group="kind"][data-value="food"] button'),
	).toBeNull();
	const staticRow = $(
		mixed,
		'li[data-group="kind"][data-value="food"] div.item.row.static',
	)!;
	expect(staticRow).not.toBeNull();
	// The count shows trailing, on the right, not as a sub line under the name.
	expect(staticRow.querySelector(".grow .sub")).toBeNull();
	expect(staticRow.querySelector(".count")?.textContent).toBe("3 restaurants");
	expect(staticRow.querySelector(".trail")).toBeNull();
	// Not every row is readonly, so the list itself is not marked readonly.
	expect($(mixed, "ul")?.classList.contains("readonly")).toBe(false);

	const allReadonly = await mount([
		{
			group: "kind",
			value: "food",
			name: "Food",
			sub: "3 restaurants",
			readonly: true,
		},
	]);
	expect($(allReadonly, "ul")?.classList.contains("readonly")).toBe(true);
});

test("highlights matched ranges", async () => {
	const el = await mount([
		{
			group: "cuisine",
			value: "thai",
			name: "thai",
			sub: "2 restaurants",
			ranges: [{ start: 0, end: 2 }],
		},
	]);
	expect($(el, ".name mark")?.textContent).toBe("th");
});

test("marks the current row and reports tag-open", async () => {
	const row: ListRow = {
		group: "cuisine",
		value: "thai",
		name: "thai",
		sub: "2 restaurants",
	};
	const el = await mount([row], {
		currentGroup: "cuisine",
		currentValue: "thai",
	});
	const button = $<HTMLButtonElement>(
		el,
		'li[data-group="cuisine"][data-value="thai"] button',
	)!;
	expect(button.getAttribute("aria-current")).toBe("true");
	const opens = listen<ListRow>(el, "tag-open");
	button.click();
	expect(opens).toEqual([row]);
});

const css = (): string =>
	(TagList.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("a read-only row keeps its muted, dashed look even in a mixed list", () => {
	const rule = css().match(/\.row\.static\s*\{([^}]*)\}/)?.[1];
	expect(rule, ".row.static rule").toBeDefined();
	expect(rule).toContain("color: var(--color-muted)");
	expect(rule).toMatch(/outline:\s*1px dashed var\(--color-border\)/);
	expect(rule).toContain("outline-offset: -4px");
});

test("focusRow finds a value with a quote or backslash", async () => {
	const value = 'a"b\\c';
	const el = await mount([
		{ group: "cuisine", value, name: value, sub: "1 restaurant" },
	]);
	expect(el.focusRow("cuisine", value)).toBe(true);
	const button = $<HTMLButtonElement>(
		el,
		'li[data-group="cuisine"] button[data-action="open"]',
	);
	expect(el.shadowRoot!.activeElement).toBe(button);
});
