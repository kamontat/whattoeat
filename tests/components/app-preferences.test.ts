import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-preferences";
import type { AppPreferences } from "#components/app-preferences";
import { LANG_EVENT, setLang } from "#lib/i18n";
import { setTheme } from "#lib/theme";

beforeEach(() => {
	setLang("en");
	setTheme("auto");
});

afterEach(() => {
	document.body.innerHTML = "";
	setLang("en");
	setTheme("auto");
	localStorage.clear();
});

const mount = async (compact = false) => {
	const el = document.createElement("app-preferences") as AppPreferences;
	el.compact = compact;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const radio = (el: AppPreferences, name: string, value: string) =>
	el.shadowRoot!.querySelector<HTMLInputElement>(
		`input[name="${name}"][value="${value}"]`,
	)!;

const choose = async (el: AppPreferences, name: string, value: string) => {
	const input = radio(el, name, value);
	input.checked = true;
	input.dispatchEvent(new Event("change", { bubbles: true }));
	await el.updateComplete;
};

test("groups each choice in a fieldset with a legend", async () => {
	const el = await mount();
	const legends = [...el.shadowRoot!.querySelectorAll("fieldset legend")].map(
		(legend) => legend.textContent?.trim(),
	);
	expect(legends).toEqual(["Language", "Theme"]);
});

test("checks the current language and theme", async () => {
	const el = await mount();
	expect(radio(el, "lang", "en").checked).toBe(true);
	expect(radio(el, "lang", "th").checked).toBe(false);
	expect(radio(el, "theme", "auto").checked).toBe(true);
});

test("language options are written in their own language", async () => {
	const el = await mount();
	const th = radio(el, "lang", "th").closest("label")!;
	expect(th.textContent?.trim()).toBe("ไทย");
	expect(th.querySelector("[lang]")?.getAttribute("lang")).toBe("th");
	const en = radio(el, "lang", "en").closest("label")!;
	expect(en.textContent).toContain("English");
	expect(en.querySelector(".visually-hidden")?.textContent?.trim()).toBe(
		"English (EN)",
	);
	expect(en.querySelector("[aria-hidden]")?.textContent?.trim()).toBe("EN");
});

test("choosing Thai switches the language and the page lang", async () => {
	const el = await mount();
	await choose(el, "lang", "th");
	expect(document.documentElement.lang).toBe("th");
	expect(
		el.shadowRoot!.querySelector("fieldset.theme legend")?.textContent?.trim(),
	).toBe("ธีม");
});

test("choosing dark marks the page", async () => {
	const el = await mount();
	await choose(el, "theme", "dark");
	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	expect(radio(el, "theme", "dark").checked).toBe(true);
});

test("theme options show their names as text in the full layout", async () => {
	const el = await mount();
	const labels = ["auto", "light", "dark"].map((value) =>
		radio(el, "theme", value).closest("label")!.textContent?.trim(),
	);
	expect(labels).toEqual(["Auto", "Light", "Dark"]);
});

test("the compact layout keeps the theme names for screen readers", async () => {
	const el = await mount(true);
	const dark = radio(el, "theme", "dark").closest("label")!;
	expect(dark.querySelector(".visually-hidden")?.textContent?.trim()).toBe(
		"Dark",
	);
	expect(dark.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("follows a change event from elsewhere, such as another tab", async () => {
	const el = await mount();
	setLang("th");
	window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: "th" }));
	await el.updateComplete;
	expect(radio(el, "lang", "th").checked).toBe(true);
});

test("two instances stay in step", async () => {
	const header = await mount(true);
	const settings = await mount();
	await choose(settings, "theme", "light");
	await header.updateComplete;
	expect(radio(header, "theme", "light").checked).toBe(true);
	expect(radio(header, "theme", "auto").checked).toBe(false);
});
