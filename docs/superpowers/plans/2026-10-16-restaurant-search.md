# Restaurant Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A name search on the Restaurants page: a header magnifier turns the title row into an iOS-style search field that narrows the list as you type, with bold matches, a result count, and a no-match card that offers to add the name.

**Architecture:** A pure matcher in `src/lib/search.ts` (folding, words, highlight ranges). `restaurant-manager` keeps two new states (`searching`, `query`), renders the search row in place of the header, filters its sorted list through the matcher, and wraps matched ranges in `<mark>`. The search input is always rendered (hidden until search mode) so it can be focused synchronously inside the tap, which iOS needs to open the keyboard.

**Tech Stack:** Lit 3.3, TypeScript, Bun test + happy-dom 21, Biome.

**Spec:** `docs/superpowers/specs/2026-10-16-restaurant-search-design.md`

## Global Constraints

- Search matches the restaurant **name only**.
- Folding (per character, so composed and decomposed accents agree): lower-case, Latin combining accents U+0300–U+036F removed after NFD; Thai marks kept.
- Every word must appear (substring, any order); results keep the A–Z order.
- Entry: icon button "Search restaurants" before the Tags link, only when there is at least one restaurant.
- Search mode replaces the title row with field + clear (only with text) + Cancel; Cancel/Escape restore the header and focus the button.
- Count "{shown} of {total} restaurants" while at least one word; screen readers hear it 500 ms after typing pauses.
- No match: card with "No restaurants match "{query}"." plus **Add "{query}"** (prefills the name) and **Clear search**.
- `/` opens search only on wide screens (48rem+), not while typing in a field, not while a sheet is open.
- The query is never stored.
- All controls at least `var(--tap)` tall; 16px input text; visible focus ring; English and Thai text.
- Follow `shipping-a-change`: worktree, TDD, `bun run format`, `bun run check`, `bun run test`, `bun run build` before each commit; conventional lower-case commits ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **iOS keyboard:** the field must be focused inside the click handler, before any `await`; a reviewer should check no `focusAfterRender` is used to open search.
2. **Thai text:** a Thai query must never match a name that differs only by vowel or tone marks (the accent strip is limited to U+0300–U+036F).
3. **A search while data changes:** another tab adding or renaming restaurants re-filters; deleting the last restaurant mid-search leaves the empty-list card, not a broken header.
4. **Editing from results:** save, cancel and delete keep the query; a rename out of the query drops the row and the status still confirms.
5. **Live region noise:** the count is announced once per pause, not per key; the visible count updates immediately.

---

### Task 1: The name matcher

**Files:**
- Create: `src/lib/search.ts`
- Test: `tests/lib/search.test.ts`

**Interfaces:**
- Produces: `searchWords(query: string): string[]`, `type MatchRange = { start: number; end: number }`, `matchName(name: string, words: readonly string[]): MatchRange[] | undefined`. Ranges index into the original `name` string (UTF-16 offsets), sorted and merged.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "bun:test";
import { matchName, searchWords } from "#lib/search";

test("splits the query into folded words, dropping empty ones", () => {
	expect(searchWords("  Ramen   NAGI ")).toEqual(["ramen", "nagi"]);
	expect(searchWords("   ")).toEqual([]);
	expect(searchWords("")).toEqual([]);
});

test("folds Latin accents away but keeps Thai marks", () => {
	expect(searchWords("Café")).toEqual(["cafe"]);
	expect(searchWords("ข้าว")).toEqual(["ข้าว"]);
});

test("matches a word anywhere in the name, ignoring case", () => {
	expect(matchName("Ramen Champion", ["champ"])).toEqual([
		{ start: 6, end: 11 },
	]);
	expect(matchName("Ramen Champion", ["sushi"])).toBeUndefined();
});

test("every word must appear, in any order", () => {
	expect(matchName("Nagi Ramen Silom", searchWords("ramen nagi"))).toEqual([
		{ start: 0, end: 4 },
		{ start: 5, end: 10 },
	]);
	expect(matchName("Nagi Ramen Silom", searchWords("ramen sushi"))).toBe(
		undefined,
	);
});

test("an unaccented query highlights the accented letters it matched", () => {
	expect(matchName("Café Tartine", searchWords("cafe"))).toEqual([
		{ start: 0, end: 4 },
	]);
	// Decomposed input: "e" plus a combining acute, 5 code units for 4 letters.
	expect(matchName("Cafe\u0301 Tartine", searchWords("cafe"))).toEqual([
		{ start: 0, end: 5 },
	]);
});

test("Thai matches as typed: different tone marks do not match", () => {
	expect(matchName("ข้าวมันไก่", searchWords("ข้าว"))).toEqual([
		{ start: 0, end: 4 },
	]);
	expect(matchName("ข่าวสด", searchWords("ข้าว"))).toBeUndefined();
});

test("overlapping and repeated words merge into one range", () => {
	expect(matchName("Ramen Champion", searchWords("ram amen"))).toEqual([
		{ start: 0, end: 5 },
	]);
	expect(matchName("Ramen", searchWords("ram ram"))).toEqual([
		{ start: 0, end: 3 },
	]);
});

test("no words matches everything with nothing to highlight", () => {
	expect(matchName("Jay Fai", [])).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/search.test.ts`
Expected: FAIL with `Cannot find module '#lib/search'`

- [ ] **Step 3: Write minimal implementation**

```ts
/** A part of a name that matched, as UTF-16 offsets into the original string. */
export type MatchRange = { start: number; end: number };

/**
 * Lower-cased text with Latin accents (U+0300–U+036F after NFD) removed, one character at a
 * time, so composed and decomposed accents fold the same. Thai vowel and tone marks are
 * combining marks too, but different Thai words differ only by them, so they stay.
 * `map[i]` is the offset in `text` of the character folded into position `i`; one more entry
 * holds `text.length`.
 */
const fold = (text: string): { folded: string; map: number[] } => {
	let folded = "";
	const map: number[] = [];
	let offset = 0;
	for (const char of text) {
		const plain = char
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase();
		for (const unit of plain) {
			for (let i = 0; i < unit.length; i++) map.push(offset);
			folded += unit;
		}
		offset += char.length;
	}
	map.push(offset);
	return { folded, map };
};

/** The query split into folded words; empty when there is nothing to search for. */
export const searchWords = (query: string): string[] =>
	fold(query)
		.folded.split(/\s+/)
		.filter((word) => word !== "");

/**
 * Whether every word occurs in `name`, and if so the parts of `name` to highlight, sorted and
 * merged. `undefined` when it does not match. No words matches with nothing highlighted.
 */
export const matchName = (
	name: string,
	words: readonly string[],
): MatchRange[] | undefined => {
	const { folded, map } = fold(name);
	const ranges: MatchRange[] = [];
	for (const word of words) {
		const at = folded.indexOf(word);
		if (at === -1) return undefined;
		ranges.push({ start: map[at] ?? 0, end: map[at + word.length] ?? name.length });
	}
	ranges.sort((a, b) => a.start - b.start);
	const merged: MatchRange[] = [];
	for (const range of ranges) {
		const last = merged.at(-1);
		if (last !== undefined && range.start <= last.end)
			last.end = Math.max(last.end, range.end);
		else merged.push({ ...range });
	}
	return merged;
};
```

A combining accent right after a matched letter falls inside the range (the end is the next kept character's offset), so `"Cafe\u0301 Tartine"` highlights all five code units of the first word.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/search.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add src/lib/search.ts tests/lib/search.test.ts
git commit -m "feat(lib): name matcher for restaurant search

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Search mode, filtering, marks and count

**Files:**
- Modify: `src/lib/icons.ts` (add `search`)
- Modify: `src/lib/i18n.ts` (add keys, en and th)
- Modify: `src/components/restaurant-manager.ts`
- Test: `tests/components/restaurant-manager.test.ts`

**Interfaces:**
- Consumes: `searchWords`, `matchName`, `MatchRange` from `#lib/search`.
- Produces (DOM contract used by Task 3 and tests): button `[data-action="search"]` (aria-label "Search restaurants"); `.search-row` containing `input#search`, `button[data-action="clear-search"]` (only with text), `button[data-action="cancel-search"]`; `p.search-count`; a `.visually-hidden[role="status"].search-announce`; rows' `.name` with `<mark>` parts. Private methods `openSearch()`, `clearSearch`, `cancelSearch`, and a `results` list of `{ item: Restaurant; ranges: MatchRange[] }`.

- [ ] **Step 1: Add the i18n keys and icon (needed for the tests to type-check)**

In `src/lib/icons.ts` `SHAPES`, after `list`:

```ts
	search: svg`<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>`,
```

In `src/lib/i18n.ts`, after `"manager.deletePrompt"` in the English table:

```ts
	"search.open": "Search restaurants",
	"search.placeholder": "Search by name",
	"search.clear": "Clear search",
	"search.cancel": "Cancel",
	"search.count": "{shown} of {total} restaurants",
	"search.noMatch": 'No restaurants match "{query}".',
	"search.add": 'Add "{query}"',
```

and after `"manager.deletePrompt"` in the Thai table:

```ts
	"search.open": "ค้นหาร้านอาหาร",
	"search.placeholder": "ค้นหาด้วยชื่อ",
	"search.clear": "ล้างการค้นหา",
	"search.cancel": "ยกเลิก",
	"search.count": "{shown} จาก {total} ร้าน",
	"search.noMatch": "ไม่มีร้านที่ตรงกับ “{query}”",
	"search.add": "เพิ่ม “{query}”",
```

(`search.noMatch` and `search.add` are used in Task 3; adding them now keeps the table in one place.)

- [ ] **Step 2: Write the failing tests**

Append to `tests/components/restaurant-manager.test.ts`:

```ts
const searchInput = (el: RestaurantManager) => $<HTMLInputElement>(el, "#search")!;
const openSearch = async (el: RestaurantManager) => {
	$<HTMLButtonElement>(el, '[data-action="search"]')!.click();
	await el.updateComplete;
};
const typeSearch = async (el: RestaurantManager, text: string) => {
	type(el, "#search", text);
	await el.updateComplete;
};
const seedSearch = () => {
	for (const name of ["Bankara Ramen", "Café Tartine", "Jay Fai", "Ramen Champion"])
		addRestaurant({ ...blank, name });
};

test("search: the header button shows only once there is a restaurant", async () => {
	const el = await mount();
	expect($(el, '[data-action="search"]')).toBeNull();
	addRestaurant({ ...blank, name: "Jay Fai" });
	await el.updateComplete;
	const button = $(el, '.head-actions [data-action="search"]')!;
	expect(button.getAttribute("aria-label")).toBe("Search restaurants");
	expect(button.nextElementSibling?.classList.contains("tags-link")).toBe(true);
});

test("search: opening focuses the field inside the tap, so iOS opens the keyboard", async () => {
	seedSearch();
	const el = await mount();
	$<HTMLButtonElement>(el, '[data-action="search"]')!.click();
	// No await: the focus must already have moved when the click handler returns.
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
	await el.updateComplete;
	expect($(el, ".head")?.hasAttribute("hidden")).toBe(true);
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	const input = searchInput(el);
	expect(input.type).toBe("search");
	expect(input.getAttribute("aria-label")).toBe("Search restaurants");
	expect(input.placeholder).toBe("Search by name");
	expect(input.getAttribute("autocomplete")).toBe("off");
	expect(input.getAttribute("autocapitalize")).toBe("off");
	expect(input.getAttribute("spellcheck")).toBe("false");
	expect(input.getAttribute("enterkeyhint")).toBe("search");
});

test("search: typing narrows the list to matching names, A to Z, with the match in a mark", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	expect(rowNames(el)).toEqual(["Bankara Ramen", "Ramen Champion"]);
	const marks = [...el.shadowRoot!.querySelectorAll("li[data-id] .name mark")].map(
		(mark) => mark.textContent,
	);
	expect(marks).toEqual(["Ram", "Ram"]);
	expect(
		$(el, "li[data-id] button.row")?.getAttribute("aria-label"),
	).toBe("Edit Bankara Ramen");
	await typeSearch(el, "cafe");
	expect(rowNames(el)).toEqual(["Café Tartine"]);
	expect($(el, "li[data-id] .name mark")?.textContent).toBe("Café");
	await typeSearch(el, "champion ramen");
	expect(rowNames(el)).toEqual(["Ramen Champion"]);
});

test("search: the count shows at once; screen readers hear it after typing pauses", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	expect($(el, ".search-count")?.textContent?.trim()).toBe("4 restaurants");
	await typeSearch(el, "ram");
	expect($(el, ".search-count")?.textContent?.trim()).toBe(
		"2 of 4 restaurants",
	);
	const live = $(el, '.search-announce[role="status"]')!;
	expect(live.textContent?.trim()).toBe("");
	await new Promise((resolve) => setTimeout(resolve, 550));
	await el.updateComplete;
	expect(live.textContent?.trim()).toBe("2 of 4 restaurants");
});

test("search: clear empties the field but stays in search with focus in the field", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	expect($(el, '[data-action="clear-search"]')).toBeNull();
	await typeSearch(el, "ram");
	await click(el, '[data-action="clear-search"]');
	expect(searchInput(el).value).toBe("");
	expect(rowNames(el)).toHaveLength(4);
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("search: Cancel and Escape end search, restore the header and focus the button", async () => {
	seedSearch();
	const el = await mount();
	for (const end of ["cancel", "escape"]) {
		await openSearch(el);
		await typeSearch(el, "ram");
		if (end === "cancel") await click(el, '[data-action="cancel-search"]');
		else {
			searchInput(el).dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
			await el.updateComplete;
		}
		await el.updateComplete;
		expect($(el, ".head")?.hasAttribute("hidden")).toBe(false);
		expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
		expect(rowNames(el)).toHaveLength(4);
		expect(searchInput(el).value).toBe("");
		expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
			"search",
		);
	}
});

test("search: is translated to Thai", async () => {
	seedSearch();
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect($(el, '[data-action="search"]')?.getAttribute("aria-label")).toBe(
		"ค้นหาร้านอาหาร",
	);
	await openSearch(el);
	expect(searchInput(el).placeholder).toBe("ค้นหาด้วยชื่อ");
	expect($(el, '[data-action="cancel-search"]')?.textContent?.trim()).toBe(
		"ยกเลิก",
	);
	await typeSearch(el, "ram");
	expect($(el, ".search-count")?.textContent?.trim()).toBe("2 จาก 4 ร้าน");
});

test("search: field, clear and cancel are tap sized; the input text is 16px", () => {
	const css = (RestaurantManager.styles as unknown[])
		.slice(1)
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");
	expect(css).toMatch(/\.search-field\s*\{[^}]*min-height:\s*var\(--tap\)/);
	expect(css).toMatch(/\.search-open\s*\{[^}]*min-height:\s*var\(--tap\)/);
	expect(css).toMatch(/\.search-row\[hidden\]/);
	expect(css).toMatch(/\.name mark\s*\{[^}]*background:\s*var\(--color-primary-soft\)/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: the new `search:` tests FAIL (no `[data-action="search"]`); existing tests pass.

- [ ] **Step 4: Implement in `restaurant-manager.ts`**

Imports: add `import { type MatchRange, matchName, searchWords } from "#lib/search";`.

State, after `private skipped`:

```ts
	/** Whether the header is in search mode. */
	@state()
	private searching = false;

	/** What is typed in the search field; never stored. */
	@state()
	private query = "";

	/** The result count read out to screen readers once typing pauses. */
	@state()
	private announced = "";

	private announceTimer: ReturnType<typeof setTimeout> | undefined;
```

In `disconnectedCallback`, add `clearTimeout(this.announceTimer);`.

Methods (beside `startAdd`):

```ts
	/**
	 * iOS only opens the keyboard for a focus made during the tap, so the search row is always
	 * rendered and is shown and focused here, before any re-render.
	 */
	private readonly openSearch = (): void => {
		const row = this.renderRoot.querySelector<HTMLElement>(".search-row");
		if (row !== null) row.hidden = false;
		this.renderRoot.querySelector<HTMLInputElement>("#search")?.focus();
		this.searching = true;
	};

	private readonly onSearchInput = (event: Event): void => {
		this.query = (event.target as HTMLInputElement).value;
		this.scheduleAnnounce();
	};

	private readonly onSearchKey = (event: KeyboardEvent): void => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		this.cancelSearch();
	};

	private readonly clearSearch = (): void => {
		this.query = "";
		this.scheduleAnnounce();
		const input = this.renderRoot.querySelector<HTMLInputElement>("#search");
		if (input !== null) {
			input.value = "";
			input.focus();
		}
	};

	private readonly cancelSearch = (): void => {
		clearTimeout(this.announceTimer);
		this.searching = false;
		this.query = "";
		this.announced = "";
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="search"]'),
		);
	};

	/** Say the count once typing pauses, not on every key. */
	private scheduleAnnounce(): void {
		clearTimeout(this.announceTimer);
		this.announced = "";
		this.announceTimer = setTimeout(() => {
			this.announced = this.countText(this.sortedRestaurants());
		}, 500);
	}

	private sortedRestaurants(): Restaurant[] {
		return [...this.restaurants].sort((a, b) =>
			a.name.localeCompare(b.name, getLang()),
		);
	}

	/** The restaurants the query keeps, in list order, with what to highlight in each name. */
	private results(
		sorted: readonly Restaurant[],
	): { item: Restaurant; ranges: MatchRange[] }[] {
		const words = this.searching ? searchWords(this.query) : [];
		return sorted.flatMap((item) => {
			const ranges = matchName(item.name, words);
			return ranges === undefined ? [] : [{ item, ranges }];
		});
	}

	private countText(sorted: readonly Restaurant[]): string {
		const total = sorted.length;
		if (this.searching && searchWords(this.query).length > 0)
			return t("search.count", {
				shown: this.results(sorted).length,
				total,
			});
		return total === 1
			? t("picker.count.one")
			: t("picker.count.other", { count: total });
	}
```

Check `t`'s params type: if `t` only accepts `Record<string, string>`, pass `String(...)` values instead of numbers (follow how `picker.count.other` passes `count`).

In `render()`: replace the `sorted` declaration with `const sorted = this.sortedRestaurants();`, replace the `count` computation with `const count = this.countText(sorted);` for the header (when not searching it is the usual total), and add `const results = this.results(sorted);`.

Header markup becomes:

```ts
			<header class="head" ?hidden=${this.searching}>
				<div>
					<h1 class="page-title">${t("manager.title")}</h1>
					<p class="count page-sub">${count}</p>
				</div>
				<div class="head-actions">
					${
						sorted.length > 0
							? html`<button
									type="button"
									class="search-open"
									data-action="search"
									aria-label=${t("search.open")}
									@click=${this.openSearch}
								>
									${icon("search", 20)}
								</button>`
							: nothing
					}
					<a class="tags-link" href="./tags">${icon("tag", 18)}<span>${t("nav.tags")}</span></a>
					${wide ? add : nothing}
				</div>
			</header>
			<div class="search-row" ?hidden=${!this.searching}>
				<label class="search-field">
					${icon("search", 20)}
					<input
						id="search"
						type="search"
						aria-label=${t("search.open")}
						placeholder=${t("search.placeholder")}
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
						spellcheck="false"
						enterkeyhint="search"
						.value=${live(this.query)}
						@input=${this.onSearchInput}
						@keydown=${this.onSearchKey}
					/>
					${
						this.query !== ""
							? html`<button
									type="button"
									class="clear-search"
									data-action="clear-search"
									aria-label=${t("search.clear")}
									@click=${this.clearSearch}
								>
									${icon("x", 18)}
								</button>`
							: nothing
					}
				</label>
				<button type="button" class="cancel-search" data-action="cancel-search" @click=${this.cancelSearch}>
					${t("search.cancel")}
				</button>
			</div>
			${
				this.searching
					? html`<p class="search-count page-sub">${count}</p>`
					: nothing
			}
			<p class="visually-hidden search-announce" role="status">${this.announced}</p>
```

Note `count` already reflects search (via `countText`), so the header's `.count` is only visible when not searching and the `.search-count` only while searching.

List: render `results` instead of `sorted` — `results.map(({ item, ranges }) => this.renderRow(item, ranges))`, keeping the `sorted.length === 0` empty card. (Task 3 adds the no-match card for `results.length === 0`; until then an empty `<ul>` is fine.)

`renderRow(item: Restaurant, ranges: readonly MatchRange[] = [])`: replace `${item.name}` in `<b class="name">` with `${this.renderName(item.name, ranges)}` and add:

```ts
	/** The name with the parts the search matched wrapped in `<mark>`. */
	private renderName(name: string, ranges: readonly MatchRange[]) {
		if (ranges.length === 0) return name;
		const parts: unknown[] = [];
		let at = 0;
		for (const { start, end } of ranges) {
			if (start > at) parts.push(name.slice(at, start));
			parts.push(html`<mark>${name.slice(start, end)}</mark>`);
			at = end;
		}
		if (at < name.length) parts.push(name.slice(at));
		return parts;
	}
```

Styles (add to the component's `css`):

```css
			.head[hidden],
			.search-row[hidden] {
				display: none;
			}

			.search-open {
				width: var(--tap);
				min-height: var(--tap);
				padding: 0;
				border-radius: var(--radius-pill);
			}

			.search-row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}

			.search-field {
				display: flex;
				flex: 1;
				align-items: center;
				gap: 0.5rem;
				min-height: var(--tap);
				padding: 0 0 0 0.75rem;
				border-radius: var(--radius-sm);
				background: var(--color-surface-2);
				color: var(--color-muted);
				font-weight: 400;
			}

			.search-field:focus-within {
				outline: 3px solid var(--color-focus);
				outline-offset: 2px;
			}

			.search-field input {
				flex: 1;
				min-width: 0;
				min-height: var(--tap);
				padding: 0;
				border: 0;
				background: transparent;
				color: var(--color-text);
			}

			/* The field's own ring is drawn around the whole field above. */
			.search-field input:focus-visible {
				outline: none;
			}

			.search-field input::-webkit-search-cancel-button {
				display: none;
			}

			.clear-search {
				width: var(--tap);
				padding: 0;
				border: 0;
				background: transparent;
				color: var(--color-muted);
			}

			.cancel-search {
				padding: 0 0.25rem;
				border-color: transparent;
				background: transparent;
				color: var(--color-link);
			}

			.search-count {
				margin-top: -0.25rem;
			}

			.name mark {
				border-radius: 3px;
				background: var(--color-primary-soft);
				color: inherit;
				font-weight: 700;
			}

			@media (prefers-reduced-motion: no-preference) {
				.search-row:not([hidden]) {
					animation: search-in var(--duration) ease-out;
				}

				@keyframes search-in {
					from {
						opacity: 0;
					}
				}
			}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: all PASS, including every existing test (the header `.count` and row names are unchanged when not searching).

- [ ] **Step 6: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): search restaurants by name from the header

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: No-match card, add from search, `/` shortcut, edits during search

**Files:**
- Modify: `src/components/restaurant-manager.ts`
- Modify: `README.md` (Restaurants row in the page table)
- Modify: `TODO.md` (the "Search lists" item now covers Tags only)
- Test: `tests/components/restaurant-manager.test.ts`

**Interfaces:**
- Consumes: Task 2's DOM contract and private `openSearch`, `clearSearch`, `results`, `startAdd`.
- Produces: `.card.empty.no-match` with `button[data-action="add-named"]` and `button[data-action="clear-search-empty"]`.

- [ ] **Step 1: Write the failing tests**

```ts
test("search: no match shows one card that offers to add the name or clear", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "  zaab ");
	expect($(el, "ul.list")).toBeNull();
	const card = $(el, ".card.empty.no-match")!;
	expect(card.querySelector("p")?.textContent?.trim()).toBe(
		'No restaurants match "zaab".',
	);
	expect(
		card.querySelector('[data-action="add-named"]')?.textContent?.trim(),
	).toBe('Add "zaab"');
	await click(el, '[data-action="clear-search-empty"]');
	expect(rowNames(el)).toHaveLength(4);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("phone: Add from a search opens the new form with the name filled in", async () => {
	seedSearch();
	const el = await phone();
	await openSearch(el);
	await typeSearch(el, "Zaab Ari");
	await click(el, '[data-action="add-named"]');
	expect($(el, "app-sheet")?.hasAttribute("open")).toBe(true);
	expect($(el, "app-sheet")?.getAttribute("heading")).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Zaab Ari");
});

test("wide: Add from a search fills the side panel's name", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "Zaab Ari");
	await click(el, '[data-action="add-named"]');
	expect($(el, "#form-title")?.textContent?.trim()).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Zaab Ari");
});

test("search: editing a result keeps the search; a rename out of it drops the row", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "Bankara Tonkotsu");
	await submit(el);
	await el.updateComplete;
	expect(searchInput(el).value).toBe("ram");
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(rowNames(el)).toEqual(["Ramen Champion"]);
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved Bankara Tonkotsu",
	);
});

test("search: a restaurant added in another tab shows up if it matches", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	addRestaurant({ ...blank, name: "Ramen Nagi" });
	await el.updateComplete;
	expect(rowNames(el)).toEqual(["Bankara Ramen", "Ramen Champion", "Ramen Nagi"]);
});

test("search: deleting every restaurant mid-search shows the empty list card", async () => {
	seedSearch();
	const el = await mount();
	await openSearch(el);
	await typeSearch(el, "ram");
	saveRestaurants([]);
	await el.updateComplete;
	expect($(el, ".card.empty:not(.no-match)")).not.toBeNull();
	expect($(el, ".no-match")).toBeNull();
});

const slash = (target: EventTarget = document.body) =>
	target.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "/",
			bubbles: true,
			composed: true,
			cancelable: true,
		}),
	);

test("wide: / opens search, but not while typing in a field", async () => {
	seedSearch();
	const el = await mount();
	slash($<HTMLInputElement>(el, "#name")!);
	await el.updateComplete;
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	slash();
	await el.updateComplete;
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(false);
	expect(el.shadowRoot!.activeElement?.id).toBe("search");
});

test("phone: / does nothing", async () => {
	seedSearch();
	const el = await phone();
	slash();
	await el.updateComplete;
	expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
});

test("wide: / does nothing while a sheet is open", async () => {
	seedSearch();
	const el = await mount();
	document.documentElement.classList.add("sheet-open");
	try {
		slash();
		await el.updateComplete;
		expect($(el, ".search-row")?.hasAttribute("hidden")).toBe(true);
	} finally {
		document.documentElement.classList.remove("sheet-open");
	}
});

test("search: the no-match card is translated to Thai", async () => {
	seedSearch();
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	await openSearch(el);
	await typeSearch(el, "zaab");
	expect($(el, ".no-match p")?.textContent?.trim()).toBe(
		"ไม่มีร้านที่ตรงกับ “zaab”",
	);
	expect($(el, '[data-action="add-named"]')?.textContent?.trim()).toBe(
		"เพิ่ม “zaab”",
	);
	expect(
		$(el, '[data-action="clear-search-empty"]')?.textContent?.trim(),
	).toBe("ล้างการค้นหา");
});
```

If `saveRestaurants` is not imported in the test file yet, import it from `#lib/store` beside `addRestaurant`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: the new tests FAIL (no `.no-match`, `/` ignored).

- [ ] **Step 3: Implement**

Add-named:

```ts
	/** The no-match card's Add: a new restaurant already named what was searched for. */
	private startAddNamed(name: string): void {
		this.startAdd();
		this.form = { ...this.form, name };
	}
```

The no-match card, rendered in the list column when `sorted.length > 0 && results.length === 0`:

```ts
	private renderNoMatch() {
		const query = this.query.trim();
		return html`<div class="card empty no-match">
			<p>${t("search.noMatch", { query })}</p>
			<div class="actions">
				<button type="button" class="primary" data-action="add-named" @click=${() => this.startAddNamed(query)}>
					${icon("plus", 20)}<span>${t("search.add", { query })}</span>
				</button>
				<button type="button" data-action="clear-search-empty" @click=${this.clearSearch}>
					${t("search.clear")}
				</button>
			</div>
		</div>`;
	}
```

List column:

```ts
					${
						sorted.length === 0
							? html`<div class="card empty"><p>${t("manager.empty")}</p></div>`
							: results.length === 0
								? this.renderNoMatch()
								: html`<ul class="group list">${results.map(({ item, ranges }) => this.renderRow(item, ranges))}</ul>`
					}
```

Style: `.no-match .actions { justify-content: center; }`.

Shortcut:

```ts
	/** `/` opens search on wide screens, unless typing somewhere or a sheet is open. */
	private readonly onShortcut = (event: KeyboardEvent): void => {
		if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey)
			return;
		if (this.searching || !this.wide.matches || this.restaurants.length === 0)
			return;
		if (document.documentElement.classList.contains("sheet-open")) return;
		const target = event.composedPath()[0];
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
		)
			return;
		event.preventDefault();
		this.openSearch();
	};
```

Register in `connectedCallback` with `document.addEventListener("keydown", this.onShortcut);` and remove it in `disconnectedCallback`.

Docs: in `README.md`'s page table change the `/restaurants` row to `Add, edit and delete restaurants; search them by name`. In `TODO.md` change **Search lists** to say only the tag list is left: "A search box on the tag list, like the one on Restaurants. Needs matching on both English and Thai text, and an empty state when nothing matches."

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: all PASS.

- [ ] **Step 5: Format, check, test, build, commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): add from a search, and / opens search on wide screens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
