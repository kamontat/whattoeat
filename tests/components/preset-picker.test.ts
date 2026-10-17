import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/preset-picker";
import type { PresetPicker } from "#components/preset-picker";
import { setLang } from "#lib/i18n";
import { PRESETS_KEY, type PresetIndex } from "#lib/presets";
import type { Restaurant } from "#lib/restaurant";
import { saveRestaurants } from "#lib/store";

const make = (id: string, name = id): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	groups: {},
	kinds: [],
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

/** 2 cities, 3 districts, 9 presets: bangkok (sukhumvit, chatuchak) and chiangmai (nimman). */
const INDEX9: PresetIndex = {
	version: 1,
	cities: {
		bangkok: { en: "Bangkok", th: "กรุงเทพฯ" },
		chiangmai: { en: "Chiang Mai", th: "เชียงใหม่" },
	},
	// Inserted out of alphabetical order on purpose, so a passing test proves real sorting.
	districts: {
		sukhumvit: { en: "Sukhumvit", th: "สุขุมวิท" },
		chatuchak: { en: "Chatuchak", th: "จตุจักร" },
		nimman: { en: "Nimman", th: "นิมมาน" },
	},
	presets: [
		{
			id: "asoke",
			city: "bangkok",
			district: "sukhumvit",
			name: { en: "Asoke", th: "อโศก" },
			count: 10,
			updatedAt: "2026-10-16",
			places: ["Terminal 21", "EM District"],
			areas: [],
		},
		{
			id: "ekkamai",
			city: "bangkok",
			district: "sukhumvit",
			name: { en: "Ekkamai", th: "เอกมัย" },
			count: 5,
			updatedAt: "2026-10-16",
			places: ["Gateway Ekkamai"],
			areas: [],
		},
		{
			id: "thonglor",
			city: "bangkok",
			district: "sukhumvit",
			name: { en: "Thonglor", th: "ทองหล่อ" },
			count: 20,
			updatedAt: "2026-10-16",
			places: ["J Avenue", "The Commons", "Thonglor Soi 10"],
			areas: [],
		},
		{
			id: "kaset",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Kaset", th: "เกษตร" },
			count: 8,
			updatedAt: "2026-10-16",
			places: ["Kaset Fair", "Jas Ramindra"],
			areas: [],
		},
		{
			id: "ladprao",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Ladprao", th: "ลาดพร้าว" },
			count: 12,
			updatedAt: "2026-10-16",
			places: [
				"Central Ladprao",
				"Union Mall",
				"Lotus Ladprao",
				"Ha Yaek Lat Phrao",
				"Lat Phrao Soi 15",
			],
			areas: [],
		},
		{
			id: "ratchayothin",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Ratchayothin", th: "รัชโยธิน" },
			count: 15,
			updatedAt: "2026-10-16",
			places: ["Major Ratchayothin", "Avenue Ratchayothin", "SCB Park"],
			areas: [],
		},
		{
			id: "huay-kaew",
			city: "chiangmai",
			district: "nimman",
			name: { en: "Huay Kaew", th: "ห้วยแก้ว" },
			count: 6,
			updatedAt: "2026-10-16",
			places: ["Central Kad Suan Kaew", "Huay Kaew Road"],
			areas: [],
		},
		{
			id: "maya",
			city: "chiangmai",
			district: "nimman",
			name: { en: "Maya", th: "มายา" },
			count: 4,
			updatedAt: "2026-10-16",
			places: ["Maya Lifestyle Shopping Center"],
			areas: [],
		},
		{
			id: "nimman-soi1",
			city: "chiangmai",
			district: "nimman",
			name: { en: "Nimman Soi 1", th: "นิมมานซอยหนึ่ง" },
			count: 9,
			updatedAt: "2026-10-16",
			places: ["One Nimman", "Think Park", "Nimman Village"],
			areas: [],
		},
	],
};

/** 1 city, 2 presets: too few for the search field, and only one city for the chips. */
const INDEX2: PresetIndex = {
	version: 1,
	cities: { bangkok: { en: "Bangkok", th: "กรุงเทพฯ" } },
	districts: { chatuchak: { en: "Chatuchak", th: "จตุจักร" } },
	presets: [
		{
			id: "ladprao",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Ladprao", th: "ลาดพร้าว" },
			count: 12,
			updatedAt: "2026-10-16",
			places: ["Central Ladprao", "Union Mall"],
			areas: [],
		},
		{
			id: "ratchayothin",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Ratchayothin", th: "รัชโยธิน" },
			count: 15,
			updatedAt: "2026-10-16",
			places: ["Major Ratchayothin"],
			areas: [],
		},
	],
};

const jsonResponse = (data: unknown): Promise<Response> =>
	Promise.resolve(new Response(JSON.stringify(data)));

/** Answer every fetch of the index with `respond`, ignoring the requested URL. */
const stubFetch = (respond: () => Promise<Response>) => {
	const spy = spyOn(globalThis, "fetch").mockImplementation(((
		_input: RequestInfo | URL,
	) => respond()) as typeof fetch);
	return () => spy.mockRestore();
};

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
	setLang("en");
});

const $ = (el: PresetPicker, selector: string) =>
	el.shadowRoot!.querySelector<HTMLElement>(selector);

const $$ = (el: PresetPicker, selector: string): HTMLElement[] => [
	...el.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];

const flush = async (el: PresetPicker): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};

const mount = async (base?: string): Promise<PresetPicker> => {
	const el = document.createElement("preset-picker");
	if (base !== undefined) el.base = base;
	document.body.append(el);
	await el.updateComplete;
	await flush(el);
	return el;
};

const visibleIds = (el: PresetPicker): string[] =>
	$$(el, "[data-preset]").map((row) => row.dataset["preset"] ?? "");

const groupLabels = (el: PresetPicker): string[] =>
	$$(el, ".group-label").map((h) => h.textContent?.trim() ?? "");

const setChecked = async (
	el: PresetPicker,
	id: string,
	checked: boolean,
): Promise<void> => {
	const input = $(el, `[data-preset="${id}"] input`) as HTMLInputElement;
	input.checked = checked;
	input.dispatchEvent(new Event("change"));
	await el.updateComplete;
};

const clickChip = async (el: PresetPicker, city: string): Promise<void> => {
	($(el, `[data-city="${city}"]`) as HTMLButtonElement).click();
	await el.updateComplete;
};

const search = async (el: PresetPicker, query: string): Promise<void> => {
	const input = $(el, "input[type='search']") as HTMLInputElement;
	input.value = query;
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
};

test("shows Loading, then the list grouped by district, with districts and rows sorted by name in the current language", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = document.createElement("preset-picker");
		document.body.append(el);
		await el.updateComplete;
		expect($(el, ".loading")?.textContent?.trim()).toBe("Loading…");
		await flush(el);
		// Default city is bangkok (first in the index), so chatuchak and sukhumvit show.
		expect(groupLabels(el)).toEqual(["Chatuchak", "Sukhumvit"]);
		expect(visibleIds(el)).toEqual([
			"kaset",
			"ladprao",
			"ratchayothin",
			"asoke",
			"ekkamai",
			"thonglor",
		]);
	} finally {
		restore();
	}
});

test("a failed or malformed index shows the error and Retry; Retry fetches again", async () => {
	let calls = 0;
	const restore = stubFetch(() => {
		calls += 1;
		return calls === 1
			? jsonResponse({ version: 1 }) // malformed: missing cities/districts/presets
			: jsonResponse(INDEX9);
	});
	try {
		const el = await mount();
		expect($(el, ".error")?.textContent?.trim()).toBe(
			"The neighbourhood list could not be loaded. Check your connection and try again.",
		);
		const retry = $(el, '[data-action="retry"]') as HTMLButtonElement;
		expect(retry.textContent?.trim()).toBe("Try again");
		retry.click();
		await el.updateComplete;
		await flush(el);
		expect(calls).toBe(2);
		expect($(el, ".error")).toBeNull();
		expect($$(el, ".district").length).toBeGreaterThan(0);
	} finally {
		restore();
	}
});

test("row subtitle shows count, the first two places and +rest", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		const sub = $(el, '[data-preset="ladprao"] .sub');
		expect(sub?.textContent?.trim()).toBe(
			"12 · Central Ladprao, Union Mall +3",
		);
		const noRest = $(el, '[data-preset="asoke"] .sub');
		expect(noRest?.textContent?.trim()).toBe("10 · Terminal 21, EM District");
	} finally {
		restore();
	}
});

test("search and chips are hidden with 2 presets in 1 city", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX2));
	try {
		const el = await mount();
		expect($(el, "input[type='search']")).toBeNull();
		expect($(el, ".chips")).toBeNull();
		expect(visibleIds(el)).toEqual(["ladprao", "ratchayothin"]);
	} finally {
		restore();
	}
});

test("search matches name, district and places in en and th, across all cities while typed, and highlights the matched place", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		// Default city is bangkok; "maya" is in chiangmai, proving search ignores the chip.
		await search(el, "maya");
		expect(visibleIds(el)).toEqual(["maya"]);

		await search(el, "มายา");
		expect(visibleIds(el)).toEqual(["maya"]);

		await search(el, "nimman");
		expect(visibleIds(el).sort()).toEqual(
			["huay-kaew", "maya", "nimman-soi1"].sort(),
		);

		await search(el, "นิมมาน");
		expect(visibleIds(el).sort()).toEqual(
			["huay-kaew", "maya", "nimman-soi1"].sort(),
		);

		await search(el, "kad suan");
		expect(visibleIds(el)).toEqual(["huay-kaew"]);
		const mark = $(el, '[data-preset="huay-kaew"] mark');
		expect(mark?.textContent).toBe("Kad Suan");
	} finally {
		restore();
	}
});

test("chips filter districts by city; switching chip keeps the selection", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		expect($(el, '[data-district="nimman"]')).toBeNull();
		await setChecked(el, "asoke", true);
		await clickChip(el, "chiangmai");
		expect($(el, '[data-district="sukhumvit"]')).toBeNull();
		expect($(el, '[data-district="nimman"]')).not.toBeNull();
		await clickChip(el, "bangkok");
		const checkbox = $(el, '[data-preset="asoke"] input') as HTMLInputElement;
		expect(checkbox.checked).toBe(true);
	} finally {
		restore();
	}
});

test('ticked rows hidden by search or chip show "{n} selected, not shown"; Clear empties the search and selects the first hidden ticked row\'s city', async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		// Maya (chiangmai) is ticked while visible, then hidden again by switching back.
		await clickChip(el, "chiangmai");
		await setChecked(el, "maya", true);
		await clickChip(el, "bangkok");
		await setChecked(el, "asoke", true);
		expect($(el, ".hidden-line")?.textContent?.trim()).toContain(
			"1 selected, not shown",
		);

		// A query matching nothing hides both ticked rows.
		await search(el, "zzzznomatch");
		expect($(el, ".hidden-line")?.textContent?.trim()).toContain(
			"2 selected, not shown",
		);
		expect($(el, ".no-match")?.textContent?.trim()).toBe(
			"No neighbourhood matches “zzzznomatch”.",
		);

		const clear = $(el, '[data-action="clear-search"]') as HTMLButtonElement;
		clear.click();
		await el.updateComplete;

		expect(($(el, "input[type='search']") as HTMLInputElement).value).toBe("");
		// nimman sorts before sukhumvit, so maya (chiangmai) is the first hidden row.
		expect($(el, '[data-city="chiangmai"]')?.getAttribute("aria-pressed")).toBe(
			"true",
		);
		const mayaBox = $(el, '[data-preset="maya"] input') as HTMLInputElement;
		expect(mayaBox.checked).toBe(true);
		expect($(el, ".hidden-line")?.textContent?.trim()).toContain(
			"1 selected, not shown",
		);
	} finally {
		restore();
	}
});

test("no match shows the no-match line", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		await search(el, "doesnotexist");
		expect($(el, ".no-match")?.textContent?.trim()).toBe(
			"No neighbourhood matches “doesnotexist”.",
		);
	} finally {
		restore();
	}
});

test("in Add mode, an added preset is ticked, disabled and badged Added; an update preset is tickable and badged Update", async () => {
	saveRestaurants([make("r1", "R1"), make("r2", "R2")]);
	localStorage.setItem(
		PRESETS_KEY,
		JSON.stringify([
			{ id: "ladprao", updatedAt: "2026-10-16", ids: ["r1"] },
			{ id: "ratchayothin", updatedAt: "2026-10-01", ids: ["r2"] },
		]),
	);
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		const addedRow = $(el, '[data-preset="ladprao"]')!;
		const addedBox = addedRow.querySelector("input") as HTMLInputElement;
		expect(addedBox.checked).toBe(true);
		expect(addedBox.disabled).toBe(true);
		expect(addedRow.querySelector(".badge")?.textContent?.trim()).toBe("Added");
		expect(addedRow.querySelector(".badge")?.getAttribute("data-state")).toBe(
			"added",
		);

		const updateRow = $(el, '[data-preset="ratchayothin"]')!;
		const updateBox = updateRow.querySelector("input") as HTMLInputElement;
		expect(updateBox.checked).toBe(false);
		expect(updateBox.disabled).toBe(false);
		expect(updateRow.querySelector(".badge")?.textContent?.trim()).toBe(
			"Update",
		);
		expect(updateRow.querySelector(".badge")?.getAttribute("data-state")).toBe(
			"update",
		);
	} finally {
		restore();
	}
});

test("a recorded preset whose ids are all gone is tickable with no badge", async () => {
	localStorage.setItem(
		PRESETS_KEY,
		JSON.stringify([{ id: "kaset", updatedAt: "2026-10-16", ids: ["gone"] }]),
	);
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		const row = $(el, '[data-preset="kaset"]')!;
		const box = row.querySelector("input") as HTMLInputElement;
		expect(box.checked).toBe(false);
		expect(box.disabled).toBe(false);
		expect(row.querySelector(".badge")).toBeNull();
	} finally {
		restore();
	}
});

test("a back link points to the base plus settings", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount("../../");
		const back = $(el, "a.back") as HTMLAnchorElement;
		expect(back.getAttribute("href")).toBe("../../settings");
		expect(back.textContent?.trim()).toBe("Settings");
	} finally {
		restore();
	}
});
