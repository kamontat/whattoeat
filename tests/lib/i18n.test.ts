import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	detectLang,
	en,
	getLang,
	initLang,
	LANG_EVENT,
	LANG_KEY,
	localize,
	setLang,
	t,
	th,
} from "#lib/i18n";

test("localize gives the current language and falls back to the other when it is blank", () => {
	setLang("th");
	expect(localize({ en: "Pho", th: "เฝอ" })).toBe("เฝอ");
	expect(localize({ en: "Pho", th: " " })).toBe("Pho");
	setLang("en");
	expect(localize({ en: "Pho", th: "เฝอ" })).toBe("Pho");
	expect(localize({ en: "", th: "เฝอ" })).toBe("เฝอ");
});

test("initLang applies the current language to the page before any render", () => {
	setLang("th");
	document.documentElement.lang = "en";
	initLang();
	expect(document.documentElement.lang).toBe("th");
});

test("a language change in another tab updates this tab", () => {
	setLang("en");
	let fired = false;
	const listener = (): void => {
		fired = true;
	};
	window.addEventListener(LANG_EVENT, listener);
	// Another tab wrote the new language straight to storage.
	localStorage.setItem(LANG_KEY, "th");
	window.dispatchEvent(new StorageEvent("storage", { key: LANG_KEY }));
	window.removeEventListener(LANG_EVENT, listener);
	expect(getLang()).toBe("th");
	expect(document.documentElement.lang).toBe("th");
	expect(fired).toBe(true);
});

test("a storage event for another key leaves the language alone", () => {
	setLang("en");
	localStorage.setItem(LANG_KEY, "th");
	window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
	expect(getLang()).toBe("en");
});

const setNavigatorLanguage = (value: string): void => {
	Object.defineProperty(navigator, "language", { value, configurable: true });
};

beforeEach(() => {
	localStorage.clear();
	setNavigatorLanguage("en-US");
});

afterEach(() => {
	setLang("en");
	localStorage.clear();
	setNavigatorLanguage("en-US");
});

test("th has exactly the same keys as en", () => {
	expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
});

test("no translation is empty", () => {
	for (const value of [...Object.values(en), ...Object.values(th)])
		expect(value.trim()).not.toBe("");
});

test("detectLang prefers the stored language", () => {
	localStorage.setItem(LANG_KEY, "th");
	expect(detectLang()).toBe("th");
});

test("detectLang ignores an unknown stored value", () => {
	localStorage.setItem(LANG_KEY, "fr");
	setNavigatorLanguage("th-TH");
	expect(detectLang()).toBe("th");
});

test("detectLang uses Thai for a Thai browser", () => {
	setNavigatorLanguage("th");
	expect(detectLang()).toBe("th");
});

test("detectLang falls back to English", () => {
	setNavigatorLanguage("ja-JP");
	expect(detectLang()).toBe("en");
});

test("setLang saves, updates html lang and notifies", () => {
	let detail: unknown;
	const listener = (event: Event): void => {
		detail = (event as CustomEvent).detail;
	};
	window.addEventListener(LANG_EVENT, listener);
	setLang("th");
	window.removeEventListener(LANG_EVENT, listener);
	expect(getLang()).toBe("th");
	expect(localStorage.getItem(LANG_KEY)).toBe("th");
	expect(document.documentElement.lang).toBe("th");
	expect(detail).toBe("th");
});

test("t returns the current language text", () => {
	setLang("en");
	expect(t("nav.home")).toBe("Home");
	setLang("th");
	expect(t("nav.home")).toBe("หน้าแรก");
});

test("t fills placeholders and leaves unknown ones", () => {
	setLang("en");
	expect(t("settings.count", { count: 3 })).toBe("Restaurants saved: 3");
	expect(t("settings.count")).toBe("Restaurants saved: {count}");
});

test("setLang still works when localStorage throws", () => {
	const setItem = Storage.prototype.setItem;
	Storage.prototype.setItem = () => {
		throw new Error("blocked");
	};
	try {
		setLang("th");
		expect(getLang()).toBe("th");
	} finally {
		Storage.prototype.setItem = setItem;
	}
});
