import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/app-toast";
import "#components/preset-picker";
import type { AppToast } from "#components/app-toast";
import type { PresetPicker } from "#components/preset-picker";
import { groupsKey } from "#lib/groups";
import { historyKey } from "#lib/history";
import { setLang } from "#lib/i18n";
import {
	type AddedPreset,
	loadAddedPresets,
	type PresetIndex,
	presetsKey,
} from "#lib/presets";
import { nameFromText, type Restaurant } from "#lib/restaurant";
import {
	isMemoryOnly,
	loadRestaurants,
	restaurantsKey,
	saveRestaurants,
} from "#lib/store";

const make = (id: string, name = id): Restaurant => ({
	id,
	name: nameFromText(name),
	tags: [],
	links: [],
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

test("an applied preset is tickable and badged In your list, whether or not its file changed", async () => {
	saveRestaurants([make("r1", "R1"), make("r2", "R2")]);
	localStorage.setItem(
		presetsKey(),
		JSON.stringify([
			{ id: "ladprao", updatedAt: "2026-10-16", ids: ["r1"] },
			{ id: "ratchayothin", updatedAt: "2026-10-01", ids: ["r2"] },
		]),
	);
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		for (const id of ["ladprao", "ratchayothin"]) {
			const row = $(el, `[data-preset="${id}"]`)!;
			const box = row.querySelector("input") as HTMLInputElement;
			expect(box.checked).toBe(false);
			expect(box.disabled).toBe(false);
			expect(row.querySelector(".badge")?.textContent?.trim()).toBe(
				"In your list",
			);
		}
	} finally {
		restore();
	}
});

test("a recorded preset whose ids are all gone is tickable with no badge", async () => {
	localStorage.setItem(
		presetsKey(),
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

// --- Task 6: mode, add, replace, undo ---

/** 1 city, 1 district, 3 presets with the counts the button label tests need. */
const INDEX_M: PresetIndex = {
	version: 1,
	cities: { bangkok: { en: "Bangkok", th: "กรุงเทพฯ" } },
	districts: { chatuchak: { en: "Chatuchak", th: "จตุจักร" } },
	presets: [
		{
			id: "ladprao",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Ladprao", th: "ลาดพร้าว" },
			count: 55,
			updatedAt: "2026-10-16",
			places: ["Central Ladprao"],
			areas: [],
		},
		{
			id: "ratchayothin",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Ratchayothin", th: "รัชโยธิน" },
			count: 72,
			updatedAt: "2026-10-16",
			places: ["Major Ratchayothin"],
			areas: [],
		},
		{
			id: "kaset",
			city: "bangkok",
			district: "chatuchak",
			name: { en: "Kaset", th: "เกษตร" },
			count: 1,
			updatedAt: "2026-10-16",
			places: ["Kaset Fair"],
			areas: [],
		},
	],
};

const fileOf = (...items: Restaurant[]) => ({
	app: "whattoeat",
	version: 1,
	restaurants: items,
});

/** The preset files, keyed by id. `shared` sits in both ladprao and ratchayothin. */
const FILES: Record<string, ReturnType<typeof fileOf>> = {
	ladprao: fileOf(make("l1"), make("l2"), make("shared")),
	ratchayothin: fileOf(make("r1"), make("shared")),
	kaset: fileOf(make("k1")),
};

/**
 * Answer the index fetch with `index` and each preset file from `FILES`; an id in `failing`
 * answers 500. Records every requested URL.
 */
const stubRoutes = (index: PresetIndex = INDEX_M, failing: string[] = []) => {
	const urls: string[] = [];
	const spy = spyOn(globalThis, "fetch").mockImplementation(((
		input: RequestInfo | URL,
	) => {
		const url = String(input);
		urls.push(url);
		if (url.endsWith("index.json")) return jsonResponse(index);
		const id = /presets\/([\w-]+)\.json$/.exec(url)?.[1] ?? "";
		if (failing.includes(id))
			return Promise.resolve(new Response("nope", { status: 500 }));
		const file = FILES[id];
		if (file === undefined)
			return Promise.resolve(new Response("missing", { status: 404 }));
		return jsonResponse(file);
	}) as typeof fetch);
	return { urls, restore: () => spy.mockRestore() };
};

const fileUrls = (urls: string[]): string[] =>
	urls.filter((url) => !url.endsWith("index.json"));

const savedIdsNow = (): string[] => loadRestaurants().map((item) => item.id);

const storedIds = (): string[] =>
	(
		JSON.parse(localStorage.getItem(restaurantsKey()) ?? "[]") as Restaurant[]
	).map((item) => item.id);

const storedPresets = (): AddedPreset[] =>
	JSON.parse(localStorage.getItem(presetsKey()) ?? "[]") as AddedPreset[];

const applyButton = (el: PresetPicker) =>
	$(el, 'button[data-action="apply"]') as HTMLButtonElement | null;

const press = async (el: PresetPicker, selector: string): Promise<void> => {
	($(el, selector) as HTMLElement).click();
	await el.updateComplete;
	await flush(el);
	await flush(el);
};

/** The picker's own toast: these tests mount no page-level `<app-toast>`. */
const toastOf = (el: PresetPicker): AppToast =>
	$(el, "app-toast") as unknown as AppToast;

const toastText = (el: PresetPicker): string | undefined =>
	toastOf(el).shadowRoot?.querySelector(".toast span")?.textContent?.trim();

const toastAction = (el: PresetPicker) =>
	toastOf(el).shadowRoot?.querySelector<HTMLButtonElement>(
		'[data-action="toast-action"]',
	) ?? null;

const clickUndo = async (el: PresetPicker): Promise<void> => {
	const toast = toastOf(el);
	await toast.updateComplete;
	toastAction(el)!.click();
	await el.updateComplete;
	await toast.updateComplete;
};

test("there is no Add / Replace switch", async () => {
	saveRestaurants([make("s1")]);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		expect($(el, "[name='preset-mode']")).toBeNull();
	} finally {
		restore();
	}
});

test("with nothing ticked the button is a Go to picker link to the base", async () => {
	const { restore } = stubRoutes();
	try {
		const el = await mount("../../");
		expect(applyButton(el)).toBeNull();
		const link = $(el, 'a[data-action="go-picker"]') as HTMLAnchorElement;
		expect(link.getAttribute("href")).toBe("../../");
		expect(link.textContent?.trim()).toBe("Go to picker");
		expect(link.closest(".pinned")).not.toBeNull();
	} finally {
		restore();
	}
});

test('with saved restaurants the button reads "Replace with 2 areas · 27 restaurants", is danger, and the warning names the count and profile', async () => {
	saveRestaurants([make("a"), make("b"), make("c")]);
	const { restore } = stubRoutes(INDEX9);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await setChecked(el, "ratchayothin", true);
		const button = applyButton(el)!;
		expect(button.textContent?.trim()).toBe(
			"Replace with 2 areas · 27 restaurants",
		);
		expect(button.classList.contains("danger")).toBe(true);
		expect($(el, ".replace-warning")?.textContent?.trim()).toBe(
			"Replaces the 3 restaurants in Personal.",
		);
	} finally {
		restore();
	}
});

test('with an empty profile the button reads "Use 1 area · 12 restaurants", is primary, has no warning, and saves without a confirm', async () => {
	// A ladprao file whose actual restaurant count matches the index's estimate (12).
	const ladFile = fileOf(
		...Array.from({ length: 12 }, (_, i) => make(`l${i}`)),
	);
	const spy = spyOn(globalThis, "fetch").mockImplementation(((
		input: RequestInfo | URL,
	) =>
		jsonResponse(
			String(input).endsWith("index.json") ? INDEX9 : ladFile,
		)) as typeof fetch);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		const button = applyButton(el)!;
		expect(button.textContent?.trim()).toBe("Use 1 area · 12 restaurants");
		expect(button.classList.contains("primary")).toBe(true);
		expect($(el, ".replace-warning")).toBeNull();

		await press(el, '[data-action="apply"]');
		expect($(el, '[data-action="replace-confirm"]')).toBeNull();
		expect(loadRestaurants()).toEqual(ladFile.restaurants);
		expect(loadAddedPresets()).toEqual([
			{
				id: "ladprao",
				updatedAt: "2026-10-16",
				ids: ladFile.restaurants.map((item) => item.id),
			},
		]);
		expect(toastText(el)).toBe("Added 12 restaurants");
		expect(toastAction(el)?.textContent?.trim()).toBe("Undo");

		await clickUndo(el);
		expect(loadRestaurants()).toEqual([]);
		expect(loadAddedPresets()).toEqual([]);
	} finally {
		spy.mockRestore();
	}
});

test("replacing rewrites the record to exactly the ticked presets", async () => {
	saveRestaurants([make("k1"), make("l1"), make("l2"), make("shared")]);
	localStorage.setItem(
		presetsKey(),
		JSON.stringify([
			{ id: "kaset", updatedAt: "2026-10-16", ids: ["k1"] },
			{ id: "ladprao", updatedAt: "2026-10-16", ids: ["l1", "l2", "shared"] },
		]),
	);
	const { restore } = stubRoutes(INDEX9);
	try {
		const el = await mount();
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(loadAddedPresets().map((r) => r.id)).toEqual(["ratchayothin"]);
	} finally {
		restore();
	}
});

test("the Thai labels", async () => {
	setLang("th");
	const { restore } = stubRoutes(INDEX9);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		expect(applyButton(el)?.textContent?.trim()).toBe("ใช้ 1 ย่าน · 12 ร้าน");
	} finally {
		restore();
	}
});

test("Replace opens the confirm with the counts and names; Cancel returns focus to the button; confirming saves only the ticked restaurants and keeps history and groups", async () => {
	saveRestaurants([make("s1"), make("s2")]);
	localStorage.setItem(
		presetsKey(),
		JSON.stringify([{ id: "kaset", updatedAt: "2026-10-16", ids: ["s1"] }]),
	);
	const history = JSON.stringify([
		{
			id: "h1",
			restaurantId: "s1",
			name: "s1",
			eatenAt: "2026-10-12T09:00:00.000Z",
		},
	]);
	const groups = JSON.stringify([{ id: "g1", name: "Mine" }]);
	localStorage.setItem(historyKey(), history);
	localStorage.setItem(groupsKey(), groups);
	const { restore, urls } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');

		// Nothing fetched or saved yet: only the confirm card shows.
		expect(fileUrls(urls)).toEqual([]);
		expect(applyButton(el)).toBeNull();
		expect($(el, ".replace-prompt")?.textContent?.trim()).toBe(
			"Replace your 2 restaurants with 127 from Ladprao, Ratchayothin? Your history and groups stay.",
		);
		expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
			"replace-confirm",
		);

		($(el, '[data-action="replace-cancel"]') as HTMLButtonElement).click();
		await el.updateComplete;
		await el.updateComplete;
		expect($(el, ".replace-prompt")).toBeNull();
		expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
			"apply",
		);
		expect(storedIds()).toEqual(["s1", "s2"]);

		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(storedIds()).toEqual(["l1", "l2", "shared", "r1"]);
		// Exactly the ticked presets: the old kaset record is gone.
		expect(storedPresets().map((item) => item.id)).toEqual([
			"ladprao",
			"ratchayothin",
		]);
		expect(localStorage.getItem(historyKey())).toBe(history);
		expect(localStorage.getItem(groupsKey())).toBe(groups);
		expect(toastText(el)).toBe("Replaced with 4 restaurants");
		expect(toastAction(el)?.textContent?.trim()).toBe("Undo");
		expect($(el, ".replace-prompt")).toBeNull();
		expect($(el, 'a[data-action="go-picker"]')).not.toBeNull();
	} finally {
		restore();
	}
});

test("Undo restores the list and whattoeat:presets from before, then shows Undone.", async () => {
	saveRestaurants([make("s1")]);
	const before = [{ id: "kaset", updatedAt: "2026-10-01", ids: ["s1"] }];
	localStorage.setItem(presetsKey(), JSON.stringify(before));
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(storedIds()).toEqual(["l1", "l2", "shared"]);
		expect(storedPresets()).toEqual([
			{ id: "ladprao", updatedAt: "2026-10-16", ids: ["l1", "l2", "shared"] },
		]);

		const show = spyOn(toastOf(el), "show");
		await clickUndo(el);
		expect(storedIds()).toEqual(["s1"]);
		expect(storedPresets()).toEqual(before);
		expect(loadAddedPresets()).toEqual(before);
		expect(show).toHaveBeenLastCalledWith("Undone.", { duration: 3000 });
		await toastOf(el).updateComplete;
		expect(toastText(el)).toBe("Undone.");
		expect(toastAction(el)).toBeNull();
		// The rows follow: ladprao is tickable again with no badge.
		const row = $(el, '[data-preset="ladprao"]')!;
		expect(row.querySelector(".badge")).toBeNull();
	} finally {
		restore();
	}
});

test("one file failing leaves storage untouched, keeps the selection, and shows the files error", async () => {
	saveRestaurants([make("s1")]);
	const presets = JSON.stringify([
		{ id: "kaset", updatedAt: "2026-10-16", ids: ["s1"] },
	]);
	localStorage.setItem(presetsKey(), presets);
	const rawBefore = localStorage.getItem(restaurantsKey());
	const { restore } = stubRoutes(INDEX_M, ["ratchayothin"]);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(localStorage.getItem(restaurantsKey())).toBe(rawBefore);
		expect(localStorage.getItem(presetsKey())).toBe(presets);
		expect($(el, ".files-error")?.textContent?.trim()).toBe(
			"The selected neighbourhoods could not be loaded. Nothing was changed. Try again.",
		);
		expect($(el, ".files-error")?.getAttribute("role")).toBe("alert");
		for (const id of ["ladprao", "ratchayothin"])
			expect(
				($(el, `[data-preset="${id}"] input`) as HTMLInputElement).checked,
			).toBe(true);
		expect(applyButton(el)?.textContent?.trim()).toBe(
			"Replace with 2 areas · 127 restaurants",
		);
		expect(toastText(el)).toBeUndefined();
	} finally {
		restore();
	}
});

test("a failing preset file on an empty profile shows the files error with no confirm card, and keeps the selection", async () => {
	const { restore } = stubRoutes(INDEX_M, ["ladprao"]);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		expect($(el, '[data-action="replace-confirm"]')).toBeNull();
		expect(loadRestaurants()).toEqual([]);
		expect($(el, ".files-error")?.textContent?.trim()).toBe(
			"The selected neighbourhoods could not be loaded. Nothing was changed. Try again.",
		);
		expect(
			($(el, '[data-preset="ladprao"] input') as HTMLInputElement).checked,
		).toBe(true);
		expect(applyButton(el)?.textContent?.trim()).toBe(
			"Use 1 area · 55 restaurants",
		);
		expect(toastText(el)).toBeUndefined();
	} finally {
		restore();
	}
});

test('a refused write shows the storage warning and "Replaced for this session only"; Undo after Replace still restores the in-memory list', async () => {
	saveRestaurants([make("s1"), make("s2")]);
	const { restore } = stubRoutes();
	// happy-dom bypasses a mocked Storage.prototype.setItem after real writes (see store.test.ts),
	// so swap the global for one that reads through but refuses every write.
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');

		expect(isMemoryOnly()).toBe(true);
		expect(savedIdsNow()).toEqual(["l1", "l2", "shared"]);
		// Storage itself was never changed.
		expect(storedIds()).toEqual(["s1", "s2"]);
		expect(real.getItem(presetsKey())).toBeNull();
		const warning = $(el, ".warning");
		expect(warning?.getAttribute("role")).toBe("alert");
		expect(warning?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
		expect(toastText(el)).toBe("Replaced for this session only");
		expect(toastAction(el)?.textContent?.trim()).toBe("Undo");

		await clickUndo(el);
		expect(savedIdsNow()).toEqual(["s1", "s2"]);
		await toastOf(el).updateComplete;
		expect(toastText(el)).toBe("Undone.");
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		restore();
		// Leave memory mode so later tests read localStorage again.
		saveRestaurants([]);
	}
});

test('a refused write on an empty profile shows "Added for this session only", and whattoeat:presets stays untouched', async () => {
	const { restore } = stubRoutes();
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');

		expect(isMemoryOnly()).toBe(true);
		expect(savedIdsNow()).toEqual(["l1", "l2", "shared"]);
		expect(real.getItem(restaurantsKey())).toBeNull();
		expect(real.getItem(presetsKey())).toBeNull();
		expect(toastText(el)).toBe("Added for this session only");
		expect(toastAction(el)?.textContent?.trim()).toBe("Undo");
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		restore();
		// Leave memory mode so later tests read localStorage again.
		saveRestaurants([]);
	}
});

test("when only the restaurant list write is refused, whattoeat:presets in storage is unchanged after Replace", async () => {
	saveRestaurants([make("s1"), make("s2")]);
	const presets = JSON.stringify([
		{ id: "kaset", updatedAt: "2026-10-16", ids: ["s1"] },
	]);
	localStorage.setItem(presetsKey(), presets);
	const { restore } = stubRoutes();
	// A quota failure on the large list while the small presets write still fits.
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: (key: string, value: string) => {
				if (key === restaurantsKey()) throw new Error("QuotaExceededError");
				real.setItem(key, value);
			},
		},
		configurable: true,
	});
	try {
		const el = await mount();
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(toastText(el)).toBe("Replaced for this session only");
		expect(savedIdsNow()).toEqual(["r1", "shared"]);
		expect(real.getItem(presetsKey())).toBe(presets);
		expect(storedIds()).toEqual(["s1", "s2"]);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		restore();
		saveRestaurants([]);
	}
});

test("an aria-live region announces the button label after a change", async () => {
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		const live = () => $(el, '[aria-live="polite"]');
		expect(live()).not.toBeNull();
		await setChecked(el, "ladprao", true);
		expect(live()?.textContent?.trim()).toBe("Use 1 area · 55 restaurants");
		await setChecked(el, "kaset", true);
		expect(live()?.textContent?.trim()).toBe("Use 2 areas · 56 restaurants");
	} finally {
		restore();
	}
});

test("messages go to the page's <app-toast> when one is mounted", async () => {
	const pageToast = document.createElement("app-toast");
	document.body.append(pageToast);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		expect($(el, "app-toast")).toBeNull();
		await setChecked(el, "kaset", true);
		await press(el, '[data-action="apply"]');
		await pageToast.updateComplete;
		expect(
			pageToast.shadowRoot?.querySelector(".toast span")?.textContent?.trim(),
		).toBe("Added 1 restaurants");
	} finally {
		restore();
	}
});

test("the no-match line is a status", async () => {
	const restore = stubFetch(() => jsonResponse(INDEX9));
	try {
		const el = await mount();
		await search(el, "doesnotexist");
		expect($(el, ".no-match")?.getAttribute("role")).toBe("status");
	} finally {
		restore();
	}
});

// --- Final review fixes ---

/** Swap `globalThis.ResizeObserver` for a fake whose callback the test drives. */
const fakeResizeObserver = () => {
	const real = globalThis.ResizeObserver;
	const state: {
		callback: ResizeObserverCallback | undefined;
		observed: Element[];
		disconnected: boolean;
	} = { callback: undefined, observed: [], disconnected: false };
	class Fake {
		constructor(callback: ResizeObserverCallback) {
			state.callback = callback;
		}
		observe(target: Element): void {
			state.observed.push(target);
		}
		unobserve(target: Element): void {
			state.observed = state.observed.filter((item) => item !== target);
		}
		disconnect(): void {
			state.disconnected = true;
			state.observed = [];
		}
	}
	globalThis.ResizeObserver = Fake as unknown as typeof ResizeObserver;
	/** Report `height` px for every observed element. */
	const resize = (height: number): void => {
		state.callback?.(
			state.observed.map(
				(target) =>
					({
						target,
						borderBoxSize: [{ blockSize: height, inlineSize: 320 }],
					}) as unknown as ResizeObserverEntry,
			),
			{} as ResizeObserver,
		);
	};
	return {
		state,
		resize,
		restore: () => {
			globalThis.ResizeObserver = real;
		},
	};
};

const pinnedSpace = (): string =>
	document.documentElement.style.getPropertyValue("--pinned-space");

test("the pinned area's measured height sets --pinned-space on the page root, and leaving clears it", async () => {
	saveRestaurants([make("s1")]);
	const ro = fakeResizeObserver();
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		expect(ro.state.observed.length).toBe(1);
		expect(ro.state.observed[0] === $(el, ".pinned")).toBe(true);
		ro.resize(122);
		expect(pinnedSpace()).toBe("122px");

		// The confirm card is a new pinned element; it is measured instead.
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		expect($(el, ".confirm")).not.toBeNull();
		expect(ro.state.observed.length).toBe(1);
		expect(ro.state.observed[0] === $(el, ".pinned")).toBe(true);
		ro.resize(150);
		expect(pinnedSpace()).toBe("150px");

		el.remove();
		expect(ro.state.disconnected).toBe(true);
		expect(pinnedSpace()).toBe("");
	} finally {
		ro.restore();
		restore();
		document.documentElement.style.removeProperty("--pinned-space");
	}
});

test("without ResizeObserver, --pinned-space falls back to a static room for the warning line and the button", async () => {
	const real = globalThis.ResizeObserver;
	// Simulate a browser without ResizeObserver.
	Object.defineProperty(globalThis, "ResizeObserver", {
		value: undefined,
		configurable: true,
		writable: true,
	});
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		expect(pinnedSpace()).toBe("9.5rem");
		el.remove();
		expect(pinnedSpace()).toBe("");
	} finally {
		globalThis.ResizeObserver = real;
		restore();
		document.documentElement.style.removeProperty("--pinned-space");
	}
});

test("focus moves to the pinned action after Undo and after a confirmed Replace", async () => {
	saveRestaurants([make("s1")]);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		const focused = () =>
			el.shadowRoot!.activeElement?.getAttribute("data-action");

		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		await el.updateComplete;
		expect(focused()).toBe("go-picker");

		(document.activeElement as HTMLElement | null)?.blur();
		await clickUndo(el);
		await el.updateComplete;
		expect(focused()).toBe("go-picker");

		await setChecked(el, "kaset", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		await el.updateComplete;
		expect(focused()).toBe("go-picker");
	} finally {
		restore();
	}
});

test("Replace then Undo restores the stored list and whattoeat:presets exactly", async () => {
	saveRestaurants([make("s1", "First"), make("s2", "Second")]);
	const presets = JSON.stringify([
		{ id: "kaset", updatedAt: "2026-10-01", ids: ["s1"] },
	]);
	localStorage.setItem(presetsKey(), presets);
	const listBefore = localStorage.getItem(restaurantsKey());
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(storedIds()).toEqual(["l1", "l2", "shared"]);
		expect(localStorage.getItem(presetsKey())).not.toBe(presets);

		await clickUndo(el);
		// Same records field for field (the store may write keys in its own order).
		expect(
			JSON.parse(localStorage.getItem(restaurantsKey()) ?? "null"),
		).toEqual(JSON.parse(listBefore ?? ""));
		expect(localStorage.getItem(presetsKey())).toBe(presets);
	} finally {
		restore();
	}
});

test("a refused write after Replace has its own Thai message too", async () => {
	setLang("th");
	saveRestaurants([make("s1")]);
	const { restore } = stubRoutes();
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(toastText(el)).toBe("แทนที่ไว้เฉพาะครั้งนี้เท่านั้น");
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		restore();
		saveRestaurants([]);
	}
});

test("while a save is in flight, the row checkboxes are disabled", async () => {
	saveRestaurants([make("s1")]);
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const spy = spyOn(globalThis, "fetch").mockImplementation(((
		input: RequestInfo | URL,
	) => {
		const url = String(input);
		if (url.endsWith("index.json")) return jsonResponse(INDEX_M);
		return gate.then(() => jsonResponse(FILES["ladprao"]));
	}) as typeof fetch);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		($(el, '[data-action="replace-confirm"]') as HTMLButtonElement).click();
		await el.updateComplete;
		for (const box of $$(el, "[data-preset] input"))
			expect((box as HTMLInputElement).disabled).toBe(true);

		release();
		await flush(el);
		await flush(el);
		expect(
			($(el, '[data-preset="kaset"] input') as HTMLInputElement).disabled,
		).toBe(false);
	} finally {
		spy.mockRestore();
	}
});
