import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/data-transfer";
import type { DataTransferPanel } from "#components/data-transfer";
import {
	forgetGroupsMemory,
	groupsKey,
	loadGroups,
	saveGroups,
} from "#lib/groups";
import {
	type HistoryEntry,
	historyKey,
	loadHistory,
	saveHistory,
} from "#lib/history";
import { getLang, setLang } from "#lib/i18n";
import {
	loadAddedPresets,
	type PresetIndex,
	saveAddedPresets,
} from "#lib/presets";
import {
	ACTIVE_KEY,
	activeProfile,
	createProfile,
	PROFILES_KEY,
	profileInitial,
	switchProfile,
} from "#lib/profiles";
import { nameFromText, type Restaurant } from "#lib/restaurant";
import {
	addRestaurant,
	loadRestaurants,
	restaurantsKey,
	saveRestaurants,
} from "#lib/store";
import { compressExport, readExportFile, toExportFile } from "#lib/transfer";

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

const visit = (id: string, visitedAt: string): HistoryEntry => ({
	id,
	restaurantId: "x",
	name: "X",
	visitedAt,
});

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("data-transfer");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = (el: DataTransferPanel, selector: string) =>
	el.shadowRoot!.querySelector<HTMLElement>(selector);

const click = async (
	el: DataTransferPanel,
	selector: string,
): Promise<void> => {
	$(el, selector)!.click();
	await el.updateComplete;
};

test("shows the saved restaurant count and keeps it current", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 1");
	addRestaurant({ name: { en: "B", th: "" }, tags: [], links: [], notes: "" });
	await el.updateComplete;
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 2");
});

test("export downloads a compressed file of the stored list", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	saveHistory([visit("h1", "2026-10-12T09:00:00.000Z")]);
	const blobs: Blob[] = [];
	const create = spyOn(URL, "createObjectURL").mockImplementation(
		(blob: Blob | MediaSource) => {
			blobs.push(blob as Blob);
			return "blob:test";
		},
	);
	let downloaded = "";
	const anchorClick = spyOn(
		HTMLAnchorElement.prototype,
		"click",
	).mockImplementation(function (this: HTMLAnchorElement) {
		downloaded = this.download;
	});
	try {
		const el = await mount();
		$(el, 'button[data-action="export"]')!.click();
		await flush(el);
		expect(downloaded).toMatch(/^whattoeat-\d{4}-\d{2}-\d{2}\.json\.gz$/);
		expect(blobs[0]!.type).toBe("application/gzip");
		const file = JSON.parse(await readExportFile(blobs[0]!));
		expect(file).toMatchObject({
			app: "whattoeat",
			version: 8,
			restaurants: loadRestaurants(),
			history: [visit("h1", "2026-10-12T09:00:00.000Z")],
		});
	} finally {
		create.mockRestore();
		anchorClick.mockRestore();
	}
});

test("export keeps the download URL alive long enough for the browser", async () => {
	const create = spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
	const revoke = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	const anchorClick = spyOn(
		HTMLAnchorElement.prototype,
		"click",
	).mockImplementation(() => {});
	const delays: number[] = [];
	const timer = spyOn(globalThis, "setTimeout").mockImplementation(((
		_handler: () => void,
		delay?: number,
	) => {
		delays.push(delay ?? 0);
		return 0;
	}) as unknown as typeof setTimeout);
	try {
		const el = await mount();
		await el.exportData();
		expect(create).toHaveBeenCalled();
		expect(revoke).not.toHaveBeenCalled();
		expect(Math.max(...delays)).toBeGreaterThanOrEqual(1000);
	} finally {
		timer.mockRestore();
		create.mockRestore();
		revoke.mockRestore();
		anchorClick.mockRestore();
	}
});

test("a file that cannot be read shows an error", async () => {
	const el = await mount();
	const input =
		el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
	const unreadable = { text: () => Promise.reject(new Error("moved")) };
	Object.defineProperty(input, "files", {
		value: [unreadable],
		configurable: true,
	});
	input.dispatchEvent(new Event("change"));
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The file could not be read. Choose it again.",
	);
});

test("an invalid file shows an error and changes nothing", async () => {
	addRestaurant({
		name: { en: "Keep", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	const el = await mount();
	el.readImport("{oops");
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The data is not valid JSON.",
	);
	expect($(el, 'button[data-action="replace"]')).toBeNull();
	expect(loadRestaurants().map((r) => r.name.en)).toEqual(["Keep"]);
});

test("a file with a bad entry is rejected", async () => {
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 1,
			restaurants: [{ ...make("a"), name: " " }],
		}),
	);
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The data contains invalid restaurant data.",
	);
	expect(loadRestaurants()).toEqual([]);
});

test("replace swaps the whole list", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X"), make("y", "Y")])));
	await el.updateComplete;
	expect($(el, ".found")?.textContent?.trim()).toBe("2 restaurants found.");
	await click(el, 'button[data-action="replace"]');
	expect(loadRestaurants()).toEqual([make("x", "X"), make("y", "Y")]);
	expect($(el, ".success")?.textContent?.trim()).toBe(
		"Import complete. 2 restaurants saved.",
	);
	expect($(el, 'button[data-action="replace"]')).toBeNull();
});

test("merge keeps existing restaurants and adds new ones", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X")])));
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadRestaurants().map((r) => r.name.en)).toEqual(["Old", "X"]);
	expect($(el, ".success")?.textContent?.trim()).toBe(
		"Import complete. 2 restaurants saved.",
	);
});

test("cancel import discards the pending file", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x")])));
	await el.updateComplete;
	await click(el, 'button[data-action="cancel-import"]');
	expect($(el, ".found")).toBeNull();
	expect(loadRestaurants().map((r) => r.name.en)).toEqual(["Old"]);
});

test("an import saves at once without asking when nothing is saved yet", async () => {
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile(
				[make("x", "X")],
				[visit("theirs", "2026-10-12T09:00:00.000Z")],
			),
		),
	);
	await el.updateComplete;
	expect($(el, 'button[data-action="replace"]')).toBeNull();
	expect($(el, 'button[data-action="merge"]')).toBeNull();
	expect(loadRestaurants()).toEqual([make("x", "X")]);
	expect(loadHistory().map((item) => item.id)).toEqual(["theirs"]);
	expect($(el, ".success")?.textContent?.trim()).toBe(
		"Import complete. 1 restaurants saved.",
	);
});

test("an import still asks when only history is saved", async () => {
	saveHistory([visit("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X")])));
	await el.updateComplete;
	expect($(el, 'button[data-action="merge"]')).not.toBeNull();
	expect(loadRestaurants()).toEqual([]);
});

test("choosing a file reads and validates it", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	const el = await mount();
	const input =
		el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
	const file = new File(
		[JSON.stringify(toExportFile([make("x")]))],
		"list.json",
		{ type: "application/json" },
	);
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	input.dispatchEvent(new Event("change"));
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
	expect($(el, ".found")?.textContent?.trim()).toBe("1 restaurants found.");
});

test("choosing a compressed file reads and validates it", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	const el = await mount();
	const input =
		el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
	expect(input.accept).toContain(".gz");
	const gz = await compressExport(
		JSON.stringify(toExportFile([make("x"), make("y")])),
	);
	const file = new File([gz], "list.json.gz", { type: "application/gzip" });
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	input.dispatchEvent(new Event("change"));
	await new Promise((resolve) => setTimeout(resolve, 10));
	await el.updateComplete;
	expect($(el, ".found")?.textContent?.trim()).toBe("2 restaurants found.");
});

test("an import the browser refuses to store warns instead of claiming success", async () => {
	const el = await mount();
	const real = globalThis.localStorage;
	const full = {
		getItem: () => null,
		setItem: () => {
			throw new Error("QuotaExceededError");
		},
	};
	Object.defineProperty(globalThis, "localStorage", {
		value: full,
		configurable: true,
	});
	try {
		el.readImport(JSON.stringify(toExportFile([make("x")])));
		await el.updateComplete;
		expect($(el, ".success")).toBeNull();
		expect($(el, ".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		saveRestaurants([]);
	}
});

const setClipboard = (writeText: (text: string) => Promise<void>) => {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
};

const flush = async (el: DataTransferPanel): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};

test("copy puts one-line export json on the clipboard", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	saveHistory([visit("h1", "2026-10-12T09:00:00.000Z")]);
	let copied = "";
	setClipboard(async (text) => {
		copied = text;
	});
	const el = await mount();
	$(el, 'button[data-action="copy"]')!.click();
	await flush(el);
	expect(copied).not.toContain("\n");
	expect(JSON.parse(copied)).toMatchObject({
		app: "whattoeat",
		version: 8,
		restaurants: loadRestaurants(),
		history: [visit("h1", "2026-10-12T09:00:00.000Z")],
	});
	expect($(el, ".copied")?.textContent?.trim()).toBe(
		"Copied 1 restaurants to the clipboard.",
	);
	expect($(el, "textarea.copy-fallback")).toBeNull();
});

test("a blocked clipboard shows the json to copy by hand", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	setClipboard(() => Promise.reject(new Error("NotAllowedError")));
	const el = await mount();
	$(el, 'button[data-action="copy"]')!.click();
	await flush(el);
	const fallback = el.shadowRoot!.querySelector<HTMLTextAreaElement>(
		"textarea.copy-fallback",
	)!;
	expect(fallback.readOnly).toBe(true);
	expect(JSON.parse(fallback.value).restaurants).toEqual(loadRestaurants());
	expect($(el, ".copied")).toBeNull();
	expect($(el, ".copy-failed")?.textContent?.trim()).toBe(
		"Could not copy. Select the text below and copy it.",
	);
});

test("a browser without a clipboard shows the json to copy by hand", async () => {
	Object.defineProperty(navigator, "clipboard", {
		value: undefined,
		configurable: true,
	});
	const el = await mount();
	$(el, 'button[data-action="copy"]')!.click();
	await flush(el);
	expect($(el, "textarea.copy-fallback")).not.toBeNull();
});

const setClipboardText = (readText: () => Promise<string>) => {
	Object.defineProperty(navigator, "clipboard", {
		value: { readText },
		configurable: true,
	});
};

const pasteByHand = async (
	el: DataTransferPanel,
	text: string,
): Promise<void> => {
	const area =
		el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea.paste")!;
	area.value = text;
	area.dispatchEvent(new Event("input"));
	await el.updateComplete;
	await click(el, 'button[data-action="check-paste"]');
};

test("paste reads the clipboard and checks it in one tap", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	setClipboardText(() =>
		Promise.resolve(JSON.stringify(toExportFile([make("x", "X")]))),
	);
	const el = await mount();
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect($(el, "textarea.paste")).toBeNull();
	expect($(el, ".found")?.textContent?.trim()).toBe("1 restaurants found.");
	await click(el, 'button[data-action="merge"]');
	expect(loadRestaurants().map((r) => r.name.en)).toEqual(["Old", "X"]);
});

test("paste imports straight away when nothing is saved", async () => {
	setClipboardText(() =>
		Promise.resolve(JSON.stringify(toExportFile([make("x", "X")]))),
	);
	const el = await mount();
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect($(el, 'button[data-action="merge"]')).toBeNull();
	expect(loadRestaurants()).toEqual([make("x", "X")]);
	expect($(el, ".success")?.textContent?.trim()).toBe(
		"Import complete. 1 restaurants saved.",
	);
});

test("clipboard text that is not an export shows an error", async () => {
	setClipboardText(() => Promise.resolve("hello"));
	const el = await mount();
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The data is not valid JSON.",
	);
	expect($(el, 'button[data-action="merge"]')).toBeNull();
});

test("a blocked clipboard read opens a box to paste by hand", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	setClipboardText(() => Promise.reject(new Error("NotAllowedError")));
	const el = await mount();
	expect($(el, "textarea.paste")).toBeNull();
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect($(el, ".paste-failed")?.textContent?.trim()).toBe(
		"Could not read the clipboard. Paste the JSON below.",
	);
	expect($(el, "textarea.paste")?.getAttribute("aria-label")).toBe(
		"Paste JSON",
	);
	expect(
		el.shadowRoot!.querySelector<HTMLButtonElement>(
			'button[data-action="check-paste"]',
		)!.disabled,
	).toBe(true);
	await pasteByHand(el, JSON.stringify(toExportFile([make("x", "X")])));
	expect($(el, ".found")?.textContent?.trim()).toBe("1 restaurants found.");
	await click(el, 'button[data-action="merge"]');
	expect(loadRestaurants().map((r) => r.name.en)).toEqual(["Old", "X"]);
	expect($(el, "textarea.paste")).toBeNull();
});

test("cancel closes the paste box so paste reads the clipboard again", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	setClipboardText(() => Promise.reject(new Error("NotAllowedError")));
	const el = await mount();
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	await pasteByHand(el, "hello");
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The data is not valid JSON.",
	);
	await click(el, 'button[data-action="cancel-paste"]');
	expect($(el, "textarea.paste")).toBeNull();
	expect($(el, ".paste-failed")).toBeNull();
	expect($(el, ".error")).toBeNull();
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"paste",
	);
	setClipboardText(() =>
		Promise.resolve(JSON.stringify(toExportFile([make("x", "X")]))),
	);
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect($(el, "textarea.paste")).toBeNull();
	expect($(el, ".found")?.textContent?.trim()).toBe("1 restaurants found.");
	// The text typed before cancelling is gone if the box opens again.
	setClipboardText(() => Promise.reject(new Error("NotAllowedError")));
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect(
		el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea.paste")!.value,
	).toBe("");
});

test("an empty clipboard or a browser without one opens the paste box", async () => {
	setClipboardText(() => Promise.resolve("  "));
	const el = await mount();
	$(el, 'button[data-action="paste"]')!.click();
	await flush(el);
	expect($(el, "textarea.paste")).not.toBeNull();
	Object.defineProperty(navigator, "clipboard", {
		value: undefined,
		configurable: true,
	});
	const other = await mount();
	$(other, 'button[data-action="paste"]')!.click();
	await flush(other);
	expect($(other, "textarea.paste")).not.toBeNull();
});

test("warns about stored entries that could not be read until a save drops them", async () => {
	localStorage.setItem(
		restaurantsKey(),
		JSON.stringify([{ name: "broken" }, null]),
	);
	const el = await mount();
	expect(el.shadowRoot!.querySelector(".skipped")?.textContent?.trim()).toBe(
		"2 saved restaurants could not be read and were skipped. They will be removed the next time the list changes.",
	);
	addRestaurant({
		name: { en: "Fresh", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector(".skipped")).toBeNull();
});

test("uses the singular when one stored entry could not be read", async () => {
	localStorage.setItem(restaurantsKey(), "{not json");
	const el = await mount();
	expect(el.shadowRoot!.querySelector(".skipped")?.textContent?.trim()).toBe(
		"1 saved restaurant could not be read and was skipped. It will be removed the next time the list changes.",
	);
});

test("the reset prompt is padded on every side inside its card, not a squeezed list row", async () => {
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	const prompt = $(el, ".reset-prompt")!;
	expect(prompt.classList.contains("item")).toBe(false);
	expect(prompt.closest(".confirm")?.closest(".group")).toBe(
		$(el, "section.reset .group.reset-all"),
	);
	const css = [
		(customElements.get("data-transfer") as unknown as { styles: unknown })
			.styles,
	]
		.flat(2)
		.map((style) => (style as { cssText: string }).cssText)
		.join("");
	expect(css).toMatch(/\.confirm\s*\{[^}]*padding:\s*1rem 1\.125rem/);
});

test("reset asks for confirmation and can be cancelled", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	expect($(el, 'button[data-action="reset-confirm"]')).toBeNull();
	await click(el, 'button[data-action="reset"]');
	expect($(el, ".reset-prompt")?.textContent?.trim()).toBe(
		"Delete 1 profile with 1 restaurant in total, plus all history and settings saved in this browser? This cannot be undone.",
	);
	await click(el, 'button[data-action="reset-cancel"]');
	expect($(el, 'button[data-action="reset-confirm"]')).toBeNull();
	expect(loadRestaurants()).toHaveLength(1);
});

test("the reset prompt counts every profile and the restaurants across all of them", async () => {
	const first = activeProfile();
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	createProfile("Family");
	addRestaurant({ name: { en: "B", th: "" }, tags: [], links: [], notes: "" });
	addRestaurant({ name: { en: "C", th: "" }, tags: [], links: [], notes: "" });
	createProfile("Couple");
	switchProfile(first.id);
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	expect($(el, ".reset-prompt")?.textContent?.trim()).toBe(
		"Delete 3 profiles with 3 restaurants in total, plus all history and settings saved in this browser? This cannot be undone.",
	);
});

test("the reset prompt in Thai", async () => {
	setLang("th");
	createProfile("ครอบครัว");
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	expect($(el, ".reset-prompt")?.textContent?.trim()).toBe(
		"ลบ 2 โปรไฟล์ รวมร้านอาหาร 1 ร้าน พร้อมประวัติและการตั้งค่าทั้งหมดที่บันทึกไว้ในเบราว์เซอร์นี้หรือไม่ การลบนี้ย้อนกลับไม่ได้",
	);
});

test("reset moves focus to the confirm button, cancel moves it back", async () => {
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"reset-confirm",
	);
	await click(el, 'button[data-action="reset-cancel"]');
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"reset",
	);
});

test("confirming reset deletes everything in localStorage", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	setLang("th");
	localStorage.setItem("whattoeat:theme", "dark");
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	await click(el, 'button[data-action="reset-confirm"]');
	// The component's re-render reads the (now empty) restaurant list, which lazily recreates the
	// default profile; only its two bootstrap keys remain.
	const remaining = Array.from({ length: localStorage.length }, (_, i) =>
		localStorage.key(i),
	);
	expect(remaining.sort()).toEqual([ACTIVE_KEY, PROFILES_KEY].sort());
	expect(loadRestaurants()).toEqual([]);
	// happy-dom reports an English browser, so the language falls back to English.
	expect(getLang()).toBe("en");
	await el.updateComplete;
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 0");
	expect($(el, ".reset-done")?.textContent?.trim()).toBe(
		"All saved data was deleted.",
	);
});

test("replace with a version 3 file replaces history too", async () => {
	saveHistory([visit("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile(
				[make("x", "X")],
				[visit("theirs", "2026-10-12T09:00:00.000Z")],
			),
		),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadHistory().map((item) => item.id)).toEqual(["theirs"]);
});

test("replace with a version 1 file keeps the current history", async () => {
	saveHistory([visit("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 1,
			restaurants: [make("x", "X")],
		}),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadRestaurants()).toEqual([make("x", "X")]);
	expect(loadHistory().map((item) => item.id)).toEqual(["mine"]);
});

test("merge combines history newest first", async () => {
	saveHistory([visit("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile(
				[make("x", "X")],
				[visit("theirs", "2026-10-12T09:00:00.000Z")],
			),
		),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadHistory().map((item) => item.id)).toEqual(["theirs", "mine"]);
});

test("confirming reset deletes the history too", async () => {
	saveHistory([visit("mine", "2026-10-01T09:00:00.000Z")]);
	const el = await mount();
	await click(el, 'button[data-action="reset"]');
	await click(el, 'button[data-action="reset-confirm"]');
	expect(localStorage.getItem(historyKey())).toBeNull();
	expect(loadHistory()).toEqual([]);
});

test("warns when the browser refuses to save the group list", async () => {
	const el = await mount();
	expect($(el, ".warning")).toBeNull();
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: (key: string, value: string) => {
				if (key === groupsKey()) throw new Error("QuotaExceededError");
				real.setItem(key, value);
			},
		},
		configurable: true,
	});
	try {
		saveGroups([{ id: "g1", name: "Price" }]);
		await el.updateComplete;
		expect($(el, ".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		forgetGroupsMemory();
	}
});

test("an import whose history the browser refuses to store warns", async () => {
	const el = await mount();
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (key: string) => real.getItem(key),
			setItem: (key: string, value: string) => {
				if (key === historyKey()) throw new Error("QuotaExceededError");
				real.setItem(key, value);
			},
		},
		configurable: true,
	});
	try {
		el.readImport(
			JSON.stringify(
				toExportFile(
					[make("x", "X")],
					[visit("theirs", "2026-10-12T09:00:00.000Z")],
				),
			),
		);
		await el.updateComplete;
		expect($(el, ".success")).toBeNull();
		expect($(el, ".warning")?.textContent?.trim()).toBe(
			"Your browser is not saving changes. They will be lost when you leave this page.",
		);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
		saveHistory([]);
	}
});

test("replace with a version 4 file replaces the groups and keeps their values", async () => {
	saveGroups([{ id: "old", name: "Old" }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 4,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [{ ...make("a"), groups: { g1: ["cheap"] } }],
			history: [],
			groups: [{ id: "g1", name: "Price" }],
		}),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
	expect(loadRestaurants()[0]?.groups).toEqual({ g1: ["cheap"] });
});

test("merge folds a file group into an existing one with the same name", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 4,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [{ ...make("b"), groups: { x9: ["cheap"] } }],
			history: [],
			groups: [{ id: "x9", name: "price" }],
		}),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
	expect(loadRestaurants().find((item) => item.id === "b")?.groups).toEqual({
		g1: ["cheap"],
	});
});

test("replace with a version 3 file keeps the current groups", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 3,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [],
			history: [],
		}),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
});

test("Replace takes the file's preset record", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	saveAddedPresets([{ id: "ladprao", updatedAt: "2026-10-01", ids: ["old"] }]);
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile(
				[make("x", "X")],
				[],
				[],
				[{ id: "siam", updatedAt: "2026-10-23", ids: ["x"] }],
			),
		),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadAddedPresets()).toEqual([
		{ id: "siam", updatedAt: "2026-10-23", ids: ["x"] },
	]);
});

test("Merge adds only presets the profile has no record of", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	saveAddedPresets([{ id: "siam", updatedAt: "2026-10-01", ids: ["mine"] }]);
	const el = await mount();
	el.readImport(
		JSON.stringify(
			toExportFile(
				[make("x", "X")],
				[],
				[],
				[
					{ id: "siam", updatedAt: "2026-10-23", ids: ["x"] },
					{ id: "ladprao", updatedAt: "2026-10-16", ids: ["y"] },
				],
			),
		),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadAddedPresets()).toEqual([
		{ id: "siam", updatedAt: "2026-10-01", ids: ["mine"] },
		{ id: "ladprao", updatedAt: "2026-10-16", ids: ["y"] },
	]);
});

test("Replace with a version 7 file leaves no preset record", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	saveAddedPresets([{ id: "siam", updatedAt: "2026-10-01", ids: ["mine"] }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 7,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [make("x", "X")],
			history: [],
			groups: [],
		}),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="replace"]');
	expect(loadAddedPresets()).toEqual([]);
});

test("Merge with a version 7 file keeps the profile's record", async () => {
	addRestaurant({
		name: { en: "Old", th: "" },
		tags: [],
		links: [],
		notes: "",
	});
	saveAddedPresets([{ id: "siam", updatedAt: "2026-10-01", ids: ["mine"] }]);
	const el = await mount();
	el.readImport(
		JSON.stringify({
			app: "whattoeat",
			version: 7,
			exportedAt: "2026-10-14T00:00:00.000Z",
			restaurants: [make("x", "X")],
			history: [],
			groups: [],
		}),
	);
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadAddedPresets()).toEqual([
		{ id: "siam", updatedAt: "2026-10-01", ids: ["mine"] },
	]);
});

test("Download and Copy include the preset record", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	saveAddedPresets([{ id: "siam", updatedAt: "2026-10-01", ids: ["a"] }]);
	const blobs: Blob[] = [];
	const create = spyOn(URL, "createObjectURL").mockImplementation(
		(blob: Blob | MediaSource) => {
			blobs.push(blob as Blob);
			return "blob:test";
		},
	);
	const anchorClick = spyOn(
		HTMLAnchorElement.prototype,
		"click",
	).mockImplementation(() => {});
	let copied = "";
	setClipboard(async (text) => {
		copied = text;
	});
	try {
		const el = await mount();
		$(el, 'button[data-action="export"]')!.click();
		await flush(el);
		const downloaded = JSON.parse(await readExportFile(blobs[0]!));
		expect(downloaded.presets).toEqual([
			{ id: "siam", updatedAt: "2026-10-01", ids: ["a"] },
		]);
		$(el, 'button[data-action="copy"]')!.click();
		await flush(el);
		expect(JSON.parse(copied).presets).toEqual([
			{ id: "siam", updatedAt: "2026-10-01", ids: ["a"] },
		]);
	} finally {
		create.mockRestore();
		anchorClick.mockRestore();
	}
});

test("settings is grouped under Profile, This device, Organise, Export, Import, Reset and About", async () => {
	const el = await mount();
	const headings = [
		...el.shadowRoot!.querySelectorAll("section > h2.group-label"),
	].map((h) => h.textContent?.trim());
	expect(headings).toEqual([
		"Profile",
		"This device",
		"Organise",
		"Export",
		"Import",
		"Reset",
		"About",
	]);
	for (const section of el.shadowRoot!.querySelectorAll("section")) {
		const id = section.getAttribute("aria-labelledby");
		expect(id).not.toBeNull();
		expect(section.querySelector(`#${id}`)?.tagName).toBe("H2");
	}
});

test("the first section links to the profiles page with the active profile's name and count", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	addRestaurant({ name: { en: "B", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	const sections = [...el.shadowRoot!.querySelectorAll("section")];
	expect(sections[0]?.className).toBe("profile");
	expect($(el, "#profile-title")?.textContent?.trim()).toBe("Profile");
	const row = $(
		el,
		'section.profile a.item[data-action="profiles"]',
	) as HTMLAnchorElement | null;
	expect(row?.getAttribute("href")).toBe("./settings/profiles");
	expect(row?.querySelector(".lead.avatar")?.textContent?.trim()).toBe(
		profileInitial(activeProfile().name),
	);
	expect(row?.querySelector("b")?.textContent?.trim()).toBe(
		activeProfile().name,
	);
	expect(row?.querySelector("small")?.textContent?.trim()).toBe(
		"2 restaurants",
	);
	expect(row?.querySelector(".trail svg")).not.toBeNull();
});

test("the appearance section is titled This device", async () => {
	const el = await mount();
	expect($(el, "#appearance-title")?.textContent?.trim()).toBe("This device");
});

test("the appearance section holds the language and theme switches", async () => {
	const el = await mount();
	const prefs = $(el, "section.appearance app-preferences");
	expect(prefs).not.toBeNull();
});

test("the about section holds the source, changelog and build links", async () => {
	const el = await mount();
	expect($(el, "section.about app-footer")).not.toBeNull();
});

test("export and copy are list rows with their labels and icons", async () => {
	const el = await mount();
	const exportRow = $(el, 'section.export button.item[data-action="export"]');
	expect(exportRow?.textContent).toContain("Download file");
	expect(exportRow?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
		"true",
	);
	expect(
		$(el, 'section.export button.item[data-action="copy"]')?.textContent,
	).toContain("Copy JSON");
});

test("the file input is still a real input inside its labelled row", async () => {
	const el = await mount();
	const input = $(
		el,
		'section.import label.item input[type="file"]',
	) as HTMLInputElement | null;
	expect(input).not.toBeNull();
	expect(input?.closest("label")?.textContent).toContain("Choose a file");
	expect(input?.disabled).toBe(false);
});

test("paste json is a list row button with its label and icon", async () => {
	const el = await mount();
	const row = $(el, 'section.import button.item[data-action="paste"]');
	expect(row?.textContent).toContain("Paste JSON");
	expect(row?.querySelector("svg")).not.toBeNull();
});

test("the page title is a large title", async () => {
	const el = await mount();
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Settings");
});

/** Answer every fetch of the preset index with `respond`, ignoring the requested URL. */
const stubFetch = (respond: () => Promise<Response>) => {
	const spy = spyOn(globalThis, "fetch").mockImplementation(((
		_input: RequestInfo | URL,
	) => respond()) as typeof fetch);
	return () => spy.mockRestore();
};

const jsonResponse = (data: unknown): Promise<Response> =>
	Promise.resolve(new Response(JSON.stringify(data)));

/** 1 city, 2 presets: enough to exercise an "added" count. */
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
			places: ["Central Ladprao"],
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

test("Import starts with a Neighbourhood presets link row to ./settings/presets", async () => {
	const restore = stubFetch(() => Promise.reject(new Error("offline")));
	try {
		const el = await mount();
		await flush(el);
		const groups = [
			...el.shadowRoot!.querySelectorAll<HTMLElement>("section.import .group"),
		];
		const row = groups[0]?.querySelector<HTMLAnchorElement>(
			'a.item[data-action="presets"]',
		);
		expect(row?.getAttribute("href")).toBe("./settings/presets");
		expect(row?.querySelector("b")?.textContent?.trim()).toBe(
			"Neighbourhood presets",
		);
		// The row lives in its own group, above the file/paste group.
		expect(groups[1]?.querySelector("input[type='file']")).not.toBeNull();
	} finally {
		restore();
	}
});

test('its subtitle reads "1 of 2 added" once the index loads', async () => {
	saveRestaurants([make("ladprao-1", "X")]);
	saveAddedPresets([
		{ id: "ladprao", updatedAt: "2026-10-16", ids: ["ladprao-1"] },
	]);
	const restore = stubFetch(() => jsonResponse(INDEX2));
	try {
		const el = await mount();
		await flush(el);
		expect(
			$(el, 'a.item[data-action="presets"] small')?.textContent?.trim(),
		).toBe("1 of 2 added");
	} finally {
		restore();
	}
});

test("with the index failing, the row shows no subtitle and still links", async () => {
	const restore = stubFetch(() => Promise.reject(new Error("offline")));
	try {
		const el = await mount();
		await flush(el);
		const row = $(el, 'a.item[data-action="presets"]');
		expect(row?.getAttribute("href")).toBe("./settings/presets");
		expect(row?.querySelector("small")).toBeNull();
	} finally {
		restore();
	}
});

test("an Organise section links to the tags page", async () => {
	const el = await mount();
	const sections = [...el.shadowRoot!.querySelectorAll("section")].map(
		(section) => section.className,
	);
	// Right after appearance, before export.
	expect(sections.indexOf("organise")).toBe(sections.indexOf("appearance") + 1);
	expect($(el, "section.organise h2")?.textContent?.trim()).toBe("Organise");
	const row = $(el, 'section.organise a.item[data-action="tags"]');
	expect(row?.getAttribute("href")).toBe("./settings/tags");
	expect(row?.querySelector("b")?.textContent?.trim()).toBe("Tags");
	expect(row?.querySelector("small")?.textContent?.trim()).toBe(
		"Groups and their values",
	);
	setLang("th");
	await el.updateComplete;
	expect($(el, "section.organise h2")?.textContent?.trim()).toBe("จัดระเบียบ");
	expect($(el, 'a.item[data-action="tags"] b')?.textContent?.trim()).toBe(
		"แท็ก",
	);
});

test("the Reset section orders delete restaurants, delete history, then delete all data", async () => {
	const el = await mount();
	const reset = $(el, "section.reset")!;
	const restaurants = reset.querySelector(
		'button[data-action="clear-restaurants"]',
	)!;
	const history = reset.querySelector("history-clear")!;
	const all = reset.querySelector('button[data-action="reset"]')!;
	expect(restaurants.textContent?.trim()).toBe("Delete restaurants");
	expect(all.textContent?.trim()).toBe("Delete all data");
	expect(
		restaurants.compareDocumentPosition(history) &
			Node.DOCUMENT_POSITION_FOLLOWING,
	).toBeTruthy();
	expect(
		history.compareDocumentPosition(all) & Node.DOCUMENT_POSITION_FOLLOWING,
	).toBeTruthy();
});

test("delete restaurants and delete history share one card; delete all data stands alone", async () => {
	const el = await mount();
	const reset = $(el, "section.reset")!;
	expect(reset.querySelectorAll(".group")).toHaveLength(2);
	const deletes = $(el, "section.reset .group");
	const all = $(el, "section.reset .group.reset-all");
	expect(
		reset.querySelector('button[data-action="clear-restaurants"]')
			?.parentElement,
	).toBe(deletes);
	expect(reset.querySelector("history-clear")?.parentElement).toBe(deletes);
	expect(
		reset.querySelector('button[data-action="reset"]')?.parentElement,
	).toBe(all);
	expect(all?.children).toHaveLength(1);
});

test("the delete restaurants prompt opens inside its card, keeping the history row", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="clear-restaurants"]');
	const card = $(el, "section.reset .group")!;
	expect(card.querySelector(".clear-restaurants-prompt")).not.toBeNull();
	expect(card.querySelector("history-clear")).not.toBeNull();
	expect($(el, 'button[data-action="reset"]')).not.toBeNull();
});

test("each result shows under its own card", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="clear-restaurants"]');
	await click(el, 'button[data-action="clear-restaurants-confirm"]');
	const deletes = $(el, "section.reset .group")!;
	const all = $(el, "section.reset .group.reset-all")!;
	const done = $(el, ".clear-restaurants-done")!;
	expect(deletes.nextElementSibling).toBe(done);
	await click(el, 'button[data-action="reset"]');
	await click(el, 'button[data-action="reset-confirm"]');
	expect(all.nextElementSibling).toBe($(el, ".reset-done"));
});

test("a history clear is reported under the card; focus lands there once the row greys out", async () => {
	const el = await mount();
	const history = $(el, "history-clear")!;
	history.dispatchEvent(
		new CustomEvent("history-cleared", {
			detail: { count: 3 },
			bubbles: true,
			composed: true,
		}),
	);
	await el.updateComplete;
	await el.updateComplete;
	const done = $(el, ".clear-history-done")!;
	expect(done.textContent?.trim()).toBe("Deleted 3 visits.");
	expect(done.getAttribute("role")).toBe("status");
	expect(done.closest(".group")).toBeNull();
	expect(el.shadowRoot!.activeElement).toBe(done);
});

test("starting another delete drops the last result", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	$(el, "history-clear")!.dispatchEvent(
		new CustomEvent("history-cleared", { detail: { count: 1 } }),
	);
	await el.updateComplete;
	expect($(el, ".clear-history-done")).not.toBeNull();
	await click(el, 'button[data-action="clear-restaurants"]');
	expect($(el, ".clear-history-done")).toBeNull();
});

test("delete restaurants is greyed out while there are none", async () => {
	const el = await mount();
	const button = () =>
		$(el, 'button[data-action="clear-restaurants"]') as HTMLButtonElement;
	expect(button().disabled).toBe(true);
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	await el.updateComplete;
	expect(button().disabled).toBe(false);
});

test("delete restaurants asks first and can be cancelled, with focus following", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	addRestaurant({ name: { en: "B", th: "" }, tags: [], links: [], notes: "" });
	const el = await mount();
	await click(el, 'button[data-action="clear-restaurants"]');
	const prompt = $(el, ".clear-restaurants-prompt")!;
	expect(prompt.textContent?.trim()).toBe(
		"Delete all 2 restaurants? Your history, groups and settings are kept. This cannot be undone.",
	);
	expect(prompt.getAttribute("role")).toBe("alert");
	expect(prompt.closest(".confirm")?.closest(".group")).toBe(
		$(el, "section.reset .group"),
	);
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"clear-restaurants-confirm",
	);
	await click(el, 'button[data-action="clear-restaurants-cancel"]');
	expect($(el, ".clear-restaurants-prompt")).toBeNull();
	expect(loadRestaurants()).toHaveLength(2);
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"clear-restaurants",
	);
});

test("confirming delete restaurants empties only the restaurant list and added presets", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	saveHistory([visit("mine", "2026-10-01T09:00:00.000Z")]);
	saveGroups([{ id: "g1", name: "Price" }]);
	saveAddedPresets([{ id: "siam", updatedAt: "2026-10-01", ids: ["a"] }]);
	localStorage.setItem("whattoeat:theme", "dark");
	const el = await mount();
	await click(el, 'button[data-action="clear-restaurants"]');
	await click(el, 'button[data-action="clear-restaurants-confirm"]');
	expect(loadRestaurants()).toEqual([]);
	expect(loadAddedPresets()).toEqual([]);
	expect(loadHistory().map((item) => item.id)).toEqual(["mine"]);
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
	expect(localStorage.getItem("whattoeat:theme")).toBe("dark");
	await el.updateComplete;
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 0");
	expect($(el, ".clear-restaurants-done")?.textContent?.trim()).toBe(
		"Deleted 1 restaurant.",
	);
	expect($(el, ".clear-restaurants-done")?.closest(".group")).toBeNull();
	expect(el.shadowRoot!.activeElement).toBe($(el, ".clear-restaurants-done"));
});

test("delete restaurants is translated to Thai", async () => {
	addRestaurant({ name: { en: "A", th: "" }, tags: [], links: [], notes: "" });
	addRestaurant({ name: { en: "B", th: "" }, tags: [], links: [], notes: "" });
	setLang("th");
	const el = await mount();
	expect(
		$(el, 'button[data-action="clear-restaurants"]')?.textContent?.trim(),
	).toBe("ลบร้านอาหาร");
	await click(el, 'button[data-action="clear-restaurants"]');
	expect($(el, ".clear-restaurants-prompt")?.textContent?.trim()).toBe(
		"ลบร้านอาหารทั้งหมด 2 ร้านหรือไม่ ประวัติ กลุ่ม และการตั้งค่าจะยังอยู่ การลบนี้ย้อนกลับไม่ได้",
	);
	await click(el, 'button[data-action="clear-restaurants-confirm"]');
	expect($(el, ".clear-restaurants-done")?.textContent?.trim()).toBe(
		"ลบร้านอาหาร 2 ร้านแล้ว",
	);
});
