import { afterEach, beforeEach, expect, test } from "bun:test";
import { VisitHistory } from "#components/visit-history";
import {
	HISTORY_KEY,
	type HistoryEntry,
	loadHistory,
	saveHistory,
} from "#lib/history";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";
import { saveRestaurants } from "#lib/store";

const restaurant = (id: string, name: string): Restaurant => ({
	id,
	name,
	tags: [],
	location: "",
	notes: "",
	groups: {},
	kinds: [],
	createdAt: "2026-10-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
});

const visit = (
	id: string,
	restaurantId: string,
	name: string,
	visitedAt: string,
): HistoryEntry => ({ id, restaurantId, name, visitedAt });

const sample = (): HistoryEntry[] => [
	visit("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z"),
	visit("h2", "r4", "Ramen Champion", "2026-10-11T12:42:00.000Z"),
	visit("h3", "r2", "Som Tam Nua", "2026-10-09T05:05:00.000Z"),
	visit("h4", "gone", "Pad Thai Fai Ta Lu", "2026-10-06T11:30:00.000Z"),
];

beforeEach(() => {
	localStorage.clear();
	setLang("en");
	saveRestaurants([
		restaurant("r2", "Som Tam Nua"),
		restaurant("r4", "Ramen Champion"),
	]);
	saveHistory(sample());
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const el = document.createElement("visit-history");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const root = (el: VisitHistory) => el.shadowRoot!;
const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();
const rows = (el: VisitHistory) =>
	[...root(el).querySelectorAll("tbody tr")].map((tr) =>
		[...tr.querySelectorAll("td")].map((td) => text(td)),
	);
const visitIds = (el: VisitHistory) =>
	[...root(el).querySelectorAll("li[data-id]")].map((li) =>
		li.getAttribute("data-id"),
	);
const visitRow = (el: VisitHistory, id: string) =>
	root(el).querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
const action = (el: VisitHistory, id: string, name: string) =>
	visitRow(el, id)?.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

const day = (iso: string) =>
	new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));

test("shows the page heading, the total and one stats row per restaurant", async () => {
	const el = await mount();
	expect(text(root(el).querySelector("h1"))).toBe("History");
	expect(text(root(el).querySelector(".total"))).toBe("4 visits in total");
	expect(
		[...root(el).querySelectorAll("thead th")].map((th) => text(th)),
	).toEqual(["Restaurant", "Times", "Last time"]);
	expect(rows(el)).toEqual([
		["Som Tam Nua", "2", day("2026-10-12T05:18:00.000Z")],
		["Ramen Champion", "1", day("2026-10-11T12:42:00.000Z")],
		["Pad Thai Fai Ta Lu (deleted)", "1", day("2026-10-06T11:30:00.000Z")],
	]);
});

test("uses the singular for one visit", async () => {
	saveHistory([visit("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z")]);
	const el = await mount();
	expect(text(root(el).querySelector(".total"))).toBe("1 visit in total");
});

test("lists every visit newest first with its time under its day heading", async () => {
	const el = await mount();
	expect(visitIds(el)).toEqual(["h1", "h2", "h3", "h4"]);
	const first = visitRow(el, "h1")!;
	expect(text(first.querySelector(".name"))).toBe("Som Tam Nua");
	const time = first.querySelector("time");
	expect(time?.getAttribute("datetime")).toBe("2026-10-12T05:18:00.000Z");
	expect(text(time)).toBe(
		new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(
			new Date("2026-10-12T05:18:00.000Z"),
		),
	);
});

test("the visit list keeps the name a restaurant had when it was visited", async () => {
	saveRestaurants([
		restaurant("r2", "Som Tam Nua Siam"),
		restaurant("r4", "Ramen Champion"),
	]);
	const el = await mount();
	expect(text(visitRow(el, "h1")?.querySelector(".name"))).toBe("Som Tam Nua");
	expect(rows(el)[0]![0]).toBe("Som Tam Nua Siam");
});

test("delete asks first and can be cancelled", async () => {
	const el = await mount();
	action(el, "h2", "delete")!.click();
	await el.updateComplete;
	expect(action(el, "h2", "delete")).toBeNull();
	expect(text(action(el, "h2", "confirm-delete"))).toBe("Delete this visit");
	await el.updateComplete;
	expect(root(el).activeElement).toBe(action(el, "h2", "confirm-delete")!);
	action(el, "h2", "cancel-delete")!.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement).toBe(action(el, "h2", "delete")!);
	expect(loadHistory()).toHaveLength(4);
});

test("confirming delete removes the visit and updates the stats", async () => {
	const el = await mount();
	action(el, "h2", "delete")!.click();
	await el.updateComplete;
	action(el, "h2", "confirm-delete")!.click();
	await el.updateComplete;
	expect(visitRow(el, "h2")).toBeNull();
	expect(loadHistory().map((item) => item.id)).toEqual(["h1", "h3", "h4"]);
	expect(text(root(el).querySelector(".total"))).toBe("3 visits in total");
	expect(rows(el).map((row) => row[0])).toEqual([
		"Som Tam Nua",
		"Pad Thai Fai Ta Lu (deleted)",
	]);
});

test("with no visits shows a link to pick and no stats", async () => {
	saveHistory([]);
	const el = await mount();
	expect(text(root(el).querySelector(".empty p"))).toBe("No visits yet.");
	const link = root(el).querySelector(".empty a.button-link");
	expect(link?.getAttribute("href")).toBe("./");
	expect(text(link)).toBe("Pick a restaurant");
	expect(root(el).querySelector("table")).toBeNull();
});

test("follows changes from another tab", async () => {
	const el = await mount();
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([
			visit("x", "r4", "Ramen Champion", "2026-10-13T05:00:00.000Z"),
		]),
	);
	window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_KEY }));
	await el.updateComplete;
	expect(visitIds(el)).toEqual(["x"]);
});

test("follows restaurant renames and deletes", async () => {
	const el = await mount();
	saveRestaurants([restaurant("r2", "Som Tam Nua")]);
	await el.updateComplete;
	expect(rows(el)[1]![0]).toBe("Ramen Champion (deleted)");
});

test("renders in Thai", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(text(root(el).querySelector("h1"))).toBe("ประวัติ");
	expect(text(root(el).querySelector(".total"))).toBe("เลือกไปแล้ว 4 ครั้ง");
	expect(text(action(el, "h1", "delete"))).toBe("ลบ");
});

const deleteVisit = async (el: VisitHistory, id: string) => {
	action(el, id, "delete")!.click();
	await el.updateComplete;
	action(el, id, "confirm-delete")!.click();
	await el.updateComplete;
	await el.updateComplete;
};

test("after a delete, focus moves to the next visit's Delete button", async () => {
	const el = await mount();
	await deleteVisit(el, "h2");
	expect(root(el).activeElement).toBe(action(el, "h3", "delete")!);
});

test("after deleting the last visit in the list, focus moves to the one before", async () => {
	const el = await mount();
	await deleteVisit(el, "h4");
	expect(root(el).activeElement).toBe(action(el, "h3", "delete")!);
});

test("after deleting the only visit, focus moves to the heading", async () => {
	saveHistory([visit("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z")]);
	const el = await mount();
	await deleteVisit(el, "h1");
	expect(root(el).activeElement).toBe(root(el).querySelector("h1"));
});

test("warns when the browser could not save a delete", async () => {
	const el = await mount();
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
		await deleteVisit(el, "h2");
		expect(text(root(el).querySelector(".warning"))).toBe(
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

test("visits sit under day headings, newest day first", async () => {
	const el = await mount();
	const headings = [...root(el).querySelectorAll(".day h3")].map((h) =>
		text(h),
	);
	expect(headings.length).toBeGreaterThan(0);
	for (const group of root(el).querySelectorAll(".day")) {
		expect(group.querySelector("h3")).not.toBeNull();
		expect(
			group.querySelectorAll("ul.group li.visit[data-id]").length,
		).toBeGreaterThan(0);
	}
	expect(visitIds(el)).toEqual(["h1", "h2", "h3", "h4"]);
});

test("today's and yesterday's visits are headed Today and Yesterday", async () => {
	const now = new Date();
	const yesterday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - 1,
		12,
	);
	saveHistory([
		visit("t1", "r2", "Som Tam Nua", now.toISOString()),
		visit("y1", "r2", "Som Tam Nua", yesterday.toISOString()),
	]);
	const el = await mount();
	expect([...root(el).querySelectorAll(".day h3")].map((h) => text(h))).toEqual(
		["Today", "Yesterday"],
	);
});

test("each Delete names the visit it removes", async () => {
	const el = await mount();
	const button = action(el, "h1", "delete")!;
	const time = new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(
		new Date("2026-10-12T05:18:00.000Z"),
	);
	expect(button.getAttribute("aria-label")).toBe(
		`Delete visit to Som Tam Nua at ${time}`,
	);
	expect(text(button)).toBe("Delete");
});

test("the stats table scrolls inside a labelled, focusable region with a caption", async () => {
	const el = await mount();
	const region = root(el).querySelector(".stats .table-wrap")!;
	expect(region.getAttribute("role")).toBe("region");
	expect(region.getAttribute("tabindex")).toBe("0");
	expect(region.getAttribute("aria-labelledby")).toBe("stats-title");
	expect(text(region.querySelector("table caption"))).toBe("Stats");
});

test("the title is a large page title; clearing history lives in Settings, not here", async () => {
	const el = await mount();
	expect(root(el).querySelector("h1.page-title")).not.toBeNull();
	expect(root(el).querySelector(".clear, [data-clear]")).toBeNull();
});

test("the visit buttons meet the tap target size", () => {
	const css = (VisitHistory.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(/\.visit button\s*\{[^}]*min-height:\s*var\(--tap\)/);
});

test("day groups are plain grouping, not a separately labelled landmark", async () => {
	const el = await mount();
	const groups = [...root(el).querySelectorAll(".day")];
	expect(groups.length).toBeGreaterThan(0);
	for (const group of groups) {
		expect(group.tagName).toBe("DIV");
		expect(group.hasAttribute("aria-labelledby")).toBe(false);
		expect(group.querySelector("h3")).not.toBeNull();
		expect(
			group.querySelectorAll("ul.group li.visit[data-id]").length,
		).toBeGreaterThan(0);
	}
});

test("the stats card itself is not a second region named Stats", async () => {
	const el = await mount();
	const section = root(el).querySelector("section.stats")!;
	expect(section.hasAttribute("aria-labelledby")).toBe(false);
	// The scroll region keeps its own name on the table-wrap, not duplicated on its container.
	expect(
		root(el)
			.querySelector(".stats .table-wrap")
			?.getAttribute("aria-labelledby"),
	).toBe("stats-title");
});
