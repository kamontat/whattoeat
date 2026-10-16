import { afterEach, beforeEach, expect, test } from "bun:test";
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
const row = (el: HistoryClear, range: string) =>
	root(el).querySelector<HTMLButtonElement>(`button[data-clear="${range}"]`);
const action = (el: HistoryClear, name: string) =>
	root(el).querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
const settle = async (el: HistoryClear) => {
	await el.updateComplete;
	await el.updateComplete;
};

test("each range is a row in a grouped list with how many visits it would delete", async () => {
	const el = await mount();
	const rows = ["week", "month", "year", "all"].map((range) => row(el, range));
	for (const item of rows) {
		expect(item?.classList.contains("item")).toBe(true);
		expect(item?.closest("ul.group")).not.toBeNull();
	}
	expect(rows.map((item) => text(item?.querySelector("b")))).toEqual([
		"Clear visits older than 1 week",
		"Clear visits older than 1 month",
		"Clear visits older than 1 year",
		"Clear all visits",
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
	expect(row(el, "week")!.disabled).toBe(true);
	expect(row(el, "all")!.disabled).toBe(false);
});

test("clearing asks first, then deletes only the older visits and says so", async () => {
	const el = await mount();
	row(el, "month")!.click();
	await settle(el);
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
	await settle(el);
	expect(loadHistory().map((item) => item.id)).toEqual(["d1", "d10"]);
	expect(root(el).querySelector(".clear-prompt")).toBeNull();
	const status = root(el).querySelector('[role="status"]');
	expect(text(status)).toBe("Deleted 2 visits.");
	// The month row is now empty, so focus goes to the first row that can still clear.
	expect(root(el).activeElement).toBe(row(el, "week"));
});

test("clearing all asks with its own wording; with every row empty, focus lands on the result", async () => {
	const el = await mount();
	row(el, "all")!.click();
	await settle(el);
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"Delete all 4 visits? This cannot be undone.",
	);
	action(el, "clear-confirm")!.click();
	await settle(el);
	await settle(el);
	expect(loadHistory()).toEqual([]);
	expect(row(el, "all")!.disabled).toBe(true);
	const status = root(el).querySelector(".cleared");
	expect(text(status)).toBe("Deleted 4 visits.");
	expect(root(el).activeElement).toBe(status);
});

test("cancelling keeps every visit and returns focus to its row", async () => {
	const el = await mount();
	row(el, "year")!.click();
	await settle(el);
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"Delete 1 visit older than 1 year? This cannot be undone.",
	);
	action(el, "clear-cancel")!.click();
	await settle(el);
	expect(loadHistory()).toHaveLength(4);
	expect(root(el).querySelector(".clear-prompt")).toBeNull();
	expect(root(el).activeElement).toBe(row(el, "year"));
});

test("follows history changes from elsewhere", async () => {
	const el = await mount();
	saveHistory([visit("d1", 1)]);
	await el.updateComplete;
	expect(text(row(el, "all")?.querySelector(".trail"))).toBe("1 visit");
});

test("is translated to Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(text(row(el, "week")?.querySelector("b"))).toBe(
		"ล้างประวัติที่เก่ากว่า 1 สัปดาห์",
	);
	expect(text(row(el, "all")?.querySelector("b"))).toBe("ล้างประวัติทั้งหมด");
	expect(text(row(el, "all")?.querySelector(".trail"))).toBe("4 รายการ");
	row(el, "all")!.click();
	await settle(el);
	expect(text(root(el).querySelector(".clear-prompt"))).toBe(
		"ลบประวัติทั้งหมด 4 รายการหรือไม่ การลบนี้ย้อนกลับไม่ได้",
	);
});
