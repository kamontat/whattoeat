import { afterEach, beforeEach, expect, test } from "bun:test";
import type { AppSheet } from "#components/app-sheet";
import "#components/history-clear";
import type { HistoryClear } from "#components/history-clear";
import { type HistoryEntry, loadHistory, saveHistory } from "#lib/history";
import { setLang } from "#lib/i18n";

const daysAgo = (days: number) =>
	new Date(Date.now() - days * 86_400_000).toISOString();
const visit = (id: string, days: number): HistoryEntry => ({
	id,
	restaurantId: "r1",
	name: "Som Tam Nua",
	visitedAt: daysAgo(days),
});
/** One visit 1 day, 10 days, 60 days and 400 days old. */
const spread = (): HistoryEntry[] => [
	visit("d1", 1),
	visit("d10", 10),
	visit("d60", 60),
	visit("d400", 400),
];

beforeEach(() => {
	localStorage.clear();
	setLang("en");
	saveHistory(spread());
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("history-clear");
	document.body.append(el);
	await el.updateComplete;
	return el;
};
const root = (el: HistoryClear) => el.shadowRoot!;
const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();
const open = (el: HistoryClear) =>
	root(el).querySelector<HTMLButtonElement>(
		'button[data-action="clear-history"]',
	);
const sheet = (el: HistoryClear) =>
	root(el).querySelector<AppSheet>("app-sheet")!;
const row = (el: HistoryClear, range: string) =>
	root(el).querySelector<HTMLButtonElement>(`button[data-clear="${range}"]`);
const action = (el: HistoryClear, name: string) =>
	root(el).querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
const settle = async (el: HistoryClear) => {
	await el.updateComplete;
	await el.updateComplete;
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
};
const choose = async (el: HistoryClear, range: string) => {
	// A browser focuses a clicked button; happy-dom does not.
	open(el)!.focus();
	open(el)!.click();
	await settle(el);
	row(el, range)!.click();
	await settle(el);
};

test("one Delete history row opens a sheet; the ranges are not listed on the page", async () => {
	const el = await mount();
	const button = open(el)!;
	expect(button.classList.contains("item")).toBe(true);
	expect(button.closest("ul.group, div.group")).not.toBeNull();
	expect(text(button.querySelector("b"))).toBe("Delete history");
	expect(button.getAttribute("aria-haspopup")).toBe("dialog");
	expect(sheet(el).hasAttribute("open")).toBe(false);
	expect(row(el, "week")?.closest("app-sheet")).toBe(sheet(el));
	button.click();
	await settle(el);
	expect(sheet(el).hasAttribute("open")).toBe(true);
	expect(sheet(el).getAttribute("heading")).toBe("Delete history");
});

test("with no history the row is greyed out and cannot open the sheet", async () => {
	saveHistory([]);
	const el = await mount();
	expect(open(el)!.disabled).toBe(true);
});

test("the sheet lists each range with how many visits it would delete", async () => {
	const el = await mount();
	open(el)!.click();
	await settle(el);
	const rows = ["week", "month", "year", "all"].map((range) => row(el, range));
	for (const item of rows) {
		expect(item?.classList.contains("item")).toBe(true);
		expect(item?.closest("app-sheet")).toBe(sheet(el));
	}
	expect(rows.map((item) => text(item?.querySelector("b")))).toEqual([
		"Older than 1 week",
		"Older than 1 month",
		"Older than 1 year",
		"All visits",
	]);
	expect(rows.map((item) => text(item?.querySelector(".trail")))).toEqual([
		"3 visits",
		"2 visits",
		"1 visit",
		"4 visits",
	]);
});

test("a range with nothing to delete is disabled", async () => {
	saveHistory([visit("d1", 1)]);
	const el = await mount();
	open(el)!.click();
	await settle(el);
	expect(row(el, "week")!.disabled).toBe(true);
	expect(row(el, "all")!.disabled).toBe(false);
});

test("choosing a range asks first, then deletes only the older visits and says so", async () => {
	const el = await mount();
	await choose(el, "month");
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"Delete 2 visits older than 1 month? This cannot be undone.",
	);
	expect(root(el).querySelector(".clear-prompt")?.getAttribute("role")).toBe(
		"alert",
	);
	expect(root(el).activeElement).toBe(action(el, "clear-confirm"));
	expect(loadHistory()).toHaveLength(4);
	action(el, "clear-confirm")!.click();
	await settle(el);
	expect(loadHistory().map((item) => item.id)).toEqual(["d1", "d10"]);
	expect(sheet(el).hasAttribute("open")).toBe(false);
	expect(text(root(el).querySelector('[role="status"]'))).toBe(
		"Deleted 2 visits.",
	);
	expect(root(el).activeElement).toBe(open(el));
});

test("clearing all empties the history; with the row now greyed out, focus lands on the result", async () => {
	const el = await mount();
	await choose(el, "all");
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"Delete all 4 visits? This cannot be undone.",
	);
	action(el, "clear-confirm")!.click();
	await settle(el);
	expect(loadHistory()).toEqual([]);
	expect(open(el)!.disabled).toBe(true);
	const status = root(el).querySelector(".cleared");
	expect(text(status)).toBe("Deleted 4 visits.");
	expect(root(el).activeElement).toBe(status);
});

test("cancelling the prompt goes back to the ranges, focused on the one chosen", async () => {
	const el = await mount();
	await choose(el, "year");
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"Delete 1 visit older than 1 year? This cannot be undone.",
	);
	action(el, "clear-cancel")!.click();
	await settle(el);
	expect(loadHistory()).toHaveLength(4);
	expect(root(el).querySelector(".clear-prompt")).toBeNull();
	expect(sheet(el).hasAttribute("open")).toBe(true);
	expect(root(el).activeElement).toBe(row(el, "year"));
});

test("closing the sheet drops a pending prompt", async () => {
	const el = await mount();
	await choose(el, "all");
	sheet(el).open = false;
	await settle(el);
	expect(loadHistory()).toHaveLength(4);
	open(el)!.click();
	await settle(el);
	expect(root(el).querySelector(".clear-prompt")).toBeNull();
	expect(row(el, "all")).not.toBeNull();
});

test("follows history changes from elsewhere", async () => {
	const el = await mount();
	saveHistory([]);
	await el.updateComplete;
	expect(open(el)!.disabled).toBe(true);
});

test("is translated to Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(text(open(el)?.querySelector("b"))).toBe("ลบประวัติ");
	open(el)!.click();
	await settle(el);
	expect(text(row(el, "week")?.querySelector("b"))).toBe("เก่ากว่า 1 สัปดาห์");
	expect(text(row(el, "all")?.querySelector("b"))).toBe("ประวัติทั้งหมด");
	expect(text(row(el, "all")?.querySelector(".trail"))).toBe("4 รายการ");
	row(el, "all")!.click();
	await settle(el);
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"ลบประวัติทั้งหมด 4 รายการหรือไม่ การลบนี้ย้อนกลับไม่ได้",
	);
});
