import { en, t, th } from "#lib/i18n";
import {
	BUILT_IN_GROUPS,
	groupValues,
	isKind,
	nameKey,
	newId,
	normalizeTag,
	parseTags,
	RESERVED_GROUP_IDS,
	type Restaurant,
	valuesByUsage,
} from "#lib/restaurant";

/** A group people made themselves, like "price". Built-in groups are never stored. */
export type GroupDef = { id: string; name: string };

export const GROUPS_KEY = "whattoeat:groups";
export const GROUPS_EVENT = "whattoeat:groups-changed";

/** Set when localStorage refused a write; the list then lives in memory for this session. */
let memory: GroupDef[] | undefined;

/** Ids a group may never take: the reserved built-ins, plus `__proto__`, which bracket assignment
 * (`obj[id] = ...`) would treat as the prototype setter instead of an own property. */
const FORBIDDEN_GROUP_IDS: readonly string[] = [
	...RESERVED_GROUP_IDS,
	"__proto__",
];

export const isGroupDef = (value: unknown): value is GroupDef => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<Record<keyof GroupDef, unknown>>;
	return (
		typeof item.id === "string" &&
		item.id !== "" &&
		!FORBIDDEN_GROUP_IDS.includes(item.id) &&
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

export type ValueCount = { value: string; count: number };

/** Each value of one group with how many restaurants have it, most used first, ties by name. */
export const valueCounts = (
	list: readonly Restaurant[],
	group: string,
): ValueCount[] =>
	valuesByUsage(list, group).map((value) => ({
		value,
		count: list.filter((item) => groupValues(item, group).includes(value))
			.length,
	}));

/** How many restaurants have any value in a group. */
export const usingGroup = (
	list: readonly Restaurant[],
	group: string,
): number => list.filter((item) => groupValues(item, group).length > 0).length;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export type NameError = "tags.nameRequired" | "tags.nameTaken";
export type ValueError = "tags.valueRequired" | "tags.valueComma";

const checkName = (
	defs: readonly GroupDef[],
	name: string,
	exceptId?: string,
): Result<string, NameError> => {
	const clean = name.trim();
	if (clean === "") return { ok: false, error: "tags.nameRequired" };
	if (isGroupNameTaken(defs, clean, exceptId))
		return { ok: false, error: "tags.nameTaken" };
	return { ok: true, value: clean };
};

export const addGroup = (
	defs: readonly GroupDef[],
	name: string,
): Result<GroupDef[], NameError> => {
	const checked = checkName(defs, name);
	if (!checked.ok) return checked;
	const id = newId([...RESERVED_GROUP_IDS, ...customGroupIds(defs)]);
	return { ok: true, value: [...defs, { id, name: checked.value }] };
};

export const renameGroup = (
	defs: readonly GroupDef[],
	id: string,
	name: string,
): Result<GroupDef[], NameError> => {
	const checked = checkName(defs, name, id);
	if (!checked.ok) return checked;
	return {
		ok: true,
		value: defs.map((def) =>
			def.id === id ? { ...def, name: checked.value } : def,
		),
	};
};

/** Swap a group with its neighbour; at either end nothing changes. */
export const moveGroup = (
	defs: readonly GroupDef[],
	id: string,
	offset: -1 | 1,
): GroupDef[] => {
	const from = defs.findIndex((def) => def.id === id);
	const to = from + offset;
	const next = [...defs];
	const a = next[from];
	const b = next[to];
	if (from < 0 || a === undefined || b === undefined) return next;
	next[from] = b;
	next[to] = a;
	return next;
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * Set one group's values; an empty list removes the key. `tags` sets plain tags. Built from a
 * single `Object.fromEntries` call, never bracket assignment: a group id of `__proto__` would
 * otherwise set the object's prototype instead of an own property.
 */
const withValues = (
	item: Restaurant,
	group: string,
	values: string[],
): Restaurant => {
	if (group === "tags") return { ...item, tags: values };
	const kept = Object.entries(item.groups).filter(([id]) => id !== group);
	return {
		...item,
		groups: Object.fromEntries(
			values.length > 0 ? [...kept, [group, values]] : kept,
		),
	};
};

/** Apply `edit` to every restaurant that has `value` in `group`, stamping `updatedAt`. */
const editWhere = (
	list: readonly Restaurant[],
	group: string,
	value: string,
	now: Date,
	edit: (item: Restaurant) => Restaurant,
): Restaurant[] =>
	list.map((item) =>
		groupValues(item, group).includes(value)
			? { ...edit(item), updatedAt: now.toISOString() }
			: item,
	);

/** Normalized value text, refusing blank text and commas (commas separate values). */
export const checkValue = (text: string): Result<string, ValueError> => {
	if (text.includes(",")) return { ok: false, error: "tags.valueComma" };
	const value = normalizeTag(text);
	if (value === "") return { ok: false, error: "tags.valueRequired" };
	return { ok: true, value };
};

/** Rename a value in one group; when `to` is already there, the two merge into one. */
export const renameValue = (
	list: readonly Restaurant[],
	group: string,
	from: string,
	to: string,
	now: Date,
): Restaurant[] =>
	from === to
		? [...list]
		: editWhere(list, group, from, now, (item) =>
				withValues(
					item,
					group,
					unique(
						groupValues(item, group).map((value) =>
							value === from ? to : value,
						),
					),
				),
			);

/** Move a value from one group to another (or to plain tags); a restaurant keeps one copy. */
export const moveValue = (
	list: readonly Restaurant[],
	from: string,
	value: string,
	to: string,
	now: Date,
): Restaurant[] =>
	from === to
		? [...list]
		: editWhere(list, from, value, now, (item) => {
				const removed = withValues(
					item,
					from,
					groupValues(item, from).filter((other) => other !== value),
				);
				return withValues(
					removed,
					to,
					unique([...groupValues(removed, to), value]),
				);
			});

export const deleteValue = (
	list: readonly Restaurant[],
	group: string,
	value: string,
	now: Date,
): Restaurant[] =>
	editWhere(list, group, value, now, (item) =>
		withValues(
			item,
			group,
			groupValues(item, group).filter((other) => other !== value),
		),
	);

/** Remove a custom group; its values become plain tags on every restaurant that had them. */
export const deleteGroup = (
	list: readonly Restaurant[],
	defs: readonly GroupDef[],
	id: string,
	now: Date,
): { restaurants: Restaurant[]; groups: GroupDef[] } => ({
	restaurants: list.map((item) => {
		const values = groupValues(item, id);
		if (values.length === 0) return item;
		return {
			...withValues(
				withValues(item, id, []),
				"tags",
				unique([...item.tags, ...values]),
			),
			updatedAt: now.toISOString(),
		};
	}),
	groups: defs.filter((def) => def.id !== id),
});
