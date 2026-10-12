import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-header";
import { setLang } from "#lib/i18n";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	setLang("en");
	localStorage.clear();
});

const mount = async (current?: "home" | "restaurants" | "settings") => {
	const el = document.createElement("app-header");
	if (current) el.current = current;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("renders nav links to the three pages", async () => {
	const el = await mount();
	const links = [...el.shadowRoot!.querySelectorAll("nav a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"./",
		"./restaurants",
		"./settings",
	]);
	expect(links.map((a) => a.textContent?.trim())).toEqual([
		"Home",
		"Restaurants",
		"Settings",
	]);
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
