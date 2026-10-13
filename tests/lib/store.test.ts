import { afterEach, beforeEach, expect, test } from "bun:test";
import { addLock, HISTORY_KEY, loadHistory } from "#lib/history";
import {
	addRestaurant,
	CHANGE_EVENT,
	isMemoryOnly,
	loadRestaurants,
	onRestaurantsChanged,
	removeRestaurant,
	resetStorage,
	STORAGE_KEY,
	saveRestaurants,
	skippedCount,
	updateRestaurant,
} from "#lib/store";

const input = {
	name: " Jay Fai ",
	tags: ["street", " street "],
	location: "Bangkok",
	notes: "",
};

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
});

test("loads [] when nothing is stored", () => {
	expect(loadRestaurants()).toEqual([]);
	expect(skippedCount()).toBe(0);
});

test("loads [] for unparseable data", () => {
	localStorage.setItem(STORAGE_KEY, "{not json");
	expect(loadRestaurants()).toEqual([]);
	expect(skippedCount()).toBe(1);
});

test("loads [] when stored data is not an array", () => {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: "x" }));
	expect(loadRestaurants()).toEqual([]);
	expect(skippedCount()).toBe(1);
});

test("drops invalid entries and keeps valid ones", () => {
	const [kept] = addRestaurant(input);
	const raw = JSON.parse(
		localStorage.getItem(STORAGE_KEY) ?? "[]",
	) as unknown[];
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify([...raw, { name: "broken" }, null]),
	);
	expect(loadRestaurants()).toEqual([kept!]);
});

test("counts skipped entries until the next save drops them", () => {
	addRestaurant(input);
	const raw = JSON.parse(
		localStorage.getItem(STORAGE_KEY) ?? "[]",
	) as unknown[];
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify([...raw, { name: "broken" }, null]),
	);
	loadRestaurants();
	expect(skippedCount()).toBe(2);
	addRestaurant({ ...input, name: "Next" });
	loadRestaurants();
	expect(skippedCount()).toBe(0);
	expect(localStorage.getItem("whattoeat:restaurants:invalid")).toBeNull();
});

test("addRestaurant normalizes, stamps and saves", () => {
	const now = new Date("2026-10-12T10:00:00.000Z");
	const list = addRestaurant(input, now);
	expect(list).toHaveLength(1);
	expect(list[0]).toMatchObject({
		name: "Jay Fai",
		tags: ["street"],
		location: "Bangkok",
		notes: "",
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
	});
	expect(list[0]!.id).toMatch(/^[0-9A-Za-z]{8}$/);
	expect(loadRestaurants()).toEqual(list);
});

test("addRestaurant gives every restaurant its own id", () => {
	addRestaurant(input);
	const list = addRestaurant({ ...input, name: "Other" });
	expect(new Set(list.map((item) => item.id)).size).toBe(2);
});

test("addRestaurant throws on a blank name and saves nothing", () => {
	expect(() => addRestaurant({ ...input, name: "   " })).toThrow();
	expect(loadRestaurants()).toEqual([]);
});

test("updateRestaurant changes fields and updatedAt only", () => {
	const created = new Date("2026-10-12T10:00:00.000Z");
	const edited = new Date("2026-10-13T10:00:00.000Z");
	const [first] = addRestaurant(input, created);
	const list = updateRestaurant(
		first!.id,
		{
			name: "Jay Fai 2",
			tags: [],
			location: "",
			notes: "star",
			area: " Old Town ",
			cuisine: "Thai",
			kinds: ["dessert", "food"],
		},
		edited,
	);
	expect(list[0]).toEqual({
		id: first!.id,
		name: "Jay Fai 2",
		tags: [],
		location: "",
		notes: "star",
		area: "old town",
		cuisine: "thai",
		kinds: ["food", "dessert"],
		createdAt: created.toISOString(),
		updatedAt: edited.toISOString(),
	});
	expect(loadRestaurants()).toEqual(list);
});

test("addRestaurant throws on a name already in the list", () => {
	addRestaurant(input);
	expect(() => addRestaurant({ ...input, name: " jay FAI " })).toThrow();
	expect(loadRestaurants()).toHaveLength(1);
});

test("updateRestaurant throws when renaming to another restaurant's name", () => {
	addRestaurant(input);
	const list = addRestaurant({ ...input, name: "Other" });
	const other = list[1]!;
	expect(() =>
		updateRestaurant(other.id, { ...input, name: "jay fai" }),
	).toThrow();
	expect(loadRestaurants()[1]!.name).toBe("Other");
	expect(() =>
		updateRestaurant(other.id, { ...input, name: "OTHER" }),
	).not.toThrow();
});

test("updateRestaurant throws on a blank name", () => {
	const [first] = addRestaurant(input);
	expect(() => updateRestaurant(first!.id, { ...input, name: "" })).toThrow();
	expect(loadRestaurants()[0]!.name).toBe("Jay Fai");
});

test("removeRestaurant removes by id", () => {
	const [first] = addRestaurant(input);
	addRestaurant({ ...input, name: "Other" });
	const list = removeRestaurant(first!.id);
	expect(list.map((item) => item.name)).toEqual(["Other"]);
	expect(loadRestaurants()).toEqual(list);
});

test("every save notifies subscribers until unsubscribed", () => {
	let calls = 0;
	const unsubscribe = onRestaurantsChanged(() => {
		calls += 1;
	});
	addRestaurant(input);
	saveRestaurants([]);
	unsubscribe();
	addRestaurant(input);
	expect(calls).toBe(2);
});

test("a storage event for the restaurants key notifies subscribers", () => {
	let calls = 0;
	const unsubscribe = onRestaurantsChanged(() => {
		calls += 1;
	});
	window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
	window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
	window.dispatchEvent(new StorageEvent("storage", { key: null }));
	unsubscribe();
	expect(calls).toBe(2);
});

test("save dispatches the change event on window", () => {
	let fired = false;
	const listener = (): void => {
		fired = true;
	};
	window.addEventListener(CHANGE_EVENT, listener);
	saveRestaurants([]);
	window.removeEventListener(CHANGE_EVENT, listener);
	expect(fired).toBe(true);
});

test("falls back to memory when localStorage throws", () => {
	const setItem = Storage.prototype.setItem;
	Storage.prototype.setItem = () => {
		throw new Error("QuotaExceededError");
	};
	try {
		const list = addRestaurant(input);
		expect(loadRestaurants()).toEqual(list);
	} finally {
		Storage.prototype.setItem = setItem;
	}
	// A successful save leaves memory mode again.
	saveRestaurants([]);
	expect(loadRestaurants()).toEqual([]);
	expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
});

test("saveRestaurants reports whether the list was persisted", () => {
	expect(saveRestaurants([])).toBe(true);
	expect(isMemoryOnly()).toBe(false);
	// happy-dom bypasses a mocked Storage.prototype.setItem after real writes, so swap the global.
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
		expect(saveRestaurants([])).toBe(false);
		expect(isMemoryOnly()).toBe(true);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	saveRestaurants([]);
	expect(isMemoryOnly()).toBe(false);
});

test("stored tags that differ only in case load as one lowercase tag", () => {
	const [item] = addRestaurant({ ...input, tags: [] });
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify([{ ...item, tags: ["Thai", "thai", " BBQ "] }]),
	);
	expect(loadRestaurants()[0]?.tags).toEqual(["thai", "bbq"]);
});

test("restaurants stored before area, cuisine and kinds load with them empty", () => {
	const old = {
		id: "a1",
		name: "Old",
		tags: ["thai"],
		location: "",
		notes: "",
		createdAt: "2026-10-12T00:00:00.000Z",
		updatedAt: "2026-10-12T00:00:00.000Z",
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify([old]));
	expect(loadRestaurants()).toEqual([
		{ ...old, area: "", cuisine: "", kinds: [] },
	]);
	expect(skippedCount()).toBe(0);
});

test("resetStorage deletes every localStorage entry and notifies subscribers", () => {
	addRestaurant(input);
	localStorage.setItem("whattoeat:theme", "dark");
	localStorage.setItem("other", "x");
	let calls = 0;
	const off = onRestaurantsChanged(() => {
		calls += 1;
	});
	let storageKey: string | null | undefined;
	const onStorage = (event: StorageEvent): void => {
		storageKey = event.key;
	};
	window.addEventListener("storage", onStorage);
	try {
		resetStorage();
	} finally {
		off();
		window.removeEventListener("storage", onStorage);
	}
	expect(localStorage.length).toBe(0);
	expect(loadRestaurants()).toEqual([]);
	expect(calls).toBeGreaterThan(0);
	expect(storageKey).toBeNull();
});

test("resetStorage leaves memory mode", () => {
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		},
		configurable: true,
	});
	try {
		addRestaurant(input);
		expect(isMemoryOnly()).toBe(true);
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	resetStorage();
	expect(isMemoryOnly()).toBe(false);
	expect(loadRestaurants()).toEqual([]);
});

test("resetStorage also forgets history kept in memory", () => {
	const real = globalThis.localStorage;
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
			clear: () => {},
		},
		configurable: true,
	});
	try {
		addLock({ id: "r1", name: "A" });
		expect(loadHistory()).toHaveLength(1);
		resetStorage();
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
	expect(loadHistory()).toEqual([]);
	expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
});
