import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-header";
import type { Page } from "#components/app-header";
import { setLang } from "#lib/i18n";
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

const mount = async (current?: Page) => {
	const el = document.createElement("app-header");
	if (current) el.current = current;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("renders nav links to the five pages", async () => {
	const el = await mount();
	const links = [...el.shadowRoot!.querySelectorAll("nav a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"./",
		"./restaurants",
		"./tags",
		"./history",
		"./settings",
	]);
	expect(links.map((a) => a.textContent?.trim())).toEqual([
		"Home",
		"Restaurants",
		"Tags",
		"History",
		"Settings",
	]);
});

test("titles the history page", async () => {
	await mount("history");
	expect(document.title).toBe("History · What to Eat");
});

test("marks the current page", async () => {
	const el = await mount("restaurants");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./restaurants");
});

test("switching to Thai re-renders text and marks the button", async () => {
	const el = await mount();
	const th = el.shadowRoot!.querySelector<HTMLButtonElement>(
		'button[data-lang="th"]',
	)!;
	th.click();
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector("nav a")?.textContent?.trim()).toBe(
		"หน้าแรก",
	);
	expect(th.getAttribute("aria-pressed")).toBe("true");
	expect(
		el
			.shadowRoot!.querySelector('button[data-lang="en"]')
			?.getAttribute("aria-pressed"),
	).toBe("false");
	expect(document.documentElement.lang).toBe("th");
});

test("translates the browser tab title for the current page", async () => {
	const el = await mount("restaurants");
	expect(document.title).toBe("Restaurants · What to Eat");
	setLang("th");
	await el.updateComplete;
	expect(document.title).toBe("ร้านอาหาร · กินอะไรดี");
});

test("the home page title is the app name", async () => {
	await mount("home");
	expect(document.title).toBe("What to Eat");
});

test("renders the theme switch with auto pressed by default", async () => {
	const el = await mount();
	const group = el.shadowRoot!.querySelector(".theme");
	expect(group?.getAttribute("role")).toBe("group");
	expect(group?.getAttribute("aria-label")).toBe("Theme");
	const buttons = [
		...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button[data-theme]"),
	];
	expect(buttons.map((b) => b.getAttribute("data-theme"))).toEqual([
		"auto",
		"light",
		"dark",
	]);
	expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
		"Auto",
		"Light",
		"Dark",
	]);
	expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
		"true",
		"false",
		"false",
	]);
});

test("choosing dark marks the button and the page", async () => {
	const el = await mount();
	el.shadowRoot!.querySelector<HTMLButtonElement>(
		'button[data-theme="dark"]',
	)!.click();
	await el.updateComplete;
	expect(
		el
			.shadowRoot!.querySelector('button[data-theme="dark"]')
			?.getAttribute("aria-pressed"),
	).toBe("true");
	expect(
		el
			.shadowRoot!.querySelector('button[data-theme="auto"]')
			?.getAttribute("aria-pressed"),
	).toBe("false");
	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
});

test("theme labels follow the language", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(
		el
			.shadowRoot!.querySelector('button[data-theme="dark"]')
			?.getAttribute("aria-label"),
	).toBe("มืด");
});
