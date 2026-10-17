import {
	type Filter,
	type FilterScope,
	HOME_FILTER,
	moveFilterValue,
	renameFilterValue,
} from "#lib/filter";
import {
	type GroupDef,
	groupLabel,
	moveValue,
	renameValue,
	usingGroup,
	valueCounts,
	valueLabel,
} from "#lib/groups";
import {
	BUILT_IN_GROUPS,
	type Restaurant,
	VALUE_GROUPS,
} from "#lib/restaurant";

/** How a group in the tags list came to be: `kind` is fixed, cuisine/area are built in,
 * the rest are a custom group or plain tags. */
export type GroupKind = "fixed" | "built-in" | "custom" | "tags";

export type TagGroup = {
	id: string;
	label: string;
	kind: GroupKind;
	/** How many distinct values the group has. */
	values: number;
	/** How many restaurants have at least one value in the group. */
	restaurants: number;
};

const builtInKind = (id: string): GroupKind =>
	id === "kind" ? "fixed" : "built-in";

/** Every group in display order: Type, Cuisine, Area, custom groups (stored order), then plain tags. */
export const tagGroups = (
	list: readonly Restaurant[],
	defs: readonly GroupDef[],
): TagGroup[] => {
	const ids: { id: string; kind: GroupKind }[] = [
		...BUILT_IN_GROUPS.map((id) => ({ id, kind: builtInKind(id) })),
		...defs.map((def) => ({ id: def.id, kind: "custom" as const })),
		{ id: "tags", kind: "tags" as const },
	];
	return ids.map(({ id, kind }) => ({
		id,
		label: groupLabel(id, defs),
		kind,
		values: valueCounts(list, id).length,
		restaurants: usingGroup(list, id),
	}));
};

export type TagEntry =
	| { type: "group"; group: string; name: string }
	| {
			type: "value";
			group: string;
			value: string;
			name: string;
			count: number;
	  };

/** Every group first (in `tagGroups` order), then every value, grouped the same way and
 * ordered within each group by `valueCounts` (most used first). */
export const tagEntries = (
	list: readonly Restaurant[],
	defs: readonly GroupDef[],
): TagEntry[] => {
	const groups = tagGroups(list, defs);
	const groupEntries: TagEntry[] = groups.map((group) => ({
		type: "group",
		group: group.id,
		name: group.label,
	}));
	const valueEntries: TagEntry[] = groups.flatMap((group) =>
		valueCounts(list, group.id).map(
			({ value, count }): TagEntry => ({
				type: "value",
				group: group.id,
				value,
				name: valueLabel(group.id, value),
				count,
			}),
		),
	);
	return [...groupEntries, ...valueEntries];
};

/** Every group a value can move to: built-in value groups, custom groups, then plain tags. Type
 * is never a target since it only ever holds kinds. */
export const valueTargets = (defs: readonly GroupDef[]): string[] => [
	...VALUE_GROUPS,
	...defs.map((def) => def.id),
	"tags",
];

/** Whether moving `from` onto `to` would merge into an existing value there. */
export const wouldMerge = (
	list: readonly Restaurant[],
	from: { group: string; value: string },
	to: { group: string; value: string },
): boolean =>
	(to.group !== from.group || to.value !== from.value) &&
	valueCounts(list, to.group).some((entry) => entry.value === to.value);

/**
 * Rename `from.value` to `to.value` within `from.group`, then move it to `to.group`; each step
 * is a no-op when its endpoints match. The filter (of `scope`) follows the same two steps.
 */
export const editValue = (
	list: readonly Restaurant[],
	filter: Filter,
	from: { group: string; value: string },
	to: { group: string; value: string },
	now: Date,
	scope: FilterScope = HOME_FILTER,
): { restaurants: Restaurant[]; filter: Filter } => {
	const renamed = renameValue(list, from.group, from.value, to.value, now);
	const restaurants = moveValue(renamed, from.group, to.value, to.group, now);
	const renamedFilter = renameFilterValue(
		filter,
		from.group,
		from.value,
		to.value,
	);
	const nextFilter = moveFilterValue(
		renamedFilter,
		from.group,
		to.value,
		to.group,
		scope,
	);
	return { restaurants, filter: nextFilter };
};

/** Which group's tags last showed, kept for this tab only. */
export const PICK_KEY = "whattoeat:tags-group";

/** The stored pick when it still names one of `ids`, else `"cuisine"`. */
export const loadPick = (ids: readonly string[]): string => {
	try {
		const stored = sessionStorage.getItem(PICK_KEY);
		if (stored !== null && ids.includes(stored)) return stored;
	} catch {
		// Storage blocked: fall back to the default.
	}
	return "cuisine";
};

export const savePick = (id: string): void => {
	try {
		sessionStorage.setItem(PICK_KEY, id);
	} catch {
		// Storage blocked: the pick lasts for this page only.
	}
};
