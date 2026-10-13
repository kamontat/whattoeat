# Tag Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tags case-insensitive, suggest existing tags while typing, and let the random picker include or exclude tags.

**Architecture:** Tag rules live in `src/lib/restaurant.ts` (normalize, parse, order by usage) and are applied on load and import. Filter rules and their `localStorage` persistence live in a new pure module `src/lib/filter.ts`. A new Lit component `<tag-input>` replaces the comma text field in `restaurant-manager`; `random-picker` gains a row of tri-state filter chips and passes the filtered list to the unchanged `pickRandom`.

**Tech Stack:** Bun, TypeScript, Lit 3, happy-dom (tests), Biome.

**Spec:** `docs/superpowers/specs/2026-10-13-tag-rework-design.md`

## Global Constraints

- Work in worktree `.claude/worktrees/tag-rework`, branch `worktree-tag-rework`. Never edit `main`.
- Tags are stored as `normalizeTag` output: NFC, trimmed, whitespace runs collapsed to one space, `toLowerCase()`.
- Export format stays `EXPORT_VERSION = 1`; `Restaurant.tags` stays `string[]`.
- Filter storage key is exactly `whattoeat:filter`; value shape `{ include: string[]; exclude: string[] }`.
- Filter rule: if `include` is non-empty keep restaurants with any included tag; then drop restaurants with any excluded tag.
- Every new UI string gets a key in both `en` and `th` in `src/lib/i18n.ts` (`th` is typed `Record<MessageKey, string>`, so a missing key fails `tsc`).
- Imports use the `#lib/*`, `#components/*`, `#styles/*` aliases. Indent with tabs (Biome).
- Tests live under `tests/` mirroring `src/`. Run one file with `bun test <file>`.
- Commits: conventional, lower case, scoped (`feat(lib): ...`, `feat(components): ...`), each ending with the line
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Do not edit `CHANGELOG.md`.
- Before every commit run `bun run format && bun run check && bun run test`; all must pass.

## Review Focus

1. **Thai keyboard (IME) input:** pressing Enter to confirm a composed character must not add a half-typed tag — Task 3 tests `isComposing`.
2. **Text typed but not confirmed when saving:** the tag still saves, not silently lost — Task 3 (`commit()`) and Task 4 (submit test).
3. **Old data with `Thai` and `thai` on the same restaurant:** reads as one `thai` — Task 1 store test.
4. **Hand-edited or stale saved filter** (bad JSON, a tag in both lists, tags no longer used): loads safely, conflicts resolved toward include, unknown tags pruned — Task 2 and Task 5 tests.
5. **Filter matches nothing:** pick button disabled with a message, never a crash or an `undefined` result — Task 5 test.

---

### Task 1: Case-insensitive tag rules

**Files:**
- Modify: `src/lib/restaurant.ts` (add `normalizeTag`, `tagsByUsage`; change `parseTags`)
- Modify: `src/lib/store.ts` (`loadRestaurants` normalizes tags)
- Test: `tests/lib/restaurant.test.ts`, `tests/lib/store.test.ts`, `tests/lib/transfer.test.ts`

**Interfaces:**
- Produces: `normalizeTag(text: string): string`, `parseTags(text: string): string[]` (now case-insensitive), `tagsByUsage(list: readonly Restaurant[]): string[]`.

- [ ] **Step 1: Write the failing tests**

In `tests/lib/restaurant.test.ts`, add `normalizeTag` and `tagsByUsage` to the import from `#lib/restaurant`, then replace the test `"parseTags keeps different casing as different tags"` with:

```ts
test("parseTags merges tags that differ only in case, keeping first-seen order", () => {
	expect(parseTags("Thai, noodle, THAI, thai")).toEqual(["thai", "noodle"]);
});

test.each([
	["lowercases", "Thai", "thai"],
	["trims", "  thai  ", "thai"],
	["collapses inner whitespace", "thai \t  food", "thai food"],
	["composes Unicode to NFC", "café", "café"],
	["leaves Thai text alone", "ก๋วยเตี๋ยว", "ก๋วยเตี๋ยว"],
	["returns empty for blank text", "   ", ""],
])("normalizeTag %s", (_label, input, expected) => {
	expect(normalizeTag(input)).toBe(expected);
});

const withTags = (id: string, tags: string[]): Restaurant => ({
	...valid,
	id,
	tags,
});

test("tagsByUsage orders tags by how many restaurants use them, then by name", () => {
	expect(
		tagsByUsage([
			withTags("1", ["thai", "spicy"]),
			withTags("2", ["noodle", "thai"]),
			withTags("3", ["noodle", "thai", "cheap"]),
		]),
	).toEqual(["thai", "noodle", "cheap", "spicy"]);
});

test("tagsByUsage returns [] for no restaurants", () => {
	expect(tagsByUsage([])).toEqual([]);
});
```

In `tests/lib/store.test.ts`, add:

```ts
test("stored tags that differ only in case load as one lowercase tag", () => {
	const [item] = addRestaurant({ ...input, tags: [] });
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify([{ ...item, tags: ["Thai", "thai", " BBQ "] }]),
	);
	expect(loadRestaurants()[0]?.tags).toEqual(["thai", "bbq"]);
});
```

In `tests/lib/transfer.test.ts`, add:

```ts
test("imported tags are lowercased and merged by case", () => {
	const result = parseImport(
		JSON.stringify({
			app: "whattoeat",
			version: 1,
			restaurants: [{ ...make("a"), tags: ["Thai", "THAI", "Noodle"] }],
		}),
	);
	expect(result).toEqual({
		ok: true,
		restaurants: [{ ...make("a"), tags: ["thai", "noodle"] }],
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/lib/restaurant.test.ts tests/lib/store.test.ts tests/lib/transfer.test.ts`
Expected: FAIL — `normalizeTag`/`tagsByUsage` are not exported, and the casing tests get `["Thai", "thai"]`-style output.

- [ ] **Step 3: Implement**

In `src/lib/restaurant.ts`, replace `parseTags` with:

```ts
/** Canonical form of a tag: NFC, trimmed, single spaces, lowercase. Tags compare by this form only. */
export const normalizeTag = (text: string): string =>
	text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** Split comma-separated text into normalized, non-empty, de-duplicated tags, keeping first-seen order. */
export const parseTags = (text: string): string[] => {
	const tags = new Set<string>();
	for (const raw of text.split(",")) {
		const tag = normalizeTag(raw);
		if (tag !== "") tags.add(tag);
	}
	return [...tags];
};
```

Append to `src/lib/restaurant.ts`:

```ts
/** Every tag in the list, most-used first; ties are sorted by name. */
export const tagsByUsage = (list: readonly Restaurant[]): string[] => {
	const counts = new Map<string, number>();
	for (const item of list) {
		for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return [...counts]
		.sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
		.map(([tag]) => tag);
};
```

In `src/lib/store.ts`, add `parseTags` to the import from `#lib/restaurant`, and change the end of `loadRestaurants` from `return valid;` to:

```ts
	// Older data may hold tags that differ only in case; read them in canonical form.
	return valid.map((item) => ({ ...item, tags: parseTags(item.tags.join(",")) }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/lib`
Expected: PASS (all lib tests, including existing ones).

- [ ] **Step 5: Format, check, test, commit**

```bash
bun run format && bun run check && bun run test
git add -A
git commit -m "feat(lib): make tags case-insensitive

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tag filter rules and storage

**Files:**
- Create: `src/lib/filter.ts`
- Test: `tests/lib/filter.test.ts`

**Interfaces:**
- Consumes: `normalizeTag`, `Restaurant` from `#lib/restaurant` (Task 1).
- Produces:
  ```ts
  type TagFilter = { include: string[]; exclude: string[] };
  type TagState = "off" | "include" | "exclude";
  const EMPTY_FILTER: TagFilter;
  const FILTER_KEY = "whattoeat:filter";
  applyFilter(list: readonly Restaurant[], filter: TagFilter): Restaurant[];
  isFilterActive(filter: TagFilter): boolean;
  tagState(filter: TagFilter, tag: string): TagState;
  cycleTag(filter: TagFilter, tag: string): TagFilter;
  pruneFilter(filter: TagFilter, knownTags: readonly string[]): TagFilter;
  loadFilter(): TagFilter;
  saveFilter(filter: TagFilter): void;
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/filter.test.ts`:

```ts
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	applyFilter,
	cycleTag,
	EMPTY_FILTER,
	FILTER_KEY,
	isFilterActive,
	loadFilter,
	pruneFilter,
	saveFilter,
	tagState,
} from "#lib/filter";
import type { Restaurant } from "#lib/restaurant";

const make = (name: string, tags: string[]): Restaurant => ({
	id: name,
	name,
	tags,
	location: "",
	notes: "",
	createdAt: "2026-10-13T00:00:00.000Z",
	updatedAt: "2026-10-13T00:00:00.000Z",
});

const list = [
	make("A", ["thai"]),
	make("B", ["japanese"]),
	make("C", ["thai", "spicy"]),
	make("D", []),
];
const names = (items: Restaurant[]) => items.map((item) => item.name);

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("an empty filter keeps every restaurant", () => {
	expect(names(applyFilter(list, EMPTY_FILTER))).toEqual(["A", "B", "C", "D"]);
});

test("include keeps restaurants with any included tag", () => {
	expect(
		names(applyFilter(list, { include: ["thai", "japanese"], exclude: [] })),
	).toEqual(["A", "B", "C"]);
});

test("exclude drops restaurants with any excluded tag, untagged ones stay", () => {
	expect(names(applyFilter(list, { include: [], exclude: ["spicy"] }))).toEqual(
		["A", "B", "D"],
	);
});

test("include and exclude combine", () => {
	expect(
		names(applyFilter(list, { include: ["thai"], exclude: ["spicy"] })),
	).toEqual(["A"]);
});

test("a filter can match nothing", () => {
	expect(applyFilter(list, { include: ["pizza"], exclude: [] })).toEqual([]);
});

test("isFilterActive is true only when a list has tags", () => {
	expect(isFilterActive(EMPTY_FILTER)).toBe(false);
	expect(isFilterActive({ include: [], exclude: ["x"] })).toBe(true);
	expect(isFilterActive({ include: ["x"], exclude: [] })).toBe(true);
});

test("cycleTag goes off, include, exclude, off", () => {
	const included = cycleTag(EMPTY_FILTER, "thai");
	expect(included).toEqual({ include: ["thai"], exclude: [] });
	expect(tagState(included, "thai")).toBe("include");
	const excluded = cycleTag(included, "thai");
	expect(excluded).toEqual({ include: [], exclude: ["thai"] });
	expect(tagState(excluded, "thai")).toBe("exclude");
	const off = cycleTag(excluded, "thai");
	expect(off).toEqual(EMPTY_FILTER);
	expect(tagState(off, "thai")).toBe("off");
});

test("cycleTag leaves other tags alone", () => {
	expect(cycleTag({ include: ["a"], exclude: ["b"] }, "c")).toEqual({
		include: ["a", "c"],
		exclude: ["b"],
	});
});

test("pruneFilter drops tags that are no longer known", () => {
	expect(
		pruneFilter({ include: ["thai", "gone"], exclude: ["old"] }, ["thai"]),
	).toEqual({ include: ["thai"], exclude: [] });
});

test("loadFilter gives the empty filter when nothing is stored", () => {
	expect(loadFilter()).toEqual(EMPTY_FILTER);
});

test.each([
	["bad JSON", "{nope"],
	["null", "null"],
	["an array", "[]"],
	["a string", '"thai"'],
])("loadFilter gives the empty filter for %s", (_label, raw) => {
	localStorage.setItem(FILTER_KEY, raw);
	expect(loadFilter()).toEqual(EMPTY_FILTER);
});

test("loadFilter normalizes tags, drops non-strings and blanks, and resolves conflicts toward include", () => {
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({
			include: ["Thai", 1, " ", "THAI"],
			exclude: ["thai", "Spicy"],
		}),
	);
	expect(loadFilter()).toEqual({ include: ["thai"], exclude: ["spicy"] });
});

test("saveFilter round-trips through loadFilter", () => {
	saveFilter({ include: ["thai"], exclude: ["spicy"] });
	expect(loadFilter()).toEqual({ include: ["thai"], exclude: ["spicy"] });
});

test("saveFilter does not throw when storage refuses the write", () => {
	const spy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("QuotaExceededError");
	});
	try {
		expect(() => saveFilter({ include: ["x"], exclude: [] })).not.toThrow();
	} finally {
		spy.mockRestore();
	}
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/lib/filter.test.ts`
Expected: FAIL — `Cannot find module '#lib/filter'`.

- [ ] **Step 3: Implement**

Create `src/lib/filter.ts`:

```ts
import { normalizeTag, type Restaurant } from "#lib/restaurant";

export type TagFilter = { include: string[]; exclude: string[] };
export type TagState = "off" | "include" | "exclude";

export const EMPTY_FILTER: TagFilter = { include: [], exclude: [] };
export const FILTER_KEY = "whattoeat:filter";

/** Keep restaurants with any included tag (all when none is included), then drop any with an excluded tag. */
export const applyFilter = (
	list: readonly Restaurant[],
	filter: TagFilter,
): Restaurant[] =>
	list.filter(
		(item) =>
			(filter.include.length === 0 ||
				item.tags.some((tag) => filter.include.includes(tag))) &&
			!item.tags.some((tag) => filter.exclude.includes(tag)),
	);

export const isFilterActive = (filter: TagFilter): boolean =>
	filter.include.length > 0 || filter.exclude.length > 0;

export const tagState = (filter: TagFilter, tag: string): TagState => {
	if (filter.include.includes(tag)) return "include";
	if (filter.exclude.includes(tag)) return "exclude";
	return "off";
};

/** Move one tag to its next state: off, include, exclude, then off again. */
export const cycleTag = (filter: TagFilter, tag: string): TagFilter => {
	const include = filter.include.filter((item) => item !== tag);
	const exclude = filter.exclude.filter((item) => item !== tag);
	switch (tagState(filter, tag)) {
		case "off":
			return { include: [...include, tag], exclude };
		case "include":
			return { include, exclude: [...exclude, tag] };
		case "exclude":
			return { include, exclude };
	}
};

export const pruneFilter = (
	filter: TagFilter,
	knownTags: readonly string[],
): TagFilter => {
	const known = (tag: string): boolean => knownTags.includes(tag);
	return {
		include: filter.include.filter(known),
		exclude: filter.exclude.filter(known),
	};
};

const toTags = (value: unknown): string[] => {
	if (!Array.isArray(value)) return [];
	const tags = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const tag = normalizeTag(item);
		if (tag !== "") tags.add(tag);
	}
	return [...tags];
};

/** The saved filter, or the empty filter when nothing valid is stored. A tag in both lists stays included. */
export const loadFilter = (): TagFilter => {
	let data: unknown;
	try {
		data = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null");
	} catch {
		return EMPTY_FILTER;
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return EMPTY_FILTER;
	}
	const raw = data as Partial<Record<keyof TagFilter, unknown>>;
	const include = toTags(raw.include);
	return {
		include,
		exclude: toTags(raw.exclude).filter((tag) => !include.includes(tag)),
	};
};

export const saveFilter = (filter: TagFilter): void => {
	try {
		localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
	} catch {
		// Storage blocked: the filter lasts for this page only.
	}
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/lib/filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Format, check, test, commit**

```bash
bun run format && bun run check && bun run test
git add -A
git commit -m "feat(lib): add tag filter rules and storage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `<tag-input>` component

**Files:**
- Create: `src/components/tag-input.ts`
- Modify: `src/types/global.d.ts` (register `"tag-input": TagInput`)
- Modify: `src/lib/i18n.ts` (add `tagInput.remove` to `en` and `th`)
- Test: `tests/components/tag-input.test.ts`

**Interfaces:**
- Consumes: `normalizeTag`, `parseTags` from `#lib/restaurant` (Task 1).
- Produces: element `<tag-input>`, class `TagInput` with
  - properties `value: string[]`, `suggestions: string[]`, `label: string`, `hint: string` (set as properties, e.g. `.value=${...}`);
  - event `change` (`CustomEvent<string[]>`, `detail` = new tag list), fired only on user changes;
  - `commit(): string[]` — adds text still in the box and returns the resulting tag list;
  - `clearText(): void` — drops text still in the box without adding it.
- Inner DOM used by tests: `input` (the combobox), `.chip-text` (tag text), `button.remove` (per chip), `[role="listbox"]`, `[role="option"]`, `.hint`.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/tag-input.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/tag-input";
import type { TagInput } from "#components/tag-input";
import { setLang } from "#lib/i18n";

beforeEach(() => {
	localStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async (value: string[] = [], suggestions: string[] = []) => {
	const el = document.createElement("tag-input");
	el.label = "Tags";
	el.hint = "Press Enter";
	el.value = value;
	el.suggestions = suggestions;
	const changes: string[][] = [];
	el.addEventListener("change", (event) => {
		changes.push((event as CustomEvent<string[]>).detail);
	});
	document.body.append(el);
	await el.updateComplete;
	return { el, changes };
};

const box = (el: TagInput) =>
	el.shadowRoot!.querySelector<HTMLInputElement>("input")!;

const type = async (el: TagInput, text: string): Promise<void> => {
	box(el).value = text;
	box(el).dispatchEvent(new Event("input"));
	await el.updateComplete;
};

const press = async (
	el: TagInput,
	key: string,
	init: KeyboardEventInit = {},
): Promise<KeyboardEvent> => {
	const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init });
	box(el).dispatchEvent(event);
	await el.updateComplete;
	return event;
};

const chips = (el: TagInput) =>
	[...el.shadowRoot!.querySelectorAll(".chip-text")].map((c) => c.textContent);
const options = (el: TagInput) =>
	[...el.shadowRoot!.querySelectorAll('[role="option"]')].map((o) =>
		o.textContent?.trim(),
	);

test("renders its label, hint and existing tags", async () => {
	const { el } = await mount(["thai"]);
	expect(el.shadowRoot!.querySelector("label")?.textContent?.trim()).toBe(
		"Tags",
	);
	expect(el.shadowRoot!.querySelector(".hint")?.textContent).toBe(
		"Press Enter",
	);
	expect(chips(el)).toEqual(["thai"]);
});

test("Enter adds the typed text as a normalized tag and clears the box", async () => {
	const { el, changes } = await mount();
	await type(el, "  Thai   Food ");
	const event = await press(el, "Enter");
	expect(event.defaultPrevented).toBe(true);
	expect(chips(el)).toEqual(["thai food"]);
	expect(box(el).value).toBe("");
	expect(changes).toEqual([["thai food"]]);
});

test("a comma adds the text before it and keeps the rest", async () => {
	const { el } = await mount();
	await type(el, "a, B,c");
	expect(chips(el)).toEqual(["a", "b"]);
	expect(box(el).value).toBe("c");
});

test("a tag already added is ignored, whatever its case", async () => {
	const { el, changes } = await mount(["thai"]);
	await type(el, "THAI");
	await press(el, "Enter");
	expect(chips(el)).toEqual(["thai"]);
	expect(changes).toEqual([]);
});

test("Enter on an empty box is left to the form", async () => {
	const { el, changes } = await mount();
	const event = await press(el, "Enter");
	expect(event.defaultPrevented).toBe(false);
	expect(changes).toEqual([]);
});

test("Enter while an input method is composing does not add a tag", async () => {
	const { el } = await mount();
	await type(el, "ก๋วย");
	await press(el, "Enter", { isComposing: true });
	expect(chips(el)).toEqual([]);
	expect(box(el).value).toBe("ก๋วย");
});

test("Backspace on an empty box removes the last tag", async () => {
	const { el, changes } = await mount(["a", "b"]);
	await press(el, "Backspace");
	expect(chips(el)).toEqual(["a"]);
	expect(changes).toEqual([["a"]]);
});

test("Backspace with text in the box keeps the tags", async () => {
	const { el } = await mount(["a"]);
	await type(el, "x");
	await press(el, "Backspace");
	expect(chips(el)).toEqual(["a"]);
});

test("each chip has a labelled remove button", async () => {
	const { el, changes } = await mount(["thai", "noodle"]);
	const remove = el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
		"button.remove",
	)[0]!;
	expect(remove.getAttribute("aria-label")).toBe("Remove thai");
	remove.click();
	await el.updateComplete;
	expect(chips(el)).toEqual(["noodle"]);
	expect(changes).toEqual([["noodle"]]);
});

test("suggestions match the typed text and skip tags already added", async () => {
	const { el } = await mount(["thai"], ["thai", "noodle", "thai food"]);
	expect(box(el).getAttribute("aria-expanded")).toBe("false");
	await type(el, "TH");
	expect(options(el)).toEqual(["thai food"]);
	expect(box(el).getAttribute("aria-expanded")).toBe("true");
});

test("at most 8 suggestions show, in the given order", async () => {
	const many = Array.from({ length: 10 }, (_, i) => `tag${i}`);
	const { el } = await mount([], many);
	await type(el, "tag");
	expect(options(el)).toEqual(many.slice(0, 8));
});

test("arrow keys move through suggestions and Enter adds the active one", async () => {
	const { el } = await mount([], ["noodle", "nori"]);
	await type(el, "no");
	await press(el, "ArrowDown");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-0");
	await press(el, "ArrowDown");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-1");
	await press(el, "ArrowDown");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-0");
	await press(el, "ArrowUp");
	expect(box(el).getAttribute("aria-activedescendant")).toBe("option-1");
	expect(
		el.shadowRoot!.querySelector("#option-1")?.getAttribute("aria-selected"),
	).toBe("true");
	await press(el, "Enter");
	expect(chips(el)).toEqual(["nori"]);
	expect(options(el)).toEqual([]);
});

test("Escape closes the suggestions without adding anything", async () => {
	const { el } = await mount([], ["noodle"]);
	await type(el, "no");
	const event = await press(el, "Escape");
	expect(event.defaultPrevented).toBe(true);
	expect(options(el)).toEqual([]);
	expect(box(el).getAttribute("aria-expanded")).toBe("false");
	expect(chips(el)).toEqual([]);
});

test("clicking a suggestion adds it", async () => {
	const { el } = await mount([], ["noodle"]);
	await type(el, "no");
	el.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!.click();
	await el.updateComplete;
	expect(chips(el)).toEqual(["noodle"]);
	expect(box(el).value).toBe("");
});

test("commit adds text still in the box and returns the tags", async () => {
	const { el, changes } = await mount(["a"]);
	await type(el, "Spicy");
	expect(el.commit()).toEqual(["a", "spicy"]);
	expect(changes).toEqual([["a", "spicy"]]);
	expect(el.commit()).toEqual(["a", "spicy"]);
	expect(changes).toHaveLength(1);
});

test("clearText drops text in the box without adding it", async () => {
	const { el, changes } = await mount();
	await type(el, "half");
	el.clearText();
	await el.updateComplete;
	expect(box(el).value).toBe("");
	expect(changes).toEqual([]);
});

test("setting value from outside fires no change event", async () => {
	const { el, changes } = await mount(["a"]);
	el.value = ["b"];
	await el.updateComplete;
	expect(chips(el)).toEqual(["b"]);
	expect(changes).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/components/tag-input.test.ts`
Expected: FAIL — `Cannot find module '#components/tag-input'`.

- [ ] **Step 3: Implement**

In `src/lib/i18n.ts`, add after `"field.tagsHint"` in `en`:

```ts
	"tagInput.remove": "Remove {tag}",
```

and after `"field.tagsHint"` in `th`:

```ts
	"tagInput.remove": "ลบ {tag}",
```

Create `src/components/tag-input.ts`:

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { LangController, t } from "#lib/i18n";
import { normalizeTag, parseTags } from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

const MAX_SUGGESTIONS = 8;

/**
 * Tag chips plus a text box that suggests known tags. Fires `change` with the new tag list
 * whenever the user adds or removes a tag.
 */
@customElement("tag-input")
export class TagInput extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				position: relative;
				display: grid;
				gap: 0.25rem;
			}

			.field {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.25rem;
				padding: 0.25rem;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
			}

			.field:focus-within {
				outline: 2px solid var(--color-primary);
				outline-offset: 1px;
			}

			.field input {
				flex: 1 1 8rem;
				width: auto;
				min-width: 0;
				padding: 0.25rem 0.5rem;
				border: 0;
			}

			.field input:focus {
				outline: none;
			}

			.chip {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
			}

			button.remove {
				padding: 0 0.25rem;
				border: 0;
				background: none;
				line-height: 1;
			}

			[role="listbox"] {
				position: absolute;
				z-index: 1;
				top: 100%;
				right: 0;
				left: 0;
				margin: 0.25rem 0 0;
				padding: 0.25rem;
				list-style: none;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
				box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
			}

			[role="option"] {
				padding: 0.375rem 0.75rem;
				border-radius: var(--radius);
				cursor: pointer;
				font-weight: 400;
			}

			[role="option"]:hover,
			[role="option"][aria-selected="true"] {
				background: var(--color-bg);
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@property({ attribute: false })
	value: string[] = [];

	@property({ attribute: false })
	suggestions: string[] = [];

	@property()
	label = "";

	@property()
	hint = "";

	@state()
	private text = "";

	@state()
	private open = false;

	/** Index of the highlighted suggestion, or -1 for none. */
	@state()
	private active = -1;

	/** Add text still in the box; call before reading the tags on submit. Returns the tag list. */
	commit(): string[] {
		if (this.text !== "") this.add(this.text);
		return this.value;
	}

	clearText(): void {
		this.text = "";
		this.close();
	}

	private matches(): string[] {
		const needle = normalizeTag(this.text);
		if (needle === "") return [];
		return this.suggestions
			.filter((tag) => tag.includes(needle) && !this.value.includes(tag))
			.slice(0, MAX_SUGGESTIONS);
	}

	private close(): void {
		this.open = false;
		this.active = -1;
	}

	private setValue(next: string[]): void {
		this.value = next;
		this.dispatchEvent(new CustomEvent<string[]>("change", { detail: next }));
	}

	private add(text: string): void {
		this.text = "";
		this.close();
		const added = parseTags(text).filter((tag) => !this.value.includes(tag));
		if (added.length > 0) this.setValue([...this.value, ...added]);
	}

	private remove(tag: string): void {
		this.setValue(this.value.filter((item) => item !== tag));
	}

	private readonly onInput = (event: Event): void => {
		const text = (event.target as HTMLInputElement).value;
		const cut = text.lastIndexOf(",");
		if (cut >= 0) this.add(text.slice(0, cut));
		this.text = cut >= 0 ? text.slice(cut + 1) : text;
		this.open = true;
		this.active = -1;
	};

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		// Enter also confirms a character in Thai and other input methods; leave that alone.
		if (event.isComposing) return;
		const matches = this.matches();
		switch (event.key) {
			case "Enter": {
				const choice = this.open ? matches[this.active] : undefined;
				if (choice === undefined && this.text.trim() === "") return;
				event.preventDefault();
				this.add(choice ?? this.text);
				return;
			}
			case "ArrowDown":
			case "ArrowUp": {
				if (matches.length === 0) return;
				event.preventDefault();
				const step = event.key === "ArrowDown" ? 1 : -1;
				const from = this.open ? this.active : -1;
				this.open = true;
				this.active =
					from === -1 && step === -1
						? matches.length - 1
						: (from + step + matches.length) % matches.length;
				return;
			}
			case "Escape":
				if (!this.open || matches.length === 0) return;
				event.preventDefault();
				this.close();
				return;
			case "Backspace":
				if (this.text === "" && this.value.length > 0) {
					this.setValue(this.value.slice(0, -1));
				}
				return;
		}
	};

	override render() {
		const matches = this.open ? this.matches() : [];
		const expanded = matches.length > 0;
		const active = expanded && this.active >= 0 ? this.active : -1;
		return html`
			<label for="input">${this.label}</label>
			<div class="field">
				${
					this.value.length > 0
						? html`<ul class="chips">
								${this.value.map(
									(tag) => html`<li class="chip">
										<span class="chip-text">${tag}</span>
										<button
											type="button"
											class="remove"
											aria-label=${t("tagInput.remove", { tag })}
											@click=${() => this.remove(tag)}
										>×</button>
									</li>`,
								)}
							</ul>`
						: nothing
				}
				<input
					id="input"
					role="combobox"
					autocomplete="off"
					aria-autocomplete="list"
					aria-expanded=${expanded ? "true" : "false"}
					aria-controls="listbox"
					aria-activedescendant=${active >= 0 ? `option-${active}` : nothing}
					aria-describedby=${this.hint ? "hint" : nothing}
					.value=${live(this.text)}
					@input=${this.onInput}
					@keydown=${this.onKeyDown}
					@focus=${() => {
						this.open = true;
					}}
					@blur=${() => this.close()}
				/>
			</div>
			<ul id="listbox" role="listbox" ?hidden=${!expanded}>
				${matches.map(
					(tag, index) => html`<li
						id="option-${index}"
						role="option"
						aria-selected=${index === active ? "true" : "false"}
						@mousedown=${(event: Event) => event.preventDefault()}
						@click=${() => this.add(tag)}
					>
						${tag}
					</li>`,
				)}
			</ul>
			${this.hint ? html`<span id="hint" class="hint">${this.hint}</span>` : nothing}
		`;
	}
}
```

Note: `@mousedown` prevents the text box from losing focus (and closing the list) before the option's `click` fires.

In `src/types/global.d.ts`, add the import and the map entry:

```ts
import type { TagInput } from "#components/tag-input";
```

```ts
		"tag-input": TagInput;
```

(keep entries alphabetical: after `"restaurant-manager"`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/tag-input.test.ts`
Expected: PASS. If the `isComposing` test fails because happy-dom drops `isComposing` from `KeyboardEventInit`, check `new KeyboardEvent("keydown", { isComposing: true }).isComposing` in a scratch test; if happy-dom does not support it, define it on the event with `Object.defineProperty(event, "isComposing", { value: true })` inside `press` instead of passing it in `init`.

- [ ] **Step 5: Format, check, test, commit**

```bash
bun run format && bun run check && bun run test
git add -A
git commit -m "feat(components): add tag-input with suggestions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Restaurant form uses `<tag-input>`

**Files:**
- Modify: `src/components/restaurant-manager.ts`
- Modify: `src/lib/i18n.ts` (`field.tagsHint` text in `en` and `th`)
- Test: `tests/components/restaurant-manager.test.ts`

**Interfaces:**
- Consumes: `TagInput` (`value`, `suggestions`, `label`, `hint`, `change` event, `commit()`, `clearText()`) from Task 3; `tagsByUsage` from Task 1.

- [ ] **Step 1: Update and add the failing tests**

In `tests/components/restaurant-manager.test.ts`, add `import type { TagInput } from "#components/tag-input";` and these helpers after `type`:

```ts
const tagInput = (el: RestaurantManager) => $<TagInput>(el, "tag-input")!;

const typeTags = async (el: RestaurantManager, text: string): Promise<void> => {
	const field = tagInput(el);
	const box = field.shadowRoot!.querySelector<HTMLInputElement>("input")!;
	box.value = text;
	box.dispatchEvent(new Event("input"));
	await field.updateComplete;
	await el.updateComplete;
};

const tagChips = (el: RestaurantManager) =>
	[...tagInput(el).shadowRoot!.querySelectorAll(".chip-text")].map(
		(c) => c.textContent,
	);
```

Replace the test `"adds a restaurant with cleaned tags and resets the form"` with:

```ts
test("adds a restaurant with cleaned tags and resets the form", async () => {
	const el = await mount();
	type(el, "#name", " Jay Fai ");
	await typeTags(el, " Thai, ,noodle ,thai,");
	type(el, "#location", "Bangkok");
	type(el, "#notes", "Queue early");
	await submit(el);
	expect(loadRestaurants()).toMatchObject([
		{
			name: "Jay Fai",
			tags: ["thai", "noodle"],
			location: "Bangkok",
			notes: "Queue early",
		},
	]);
	expect(rowNames(el)).toEqual(["Jay Fai"]);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual([]);
});

test("a tag typed but not confirmed is saved on submit", async () => {
	const el = await mount();
	type(el, "#name", "Jay Fai");
	await typeTags(el, "Spicy");
	await submit(el);
	expect(loadRestaurants()[0]?.tags).toEqual(["spicy"]);
});

test("a blank name keeps a typed tag as a chip instead of losing it", async () => {
	const el = await mount();
	await typeTags(el, "spicy");
	await submit(el);
	expect(loadRestaurants()).toEqual([]);
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual(["spicy"]);
});

test("suggests existing tags, most used first", async () => {
	addRestaurant({ name: "A", tags: ["thai", "noodle"], location: "", notes: "" });
	addRestaurant({ name: "B", tags: ["noodle"], location: "", notes: "" });
	const el = await mount();
	expect(tagInput(el).suggestions).toEqual(["noodle", "thai"]);
	expect(tagInput(el).label).toBe("Tags");
	expect(tagInput(el).hint).toBe("Press Enter or comma to add, e.g. thai, noodle");
});
```

In `"edit fills the form and save updates the restaurant"`, replace

```ts
	expect($<HTMLInputElement>(el, "#tags")?.value).toBe("a, b");
```

with

```ts
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual(["a", "b"]);
```

In `"cancel edit resets the form without saving"`, after `type(el, "#name", "Changed");` add `await typeTags(el, "half");`, and after the existing `#name` assertion add:

```ts
	await tagInput(el).updateComplete;
	expect(
		tagInput(el).shadowRoot!.querySelector<HTMLInputElement>("input")?.value,
	).toBe("");
	expect(tagChips(el)).toEqual([]);
```

In `"an edit saved elsewhere reloads the open form instead of being overwritten"`, replace

```ts
	expect($<HTMLInputElement>(el, "#tags")?.value).toBe("new");
```

with

```ts
	await tagInput(el).updateComplete;
	expect(tagChips(el)).toEqual(["new"]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: FAIL — no `tag-input` element in the form (`tagInput(el)` is null).

- [ ] **Step 3: Implement**

In `src/lib/i18n.ts`, change `field.tagsHint`:

```ts
	"field.tagsHint": "Press Enter or comma to add, e.g. thai, noodle",
```

```ts
	"field.tagsHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ก๋วยเตี๋ยว",
```

In `src/components/restaurant-manager.ts`:

1. Imports: add `import "#components/tag-input";` and `import type { TagInput } from "#components/tag-input";`; change the restaurant import to `import { isLink, type Restaurant, tagsByUsage } from "#lib/restaurant";` (drop `parseTags`).

2. Form state:

```ts
type FormState = {
	name: string;
	tags: string[];
	location: string;
	notes: string;
};

const EMPTY_FORM: FormState = { name: "", tags: [], location: "", notes: "" };
```

3. Add after the `nameError` state (a getter, not `@query`, so it works with any class-field setting):

```ts
	private get tagInput(): TagInput | null {
		return this.renderRoot.querySelector("tag-input");
	}
```

4. `onInput` only handles text fields now; narrow the field type:

```ts
	private readonly onInput = (event: Event): void => {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		const field = target.name as Exclude<keyof FormState, "tags">;
		this.form = { ...this.form, [field]: target.value };
		if (field === "name") this.nameError = false;
	};

	private readonly onTagsChange = (event: CustomEvent<string[]>): void => {
		this.form = { ...this.form, tags: event.detail };
	};
```

5. `resetForm` also drops unconfirmed tag text:

```ts
	private resetForm(): void {
		this.form = EMPTY_FORM;
		this.editingId = undefined;
		this.nameError = false;
		this.tagInput?.clearText();
	}
```

6. `submit` confirms pending tag text first, so it is kept even when the name is missing:

```ts
	private readonly submit = (event: Event): void => {
		event.preventDefault();
		const tags = this.tagInput?.commit() ?? this.form.tags;
		if (this.form.name.trim() === "") {
			this.nameError = true;
			return;
		}
		const input = {
			name: this.form.name,
			tags,
			location: this.form.location,
			notes: this.form.notes,
		};
		const editingId = this.editingId;
		// Reset before saving so the store's change callback already sees a clean form.
		this.resetForm();
		if (editingId === undefined) addRestaurant(input);
		else updateRestaurant(editingId, input);
	};
```

7. `fillForm`: `tags: item.tags,` instead of `tags: item.tags.join(", "),`.

8. In `renderForm`, replace the whole tags `<label>…</label>` block with:

```ts
				<tag-input
					.label=${t("field.tags")}
					.hint=${t("field.tagsHint")}
					.value=${this.form.tags}
					.suggestions=${tagsByUsage(this.restaurants)}
					@change=${this.onTagsChange}
				></tag-input>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/restaurant-manager.test.ts tests/components/tag-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Format, check, test, commit**

```bash
bun run format && bun run check && bun run test
git add -A
git commit -m "feat(components): use tag-input in the restaurant form

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Tag filter on the random picker

**Files:**
- Modify: `src/components/random-picker.ts`
- Modify: `src/lib/i18n.ts` (filter keys in `en` and `th`)
- Test: `tests/components/random-picker.test.ts`

**Interfaces:**
- Consumes: from `#lib/filter` (Task 2) `applyFilter`, `cycleTag`, `EMPTY_FILTER`, `FILTER_KEY`, `isFilterActive`, `loadFilter`, `pruneFilter`, `saveFilter`, `tagState`, types `TagFilter`, `TagState`; `tagsByUsage` from `#lib/restaurant` (Task 1); `pickRandom` unchanged.
- Inner DOM used by tests: `section.filter`, `button.tag[data-tag="<tag>"]` with `data-state` and `aria-pressed`, `.active-filter`, `button[data-action="clear-filter"]`, `.no-match`, `button.pick`.

- [ ] **Step 1: Write the failing tests**

In `tests/components/random-picker.test.ts`, add `import { FILTER_KEY } from "#lib/filter";`, add helpers after `pickedName`:

```ts
const root = (el: HTMLElement) => el.shadowRoot!;
const tagButton = (el: HTMLElement, tag: string) =>
	root(el).querySelector<HTMLButtonElement>(`button.tag[data-tag="${tag}"]`);
const cycle = async (el: HTMLElement & { updateComplete: Promise<boolean> }, tag: string) => {
	tagButton(el, tag)!.click();
	await el.updateComplete;
};
```

and add these tests:

```ts
test("no filter row when no restaurant has tags", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(root(el).querySelector("section.filter")).toBeNull();
});

test("filter chips list tags most used first and cycle off, include, exclude", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["thai", "spicy"] });
	const el = await mount();
	expect(
		[...root(el).querySelectorAll("button.tag")].map((b) =>
			b.getAttribute("data-tag"),
		),
	).toEqual(["thai", "spicy"]);
	const thai = () => tagButton(el, "thai")!;
	expect(thai().getAttribute("data-state")).toBe("off");
	expect(thai().getAttribute("aria-pressed")).toBe("false");
	expect(thai().getAttribute("aria-label")).toBe("thai, not used");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("include");
	expect(thai().getAttribute("aria-pressed")).toBe("true");
	expect(thai().getAttribute("aria-label")).toBe("thai, included");
	expect(thai().textContent?.trim()).toBe("✓ thai");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("exclude");
	expect(thai().getAttribute("aria-label")).toBe("thai, excluded");
	expect(thai().textContent?.trim()).toBe("✕ thai");
	await cycle(el, "thai");
	expect(thai().getAttribute("data-state")).toBe("off");
});

test("picks only from restaurants that match the filter", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["japanese"] });
	addRestaurant({ ...base, name: "C", tags: ["thai", "spicy"] });
	const el = await mount();
	await cycle(el, "thai");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	for (let i = 0; i < 10; i++) {
		pickButton(el)!.click();
		await el.updateComplete;
		expect(pickedName(el)).toBe("A");
	}
});

test("an active filter is shown and Clear resets it", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["spicy"] });
	const el = await mount();
	expect(root(el).querySelector(".active-filter")).toBeNull();
	await cycle(el, "thai");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	expect(
		root(el).querySelector(".active-filter")?.textContent?.replace(/\s+/g, " ").trim(),
	).toBe("Filter active: ✓ thai, ✕ spicy Clear");
	root(el).querySelector<HTMLButtonElement>('button[data-action="clear-filter"]')!.click();
	await el.updateComplete;
	expect(root(el).querySelector(".active-filter")).toBeNull();
	expect(tagButton(el, "thai")?.getAttribute("data-state")).toBe("off");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({
		include: [],
		exclude: [],
	});
});

test("a filter that matches nothing disables the button and says so", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["japanese", "spicy"] });
	const el = await mount();
	await cycle(el, "japanese");
	await cycle(el, "spicy");
	await cycle(el, "spicy");
	expect(pickButton(el)?.disabled).toBe(true);
	expect(root(el).querySelector(".no-match")?.textContent?.trim()).toBe(
		"No restaurant matches this filter.",
	);
	pickButton(el)!.click();
	await el.updateComplete;
	expect(pickedName(el)).toBeUndefined();
});

test("the filter is remembered across visits", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	const first = await mount();
	await cycle(first, "thai");
	first.remove();
	const second = await mount();
	expect(tagButton(second, "thai")?.getAttribute("data-state")).toBe("include");
});

test("saved filter tags no longer used by any restaurant are dropped", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	localStorage.setItem(
		FILTER_KEY,
		JSON.stringify({ include: ["thai", "gone"], exclude: ["old"] }),
	);
	const el = await mount();
	expect(
		root(el).querySelector(".active-filter")?.textContent?.replace(/\s+/g, " ").trim(),
	).toBe("Filter active: ✓ thai Clear");
	expect(JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null")).toEqual({
		include: ["thai"],
		exclude: [],
	});
});

test("the result hides when the filter leaves out the current pick", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	addRestaurant({ ...base, name: "B", tags: ["noodle"] });
	const el = await mount();
	pickButton(el)!.click();
	await el.updateComplete;
	const other = pickedName(el) === "A" ? "noodle" : "thai";
	await cycle(el, other);
	expect(pickedName(el)).toBeUndefined();
});

test("filter labels render in Thai", async () => {
	addRestaurant({ ...base, name: "A", tags: ["thai"] });
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(root(el).querySelector(".filter-title")?.textContent?.trim()).toBe(
		"กรองตามแท็ก",
	);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/components/random-picker.test.ts`
Expected: FAIL — no `button.tag` elements.

- [ ] **Step 3: Implement**

In `src/lib/i18n.ts`, add after `"picker.addLink"` in `en`:

```ts
	"filter.title": "Filter by tag",
	"filter.hint": "Tap once to include, twice to exclude, again to clear.",
	"filter.state.off": "not used",
	"filter.state.include": "included",
	"filter.state.exclude": "excluded",
	"filter.tagState": "{tag}, {state}",
	"filter.active": "Filter active: {tags}",
	"filter.clear": "Clear",
	"filter.noMatch": "No restaurant matches this filter.",
```

and after `"picker.addLink"` in `th`:

```ts
	"filter.title": "กรองตามแท็ก",
	"filter.hint": "แตะหนึ่งครั้งเพื่อเลือก สองครั้งเพื่อไม่เอา อีกครั้งเพื่อยกเลิก",
	"filter.state.off": "ไม่ใช้",
	"filter.state.include": "เลือก",
	"filter.state.exclude": "ไม่เอา",
	"filter.tagState": "{tag}, {state}",
	"filter.active": "กำลังกรอง: {tags}",
	"filter.clear": "ล้าง",
	"filter.noMatch": "ไม่มีร้านที่ตรงกับตัวกรองนี้",
```

In `src/components/random-picker.ts`:

1. Imports:

```ts
import {
	applyFilter,
	cycleTag,
	EMPTY_FILTER,
	isFilterActive,
	loadFilter,
	pruneFilter,
	saveFilter,
	type TagFilter,
	type TagState,
	tagState,
} from "#lib/filter";
import { isLink, type Restaurant, tagsByUsage } from "#lib/restaurant";
```

2. Add to the component `css` block:

```css
			.filter {
				display: grid;
				gap: 0.5rem;
				width: 100%;
				justify-items: center;
			}

			.filter-title {
				font-size: 1rem;
			}

			.filter .chips {
				justify-content: center;
			}

			button.tag {
				padding: 0.25rem 0.75rem;
				font-size: 0.875rem;
			}

			button.tag.include {
				border-color: var(--color-success);
				color: var(--color-success);
				font-weight: 700;
			}

			button.tag.exclude {
				border-color: var(--color-danger);
				color: var(--color-danger);
				text-decoration: line-through;
			}

			button.link {
				padding: 0;
				border: 0;
				background: none;
				color: var(--color-primary);
				text-decoration: underline;
			}

			.pick:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
```

3. State and lifecycle (replace `connectedCallback` and `pick`):

```ts
	@state()
	private filter: TagFilter = EMPTY_FILTER;

	override connectedCallback(): void {
		super.connectedCallback();
		this.restaurants = loadRestaurants();
		this.filter = loadFilter();
		this.pruneFilter();
		this.unsubscribe = onRestaurantsChanged(() => {
			this.restaurants = loadRestaurants();
			this.pruneFilter();
			this.keepPickInPool();
		});
	}

	private get pool(): Restaurant[] {
		return applyFilter(this.restaurants, this.filter);
	}

	/** Drop filter tags no restaurant uses any more; save only when that changed something. */
	private pruneFilter(): void {
		const pruned = pruneFilter(this.filter, tagsByUsage(this.restaurants));
		if (
			pruned.include.length !== this.filter.include.length ||
			pruned.exclude.length !== this.filter.exclude.length
		) {
			saveFilter(pruned);
		}
		this.filter = pruned;
	}

	/** Hide the result when the picked restaurant was deleted or is outside the filter. */
	private keepPickInPool(): void {
		const pickedId = this.picked?.id;
		this.picked = this.pool.find((item) => item.id === pickedId);
	}

	private setFilter(next: TagFilter): void {
		this.filter = next;
		saveFilter(next);
		this.keepPickInPool();
	}

	private readonly clearFilter = (): void => {
		this.setFilter(EMPTY_FILTER);
	};

	private readonly pick = (): void => {
		this.picked = pickRandom(this.pool, this.picked?.id);
	};
```

4. In `render`, replace the final `return html\`…\`` (the one with the pick button) with:

```ts
		const tags = tagsByUsage(this.restaurants);
		const empty = this.pool.length === 0;
		return html`
			${heading}
			${tags.length > 0 ? this.renderFilter(tags) : nothing}
			${empty ? html`<p class="no-match" role="status">${t("filter.noMatch")}</p>` : nothing}
			<button type="button" class="primary pick" ?disabled=${empty} @click=${this.pick}>
				${this.picked ? t("picker.again") : t("picker.button")}
			</button>
			<div aria-live="polite">${this.picked ? this.renderResult(this.picked) : nothing}</div>
		`;
```

5. Add the filter renderer:

```ts
	private renderFilter(tags: string[]) {
		const symbol: Record<TagState, string> = {
			off: "",
			include: "✓ ",
			exclude: "✕ ",
		};
		const summary = [
			...this.filter.include.map((tag) => `${symbol.include}${tag}`),
			...this.filter.exclude.map((tag) => `${symbol.exclude}${tag}`),
		].join(", ");
		return html`
			<section class="filter" aria-labelledby="filter-title">
				<h2 id="filter-title" class="filter-title">${t("filter.title")}</h2>
				<p class="hint">${t("filter.hint")}</p>
				<ul class="chips">
					${tags.map((tag) => {
						const state = tagState(this.filter, tag);
						return html`<li>
							<button
								type="button"
								class="chip tag ${state}"
								data-tag=${tag}
								data-state=${state}
								aria-pressed=${state === "off" ? "false" : "true"}
								aria-label=${t("filter.tagState", { tag, state: t(`filter.state.${state}`) })}
								@click=${() => this.setFilter(cycleTag(this.filter, tag))}
							>
								${symbol[state]}${tag}
							</button>
						</li>`;
					})}
				</ul>
				${
					isFilterActive(this.filter)
						? html`<p class="active-filter">
								${t("filter.active", { tags: summary })}
								<button type="button" class="link" data-action="clear-filter" @click=${this.clearFilter}>
									${t("filter.clear")}
								</button>
							</p>`
						: nothing
				}
			</section>
		`;
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/random-picker.test.ts`
Expected: PASS, including all existing picker tests (the old "clears the result when the picked restaurant is deleted" test now goes through `keepPickInPool`).

- [ ] **Step 5: Format, check, test, commit**

```bash
bun run format && bun run check && bun run test
git add -A
git commit -m "feat(components): filter the random pick by tags

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify, push, open the pull request

**Files:** none changed (unless a check fails).

- [ ] **Step 1: Full verification**

```bash
bun run format && bun run check && bun run test && bun run build
git status
```

Expected: every command exits 0; `git status` clean (if `format` changed files, commit them as `style: format`).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "feat: rework tags with suggestions and a pick filter" --body "$(cat <<'EOF'
## Summary
- Tags are case-insensitive: stored lowercase, existing and imported data merged on read
- New `<tag-input>` chip field suggests existing tags, most used first
- Home page filter: tap a tag to include, again to exclude; remembered between visits, with a Clear line and a no-match message
- Spec and plan under `docs/superpowers/`; rename/merge tag added to `IDEAS.md`

## Test plan
- [x] `bun run check`
- [x] `bun run test`
- [x] `bun run build`
- [ ] Preview: tag chips and dropdown look right at phone width
- [ ] Preview: Thai keyboard input in the tag field
- [ ] Preview: filter colours readable for include and exclude

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for the preview deploy and report its URL**

```bash
gh pr checks <number> --watch
```

Report the URL from `.github/workflows/deploy-preview.yml` (`environment.url` with the PR number filled in) only after the `deploy` check passes.
