import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/lock-history";
import type { LockHistory } from "#components/lock-history";
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
	area: "",
	cuisine: "",
	kinds: [],
	createdAt: "2026-10-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
});

const lock = (
	id: string,
	restaurantId: string,
	name: string,
	lockedAt: string,
): HistoryEntry => ({ id, restaurantId, name, lockedAt });

const sample = (): HistoryEntry[] => [
	lock("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z"),
	lock("h2", "r4", "Ramen Champion", "2026-10-11T12:42:00.000Z"),
	lock("h3", "r2", "Som Tam Nua", "2026-10-09T05:05:00.000Z"),
	lock("h4", "gone", "Pad Thai Fai Ta Lu", "2026-10-06T11:30:00.000Z"),
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
	const el = document.createElement("lock-history");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const root = (el: LockHistory) => el.shadowRoot!;
const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();
const rows = (el: LockHistory) =>
	[...root(el).querySelectorAll("tbody tr")].map((tr) =>
		[...tr.querySelectorAll("td")].map((td) => text(td)),
	);
const lockIds = (el: LockHistory) =>
	[...root(el).querySelectorAll("li[data-id]")].map((li) =>
		li.getAttribute("data-id"),
	);
const lockRow = (el: LockHistory, id: string) =>
	root(el).querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
const action = (el: LockHistory, id: string, name: string) =>
	lockRow(el, id)?.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

const day = (iso: string) =>
	new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));
const dayTime = (iso: string) =>
	new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(iso));

test("shows the page heading, the total and one stats row per restaurant", async () => {
	const el = await mount();
	expect(text(root(el).querySelector("h1"))).toBe("History");
	expect(text(root(el).querySelector(".total"))).toBe("4 locks in total");
	expect(
		[...root(el).querySelectorAll("thead th")].map((th) => text(th)),
	).toEqual(["Restaurant", "Times", "Last time"]);
	expect(rows(el)).toEqual([
		["Som Tam Nua", "2", day("2026-10-12T05:18:00.000Z")],
		["Ramen Champion", "1", day("2026-10-11T12:42:00.000Z")],
		["Pad Thai Fai Ta Lu (deleted)", "1", day("2026-10-06T11:30:00.000Z")],
	]);
});

test("uses the singular for one lock", async () => {
	saveHistory([lock("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z")]);
	const el = await mount();
	expect(text(root(el).querySelector(".total"))).toBe("1 lock in total");
});

test("lists every lock newest first with its date and time", async () => {
	const el = await mount();
	expect(lockIds(el)).toEqual(["h1", "h2", "h3", "h4"]);
	const first = lockRow(el, "h1")!;
	expect(text(first.querySelector(".name"))).toBe("Som Tam Nua");
	const time = first.querySelector("time");
	expect(time?.getAttribute("datetime")).toBe("2026-10-12T05:18:00.000Z");
	expect(text(time)).toBe(dayTime("2026-10-12T05:18:00.000Z"));
});

test("the lock list keeps the name a restaurant had when it was locked", async () => {
	saveRestaurants([
		restaurant("r2", "Som Tam Nua Siam"),
		restaurant("r4", "Ramen Champion"),
	]);
	const el = await mount();
	expect(text(lockRow(el, "h1")?.querySelector(".name"))).toBe("Som Tam Nua");
	expect(rows(el)[0]![0]).toBe("Som Tam Nua Siam");
});

test("delete asks first and can be cancelled", async () => {
	const el = await mount();
	action(el, "h2", "delete")!.click();
	await el.updateComplete;
	expect(action(el, "h2", "delete")).toBeNull();
	expect(text(action(el, "h2", "confirm-delete"))).toBe("Delete this lock");
	await el.updateComplete;
	expect(root(el).activeElement).toBe(action(el, "h2", "confirm-delete")!);
	action(el, "h2", "cancel-delete")!.click();
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement).toBe(action(el, "h2", "delete")!);
	expect(loadHistory()).toHaveLength(4);
});

test("confirming delete removes the lock and updates the stats", async () => {
	const el = await mount();
	action(el, "h2", "delete")!.click();
	await el.updateComplete;
	action(el, "h2", "confirm-delete")!.click();
	await el.updateComplete;
	expect(lockRow(el, "h2")).toBeNull();
	expect(loadHistory().map((item) => item.id)).toEqual(["h1", "h3", "h4"]);
	expect(text(root(el).querySelector(".total"))).toBe("3 locks in total");
	expect(rows(el).map((row) => row[0])).toEqual([
		"Som Tam Nua",
		"Pad Thai Fai Ta Lu (deleted)",
	]);
});

test("with no locks shows a link to pick and no stats", async () => {
	saveHistory([]);
	const el = await mount();
	expect(text(root(el).querySelector(".empty p"))).toBe("No locks yet.");
	const link = root(el).querySelector(".empty a");
	expect(link?.getAttribute("href")).toBe("./");
	expect(text(link)).toBe("Pick a restaurant");
	expect(root(el).querySelector("table")).toBeNull();
});

test("follows changes from another tab", async () => {
	const el = await mount();
	localStorage.setItem(
		HISTORY_KEY,
		JSON.stringify([
			lock("x", "r4", "Ramen Champion", "2026-10-13T05:00:00.000Z"),
		]),
	);
	window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_KEY }));
	await el.updateComplete;
	expect(lockIds(el)).toEqual(["x"]);
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

const deleteLock = async (el: LockHistory, id: string) => {
	action(el, id, "delete")!.click();
	await el.updateComplete;
	action(el, id, "confirm-delete")!.click();
	await el.updateComplete;
	await el.updateComplete;
};

test("after a delete, focus moves to the next lock's Delete button", async () => {
	const el = await mount();
	await deleteLock(el, "h2");
	expect(root(el).activeElement).toBe(action(el, "h3", "delete")!);
});

test("after deleting the last lock in the list, focus moves to the one before", async () => {
	const el = await mount();
	await deleteLock(el, "h4");
	expect(root(el).activeElement).toBe(action(el, "h3", "delete")!);
});

test("after deleting the only lock, focus moves to the heading", async () => {
	saveHistory([lock("h1", "r2", "Som Tam Nua", "2026-10-12T05:18:00.000Z")]);
	const el = await mount();
	await deleteLock(el, "h1");
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
		await deleteLock(el, "h2");
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
