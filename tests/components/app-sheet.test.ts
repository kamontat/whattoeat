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

test("opening moves focus to the sheet's heading, not a control, so no button lights up", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	const title = sheet.shadowRoot!.querySelector("#sheet-title")!;
	expect(title.getAttribute("tabindex")).toBe("-1");
	expect(sheet.shadowRoot!.activeElement).toBe(title);
});

test("the focused heading draws no focus ring: it is a place to start, not a control", () => {
	const css = [
		(customElements.get("app-sheet") as unknown as { styles: unknown }).styles,
	]
		.flat(2)
		.map((style) => (style as { cssText: string }).cssText)
		.join("");
	expect(css).toMatch(/h2:focus\s*\{[^}]*outline:\s*none/);
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

test("does not refocus an opener that was removed from the DOM while the sheet was open", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	opener.remove();
	const other = document.createElement("button");
	document.body.append(other);
	other.focus();
	dialog(sheet).close();
	await settle(sheet);
	expect(document.activeElement).toBe(other);
});

test("does not steal focus back once something else has already claimed it before close runs", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	const other = document.createElement("button");
	document.body.append(other);
	other.focus();
	dialog(sheet).close();
	await settle(sheet);
	expect(document.activeElement).toBe(other);
});

test("still refocuses the opener when nothing else has claimed focus by the time close runs", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	// Nothing reclaims focus (it is still on the document body-ish nowhere), so the opener
	// should still get it back.
	(document.activeElement as HTMLElement | null)?.blur();
	dialog(sheet).close();
	await settle(sheet);
	expect(document.activeElement).toBe(opener);
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

test("containsFocus sees focus inside a slotted component's own shadow root", async () => {
	const { sheet } = await mount();
	const inner = document.createElement("div");
	inner.attachShadow({ mode: "open" }).innerHTML = "<input />";
	sheet.append(inner);
	sheet.open = true;
	await sheet.updateComplete;
	inner.shadowRoot!.querySelector("input")!.focus();
	expect(sheet.containsFocus()).toBe(true);
});

const sheetCss = () =>
	[(customElements.get("app-sheet") as unknown as { styles: unknown }).styles]
		.flat(2)
		.map((style) => (style as { cssText: string }).cssText)
		.join("");

test("closing slides the sheet back down over a fading scrim, as opening slides it up", () => {
	const css = sheetCss();
	expect(css).toMatch(
		/dialog\.leaving\s*\{[^}]*animation:\s*slide-down var\(--duration\)/,
	);
	expect(css).toMatch(/dialog\.leaving\s*\{[^}]*pointer-events:\s*none/);
	expect(css).toMatch(
		/\.scrim\s*\{[^}]*animation:\s*fade-out var\(--duration\)/,
	);
	expect(css).toMatch(/@keyframes slide-down/);
});

test("after closing, the sheet stays on screen for the animation, inert, with its last heading", async () => {
	const { opener, sheet } = await mount();
	sheet.style.setProperty("--duration", "30ms");
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	sheet.open = false;
	sheet.heading = "";
	await settle(sheet);
	const d = dialog(sheet);
	// Closed at once, so focus moves and the page is usable straight away.
	expect(d.open).toBe(false);
	expect(document.activeElement).toBe(opener);
	expect(d.classList.contains("leaving")).toBe(true);
	expect(d.hasAttribute("inert")).toBe(true);
	expect(sheet.shadowRoot!.querySelector(".scrim")).not.toBeNull();
	expect(sheet.shadowRoot!.querySelector("h2")?.textContent?.trim()).toBe(
		"Filter",
	);
	await new Promise((resolve) => setTimeout(resolve, 60));
	await sheet.updateComplete;
	expect(d.classList.contains("leaving")).toBe(false);
	expect(d.hasAttribute("inert")).toBe(false);
	expect(sheet.shadowRoot!.querySelector(".scrim")).toBeNull();
});

test("with no motion (reduced motion sets the duration to 0) it closes without lingering", async () => {
	const { sheet } = await mount();
	sheet.style.setProperty("--duration", "0ms");
	sheet.open = true;
	await sheet.updateComplete;
	sheet.open = false;
	await settle(sheet);
	expect(dialog(sheet).classList.contains("leaving")).toBe(false);
});

test("reopening during the close animation shows it again straight away", async () => {
	const { sheet } = await mount();
	sheet.style.setProperty("--duration", "50ms");
	sheet.open = true;
	await sheet.updateComplete;
	sheet.open = false;
	await settle(sheet);
	sheet.open = true;
	await settle(sheet);
	const d = dialog(sheet);
	expect(d.open).toBe(true);
	expect(d.classList.contains("leaving")).toBe(false);
	expect(d.hasAttribute("inert")).toBe(false);
	await new Promise((resolve) => setTimeout(resolve, 80));
	expect(d.open).toBe(true);
});

test("while a sheet is open the page behind cannot scroll; closing gives scrolling back", async () => {
	const { sheet } = await mount();
	const root = document.documentElement;
	expect(root.classList.contains("sheet-open")).toBe(false);
	sheet.open = true;
	await sheet.updateComplete;
	expect(root.classList.contains("sheet-open")).toBe(true);
	sheet.open = false;
	await settle(sheet);
	expect(root.classList.contains("sheet-open")).toBe(false);
});

test("the page stays locked while any of two open sheets is still open", async () => {
	const { sheet } = await mount();
	const other = document.createElement("app-sheet") as AppSheet;
	document.body.append(other);
	sheet.open = true;
	other.open = true;
	await sheet.updateComplete;
	await other.updateComplete;
	sheet.open = false;
	await settle(sheet);
	expect(document.documentElement.classList.contains("sheet-open")).toBe(true);
	other.remove();
	expect(document.documentElement.classList.contains("sheet-open")).toBe(false);
});

test("scrolling inside the sheet never carries on into the page", () => {
	expect(sheetCss()).toMatch(/\.body\s*\{[^}]*overscroll-behavior:\s*contain/);
});
