import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-header";
import type { Page } from "#components/app-header";
import { setLang } from "#lib/i18n";
import { ACTIVE_KEY, PROFILES_KEY } from "#lib/profiles";
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
	// The Settings tab shows the active profile instead of a label of its own; see the
	// dedicated profile tests below.
	expect(links.slice(0, 3).map((a) => a.textContent?.trim())).toEqual([
		"Home",
		"Restaurants",
		"History",
	]);
	for (const a of links.slice(0, 3))
		expect(a.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("the settings tab shows the active profile's initial and name", async () => {
	const el = await mount();
	const nav = el.shadowRoot!.querySelector("nav")!;
	const settingsLink = [...nav.querySelectorAll("a")].at(-1)!;
	expect(settingsLink.querySelector("svg")).toBeNull();
	const avatar = settingsLink.querySelector(".avatar");
	expect(avatar?.textContent?.trim()).toBe("P");
	expect(settingsLink.textContent).toContain("Personal");
});

test("its accessible name says Settings and the profile", async () => {
	const el = await mount();
	const nav = el.shadowRoot!.querySelector("nav")!;
	const settingsLink = [...nav.querySelectorAll("a")].at(-1)!;
	expect(settingsLink.getAttribute("aria-label")).toBe(
		"Settings, profile Personal",
	);
});

test("a profile switched in another tab reloads the page", async () => {
	const el = await mount();
	let calls = 0;
	el.reload = () => {
		calls += 1;
	};
	window.dispatchEvent(new StorageEvent("storage", { key: ACTIVE_KEY }));
	expect(calls).toBe(1);
	window.dispatchEvent(new StorageEvent("storage", { key: PROFILES_KEY }));
	expect(calls).toBe(2);
});

test("a theme change in another tab does not reload", async () => {
	const el = await mount();
	let calls = 0;
	el.reload = () => {
		calls += 1;
	};
	window.dispatchEvent(new StorageEvent("storage", { key: "whattoeat:theme" }));
	expect(calls).toBe(0);
});

test("marks the current page", async () => {
	const el = await mount("history");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./history");
});

test("the tags page marks the Settings tab and keeps its own title", async () => {
	const el = await mount("tags");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./settings");
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

const mountPreview = async (current: Page) => {
	const el = document.createElement("app-header");
	el.current = current;
	el.pr = 34;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("marks the header of a preview build for its edge line, with no text", async () => {
	const el = await mountPreview("home");
	const header = el.shadowRoot!.querySelector("header");
	expect(header?.classList.contains("preview")).toBe(true);
	expect(header?.textContent).not.toContain("Preview");
});

test("prefixes the tab title of a preview build", async () => {
	const el = await mountPreview("settings");
	expect(document.title).toBe("[Preview] Settings · What to Eat");
	setLang("th");
	await el.updateComplete;
	expect(document.title).toBe("[พรีวิว] ตั้งค่า · กินอะไรดี");
});

test("prefixes the home page tab title of a preview build", async () => {
	await mountPreview("home");
	expect(document.title).toBe("[Preview] What to Eat");
});

test("leaves production unmarked", async () => {
	const el = await mount("settings");
	expect(
		el.shadowRoot!.querySelector("header")?.classList.contains("preview"),
	).toBe(false);
	expect(document.title).toBe("Settings · What to Eat");
});

test("the home page title is the app name", async () => {
	await mount("home");
	expect(document.title).toBe("What to Eat");
});

test("base prefixes every tab and the brand link", async () => {
	const el = await mount();
	el.base = "../";
	await el.updateComplete;
	const nav = el.shadowRoot!.querySelector("nav")!;
	const links = [...nav.querySelectorAll("a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"../",
		"../restaurants",
		"../history",
		"../settings",
	]);
	const brand = el.shadowRoot!.querySelector<HTMLAnchorElement>("a.brand")!;
	expect(brand.getAttribute("href")).toBe("../");
});

test("the default base keeps today's links", async () => {
	const el = await mount();
	const nav = el.shadowRoot!.querySelector("nav")!;
	const links = [...nav.querySelectorAll("a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"./",
		"./restaurants",
		"./history",
		"./settings",
	]);
	const brand = el.shadowRoot!.querySelector<HTMLAnchorElement>("a.brand")!;
	expect(brand.getAttribute("href")).toBe("./");
});

test("presets highlights the Settings tab and titles the browser tab", async () => {
	const el = await mount("presets");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./settings");
	expect(document.title).toBe("Neighbourhoods · What to Eat");
});
