import { afterEach, expect, test } from "bun:test";
import {
	isFilterPanelHidden,
	PANEL_KEY,
	setFilterPanelHidden,
} from "#lib/panel";

afterEach(() => localStorage.clear());

test("the panel starts shown", () => {
	expect(isFilterPanelHidden()).toBe(false);
});

test("hiding is remembered under its own key", () => {
	setFilterPanelHidden(true);
	expect(localStorage.getItem(PANEL_KEY)).toBe("hidden");
	expect(isFilterPanelHidden()).toBe(true);
	setFilterPanelHidden(false);
	expect(localStorage.getItem(PANEL_KEY)).toBeNull();
	expect(isFilterPanelHidden()).toBe(false);
});

test("the key is namespaced like the others", () => {
	expect(PANEL_KEY).toBe("whattoeat:filter-panel");
});

test("blocked storage falls back to shown and does not throw", () => {
	const get = Storage.prototype.getItem;
	const set = Storage.prototype.setItem;
	Storage.prototype.getItem = () => {
		throw new Error("blocked");
	};
	Storage.prototype.setItem = () => {
		throw new Error("blocked");
	};
	try {
		expect(isFilterPanelHidden()).toBe(false);
		expect(() => setFilterPanelHidden(true)).not.toThrow();
	} finally {
		Storage.prototype.getItem = get;
		Storage.prototype.setItem = set;
	}
});
