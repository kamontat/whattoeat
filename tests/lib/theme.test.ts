import { afterEach, expect, spyOn, test } from "bun:test";
import {
	detectTheme,
	getTheme,
	initTheme,
	setTheme,
	THEME_EVENT,
	THEME_KEY,
} from "#lib/theme";

afterEach(() => {
	setTheme("auto");
	localStorage.clear();
});

test("defaults to auto with no data-theme on the page", () => {
	localStorage.clear();
	expect(detectTheme()).toBe("auto");
	setTheme("auto");
	expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
});

test("an unknown stored value falls back to auto", () => {
	localStorage.setItem(THEME_KEY, "purple");
	expect(detectTheme()).toBe("auto");
});

test("setTheme stores the choice, marks the page and fires an event", () => {
	let detail: unknown;
	const listener = (event: Event): void => {
		detail = (event as CustomEvent).detail;
	};
	window.addEventListener(THEME_EVENT, listener);
	setTheme("dark");
	window.removeEventListener(THEME_EVENT, listener);
	expect(localStorage.getItem(THEME_KEY)).toBe("dark");
	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	expect(getTheme()).toBe("dark");
	expect(detail).toBe("dark");
});

test("going back to auto removes data-theme", () => {
	setTheme("light");
	setTheme("auto");
	expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	expect(localStorage.getItem(THEME_KEY)).toBe("auto");
});

test("initTheme applies the stored theme before any render", () => {
	localStorage.setItem(THEME_KEY, "light");
	document.documentElement.removeAttribute("data-theme");
	initTheme();
	expect(document.documentElement.getAttribute("data-theme")).toBe("light");
});

test("a theme change in another tab updates this tab", () => {
	setTheme("auto");
	localStorage.setItem(THEME_KEY, "dark");
	window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
	expect(getTheme()).toBe("dark");
	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
});

test("blocked storage still switches the theme for this page", () => {
	const set = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("blocked");
	});
	const get = spyOn(Storage.prototype, "getItem").mockImplementation(() => {
		throw new Error("blocked");
	});
	try {
		expect(detectTheme()).toBe("auto");
		setTheme("dark");
		expect(getTheme()).toBe("dark");
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	} finally {
		set.mockRestore();
		get.mockRestore();
	}
});
