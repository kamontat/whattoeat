import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-sheet";
import type { AppSheet } from "#components/app-sheet";
import { setLang } from "#lib/i18n";

beforeEach(() => setLang("en"));

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const opener = document.createElement("button");
	opener.textContent = "Open";
	const sheet = document.createElement("app-sheet") as AppSheet;
	sheet.heading = "Filter";
	sheet.subheading = "Cuisine · 2 restaurants";
	sheet.innerHTML = `<p>Body</p><button slot="footer" type="button">Done</button>`;
	document.body.append(opener, sheet);
	await sheet.updateComplete;
	return { opener, sheet };
};

/** The dialog's close event may be queued; let it run, then let Lit re-render. */
const settle = async (sheet: AppSheet) => {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await sheet.updateComplete;
};

const dialog = (sheet: AppSheet) => sheet.shadowRoot!.querySelector("dialog")!;

test("is closed until open is set", async () => {
	const { sheet } = await mount();
	expect(dialog(sheet).open).toBe(false);
});

test("opening shows a modal dialog labelled by its heading", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	const d = dialog(sheet);
	expect(d.open).toBe(true);
	const title = sheet.shadowRoot!.getElementById(
		d.getAttribute("aria-labelledby")!,
	);
	expect(title?.tagName).toBe("H2");
	expect(title?.textContent?.trim()).toBe("Filter");
	expect(sheet.shadowRoot!.querySelector(".sub")?.textContent?.trim()).toBe(
		"Cuisine · 2 restaurants",
	);
});

test("the close button has an accessible name and closes the sheet", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	let events = 0;
	sheet.addEventListener("sheet-close", () => events++);
	const close = sheet.shadowRoot!.querySelector<HTMLButtonElement>(
		'button[data-action="close-sheet"]',
	)!;
	expect(close.getAttribute("aria-label")).toBe("Close");
	close.click();
	await settle(sheet);
	expect(dialog(sheet).open).toBe(false);
	expect(sheet.open).toBe(false);
	expect(events).toBe(1);
	expect(document.activeElement).toBe(opener);
});

test("closing the dialog directly (Esc or backdrop) updates open and fires once", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	let events = 0;
	sheet.addEventListener("sheet-close", () => events++);
	dialog(sheet).close();
	await settle(sheet);
	expect(sheet.open).toBe(false);
	expect(events).toBe(1);
	expect(document.activeElement).toBe(opener);
});

test("tapping the backdrop closes the sheet", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	let events = 0;
	sheet.addEventListener("sheet-close", () => events++);
	dialog(sheet).dispatchEvent(new MouseEvent("click", { bubbles: true }));
	await settle(sheet);
	expect(dialog(sheet).open).toBe(false);
	expect(sheet.open).toBe(false);
	expect(events).toBe(1);
	expect(document.activeElement).toBe(opener);
});

test("a click inside the sheet does not close it", async () => {
	const { sheet } = await mount();
	sheet.open = true;
	await sheet.updateComplete;
	let events = 0;
	sheet.addEventListener("sheet-close", () => events++);
	sheet
		.querySelector("p")!
		.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	await settle(sheet);
	expect(dialog(sheet).open).toBe(true);
	expect(sheet.open).toBe(true);
	expect(events).toBe(0);
});

test("setting open to false closes it", async () => {
	const { sheet } = await mount();
	sheet.open = true;
	await sheet.updateComplete;
	sheet.open = false;
	await settle(sheet);
	expect(dialog(sheet).open).toBe(false);
});

test("the footer area hides when nothing is slotted into it", async () => {
	const sheet = document.createElement("app-sheet") as AppSheet;
	sheet.heading = "Tags";
	document.body.append(sheet);
	await sheet.updateComplete;
	expect(sheet.shadowRoot!.querySelector<HTMLElement>(".foot")!.hidden).toBe(
		true,
	);
});

test("close label follows the language", async () => {
	const { sheet } = await mount();
	setLang("th");
	await sheet.updateComplete;
	expect(
		sheet
			.shadowRoot!.querySelector('button[data-action="close-sheet"]')
			?.getAttribute("aria-label"),
	).toBe("ปิด");
});

test("containsFocus sees slotted content and the sheet's own Close button", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	expect(sheet.containsFocus()).toBe(false);
	sheet.open = true;
	await sheet.updateComplete;
	sheet.querySelector<HTMLButtonElement>('button[slot="footer"]')!.focus();
	expect(sheet.containsFocus()).toBe(true);
	sheet
		.shadowRoot!.querySelector<HTMLButtonElement>(
			'button[data-action="close-sheet"]',
		)!
		.focus();
	expect(sheet.containsFocus()).toBe(true);
});
