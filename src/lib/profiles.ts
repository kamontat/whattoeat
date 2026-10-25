import { t } from "#lib/i18n";
import { newId } from "#lib/restaurant";

/** One of a person's separate restaurant worlds: "Personal", "Family", etc. */
export type Profile = { id: string; name: string };

export const PROFILES_KEY = "whattoeat:profiles";
export const ACTIVE_KEY = "whattoeat:profile";

/** A store kept separately per profile. `"tags-group"` lives in sessionStorage; the rest in localStorage. */
export type ProfileStore =
	| "restaurants"
	| "history"
	| "groups"
	| "filter"
	| "list-filter"
	| "pick-count"
	| "presets"
	| "tags-group";

export const PROFILE_STORES: readonly ProfileStore[] = [
	"restaurants",
	"history",
	"groups",
	"filter",
	"list-filter",
	"pick-count",
	"presets",
	"tags-group",
];

/** The longest a profile name may be. */
export const PROFILE_MAX = 24;

/** Set when a read or write throws; profiles then live in memory for this session. */
let memory: { list: Profile[]; active: string } | undefined;

const isProfile = (value: unknown): value is Profile => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof Profile, unknown>>;
	return (
		typeof item.id === "string" &&
		item.id !== "" &&
		typeof item.name === "string"
	);
};

/** The stored profile list, or `undefined` when it is missing, unreadable or empty. */
const readList = (): Profile[] | undefined => {
	try {
		const raw = localStorage.getItem(PROFILES_KEY);
		if (raw === null) return undefined;
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
		const list: unknown[] = parsed;
		if (!list.every(isProfile)) return undefined;
		return list as Profile[];
	} catch {
		return undefined;
	}
};

const readActive = (): string | undefined => {
	try {
		return localStorage.getItem(ACTIVE_KEY) ?? undefined;
	} catch {
		return undefined;
	}
};

/** Write both keys together; a throw from either moves everything into memory for this session. */
const persist = (list: Profile[], active: string): void => {
	try {
		localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
		localStorage.setItem(ACTIVE_KEY, active);
		memory = undefined;
	} catch {
		memory = { list, active };
	}
};

const current = (): { list: Profile[]; active: string } => {
	if (memory !== undefined) return memory;
	const list = readList() ?? [];
	const active = readActive() ?? list[0]?.id ?? "";
	return { list, active };
};

/**
 * Move a store's pre-profiles key into the new default profile. `tags-group` lived in
 * sessionStorage and is just dropped, not carried over.
 */
const migrateLegacy = (id: string): void => {
	for (const store of PROFILE_STORES) {
		const legacyKey = `whattoeat:${store}`;
		if (store === "tags-group") {
			try {
				sessionStorage.removeItem(legacyKey);
			} catch {
				// Storage blocked: nothing to drop.
			}
			continue;
		}
		try {
			const raw = localStorage.getItem(legacyKey);
			if (raw !== null) {
				localStorage.setItem(profileKey(store, id), raw);
				localStorage.removeItem(legacyKey);
			}
		} catch {
			// Storage blocked: nothing to migrate.
		}
	}
};

/**
 * Create the default profile and move legacy keys into it when `PROFILES_KEY` is missing or
 * unreadable, and repair an active id that names no profile. Always leaves at least one profile.
 */
export const ensureProfiles = (): void => {
	if (memory !== undefined) {
		const state = memory;
		if (!state.list.some((profile) => profile.id === state.active)) {
			const first = state.list[0];
			if (first !== undefined) state.active = first.id;
		}
		return;
	}

	const list = readList();
	if (list !== undefined) {
		const first = list[0];
		if (first === undefined) return;
		const active = readActive();
		if (
			active === undefined ||
			!list.some((profile) => profile.id === active)
		) {
			persist(list, first.id);
		}
		return;
	}

	const profile: Profile = { id: newId([]), name: t("profiles.defaultName") };
	migrateLegacy(profile.id);
	persist([profile], profile.id);
};

/** Every profile on this device, in creation order. Never empty. */
export const loadProfiles = (): Profile[] => {
	ensureProfiles();
	return current().list;
};

/** The profile in use right now. */
export const activeProfile = (): Profile => {
	ensureProfiles();
	const { list, active } = current();
	const found = list.find((profile) => profile.id === active);
	if (found !== undefined) return found;
	const first = list[0];
	if (first !== undefined) return first;
	throw new Error("No profiles available");
};

/** The localStorage (or sessionStorage, for `tags-group`) key one profile's store lives at. */
export const profileKey = (
	store: ProfileStore,
	id: string = activeProfile().id,
): string => `whattoeat:${id}:${store}`;

export type NameError =
	| "profiles.error.empty"
	| "profiles.error.taken"
	| "profiles.error.long";

/** `undefined` when `name` is usable as a profile name, an i18n key otherwise. `exceptId` is the profile being renamed, so it does not collide with its own current name. */
export const checkName = (
	name: string,
	exceptId?: string,
): NameError | undefined => {
	const trimmed = name.trim();
	if (trimmed === "") return "profiles.error.empty";
	if (trimmed.length > PROFILE_MAX) return "profiles.error.long";
	const taken = loadProfiles().some(
		(profile) =>
			profile.id !== exceptId &&
			profile.name.toLowerCase() === trimmed.toLowerCase(),
	);
	return taken ? "profiles.error.taken" : undefined;
};

/** Create an empty profile named `name` and switch to it. Throws a `NameError` when the name is unusable; the UI should call `checkName` first. */
export const createProfile = (name: string): Profile => {
	const error = checkName(name);
	if (error !== undefined) throw new Error(error);
	const list = loadProfiles();
	const profile: Profile = {
		id: newId(list.map((item) => item.id)),
		name: name.trim(),
	};
	persist([...list, profile], profile.id);
	return profile;
};

/** Rename a profile without changing which one is active. Throws a `NameError` when the name is unusable; the UI should call `checkName` first. */
export const renameProfile = (id: string, name: string): void => {
	const error = checkName(name, id);
	if (error !== undefined) throw new Error(error);
	const list = loadProfiles();
	const trimmed = name.trim();
	const next = list.map((profile) =>
		profile.id === id ? { ...profile, name: trimmed } : profile,
	);
	persist(next, activeProfile().id);
};

/** Switch the active profile; does nothing when `id` names no profile. */
export const switchProfile = (id: string): void => {
	const list = loadProfiles();
	if (!list.some((profile) => profile.id === id)) return;
	persist(list, id);
};

/** Remove every key in `storage` whose name starts with `whattoeat:<id>:`. */
const removeProfileKeys = (storage: Storage, id: string): void => {
	const prefix = `whattoeat:${id}:`;
	try {
		const keys: string[] = [];
		for (let i = 0; i < storage.length; i += 1) {
			const key = storage.key(i);
			if (key?.startsWith(prefix)) keys.push(key);
		}
		for (const key of keys) storage.removeItem(key);
	} catch {
		// Storage blocked: nothing to remove.
	}
};

/**
 * Delete a profile and every one of its keys in localStorage and sessionStorage, switching to
 * the first remaining profile if it was active. Throws when it is the only profile left.
 */
export const deleteProfile = (id: string): Profile => {
	const list = loadProfiles();
	if (list.length <= 1) throw new Error("Cannot delete the last profile");
	const next = list.filter((profile) => profile.id !== id);
	const first = next[0];
	if (first === undefined) throw new Error("No profiles available");

	removeProfileKeys(localStorage, id);
	removeProfileKeys(sessionStorage, id);

	const activeId = activeProfile().id;
	const nextActive = activeId === id ? first.id : activeId;
	persist(next, nextActive);
	return next.find((profile) => profile.id === nextActive) ?? first;
};

const arrayLength = (key: string): number => {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return 0;
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.length : 0;
	} catch {
		return 0;
	}
};

/** How many restaurants and history entries a profile holds; `0` when missing or unreadable. */
export const profileCounts = (
	id: string,
): { restaurants: number; history: number } => ({
	restaurants: arrayLength(profileKey("restaurants", id)),
	history: arrayLength(profileKey("history", id)),
});

/** The first whole character of a trimmed name, upper-cased; `"?"` for a blank name. */
export const profileInitial = (name: string): string =>
	Array.from(name.trim())[0]?.toUpperCase() ?? "?";
