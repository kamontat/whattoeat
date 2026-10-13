import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-input";
import type { TagInput } from "#components/tag-input";
import { setLang } from "#lib/i18n";

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async (value: string[] = [], suggestions: string[] = []) => {
	const el = document.createElement("tag-input");
	el.label = "Tags";
	el.hint = "Press Enter";
	el.value = value;
	el.suggestions = suggestions;
	const changes: string[][] = [];
	el.addEventListener("change", (event) => {
		changes.push((event as CustomEvent<string[]>).detail);
	});
	document.body.append(el);
	await el.updateComplete;
	return { el, changes };
};

const box = (el: TagInput) =>
	el.shadowRoot!.querySelector<HTMLInputElement>("input")!;

const type = async (el: TagInput, text: string): Promise<void> => {
	box(el).value = text;
	box(el).dispatchEvent(new Event("input"));
	await el.updateComplete;
};

const press = async (
	el: TagInput,
	key: string,
	init: KeyboardEventInit = {},
): Promise<KeyboardEvent> => {
	const event = new KeyboardEvent("keydown", {
		key,
		cancelable: true,
		...init,
	});
	box(el).dispatchEvent(event);
	await el.updateComplete;
	return event;
};

const chips = (el: TagInput) =>
	[...el.shadowRoot!.querySelectorAll(".chip-text")].map((c) => c.textContent);
const options = (el: TagInput) =>
	[...el.shadowRoot!.querySelectorAll('[role="option"]')].map((o) =>
		o.textContent?.trim(),
	);

test("renders its label, hint and existing tags", async () => {
	const { el } = await mount(["thai"]);
	expect(el.shadowRoot!.querySelector("label")?.textContent?.trim()).toBe(
		"Tags",
	);
	expect(el.shadowRoot!.querySelector(".hint")?.textContent).toBe(
		"Press Enter",
	);
	expect(chips(el)).toEqual(["thai"]);
});

test("Enter adds the typed text as a normalized tag and clears the box", async () => {
	const { el, changes } = await mount();
	await type(el, "  Thai   Food ");
	const event = await press(el, "Enter");
	expect(event.defaultPrevented).toBe(true);
	expect(chips(el)).toEqual(["thai food"]);
	expect(box(el).value).toBe("");
	expect(changes).toEqual([["thai food"]]);
});

test("a comma adds the text before it and keeps the rest", async () => {
	const { el } = await mount();
	await type(el, "a, B,c");
	expect(chips(el)).toEqual(["a", "b"]);
	expect(box(el).value).toBe("c");
});

test("a tag already added is ignored, whatever its case", async () => {
	const { el, changes } = await mount(["thai"]);
	await type(el, "THAI");
	await press(el, "Enter");
	expect(chips(el)).toEqual(["thai"]);
	expect(changes).toEqual([]);
});

test("Enter on an empty box is left to the form", async () => {
	const { el, changes } = await mount();
	const event = await press(el, "Enter");
	expect(event.defaultPrevented).toBe(false);
	expect(changes).toEqual([]);
});

test("Enter while an input method is composing does not add a tag", async () => {
	const { el } = await mount();
	await type(el, "ก๋วย");
	await press(el, "Enter", { isComposing: true });
	expect(chips(el)).toEqual([]);
	expect(box(el).value).toBe("ก๋วย");
});

test("Backspace on an empty box removes the last tag", async () => {
	const { el, changes } = await mount(["a", "b"]);
	await press(el, "Backspace");
	expect(chips(el)).toEqual(["a"]);
	expect(changes).toEqual([["a"]]);
});

test("Backspace with text in the box keeps the tags", async () => {
	const { el } = await mount(["a"]);
	await type(el, "x");
	await press(el, "Backspace");
	expect(chips(el)).toEqual(["a"]);
});

test("each chip has a labelled remove button", async () => {
	const { el, changes } = await mount(["thai", "noodle"]);
	const remove =
		el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button.remove")[0]!;
	expect(remove.getAttribute("aria-label")).toBe("Remove thai");
	remove.click();
	await el.updateComplete;
	expect(chips(el)).toEqual(["noodle"]);
	expect(changes).toEqual([["noodle"]]);
});

test("suggestions match the typed text and skip tags already added", async () => {
	const { el } = await mount(["thai"], ["thai", "noodle", "thai food"]);
	expect(box(el).getAttribute("aria-expanded")).toBe("false");
	await type(el, "TH");
	expect(options(el)).toEqual(["thai food"]);
	expect(box(el).getAttribute("aria-expanded")).toBe("true");
});

test("at most 8 suggestions show, in the given order", async () => {
	const many = Array.from({ length: 10 }, (_, i) => `tag${i}`);
	const { el } = await mount([], many);
	await type(el, "tag");
	expect(options(el)).toEqual(many.slice(0, 8));
});

test("arrow keys move through suggestions and Enter adds the active one", async () => {
	const { el } = await mount([], ["noodle", "nori"]);
	await type(el, "no");
	await press(el, "ArrowDown");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-0");
	await press(el, "ArrowDown");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-1");
	await press(el, "ArrowDown");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-0");
	await press(el, "ArrowUp");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-1");
	expect(
		el.shadowRoot!.querySelector("#option-1")?.getAttribute("aria-selected"),
	).toBe("true");
	await press(el, "Enter");
	expect(chips(el)).toEqual(["nori"]);
	expect(options(el)).toEqual([]);
});

test("Escape closes the suggestions without adding anything", async () => {
	const { el } = await mount([], ["noodle"]);
	await type(el, "no");
	const event = await press(el, "Escape");
	expect(event.defaultPrevented).toBe(true);
	expect(options(el)).toEqual([]);
	expect(box(el).getAttribute("aria-expanded")).toBe("false");
	expect(chips(el)).toEqual([]);
});

test("clicking a suggestion adds it", async () => {
	const { el } = await mount([], ["noodle"]);
	await type(el, "no");
	el.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!.click();
	await el.updateComplete;
	expect(chips(el)).toEqual(["noodle"]);
	expect(box(el).value).toBe("");
});

test("commit adds text still in the box and returns the tags", async () => {
	const { el, changes } = await mount(["a"]);
	await type(el, "Spicy");
	expect(el.commit()).toEqual(["a", "spicy"]);
	expect(changes).toEqual([["a", "spicy"]]);
	expect(el.commit()).toEqual(["a", "spicy"]);
	expect(changes).toHaveLength(1);
});

test("clearText drops text in the box without adding it", async () => {
	const { el, changes } = await mount();
	await type(el, "half");
	el.clearText();
	await el.updateComplete;
	expect(box(el).value).toBe("");
	expect(changes).toEqual([]);
});

test("setting value from outside fires no change event", async () => {
	const { el, changes } = await mount(["a"]);
	el.value = ["b"];
	await el.updateComplete;
	expect(chips(el)).toEqual(["b"]);
	expect(changes).toEqual([]);
});

test("Enter that Safari sends to confirm an input method (keyCode 229) does not add a tag", async () => {
	const { el } = await mount();
	await type(el, "ก๋วย");
	await press(el, "Enter", { keyCode: 229 } as KeyboardEventInit);
	expect(chips(el)).toEqual([]);
	expect(box(el).value).toBe("ก๋วย");
});

test("pasting comma-separated text adds every tag", async () => {
	const { el, changes } = await mount();
	box(el).value = "a, B";
	box(el).dispatchEvent(
		new InputEvent("input", { inputType: "insertFromPaste" }),
	);
	await el.updateComplete;
	expect(chips(el)).toEqual(["a", "b"]);
	expect(box(el).value).toBe("");
	expect(changes).toEqual([["a", "b"]]);
});

test("removing a chip moves focus to the text box", async () => {
	const { el } = await mount(["thai", "noodle"]);
	const remove =
		el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button.remove")[0]!;
	remove.focus();
	remove.click();
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement).toBe(box(el));
});
