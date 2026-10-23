import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/app-toast";
import "#components/preset-picker";
import type { AppToast } from "#components/app-toast";
import type { PresetPicker } from "#components/preset-picker";
import { setLang } from "#lib/i18n";
import {
	type AddedPreset,
	loadAddedPresets,
	PRESETS_KEY,
	type PresetIndex,
} from "#lib/presets";
import { nameFromText, type Restaurant } from "#lib/restaurant";
import { isMemoryOnly, loadRestaurants, saveRestaurants } from "#lib/store";

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
		JSON.parse(
			localStorage.getItem("whattoeat:restaurants") ?? "[]",
		) as Restaurant[]
	).map((item) => item.id);

const storedPresets = (): AddedPreset[] =>
	JSON.parse(localStorage.getItem(PRESETS_KEY) ?? "[]") as AddedPreset[];

const modeInput = (el: PresetPicker, mode: "add" | "replace") =>
	$(el, `input[name="preset-mode"][value="${mode}"]`) as HTMLInputElement;

const setMode = async (
	el: PresetPicker,
	mode: "add" | "replace",
): Promise<void> => {
	const input = modeInput(el, mode);
	input.checked = true;
	input.dispatchEvent(new Event("change"));
	await el.updateComplete;
};

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

test("the switch is hidden with no saved restaurants; the mode is Add", async () => {
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		expect($(el, 'input[name="preset-mode"]')).toBeNull();
		await setChecked(el, "kaset", true);
		expect(applyButton(el)?.textContent?.trim()).toBe(
			"Add 1 area · 1 restaurant",
		);
	} finally {
		restore();
	}
});

test("the mode starts as Add on every mount, and changing it clears the selection", async () => {
	saveRestaurants([make("s1")]);
	const { restore } = stubRoutes();
	try {
		const first = await mount();
		expect(modeInput(first, "add").checked).toBe(true);
		expect($(first, '[role="radiogroup"] legend')?.textContent?.trim()).toBe(
			"When adding",
		);
		await setMode(first, "replace");
		expect(modeInput(first, "replace").checked).toBe(true);
		await setChecked(first, "kaset", true);
		await setMode(first, "add");
		const box = $(first, '[data-preset="kaset"] input') as HTMLInputElement;
		expect(box.checked).toBe(false);
		expect($(first, 'a[data-action="go-picker"]')).not.toBeNull();

		await setMode(first, "replace");
		first.remove();
		const second = await mount();
		expect(modeInput(second, "add").checked).toBe(true);
		expect(modeInput(second, "replace").checked).toBe(false);
	} finally {
		restore();
	}
});

test("arrow keys move between the two mode options", async () => {
	saveRestaurants([make("s1")]);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "kaset", true);
		const add = modeInput(el, "add");
		add.focus();
		add.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
		);
		await el.updateComplete;
		await el.updateComplete;
		expect(modeInput(el, "replace").checked).toBe(true);
		expect(el.shadowRoot!.activeElement).toBe(modeInput(el, "replace"));
		// The mode change cleared the selection.
		expect(
			($(el, '[data-preset="kaset"] input') as HTMLInputElement).checked,
		).toBe(false);

		modeInput(el, "replace").dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
		);
		await el.updateComplete;
		await el.updateComplete;
		expect(modeInput(el, "add").checked).toBe(true);
		expect(el.shadowRoot!.activeElement).toBe(modeInput(el, "add"));
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

test('in Add mode, the label sums ticked counts, skipping Added rows: "Add 2 areas · 127 restaurants"', async () => {
	saveRestaurants([make("k1")]);
	// kaset is Added: it shows ticked and locked, but does not count.
	localStorage.setItem(
		PRESETS_KEY,
		JSON.stringify([{ id: "kaset", updatedAt: "2026-10-16", ids: ["k1"] }]),
	);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await setChecked(el, "ratchayothin", true);
		expect(
			($(el, '[data-preset="kaset"] input') as HTMLInputElement).checked,
		).toBe(true);
		const button = applyButton(el)!;
		expect(button.textContent?.trim()).toBe("Add 2 areas · 127 restaurants");
		expect(button.classList.contains("primary")).toBe(true);
	} finally {
		restore();
	}
});

test('singular label "Add 1 area · 1 restaurant"', async () => {
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "kaset", true);
		expect(applyButton(el)?.textContent?.trim()).toBe(
			"Add 1 area · 1 restaurant",
		);
	} finally {
		restore();
	}
});

test('Add merges, records the presets, clears the selection, and shows "Added {k} restaurants" with Undo', async () => {
	// l1 is saved already, with an edited name that must survive.
	saveRestaurants([make("s1"), make("l1", "My edited L1")]);
	const { restore, urls } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');

		expect(fileUrls(urls).sort()).toEqual([
			"../data/presets/ladprao.json",
			"../data/presets/ratchayothin.json",
		]);
		// Saved first, then the new ids in file order, "shared" only once.
		expect(storedIds()).toEqual(["s1", "l1", "l2", "shared", "r1"]);
		expect(loadRestaurants().find((item) => item.id === "l1")?.name.en).toBe(
			"My edited L1",
		);
		expect(storedPresets()).toEqual([
			{ id: "ladprao", updatedAt: "2026-10-16", ids: ["l1", "l2", "shared"] },
			{ id: "ratchayothin", updatedAt: "2026-10-16", ids: ["r1", "shared"] },
		]);

		expect(toastText(el)).toBe("Added 3 restaurants");
		expect(toastAction(el)?.textContent?.trim()).toBe("Undo");
		// Selection cleared; the rows are now Added, and the button falls back to the link.
		expect($(el, 'a[data-action="go-picker"]')).not.toBeNull();
		const row = $(el, '[data-preset="ladprao"]')!;
		expect(row.querySelector(".badge")?.textContent?.trim()).toBe("Added");
		expect((row.querySelector("input") as HTMLInputElement).disabled).toBe(
			true,
		);
		expect($(el, ".warning")).toBeNull();
	} finally {
		restore();
	}
});

test("Add with nothing new shows the nothing-new message with no Undo, and still records the presets", async () => {
	saveRestaurants([make("k1")]);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "kaset", true);
		await press(el, '[data-action="apply"]');
		expect(storedIds()).toEqual(["k1"]);
		expect(storedPresets()).toEqual([
			{ id: "kaset", updatedAt: "2026-10-16", ids: ["k1"] },
		]);
		expect(toastText(el)).toBe(
			"Nothing new to add. These restaurants are already in your list.",
		);
		expect(toastAction(el)).toBeNull();
	} finally {
		restore();
	}
});

test("in Replace mode, Added rows unlock and show In your list; the warning line and the danger button show", async () => {
	saveRestaurants([make("l1"), make("r1")]);
	localStorage.setItem(
		PRESETS_KEY,
		JSON.stringify([
			{ id: "ladprao", updatedAt: "2026-10-16", ids: ["l1"] },
			{ id: "ratchayothin", updatedAt: "2026-10-01", ids: ["r1"] },
		]),
	);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setMode(el, "replace");
		for (const id of ["ladprao", "ratchayothin"]) {
			const row = $(el, `[data-preset="${id}"]`)!;
			const box = row.querySelector("input") as HTMLInputElement;
			expect(box.checked).toBe(false);
			expect(box.disabled).toBe(false);
			expect(row.querySelector(".badge")?.textContent?.trim()).toBe(
				"In your list",
			);
		}
		expect($(el, ".replace-warning")).toBeNull();

		await setChecked(el, "ladprao", true);
		await setChecked(el, "kaset", true);
		expect($(el, ".replace-warning")?.textContent?.trim()).toBe(
			"Your 2 saved restaurants will be removed.",
		);
		const button = applyButton(el)!;
		expect(button.classList.contains("danger")).toBe(true);
		expect(button.textContent?.trim()).toBe("Replace with 56 restaurants");
	} finally {
		restore();
	}
});

test("Replace opens the confirm with the counts and names; Cancel returns focus to the button; confirming saves only the ticked restaurants and keeps history and groups", async () => {
	saveRestaurants([make("s1"), make("s2")]);
	localStorage.setItem(
		PRESETS_KEY,
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
	localStorage.setItem("whattoeat:history", history);
	localStorage.setItem("whattoeat:groups", groups);
	const { restore, urls } = stubRoutes();
	try {
		const el = await mount();
		await setMode(el, "replace");
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
		expect(localStorage.getItem("whattoeat:history")).toBe(history);
		expect(localStorage.getItem("whattoeat:groups")).toBe(groups);
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
	localStorage.setItem(PRESETS_KEY, JSON.stringify(before));
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		expect(storedIds()).toEqual(["s1", "l1", "l2", "shared"]);
		expect(storedPresets().length).toBe(2);

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
	localStorage.setItem(PRESETS_KEY, presets);
	const rawBefore = localStorage.getItem("whattoeat:restaurants");
	const { restore } = stubRoutes(INDEX_M, ["ratchayothin"]);
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');
		expect(localStorage.getItem("whattoeat:restaurants")).toBe(rawBefore);
		expect(localStorage.getItem(PRESETS_KEY)).toBe(presets);
		expect($(el, ".files-error")?.textContent?.trim()).toBe(
			"The selected neighbourhoods could not be loaded. Nothing was changed. Try again.",
		);
		expect($(el, ".files-error")?.getAttribute("role")).toBe("alert");
		for (const id of ["ladprao", "ratchayothin"])
			expect(
				($(el, `[data-preset="${id}"] input`) as HTMLInputElement).checked,
			).toBe(true);
		expect(applyButton(el)?.textContent?.trim()).toBe(
			"Add 2 areas · 127 restaurants",
		);
		expect(toastText(el)).toBeUndefined();

		// The same failure in Replace mode, after confirming, changes nothing either.
		await setMode(el, "replace");
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(localStorage.getItem("whattoeat:restaurants")).toBe(rawBefore);
		expect(localStorage.getItem(PRESETS_KEY)).toBe(presets);
		expect($(el, ".files-error")).not.toBeNull();
		expect(
			($(el, '[data-preset="ratchayothin"] input') as HTMLInputElement).checked,
		).toBe(true);
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
		await setMode(el, "replace");
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');

		expect(isMemoryOnly()).toBe(true);
		expect(savedIdsNow()).toEqual(["l1", "l2", "shared"]);
		// Storage itself was never changed.
		expect(storedIds()).toEqual(["s1", "s2"]);
		expect(real.getItem(PRESETS_KEY)).toBeNull();
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

test("when only the restaurant list write is refused, whattoeat:presets in storage is unchanged after Add and after Replace", async () => {
	saveRestaurants([make("s1"), make("s2")]);
	const presets = JSON.stringify([
		{ id: "kaset", updatedAt: "2026-10-16", ids: ["s1"] },
	]);
	localStorage.setItem(PRESETS_KEY, presets);
	const { restore } = stubRoutes();
	// A quota failure on the large list while the small presets write still fits.
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: (key: string, value: string) => {
				if (key === "whattoeat:restaurants")
					throw new Error("QuotaExceededError");
				real.setItem(key, value);
			},
		},
		configurable: true,
	});
	try {
		const el = await mount();
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		expect(isMemoryOnly()).toBe(true);
		expect(toastText(el)).toBe("Added for this session only");
		expect(real.getItem(PRESETS_KEY)).toBe(presets);
		expect(storedIds()).toEqual(["s1", "s2"]);

		await setMode(el, "replace");
		await setChecked(el, "ratchayothin", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(toastText(el)).toBe("Replaced for this session only");
		expect(savedIdsNow()).toEqual(["r1", "shared"]);
		expect(real.getItem(PRESETS_KEY)).toBe(presets);
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
		expect(live()?.textContent?.trim()).toBe("Add 1 area · 55 restaurants");
		await setChecked(el, "kaset", true);
		expect(live()?.textContent?.trim()).toBe("Add 2 areas · 56 restaurants");
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
		await setMode(el, "replace");
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

test("without ResizeObserver, --pinned-space falls back to a static room for the switch and button", async () => {
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

test("focus moves to the pinned action after Add, after Undo, and after a confirmed Replace", async () => {
	saveRestaurants([make("s1")]);
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		const focused = () =>
			el.shadowRoot!.activeElement?.getAttribute("data-action");

		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await el.updateComplete;
		expect(focused()).toBe("go-picker");

		(document.activeElement as HTMLElement | null)?.blur();
		await clickUndo(el);
		await el.updateComplete;
		expect(focused()).toBe("go-picker");

		await setMode(el, "replace");
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
	localStorage.setItem(PRESETS_KEY, presets);
	const listBefore = localStorage.getItem("whattoeat:restaurants");
	const { restore } = stubRoutes();
	try {
		const el = await mount();
		await setMode(el, "replace");
		await setChecked(el, "ladprao", true);
		await press(el, '[data-action="apply"]');
		await press(el, '[data-action="replace-confirm"]');
		expect(storedIds()).toEqual(["l1", "l2", "shared"]);
		expect(localStorage.getItem(PRESETS_KEY)).not.toBe(presets);

		await clickUndo(el);
		// Same records field for field (the store may write keys in its own order).
		expect(
			JSON.parse(localStorage.getItem("whattoeat:restaurants") ?? "null"),
		).toEqual(JSON.parse(listBefore ?? ""));
		expect(localStorage.getItem(PRESETS_KEY)).toBe(presets);
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
		await setMode(el, "replace");
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

test("while a save is in flight, the row checkboxes and the mode switch are disabled", async () => {
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
		($(el, '[data-action="apply"]') as HTMLButtonElement).click();
		await el.updateComplete;
		for (const box of $$(el, "[data-preset] input"))
			expect((box as HTMLInputElement).disabled).toBe(true);
		for (const mode of ["add", "replace"] as const)
			expect(modeInput(el, mode).disabled).toBe(true);

		release();
		await flush(el);
		await flush(el);
		expect(modeInput(el, "add").disabled).toBe(false);
		expect(
			($(el, '[data-preset="kaset"] input') as HTMLInputElement).disabled,
		).toBe(false);
	} finally {
		spy.mockRestore();
	}
});
