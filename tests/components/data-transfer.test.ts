import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import "#components/data-transfer";
import type { DataTransferPanel } from "#components/data-transfer";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { addRestaurant, loadRestaurants } from "#lib/store";
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

test("an invalid file shows an error and changes nothing", async () => {
	addRestaurant({ name: "Keep", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport("{oops");
	await el.updateComplete;
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"The file is not valid JSON.",
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
		"The file contains invalid restaurant data.",
	);
	expect(loadRestaurants()).toEqual([]);
});

test("replace swaps the whole list", async () => {
	addRestaurant({ name: "Old", tags: [], location: "", notes: "" });
	const el = await mount();
	el.readImport(JSON.stringify(toExportFile([make("x", "X"), make("y", "Y")])));
	await el.updateComplete;
	expect($(el, ".found")?.textContent?.trim()).toBe(
		"2 restaurants found in the file.",
	);
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
	expect($(el, ".found")?.textContent?.trim()).toBe(
		"1 restaurants found in the file.",
	);
});
