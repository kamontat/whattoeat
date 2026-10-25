import { afterEach, beforeEach, expect, test } from "bun:test";
import { loadGroups, saveGroups } from "#lib/groups";
import { addVisit, loadHistory } from "#lib/history";
import { setLang } from "#lib/i18n";
import {
	ACTIVE_KEY,
	activeProfile,
	checkName,
	createProfile,
	deleteProfile,
	ensureProfiles,
	forgetProfilesMemory,
	loadProfiles,
	onProfileSwitchedElsewhere,
	PROFILE_STORES,
	PROFILES_KEY,
	type ProfileStore,
	profileCounts,
	profileCountText,
	profileInitial,
	profileKey,
	renameProfile,
	switchProfile,
} from "#lib/profiles";
import { loadPickCount, savePickCount } from "#lib/random";
import { addRestaurant, loadRestaurants, resetStorage } from "#lib/store";

const input = {
	name: { en: "Jay Fai", th: "" },
	tags: [],
	links: [],
	notes: "",
};

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	setLang("en");
});

afterEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	setLang("en");
});

test("a fresh device gets one profile named Personal, active", () => {
	const list = loadProfiles();
	expect(list).toHaveLength(1);
	expect(list[0]?.name).toBe("Personal");
	expect(activeProfile().id).toBe(list[0]!.id);
	expect(localStorage.getItem(ACTIVE_KEY)).toBe(list[0]!.id);
});

test("the default name follows the language at creation", () => {
	setLang("th");
	expect(loadProfiles()[0]?.name).toBe("ส่วนตัว");
	setLang("en");
	expect(loadProfiles()[0]?.name).toBe("ส่วนตัว");
});

test("upgrade moves every legacy key into the first profile", () => {
	localStorage.setItem("whattoeat:restaurants", "restaurants-data");
	localStorage.setItem("whattoeat:history", "history-data");
	localStorage.setItem("whattoeat:groups", "groups-data");
	localStorage.setItem("whattoeat:filter", "filter-data");
	localStorage.setItem("whattoeat:list-filter", "list-filter-data");
	localStorage.setItem("whattoeat:pick-count", "pick-count-data");
	localStorage.setItem("whattoeat:presets", "presets-data");
	localStorage.setItem("whattoeat:lang", "th");

	ensureProfiles();

	expect(localStorage.getItem(profileKey("restaurants"))).toBe(
		"restaurants-data",
	);
	expect(localStorage.getItem(profileKey("history"))).toBe("history-data");
	expect(localStorage.getItem(profileKey("groups"))).toBe("groups-data");
	expect(localStorage.getItem(profileKey("filter"))).toBe("filter-data");
	expect(localStorage.getItem(profileKey("list-filter"))).toBe(
		"list-filter-data",
	);
	expect(localStorage.getItem(profileKey("pick-count"))).toBe(
		"pick-count-data",
	);
	expect(localStorage.getItem(profileKey("presets"))).toBe("presets-data");

	expect(localStorage.getItem("whattoeat:restaurants")).toBeNull();
	expect(localStorage.getItem("whattoeat:history")).toBeNull();
	expect(localStorage.getItem("whattoeat:groups")).toBeNull();
	expect(localStorage.getItem("whattoeat:filter")).toBeNull();
	expect(localStorage.getItem("whattoeat:list-filter")).toBeNull();
	expect(localStorage.getItem("whattoeat:pick-count")).toBeNull();
	expect(localStorage.getItem("whattoeat:presets")).toBeNull();

	expect(localStorage.getItem("whattoeat:lang")).toBe("th");
});

test("upgrade runs once", () => {
	localStorage.setItem("whattoeat:restaurants", "first-write");
	ensureProfiles();
	const [first] = loadProfiles();
	const key = profileKey("restaurants", first?.id);
	expect(localStorage.getItem(key)).toBe("first-write");

	localStorage.setItem("whattoeat:restaurants", "second-write");
	ensureProfiles();

	expect(localStorage.getItem("whattoeat:restaurants")).toBe("second-write");
	expect(localStorage.getItem(key)).toBe("first-write");
});

test("a failed upgrade keeps the legacy keys and retries on the next load", () => {
	const legacy: Record<string, string> = {
		"whattoeat:restaurants": "restaurants-data",
		"whattoeat:history": "history-data",
		"whattoeat:groups": "groups-data",
		"whattoeat:presets": "presets-data",
	};
	for (const [key, value] of Object.entries(legacy))
		localStorage.setItem(key, value);

	// happy-dom binds Storage methods onto each instance, so patch localStorage itself rather
	// than Storage.prototype.
	const setItem = localStorage.setItem;
	const define = (value: Storage["setItem"]): void => {
		Object.defineProperty(localStorage, "setItem", {
			value,
			configurable: true,
			writable: true,
		});
	};
	define((key: string, value: string) => {
		if (/^whattoeat:[^:]+:restaurants$/.test(key)) throw new Error("full");
		setItem.call(localStorage, key, value);
	});
	try {
		ensureProfiles();
		// This load still works, on an in-memory default profile.
		expect(loadProfiles()).toHaveLength(1);
	} finally {
		define(setItem);
	}

	for (const [key, value] of Object.entries(legacy))
		expect(localStorage.getItem(key)).toBe(value);
	const keys = Object.keys(localStorage);
	expect(keys.filter((key) => /^whattoeat:[^:]+:/.test(key))).toEqual([]);
	expect(localStorage.getItem(PROFILES_KEY)).toBeNull();

	// The next page load starts without this one's in-memory fallback.
	forgetProfilesMemory();
	ensureProfiles();

	expect(loadProfiles()).toHaveLength(1);
	expect(localStorage.getItem(PROFILES_KEY)).not.toBeNull();
	for (const [key, value] of Object.entries(legacy)) {
		const store = key.slice("whattoeat:".length) as ProfileStore;
		expect(localStorage.getItem(profileKey(store))).toBe(value);
		expect(localStorage.getItem(key)).toBeNull();
	}
});

test("an active id not in the list falls back to the first profile", () => {
	const [first] = loadProfiles();
	localStorage.setItem(ACTIVE_KEY, "does-not-exist");
	expect(activeProfile().id).toBe(first!.id);
	expect(localStorage.getItem(ACTIVE_KEY)).toBe(first!.id);
});

test("profileCountText reads correctly at one and many", () => {
	expect(profileCountText(0)).toBe("0 restaurants");
	expect(profileCountText(1)).toBe("1 restaurant");
	expect(profileCountText(5)).toBe("5 restaurants");
	setLang("th");
	expect(profileCountText(1)).toBe("1 ร้าน");
	expect(profileCountText(5)).toBe("5 ร้าน");
});

test("profileKey scopes by profile id", () => {
	expect(profileKey("history", "abc")).toBe("whattoeat:abc:history");
});

test("checkName", () => {
	const [personal] = loadProfiles();
	expect(checkName("  ")).toBe("profiles.error.empty");
	expect(checkName(" personal ")).toBe("profiles.error.taken");
	expect(checkName("personal", personal?.id)).toBeUndefined();
	expect(checkName("a".repeat(25))).toBe("profiles.error.long");
	expect(checkName("a".repeat(24))).toBeUndefined();
});

test("createProfile trims, appends and switches", () => {
	const profile = createProfile(" Family ");
	expect(profile.name).toBe("Family");
	const list = loadProfiles();
	expect(list.at(-1)).toEqual(profile);
	expect(activeProfile().name).toBe("Family");
	expect(profileCounts(profile.id)).toEqual({ restaurants: 0, history: 0 });
});

test("createProfile and renameProfile throw on a bad name", () => {
	const [first] = loadProfiles();
	expect(() => createProfile("  ")).toThrow();
	expect(() => renameProfile(first?.id ?? "", "  ")).toThrow();
});

test("deleteProfile removes every key of that profile and switches to the first remaining", () => {
	const [first] = loadProfiles();
	const second = createProfile("Family");
	for (const store of PROFILE_STORES) {
		if (store === "tags-group") {
			sessionStorage.setItem(profileKey(store, first?.id), "first");
			sessionStorage.setItem(profileKey(store, second.id), "second");
		} else {
			localStorage.setItem(profileKey(store, first?.id), "first");
			localStorage.setItem(profileKey(store, second.id), "second");
		}
	}

	const active = deleteProfile(second.id);

	for (const store of PROFILE_STORES) {
		if (store === "tags-group") {
			expect(sessionStorage.getItem(profileKey(store, second.id))).toBeNull();
			expect(sessionStorage.getItem(profileKey(store, first?.id))).toBe(
				"first",
			);
		} else {
			expect(localStorage.getItem(profileKey(store, second.id))).toBeNull();
			expect(localStorage.getItem(profileKey(store, first?.id))).toBe("first");
		}
	}
	expect(active).toEqual(first!);
	expect(activeProfile()).toEqual(first!);
});

test("deleteProfile refuses the last profile", () => {
	const [only] = loadProfiles();
	expect(() => deleteProfile(only?.id ?? "")).toThrow();
	expect(loadProfiles()).toHaveLength(1);
	expect(activeProfile().id).toBe(only!.id);
});

test("profileCounts reads array lengths and treats junk as 0", () => {
	const [profile] = loadProfiles();
	const id = profile?.id ?? "";
	localStorage.setItem(
		profileKey("restaurants", id),
		JSON.stringify([1, 2, 3]),
	);
	localStorage.setItem(profileKey("history", id), "not json");
	expect(profileCounts(id)).toEqual({ restaurants: 3, history: 0 });
	expect(profileCounts("missing-id")).toEqual({ restaurants: 0, history: 0 });
});

test("profileInitial takes the first whole character", () => {
	expect(profileInitial("family")).toBe("F");
	expect(profileInitial("ส่วนตัว")).toBe("ส");
	expect(profileInitial("🍜 noodles")).toBe("🍜");
});

test("stores read and write the active profile only", () => {
	const personal = loadProfiles()[0]!;
	addRestaurant(input);
	addVisit({ id: "r1", name: { en: "A", th: "" } });
	saveGroups([{ id: "g1", name: "Price" }]);
	savePickCount(4);

	createProfile("Family");
	expect(loadRestaurants()).toEqual([]);
	expect(loadHistory()).toEqual([]);
	expect(loadGroups()).toEqual([]);
	expect(loadPickCount()).toBe(2);

	switchProfile(personal.id);
	expect(loadRestaurants()).toHaveLength(1);
	expect(loadHistory()).toHaveLength(1);
	expect(loadGroups()).toEqual([{ id: "g1", name: "Price" }]);
	expect(loadPickCount()).toBe(4);
});

test("resetStorage leaves one fresh default profile", () => {
	createProfile("Family");
	expect(loadProfiles()).toHaveLength(2);

	resetStorage();

	const list = loadProfiles();
	expect(list).toHaveLength(1);
	expect(list[0]?.name).toBe("Personal");
	expect(loadRestaurants()).toEqual([]);
});

test("onProfileSwitchedElsewhere ignores other keys and unsubscribes", () => {
	let calls = 0;
	const unsubscribe = onProfileSwitchedElsewhere(() => {
		calls += 1;
	});

	window.dispatchEvent(new StorageEvent("storage", { key: "whattoeat:theme" }));
	expect(calls).toBe(0);

	window.dispatchEvent(new StorageEvent("storage", { key: ACTIVE_KEY }));
	expect(calls).toBe(1);

	window.dispatchEvent(new StorageEvent("storage", { key: PROFILES_KEY }));
	expect(calls).toBe(2);

	unsubscribe();
	window.dispatchEvent(new StorageEvent("storage", { key: ACTIVE_KEY }));
	expect(calls).toBe(2);
});

test("blocked storage still yields one in-memory profile", () => {
	const getItem = Storage.prototype.getItem;
	const setItem = Storage.prototype.setItem;
	Storage.prototype.getItem = () => {
		throw new Error("blocked");
	};
	Storage.prototype.setItem = () => {
		throw new Error("blocked");
	};
	try {
		expect(loadProfiles()).toHaveLength(1);
		createProfile("B");
		expect(loadProfiles()).toHaveLength(2);
	} finally {
		Storage.prototype.getItem = getItem;
		Storage.prototype.setItem = setItem;
	}
});
