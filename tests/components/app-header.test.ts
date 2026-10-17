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

test("starts with a skip link to the main content", async () => {
	const el = await mount();
	const first = el.shadowRoot!.querySelector("a");
	expect(first?.classList.contains("skip")).toBe(true);
	expect(first?.getAttribute("href")).toBe("#main");
	expect(first?.textContent?.trim()).toBe("Skip to content");
});

test("the main nav links the four tabs with visible labels", async () => {
	const el = await mount();
	const nav = el.shadowRoot!.querySelector("nav")!;
	expect(nav.getAttribute("aria-label")).toBe("Main");
	const links = [...nav.querySelectorAll("a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"./",
		"./restaurants",
		"./history",
		"./settings",
	]);
	expect(links.map((a) => a.textContent?.trim())).toEqual([
		"Home",
		"Restaurants",
		"History",
		"Settings",
	]);
	for (const a of links)
		expect(a.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("marks the current page", async () => {
	const el = await mount("history");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./history");
});

test("the tags page marks the Restaurants tab and keeps its own title", async () => {
	const el = await mount("tags");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./restaurants");
	expect(document.title).toBe("Tags · What to Eat");
});

test("the brand links home with the app name", async () => {
	const el = await mount();
	const brand = el.shadowRoot!.querySelector<HTMLAnchorElement>("a.brand")!;
	expect(brand.getAttribute("href")).toBe("./");
	expect(brand.textContent?.trim()).toBe("What to Eat");
});

test("has no language or theme switches: they live in Settings", async () => {
	const el = await mount();
	expect(el.shadowRoot!.querySelector("app-preferences")).toBeNull();
	expect(el.shadowRoot!.querySelector('input[type="radio"]')).toBeNull();
});

test("titles the history page", async () => {
	await mount("history");
	expect(document.title).toBe("History · What to Eat");
});

test("translates labels and the tab title", async () => {
	const el = await mount("restaurants");
	setLang("th");
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector("nav a")?.textContent?.trim()).toBe(
		"หน้าแรก",
	);
	expect(el.shadowRoot!.querySelector("a.skip")?.textContent?.trim()).toBe(
		"ข้ามไปยังเนื้อหา",
	);
	expect(document.title).toBe("ร้านอาหาร · กินอะไรดี");
});

const preview = (el: HTMLElement) =>
	el.shadowRoot!.querySelector<HTMLAnchorElement>("a.preview");

test("flags a preview build and links its pull request", async () => {
	const el = document.createElement("app-header");
	el.pr = 34;
	document.body.append(el);
	await el.updateComplete;
	expect(preview(el)?.getAttribute("href")).toBe(
		"https://github.com/kamontat/whattoeat/pull/34",
	);
	expect(preview(el)?.textContent?.replace(/\s+/g, " ").trim()).toBe(
		"Preview #34",
	);
	setLang("th");
	await el.updateComplete;
	expect(preview(el)?.textContent?.replace(/\s+/g, " ").trim()).toBe(
		"พรีวิว #34",
	);
});

test("shows no preview flag on production", async () => {
	const el = await mount();
	expect(preview(el)).toBeNull();
});

test("the home page title is the app name", async () => {
	await mount("home");
	expect(document.title).toBe("What to Eat");
});
