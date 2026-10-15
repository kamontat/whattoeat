import { en, t, th } from "#lib/i18n";
import {
	BUILT_IN_GROUPS,
	groupValues,
	isKind,
	nameKey,
	parseTags,
	RESERVED_GROUP_IDS,
	type Restaurant,
} from "#lib/restaurant";

/** A group people made themselves, like "price". Built-in groups are never stored. */
export type GroupDef = { id: string; name: string };

export const GROUPS_KEY = "whattoeat:groups";
export const GROUPS_EVENT = "whattoeat:groups-changed";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: GroupDef[] | undefined;

export const isGroupDef = (value: unknown): value is GroupDef => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof GroupDef, unknown>>;
	return (
		typeof item.id === "string" &&
		item.id !== "" &&
		!RESERVED_GROUP_IDS.includes(item.id) &&
		typeof item.name === "string" &&
		item.name.trim() !== ""
	);
};

/** Unreadable entries and repeated ids are skipped; names are trimmed. */
export const loadGroups = (): GroupDef[] => {
	if (memory !== undefined) return memory;
	let data: unknown;
	try {
		data = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "[]");
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	const seen = new Set<string>();
	const list: GroupDef[] = [];
	for (const item of data) {
		if (!isGroupDef(item) || seen.has(item.id)) continue;
		seen.add(item.id);
		list.push({ id: item.id, name: item.name.trim() });
	}
	return list;
};

export const isGroupsMemoryOnly = (): boolean => memory !== undefined;

/** Drop the in-memory fallback; `resetStorage` calls this when it wipes everything. */
export const forgetGroupsMemory = (): void => {
	memory = undefined;
};

/** Returns `false` when localStorage refused the write and the list is only kept in memory. */
export const saveGroups = (list: GroupDef[]): boolean => {
	try {
		localStorage.setItem(GROUPS_KEY, JSON.stringify(list));
		memory = undefined;
	} catch {
		memory = list;
	}
	window.dispatchEvent(new CustomEvent(GROUPS_EVENT));
	return memory === undefined;
};

/** Call `callback` after every save here and every change from another tab. Returns an unsubscribe function. */
export const onGroupsChanged = (callback: () => void): (() => void) => {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === GROUPS_KEY || event.key === null) callback();
	};
	window.addEventListener(GROUPS_EVENT, callback);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(GROUPS_EVENT, callback);
		window.removeEventListener("storage", onStorage);
	};
};

export const customGroupIds = (defs: readonly GroupDef[]): string[] =>
	defs.map((def) => def.id);

/** Every filterable group in display order: Type, Cuisine, Area, then custom groups. */
export const allGroupIds = (defs: readonly GroupDef[]): string[] => [
	...BUILT_IN_GROUPS,
	...customGroupIds(defs),
];

const LABELLED = [...BUILT_IN_GROUPS, "tags"] as const;
type Labelled = (typeof LABELLED)[number];

const isLabelled = (id: string): id is Labelled =>
	(LABELLED as readonly string[]).includes(id);

export const groupLabel = (id: string, defs: readonly GroupDef[]): string =>
	isLabelled(id)
		? t(`group.${id}`)
		: (defs.find((def) => def.id === id)?.name ?? id);

/** Kinds show in the current language; other values show as typed. */
export const valueLabel = (group: string, value: string): string =>
	group === "kind" && isKind(value) ? t(`kind.${value}`) : value;

/** The built-in group (or plain tags) a name stands for in either language. */
export const builtInGroupNamed = (name: string): Labelled | undefined =>
	LABELLED.find((id) =>
		[en, th].some((dict) => nameKey(dict[`group.${id}`]) === nameKey(name)),
	);

/** A name is taken by a built-in label in either language or by another custom group, ignoring case. */
export const isGroupNameTaken = (
	defs: readonly GroupDef[],
	name: string,
	exceptId?: string,
): boolean =>
	builtInGroupNamed(name) !== undefined ||
	defs.some(
		(def) => def.id !== exceptId && nameKey(def.name) === nameKey(name),
	);

/** "Price: cheap" for every custom group value, groups in their stored order. */
export const customChips = (
	item: Restaurant,
	defs: readonly GroupDef[],
): string[] =>
	defs.flatMap((def) =>
		groupValues(item, def.id).map((value) => `${def.name}: ${value}`),
	);

export type GroupMerge = {
	groups: GroupDef[];
	/** Incoming ids that were folded into another group, and the id they now use. */
	remap: Record<string, string>;
};

const freeName = (defs: readonly GroupDef[], name: string): string => {
	let count = 1;
	while (isGroupNameTaken(defs, `${name} - ${count}`)) count++;
	return `${name} - ${count}`;
};

/** Fold `incoming` group definitions into `existing`; see the spec's "Export and import" rules. */
export const mergeGroupDefs = (
	existing: readonly GroupDef[],
	incoming: readonly GroupDef[],
): GroupMerge => {
	const groups = existing.map((def) => ({ ...def }));
	const remap: Record<string, string> = {};
	for (const def of incoming) {
		const name = def.name.trim();
		const same = groups.find((item) => item.id === def.id);
		if (same !== undefined) {
			if (!isGroupNameTaken(groups, name, def.id)) same.name = name;
			continue;
		}
		const builtIn = builtInGroupNamed(name);
		if (builtIn === "cuisine" || builtIn === "area") {
			remap[def.id] = builtIn;
			continue;
		}
		const match = groups.find((item) => nameKey(item.name) === nameKey(name));
		if (match !== undefined) {
			remap[def.id] = match.id;
			continue;
		}
		groups.push({
			id: def.id,
			name: builtIn === undefined ? name : freeName(groups, name),
		});
	}
	return { groups, remap };
};

/** Rewrite group ids by `remap`; values that meet in one group keep one copy. */
export const remapGroups = (
	list: readonly Restaurant[],
	remap: Readonly<Record<string, string>>,
): Restaurant[] =>
	list.map((item) => {
		const merged = new Map<string, string[]>();
		for (const [id, values] of Object.entries(item.groups)) {
			const target = Object.hasOwn(remap, id) ? (remap[id] ?? id) : id;
			merged.set(target, [...(merged.get(target) ?? []), ...values]);
		}
		return {
			...item,
			groups: Object.fromEntries(
				[...merged].map(([id, values]) => [id, parseTags(values.join(","))]),
			),
		};
	});
