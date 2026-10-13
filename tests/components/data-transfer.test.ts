import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/data-transfer";
import type { DataTransferPanel } from "#components/data-transfer";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { addRestaurant, loadRestaurants, saveRestaurants } from "#lib/store";
import { toExportFile } from "#lib/transfer";

const make = (id: string, name = id): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
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
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
	const el = await mount();
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 1");
	addRestaurant({ name: "B", tags: [], location: "", notes: "" });
	await el.updateComplete;
	expect($(el, ".count")?.textContent?.trim()).toBe("Restaurants saved: 2");
});

test("export downloads a json file of the stored list", async () => {
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
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
		expect(downloaded).toMatch(/^whattoeat-\d{4}-\d{2}-\d{2}\.json$/);
		const file = JSON.parse(await blobs[0]!.text());
		expect(file).toMatchObject({
			app: "whattoeat",
			version: 1,
			restaurants: loadRestaurants(),
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
		$(el, 'button[data-action="export"]')!.click();
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
	addRestaurant({ name: "Keep", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport("{oops");
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The data is not valid JSON.",
	);
	expect($(el, 'button[data-action="replace"]')).toBeNull();
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Keep"]);
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
	addRestaurant({ name: "Old", tags: [], location: "", notes: "" });
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
	addRestaurant({ name: "Old", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X")])));
	await el.updateComplete;
	await click(el, 'button[data-action="merge"]');
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Old", "X"]);
	expect($(el, ".success")?.textContent?.trim()).toBe(
		"Import complete. 2 restaurants saved.",
	);
});

test("cancel import discards the pending file", async () => {
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x")])));
	await el.updateComplete;
	await click(el, 'button[data-action="cancel-import"]');
	expect($(el, ".found")).toBeNull();
	expect(loadRestaurants()).toEqual([]);
});

test("choosing a file reads and validates it", async () => {
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

test("an import the browser refuses to store warns instead of claiming success", async () => {
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x")])));
	await el.updateComplete;
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
		await click(el, 'button[data-action="replace"]');
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
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
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
		version: 1,
		restaurants: loadRestaurants(),
	});
	expect($(el, ".copied")?.textContent?.trim()).toBe(
		"Copied 1 restaurants to the clipboard.",
	);
	expect($(el, "textarea.copy-fallback")).toBeNull();
});

test("a blocked clipboard shows the json to copy by hand", async () => {
	addRestaurant({ name: "A", tags: [], location: "", notes: "" });
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

const paste = async (el: DataTransferPanel, text: string): Promise<void> => {
	const area =
		el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea.paste")!;
	area.value = text;
	area.dispatchEvent(new Event("input"));
	await el.updateComplete;
	await click(el, 'button[data-action="check-paste"]');
};

test("pasted json is checked and can be merged", async () => {
	addRestaurant({ name: "Old", tags: [], location: "", notes: "" });
	const el = await mount();
	await paste(el, JSON.stringify(toExportFile([make("x", "X")])));
	expect($(el, ".found")?.textContent?.trim()).toBe("1 restaurants found.");
	await click(el, 'button[data-action="merge"]');
	expect(loadRestaurants().map((r) => r.name)).toEqual(["Old", "X"]);
	expect(
		el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea.paste")!.value,
	).toBe("");
});

test("pasted text that is not an export shows an error", async () => {
	const el = await mount();
	await paste(el, "hello");
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The data is not valid JSON.",
	);
	expect($(el, 'button[data-action="merge"]')).toBeNull();
});

test("check is disabled while the paste box is empty", async () => {
	const el = await mount();
	const check = el.shadowRoot!.querySelector<HTMLButtonElement>(
		'button[data-action="check-paste"]',
	)!;
	expect(check.disabled).toBe(true);
});
