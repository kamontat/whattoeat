# Mobile redesign, stage 4: Tags and History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign History (`visit-history`) and Tags (`tag-manager`) to the Calm neutral design. History: page title, stats table in a card that scrolls sideways on narrow screens, visits grouped under Today / Yesterday / date headings in grouped lists, clear history last. Tags: back link, each value one tappable row (value · count) that opens its actions (Rename, Move to…, Delete) in a bottom sheet on phones or a side panel from 48rem; custom groups get a ⋯ button that opens Rename, Move up/down (disabled with a reason at the ends) and Delete in a sheet.

**Architecture:** All rename/move/merge/delete logic, prompts and wording in `tag-manager` stay; only where they render changes. A new `selected` value is shown in `.value-detail` (inside `<app-sheet class="value-sheet">` on phones, inside `section.value-panel` when wide, switched by `MediaController` as on Home and Restaurants). Group actions move into `.group-options` inside `<app-sheet class="group-sheet">`. History gets a pure `groupByDay` helper in `src/lib/history.ts`.

**Tech Stack:** Lit 3.3, Bun 1.4 (`bun test` + happy-dom 21), Biome 2.5, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md` (Pages → Tags; Pages → History; Accessibility checklist). Mockup: "Chosen — Tags …" artboards of <https://claude.ai/code/artifact/7cabd42f-544c-4073-8299-3dbb384f2604>, restyled in Calm neutral (Refine page).

## Global Constraints

- Work in the worktree `.claude/worktrees/redesign-tags-history` on branch `worktree-redesign-tags-history`; never edit `main`.
- Test first for every task: write the failing test, run it, watch it fail for the right reason, then code.
- Imports through `#components/*`, `#lib/*`, `#styles/*`.
- No change to `src/lib/groups.ts`, `src/lib/filter.ts`, `src/lib/store.ts`, `src/lib/restaurant.ts`; `src/lib/history.ts` only gains the pure helpers of Task 1.
- Every user-visible string through `t()`; new keys in both `en` and `th` of `src/lib/i18n.ts`; keep today's wording for existing prompts and buttons.
- Tokens from `src/styles/global.css` only; breakpoint `48rem` in CSS and `WIDE` (`#lib/media`) in JS.
- Keep every existing `data-action`, `data-clear`, `data-group`, `data-value`, `data-id`, `#new-group`, `.name`, `.count`, `time`, `.total`, `table`/`thead th`/`tbody tr`, `.empty`, `.skipped`, `.warning`, `section.tag-group` selector working, even where an element moves into a sheet or panel.
- Before each commit: `bun run format && bun run check && bun run test && bun run build`; `git add -A` after `format`.
- Conventional commits, lower case, scoped. End every commit message with exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md`.

## Review Focus

- **Renaming a value from its sheet/panel.** Expected: the detail stays open on the new name (or shows the merge prompt), focus stays on Rename, and the list row updates. Pinned in Task 3.
- **Moving or deleting the selected value.** Expected: the detail closes (the value is gone from this group), focus lands on `#new-group`, nothing is left half-open. Pinned in Task 3.
- **Another tab removes the selected value or group.** Expected: the detail or group sheet closes instead of acting on a value that no longer exists. Pinned in Task 3.
- **Visits across midnight and time zones.** Expected: grouping uses the local calendar day; a visit at 23:59 and one at 00:01 fall under different headings. Pinned in Task 1.
- **Phone width with a long stats table.** Expected: the table scrolls sideways inside its card (focusable, labelled region); the page itself never scrolls sideways. Pinned in Task 2 (markup), preview check for layout.

---

### Task 1: `groupByDay` and `relativeDay` (`#lib/history`)

**Files:**
- Modify: `src/lib/history.ts` (add exports)
- Test: `tests/lib/history.test.ts` (append)

**Interfaces:**
- Produces: `export type VisitDay = { key: string; day: Date; entries: HistoryEntry[] }`; `export const groupByDay = (entries: readonly HistoryEntry[]): VisitDay[]` (keeps the given order, groups consecutive entries of the same local day; `day` is local midnight); `export const relativeDay = (day: Date, now: Date): "today" | "yesterday" | undefined`.

- [ ] **Step 1: Write the failing tests** — append to `tests/lib/history.test.ts` (import `groupByDay`, `relativeDay` from `#lib/history`; `HistoryEntry` type is already exported there):

```ts
const at = (id: string, local: [number, number, number, number, number]) => ({
	id,
	restaurantId: "r",
	name: id,
	visitedAt: new Date(...local).toISOString(),
});

test("groupByDay keeps the order and groups visits by local calendar day", () => {
	const days = groupByDay([
		at("a", [2026, 9, 16, 20, 0]),
		at("b", [2026, 9, 16, 0, 1]),
		at("c", [2026, 9, 15, 23, 59]),
		at("d", [2026, 8, 30, 12, 0]),
	]);
	expect(days.map((d) => d.entries.map((e) => e.id))).toEqual([
		["a", "b"],
		["c"],
		["d"],
	]);
	expect(days[0]!.day).toEqual(new Date(2026, 9, 16));
	expect(days[1]!.day).toEqual(new Date(2026, 9, 15));
	expect(new Set(days.map((d) => d.key)).size).toBe(3);
});

test("groupByDay of nothing is nothing", () => {
	expect(groupByDay([])).toEqual([]);
});

test("relativeDay names today and yesterday by local day, else nothing", () => {
	const now = new Date(2026, 9, 16, 0, 30);
	expect(relativeDay(new Date(2026, 9, 16), now)).toBe("today");
	expect(relativeDay(new Date(2026, 9, 15), now)).toBe("yesterday");
	expect(relativeDay(new Date(2026, 9, 14), now)).toBeUndefined();
	expect(relativeDay(new Date(2026, 9, 17), now)).toBeUndefined();
});

test("relativeDay works across a month boundary", () => {
	expect(relativeDay(new Date(2026, 8, 30), new Date(2026, 9, 1, 9))).toBe(
		"yesterday",
	);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/lib/history.test.ts`
Expected: FAIL — `groupByDay` / `relativeDay` not exported.

- [ ] **Step 3: Implement** — append to `src/lib/history.ts`:

```ts
/** Visits of one local calendar day, in the order they were given (newest first in practice). */
export type VisitDay = { key: string; day: Date; entries: HistoryEntry[] };

const localDay = (date: Date): Date =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Groups consecutive visits that share a local calendar day, keeping their order. */
export const groupByDay = (entries: readonly HistoryEntry[]): VisitDay[] => {
	const days: VisitDay[] = [];
	for (const entry of entries) {
		const day = localDay(new Date(entry.visitedAt));
		const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
		const last = days.at(-1);
		if (last?.key === key) last.entries.push(entry);
		else days.push({ key, day, entries: [entry] });
	}
	return days;
};

/** "today" or "yesterday" for a local day relative to `now`; anything else is undefined. */
export const relativeDay = (
	day: Date,
	now: Date,
): "today" | "yesterday" | undefined => {
	const today = localDay(now);
	const yesterday = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate() - 1,
	);
	const time = localDay(day).getTime();
	if (time === today.getTime()) return "today";
	if (time === yesterday.getTime()) return "yesterday";
	return undefined;
};
```

- [ ] **Step 4: Run tests to verify they pass**, then full checks and commit:

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(lib): group visits by local day and name today and yesterday

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: History redesign (`visit-history`)

**Files:**
- Modify: `src/components/visit-history.ts` (styles, `render`, `renderClear`, `renderVisit`), `src/lib/i18n.ts`, `tests/styles/ui.test.ts` (drop `visit-history.ts` from `LEGACY_COMPONENTS`)
- Test: `tests/components/visit-history.test.ts`

**Interfaces:**
- Consumes: `groupByDay`, `relativeDay` (Task 1); `icon` (`trash`); `uiStyles` (`.page-title`, `.group-label`, `.group`, `.item`, `.grow`, `.card`, `button.danger`, `button.quiet`).
- Produces: `h1.page-title[tabindex="-1"]`; `section.stats.card` with `div.table-wrap[role="region"][tabindex="0"][aria-labelledby="stats-title"]` and `table > caption.visually-hidden`; per day `section.day` with `h3.group-label` and `ul.group.visits > li.visit[data-id]`; each visit row `.name`, `time` (time of day only), and a Delete button `data-action="delete"` with `aria-label` "Delete visit to {name} at {time}"; `section.clear` last.

- [ ] **Step 1: i18n keys** — `en`: `"history.today": "Today"`, `"history.yesterday": "Yesterday"`, `"history.deleteVisit": "Delete visit to {name} at {time}"`. `th`: `"history.today": "วันนี้"`, `"history.yesterday": "เมื่อวาน"`, `"history.deleteVisit": "ลบการไป {name} เวลา {time}"`.

- [ ] **Step 2: Update and add tests** — in `tests/components/visit-history.test.ts`:

1. `"lists every visit newest first with its date and time"`: the `time` element now shows the time of day only; change its expectation to `new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date("2026-10-12T05:18:00.000Z"))` (rename the test "…with its time under its day heading"). Keep the `datetime` assertion.
2. Append:

```ts
test("visits sit under day headings, newest day first", async () => {
	const el = await mount();
	const headings = [...root(el).querySelectorAll("section.day h3")].map((h) =>
		text(h),
	);
	expect(headings.length).toBeGreaterThan(0);
	for (const section of root(el).querySelectorAll("section.day")) {
		const id = section.getAttribute("aria-labelledby");
		expect(section.querySelector(`#${id}`)?.tagName).toBe("H3");
		expect(section.querySelectorAll("ul.group li.visit[data-id]").length).toBeGreaterThan(0);
	}
	expect(visitIds(el)).toEqual(["h1", "h2", "h3", "h4"]);
});

test("today's and yesterday's visits are headed Today and Yesterday", async () => {
	const now = new Date();
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
	saveHistory([
		visit("t1", "r2", "Som Tam Nua", now.toISOString()),
		visit("y1", "r2", "Som Tam Nua", yesterday.toISOString()),
	]);
	const el = await mount();
	expect(
		[...root(el).querySelectorAll("section.day h3")].map((h) => text(h)),
	).toEqual(["Today", "Yesterday"]);
});

test("each Delete names the visit it removes", async () => {
	const el = await mount();
	const button = action(el, "h1", "delete")!;
	const time = new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(
		new Date("2026-10-12T05:18:00.000Z"),
	);
	expect(button.getAttribute("aria-label")).toBe(
		`Delete visit to Som Tam Nua at ${time}`,
	);
	expect(text(button)).toBe("Delete");
});

test("the stats table scrolls inside a labelled, focusable region with a caption", async () => {
	const el = await mount();
	const region = root(el).querySelector(".stats .table-wrap")!;
	expect(region.getAttribute("role")).toBe("region");
	expect(region.getAttribute("tabindex")).toBe("0");
	expect(region.getAttribute("aria-labelledby")).toBe("stats-title");
	expect(text(region.querySelector("table caption"))).toBe("Stats");
});

test("the title is a large page title; clear history comes last", async () => {
	const el = await mount();
	expect(root(el).querySelector("h1.page-title")).not.toBeNull();
	const sections = [...root(el).querySelectorAll(":scope > section, :scope > div > section")];
	expect(sections.at(-1)?.classList.contains("clear")).toBe(true);
});
```

(`visit`, `saveHistory`, `mount`, `root`, `text`, `visitIds`, `action` already exist in this file; check `grep -n "^const\|^import" tests/components/visit-history.test.ts` and add any missing import. Adjust the last test's selector to the structure you render if the sections are wrapped differently, but keep its intent: the clear section is the last section.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/components/visit-history.test.ts`
Expected: the new and the updated test FAIL; the others PASS.

- [ ] **Step 4: Implement** — in `src/components/visit-history.ts`:

1. Imports: add `groupByDay`, `relativeDay` to the `#lib/history` import; add `import { icon } from "#lib/icons";`.
2. Replace the component `css` block with:

```ts
		css`
			:host {
				display: grid;
				gap: 1.25rem;
			}

			h1:focus {
				outline: none;
			}

			section {
				display: grid;
				gap: 0.5rem;
			}

			section > h2 {
				font-size: 1rem;
				font-weight: 600;
			}

			.stats {
				gap: 0.75rem;
			}

			.table-wrap {
				overflow-x: auto;
			}

			table {
				width: 100%;
				border-collapse: collapse;
				font-size: 0.9375rem;
			}

			th,
			td {
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid var(--color-border);
				text-align: start;
				white-space: nowrap;
			}

			th {
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-weight: 500;
			}

			.num {
				text-align: end;
			}

			tbody tr:last-child td {
				border-bottom: 0;
			}

			.visit .item {
				justify-content: space-between;
			}

			.visit time {
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.visit .actions {
				flex: none;
				flex-wrap: nowrap;
			}

			.visit button {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				font-size: 0.875rem;
			}

			.clear .actions button {
				min-height: 2.25rem;
				font-size: 0.875rem;
			}
		`,
```

3. In `render()`: the heading becomes `<h1 class="page-title" tabindex="-1">${t("history.title")}</h1>`. Replace the stats `<section aria-labelledby="stats-title">…</section>` with:

```ts
			<section class="stats card" aria-labelledby="stats-title">
				<h2 id="stats-title">${t("history.statsTitle")}</h2>
				<p class="total muted">
					${total === 1 ? t("history.total.one") : t("history.total.other", { count: total })}
				</p>
				<div class="table-wrap" role="region" tabindex="0" aria-labelledby="stats-title">
					<table>
						<caption class="visually-hidden">${t("history.statsTitle")}</caption>
						…keep thead and tbody exactly as they are…
					</table>
				</div>
			</section>
```

Then replace the visits `<section aria-labelledby="visits-title">…</section>` with the day groups, and move `${this.renderClear()}` after them:

```ts
			<section class="visits-list" aria-labelledby="visits-title">
				<h2 id="visits-title">${t("history.listTitle")}</h2>
				${groupByDay(this.history).map(
					({ key, day: date, entries }) => html`<section class="day" aria-labelledby="day-${key}">
						<h3 id="day-${key}" class="group-label">${this.dayLabel(date, day)}</h3>
						<ul class="group visits">
							${repeat(
								entries,
								(entry) => entry.id,
								(entry) => this.renderVisit(entry, time),
							)}
						</ul>
					</section>`,
				)}
			</section>
			${this.renderClear()}
```

where `day` is the existing `Intl.DateTimeFormat(lang, { dateStyle: "medium" })` and `time` is a new `new Intl.DateTimeFormat(lang, { timeStyle: "short" })` (replace the old `dayTime`). Add:

```ts
	/** Today, Yesterday, or the date. */
	private dayLabel(date: Date, format: Intl.DateTimeFormat): string {
		const relative = relativeDay(date, new Date());
		if (relative === "today") return t("history.today");
		if (relative === "yesterday") return t("history.yesterday");
		return format.format(date);
	}
```

4. Replace `renderVisit(entry, format)`:

```ts
	private renderVisit(entry: HistoryEntry, format: Intl.DateTimeFormat) {
		const confirming = this.confirmingId === entry.id;
		const time = format.format(new Date(entry.visitedAt));
		return html`
			<li class="visit" data-id=${entry.id}>
				<div class="item">
					<span class="grow">
						<b class="name">${entry.name}</b>
						<time datetime=${entry.visitedAt}>${time}</time>
					</span>
					<div class="actions">
						${
							confirming
								? html`
										<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(entry.id)}>
											${t("history.confirmDelete")}
										</button>
										<button type="button" data-action="cancel-delete" @click=${() => this.cancelDelete(entry.id)}>
											${t("history.cancel")}
										</button>
									`
								: html`<button
										type="button"
										class="quiet"
										data-action="delete"
										aria-label=${t("history.deleteVisit", { name: entry.name, time })}
										@click=${() => this.askDelete(entry.id)}
									>
										${t("history.delete")}
									</button>`
						}
					</div>
				</div>
			</li>
		`;
	}
```

5. In `renderClear()` keep the logic; wrap its range buttons' `.actions` unchanged; give the section `class="clear card"`.
6. In `tests/styles/ui.test.ts` remove `"visit-history.ts"` from `LEGACY_COMPONENTS` (the component now uses the shared list classes on purpose).

- [ ] **Step 5: Run tests to verify they pass**, then full checks and commit:

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): history grouped by day, with a scrolling stats card

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Tags redesign (`tag-manager`)

**Files:**
- Modify: `src/components/tag-manager.ts` (imports, styles, state, `render`, `renderGroup`, new `renderValueDetail`, `renderGroupOptions`; helpers `groupAction`, `valueRow` → see below), `src/lib/i18n.ts`, `tests/styles/ui.test.ts` (drop `tag-manager.ts` from `LEGACY_COMPONENTS`)
- Test: `tests/components/tag-manager.test.ts`

**Interfaces:**
- Consumes: `MediaController`, `WIDE`; `<app-sheet heading subheading ?open @sheet-close>` with `containsFocus()`; `icon` (`back`, `chevron`, `dots`, `edit`, `move`, `trash`, `up`, `down`); `uiStyles`.
- Produces:
  - Page: `a.back[href="./restaurants"]`, `h1.page-title`, intro `p.page-sub`.
  - Group card: `section.card.tag-group[data-group]` → `.group-head` with `h2` and, for custom groups, `button.options[data-action="group-options"][aria-haspopup="dialog"]` named "{group} options"; `ul.group.values > li.value[data-value]`; Type rows are `div.item.static` (no button) with `.name` and `.count`; other rows are `button.item.value-row[data-action="open-value"]` with `.name`, `.count` and a chevron.
  - Value detail: `div.value-detail[data-group][data-value]` — inside `<app-sheet class="value-sheet">` on phones, inside `section.card.value-panel` when wide (panel shows `p.muted.pick-hint` when nothing is selected). Without a prompt it lists `button.item[data-action="rename-value"]`, `[data-action="move-value"]` (with `small` "Another group"), `[data-action="delete-value"]`; with a prompt it shows today's prompt markup (rename form, merge, move select, delete confirmation) unchanged.
  - Group options: `div.group-options[data-group]` inside `<app-sheet class="group-sheet">` (all widths) — `rename-group`, `move-up`, `move-down` (disabled at the ends, with `small.reason` "Already the first group" / "Already the last group"), `delete-group`; with a prompt, today's rename form or delete confirmation.
  - The "Add a group" form stays an inline card at the end with `#new-group` (unchanged).

- [ ] **Step 1: i18n keys** — `en`: `"tags.groupOptions": "{group} options"`, `"tags.firstGroup": "Already the first group"`, `"tags.lastGroup": "Already the last group"`, `"tags.anotherGroup": "Another group"`, `"tags.valueSub": "{group} · {count}"`, `"tags.pickHint": "Choose a value to rename, move or delete it."`. `th`: `"tags.groupOptions": "ตัวเลือกของ {group}"`, `"tags.firstGroup": "อยู่บนสุดแล้ว"`, `"tags.lastGroup": "อยู่ล่างสุดแล้ว"`, `"tags.anotherGroup": "ไปกลุ่มอื่น"`, `"tags.valueSub": "{group} · {count}"`, `"tags.pickHint": "เลือกค่าเพื่อเปลี่ยนชื่อ ย้าย หรือลบ"`.

- [ ] **Step 2: Update the test helpers and the tests that reach actions** — in `tests/components/tag-manager.test.ts`:

1. Keep `card`, `cardTitles`, `valueRow` (the `li.value` row) as they are.
2. Add helpers:

```ts
/** Opens a value's actions (side panel at the default test width) and returns that container. */
const openValue = async (el: TagManager, group: string, value: string) => {
	valueRow(el, group, value)
		.querySelector<HTMLButtonElement>('[data-action="open-value"]')!
		.click();
	await el.updateComplete;
	return $<HTMLElement>(el, ".value-detail")!;
};

/** Opens a custom group's options sheet and returns its content. */
const openGroup = async (el: TagManager, group: string) => {
	card(el, group)
		.querySelector<HTMLButtonElement>('[data-action="group-options"]')!
		.click();
	await el.updateComplete;
	return $<HTMLElement>(el, ".group-options")!;
};
```

3. In every existing test that looks for a value action (`rename-value`, `move-value`, `delete-value`, `save-value`, `confirm-merge`, `confirm-move`, `confirm-delete-value`, `cancel`, the rename `input`, the move `select`, `.error`) inside `valueRow(…)`, first call `const detail = await openValue(el, group, value)` and look inside `detail` instead (after a re-render, look it up again with `$(el, ".value-detail")`). In every test that looks for a group action (`rename-group`, `move-up`, `move-down`, `delete-group`, `save-group-name`, `confirm-delete-group`, `cancel`, the rename `input`) inside `card(…)`, first call `await openGroup(el, group)` and look inside `$(el, ".group-options")`. Change only how elements are found — keep every expectation. Tests that check a group card has no rename button (built-in groups) now check it has no `[data-action="group-options"]`.
4. Append:

```ts
type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};
const setWidth = (width: number) => {
	(window as unknown as HappyWindow).happyDOM.setViewport({ width, height: 900 });
	window.dispatchEvent(new Event("resize"));
};
afterEach(() => setWidth(1024));

test("the page has a back link to Restaurants and a large title", async () => {
	const el = await mount();
	const back = $<HTMLAnchorElement>(el, "a.back")!;
	expect(back.getAttribute("href")).toBe("./restaurants");
	expect(back.textContent?.trim()).toBe("Restaurants");
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Tags");
});

test("value rows are buttons with the value and count; Type rows are plain", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"], groups: { cuisine: ["thai"] } });
	const el = await mount();
	const row = valueRow(el, "cuisine", "thai").querySelector(
		'button.item.value-row[data-action="open-value"]',
	)!;
	expect(row.querySelector(".name")?.textContent?.trim()).toBe("thai");
	expect(row.querySelector(".count")?.textContent?.trim()).toBe("1 restaurant");
	expect(valueRow(el, "kind", "food").querySelector("button")).toBeNull();
});

test("wide: the panel asks you to choose a value, then shows its actions", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	expect($(el, "section.value-panel .pick-hint")).not.toBeNull();
	expect($(el, "app-sheet.value-sheet")).toBeNull();
	const detail = await openValue(el, "cuisine", "thai");
	expect(detail.closest("section.value-panel")).not.toBeNull();
	expect(detail.getAttribute("data-value")).toBe("thai");
	expect(
		[...detail.querySelectorAll("button[data-action]")].map((b) =>
			b.getAttribute("data-action"),
		),
	).toEqual(["rename-value", "move-value", "delete-value"]);
	expect(
		valueRow(el, "cuisine", "thai")
			.querySelector('[data-action="open-value"]')
			?.getAttribute("aria-current"),
	).toBe("true");
});

test("phone: a value opens its actions in a sheet titled with the value", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	setWidth(390);
	const el = await mount();
	expect($(el, "section.value-panel")).toBeNull();
	await openValue(el, "cuisine", "thai");
	const sheet = $(el, "app-sheet.value-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("thai");
	expect(sheet.getAttribute("subheading")).toBe("Cuisine · 1 restaurant");
});

test("renaming keeps the detail open on the new name", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thia"] } });
	const el = await mount();
	let detail = await openValue(el, "cuisine", "thia");
	detail.querySelector<HTMLButtonElement>('[data-action="rename-value"]')!.click();
	await el.updateComplete;
	detail = $(el, ".value-detail")!;
	const input = detail.querySelector<HTMLInputElement>("input")!;
	input.value = "thai";
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
	$(el, ".value-detail")!
		.querySelector<HTMLButtonElement>('[data-action="save-value"]')!
		.click();
	await el.updateComplete;
	await el.updateComplete;
	expect($(el, ".value-detail")?.getAttribute("data-value")).toBe("thai");
	expect(el.shadowRoot!.activeElement?.getAttribute("data-action")).toBe(
		"rename-value",
	);
});

test("deleting the selected value closes the detail and focuses the add-group field", async () => {
	addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	const detail = await openValue(el, "cuisine", "thai");
	detail.querySelector<HTMLButtonElement>('[data-action="delete-value"]')!.click();
	await el.updateComplete;
	$(el, ".value-detail")!
		.querySelector<HTMLButtonElement>('[data-action="confirm-delete-value"]')!
		.click();
	await el.updateComplete;
	await el.updateComplete;
	expect($(el, ".value-detail")).toBeNull();
	expect(el.shadowRoot!.activeElement?.id).toBe("new-group");
});

test("another tab removing the selected value closes the detail", async () => {
	const [item] = addRestaurant({ ...base, name: "A", groups: { cuisine: ["thai"] } });
	const el = await mount();
	await openValue(el, "cuisine", "thai");
	updateRestaurant(item!.id, { ...base, name: "A", groups: {} });
	await el.updateComplete;
	expect($(el, ".value-detail")).toBeNull();
});

test("custom groups open their options in a sheet; moves at the ends are disabled with a reason", async () => {
	saveGroups([
		{ id: "g1", name: "Price" },
		{ id: "g2", name: "Vibe" },
	]);
	const el = await mount();
	expect(card(el, "cuisine").querySelector('[data-action="group-options"]')).toBeNull();
	const button = card(el, "g1").querySelector('[data-action="group-options"]')!;
	expect(button.getAttribute("aria-label")).toBe("Price options");
	expect(button.getAttribute("aria-haspopup")).toBe("dialog");
	const options = await openGroup(el, "g1");
	expect($(el, "app-sheet.group-sheet")?.hasAttribute("open")).toBe(true);
	const up = options.querySelector<HTMLButtonElement>('[data-action="move-up"]')!;
	expect(up.disabled).toBe(true);
	expect(up.querySelector(".reason")?.textContent?.trim()).toBe(
		"Already the first group",
	);
	expect(
		options.querySelector<HTMLButtonElement>('[data-action="move-down"]')!.disabled,
	).toBe(false);
});

test("another tab deleting the open group closes its sheet", async () => {
	saveGroups([{ id: "g1", name: "Price" }]);
	const el = await mount();
	await openGroup(el, "g1");
	saveGroups([]);
	await el.updateComplete;
	expect($(el, "app-sheet.group-sheet")?.hasAttribute("open")).toBe(false);
});
```

(`addRestaurant`, `updateRestaurant`, `saveGroups`, `base`, `mount`, `$`, `card`, `valueRow` exist or are imported in this file; add `afterEach`/`updateRestaurant` to the imports if missing. If a restaurant needs `kinds`, pass it as in the brief.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/components/tag-manager.test.ts`
Expected: the new tests and the updated ones FAIL (no `open-value`, no `.value-detail`, no `group-options`).

- [ ] **Step 4: Implement** — in `src/components/tag-manager.ts`:

1. Imports: `import "#components/app-sheet";`, `import { icon } from "#lib/icons";`, `import { MediaController, WIDE } from "#lib/media";`.
2. State:

```ts
	protected readonly wide = new MediaController(this, WIDE);

	/** The value whose actions are open (sheet on phones, side panel when wide). */
	@state() private selected: { group: string; value: string } | undefined;

	/** The custom group whose options sheet is open. */
	@state() private optionsFor: string | undefined;
```

3. In `reload()` (runs on every store change) drop selections that no longer exist:

```ts
		const selected = this.selected;
		if (
			selected !== undefined &&
			!valueCounts(this.restaurants, selected.group).some(
				(item) => item.value === selected.value,
			)
		) {
			this.selected = undefined;
			if (this.prompt !== undefined && "value" in this.prompt) this.prompt = undefined;
		}
		if (
			this.optionsFor !== undefined &&
			!this.defs.some((def) => def.id === this.optionsFor)
		) {
			this.optionsFor = undefined;
			this.prompt = undefined;
		}
```

4. Lookups now point at the detail and the options sheet:

```ts
	/** The open value's actions container (only one exists at a time). */
	private valueDetail(): Element | undefined {
		return this.renderRoot.querySelector(".value-detail") ?? undefined;
	}

	private groupAction(group: string, action: string): Element | undefined {
		const options = this.renderRoot.querySelector(".group-options");
		if (options?.getAttribute("data-group") !== group) return undefined;
		return options.querySelector(`[data-action="${action}"]`) ?? undefined;
	}
```

Replace every `this.valueRow(group, value)?.querySelector(X)` in the handlers with `this.valueDetail()?.querySelector(X)`, and delete the old `valueRow` method. `startRename` focuses `this.renderRoot.querySelector(".group-options input")`.

5. Opening and closing:

```ts
	private openValue(group: string, value: string): void {
		this.prompt = undefined;
		this.selected = { group, value };
		this.focusAfterRender(() =>
			this.valueDetail()?.querySelector('[data-action="rename-value"]'),
		);
	}

	private readonly closeValue = (): void => {
		this.selected = undefined;
		if (this.prompt !== undefined && "value" in this.prompt) this.prompt = undefined;
	};

	private openGroupOptions(group: string): void {
		this.prompt = undefined;
		this.optionsFor = group;
	}

	private readonly closeGroupOptions = (): void => {
		this.optionsFor = undefined;
		if (this.prompt?.kind === "rename-group" || this.prompt?.kind === "delete-group")
			this.prompt = undefined;
	};
```

6. After an action changes or removes the selected value:
   - `applyRename(group, value, to)`: after saving, set `this.selected = { group, value: to }` (focus stays on `rename-value` via the existing `focusAfterRender`, now pointed at the detail).
   - `applyMove` and `applyDelete`: set `this.selected = undefined` before saving (focus already goes to `#new-group`).
   - `confirmDeleteGroup`: set `this.optionsFor = undefined` (focus already goes to `#new-group`).
   - `willUpdate()`: when the width turns wide while a phone value sheet was open, nothing else is needed (the same `selected` shows in the panel); when it turns narrow, the sheet shows it — no state change required because the sheet's `open` is derived from `selected` (see render).

7. `render()`:

```ts
	override render() {
		const groups = [...BUILT_IN_GROUPS, ...this.defs.map((def) => def.id), "tags"];
		const wide = this.wide.matches;
		const selected = this.selected;
		const detailTitle =
			selected === undefined ? "" : valueLabel(selected.group, selected.value);
		const detailSub =
			selected === undefined ? "" : this.valueSubtitle(selected.group, selected.value);
		const optionsLabel =
			this.optionsFor === undefined ? "" : groupLabel(this.optionsFor, this.defs);
		return html`
			<a class="back" href="./restaurants">${icon("back", 20)}<span>${t("nav.restaurants")}</span></a>
			<div>
				<h1 class="page-title">${t("tags.title")}</h1>
				<p class="page-sub">${t("tags.intro")}</p>
			</div>
			…keep the storage warnings and the empty card exactly as they are…
			<div class="layout ${wide ? "wide" : ""}">
				<div class="groups-col">
					${repeat(groups, (group) => group, (group) => this.renderGroup(group))}
					${this.renderAddGroup()}
				</div>
				${
					wide
						? html`<section class="card value-panel" aria-labelledby="value-title">
								${
									selected === undefined
										? html`<p class="muted pick-hint">${t("tags.pickHint")}</p>`
										: html`<div>
												<h2 id="value-title">${detailTitle}</h2>
												<p class="muted">${detailSub}</p>
											</div>
											${this.renderValueDetail(selected.group, selected.value)}`
								}
							</section>`
						: html`<app-sheet
								class="value-sheet"
								heading=${detailTitle}
								subheading=${detailSub}
								?open=${selected !== undefined}
								@sheet-close=${this.closeValue}
							>
								${selected === undefined ? nothing : this.renderValueDetail(selected.group, selected.value)}
							</app-sheet>`
				}
			</div>
			<app-sheet
				class="group-sheet"
				heading=${optionsLabel}
				?open=${this.optionsFor !== undefined}
				@sheet-close=${this.closeGroupOptions}
			>
				${this.optionsFor === undefined ? nothing : this.renderGroupOptions(this.optionsFor)}
			</app-sheet>
		`;
	}

	private valueSubtitle(group: string, value: string): string {
		const count =
			valueCounts(this.restaurants, group).find((item) => item.value === value)
				?.count ?? 0;
		return t("tags.valueSub", {
			group: groupLabel(group, this.defs),
			count: count === 1 ? t("tags.count.one") : t("tags.count.other", { count }),
		});
	}
```

8. `renderGroup(group)` — the card shows only the heading, the options button and the value list:

```ts
	private renderGroup(group: string) {
		const custom = this.defs.some((def) => def.id === group);
		const label = groupLabel(group, this.defs);
		const values = valueCounts(this.restaurants, group);
		return html`
			<section class="card tag-group" data-group=${group} aria-label=${label}>
				<div class="group-head">
					<h2>${label}</h2>
					${
						custom
							? html`<button
									type="button"
									class="quiet options"
									data-action="group-options"
									aria-haspopup="dialog"
									aria-label=${t("tags.groupOptions", { group: label })}
									@click=${() => this.openGroupOptions(group)}
								>
									${icon("dots", 20)}
								</button>`
							: nothing
					}
				</div>
				${
					values.length === 0
						? html`<p class="muted">${t("tags.noValues")}</p>`
						: html`<ul class="group values">
								${values.map(({ value, count }) => this.renderValue(group, value, count))}
							</ul>`
				}
			</section>
		`;
	}

	private renderValue(group: string, value: string, count: number) {
		const countText = count === 1 ? t("tags.count.one") : t("tags.count.other", { count });
		const label = valueLabel(group, value);
		const current =
			this.selected?.group === group && this.selected.value === value;
		return html`<li class="value" data-value=${value}>
			${
				group === "kind"
					? html`<div class="item static">
							<span class="grow"><b class="name">${label}</b></span>
							<span class="count muted">${countText}</span>
						</div>`
					: html`<button
							type="button"
							class="item value-row"
							data-action="open-value"
							aria-haspopup=${this.wide.matches ? nothing : "dialog"}
							aria-current=${current ? "true" : nothing}
							@click=${() => this.openValue(group, value)}
						>
							<span class="grow"><b class="name">${label}</b></span>
							<span class="count muted">${countText}</span>
							<span class="trail">${icon("chevron", 18)}</span>
						</button>`
			}
		</li>`;
	}
```

9. `renderValueDetail(group, value)` — wraps today's `renderValueBody`, replacing only its no-prompt branch (the three inline buttons) with a list of rows:

```ts
	private renderValueDetail(group: string, value: string) {
		const count =
			valueCounts(this.restaurants, group).find((item) => item.value === value)
				?.count ?? 0;
		const prompt = this.prompt;
		const mine =
			prompt !== undefined && "value" in prompt && prompt.group === group && prompt.value === value
				? prompt
				: undefined;
		return html`<div class="value-detail" data-group=${group} data-value=${value}>
			${
				mine === undefined
					? html`<ul class="group actions-list">
							<li>
								<button type="button" class="item" data-action="rename-value"
									aria-label=${t("tags.renameValueLabel", { value })}
									@click=${() => this.startRenameValue(group, value)}>
									<span class="lead">${icon("edit", 20)}</span>
									<span class="grow"><b>${t("tags.rename")}</b></span>
								</button>
							</li>
							<li>
								<button type="button" class="item" data-action="move-value"
									aria-label=${t("tags.moveValueLabel", { value })}
									@click=${() => this.startMoveValue(group, value)}>
									<span class="lead">${icon("move", 20)}</span>
									<span class="grow"><b>${t("tags.move")}</b><small>${t("tags.anotherGroup")}</small></span>
								</button>
							</li>
							<li>
								<button type="button" class="item danger" data-action="delete-value"
									aria-label=${t("tags.deleteValueLabel", { value })}
									@click=${() => this.askDeleteValue(group, value)}>
									<span class="lead">${icon("trash", 20)}</span>
									<span class="grow"><b>${t("tags.delete")}</b></span>
								</button>
							</li>
						</ul>`
					: this.renderValueBody(group, value, count, mine)
			}
		</div>`;
	}
```

Keep `renderValueBody`'s prompt branches (`rename-value`, `merge`, `move-value`, `delete-value`) exactly as they are; delete its `prompt === undefined` branch (now in `renderValueDetail`).

10. `renderGroupOptions(group)` — today's rename form / delete prompt, or the option rows:

```ts
	private renderGroupOptions(group: string) {
		const index = this.defs.findIndex((def) => def.id === group);
		const label = groupLabel(group, this.defs);
		const prompt = this.prompt;
		const first = index === 0;
		const last = index === this.defs.length - 1;
		let body: unknown;
		if (prompt?.kind === "rename-group" && prompt.id === group)
			body = this.renderGroupTitle(group, label);
		else if (prompt?.kind === "delete-group" && prompt.id === group)
			body = this.renderGroupPrompt(group, label);
		else
			body = html`<ul class="group actions-list">
				<li>
					<button type="button" class="item" data-action="rename-group"
						aria-label=${t("tags.renameGroupLabel", { group: label })}
						@click=${() => this.startRename(group, label)}>
						<span class="lead">${icon("edit", 20)}</span>
						<span class="grow"><b>${t("tags.rename")}</b></span>
					</button>
				</li>
				<li>
					<button type="button" class="item" data-action="move-up" ?disabled=${first}
						aria-label=${t("tags.moveUp", { group: label })}
						@click=${() => this.moveGroupBy(group, -1)}>
						<span class="lead">${icon("up", 20)}</span>
						<span class="grow"><b>${t("tags.moveUp", { group: label })}</b>${first ? html`<small class="reason">${t("tags.firstGroup")}</small>` : nothing}</span>
					</button>
				</li>
				<li>
					<button type="button" class="item" data-action="move-down" ?disabled=${last}
						aria-label=${t("tags.moveDown", { group: label })}
						@click=${() => this.moveGroupBy(group, 1)}>
						<span class="lead">${icon("down", 20)}</span>
						<span class="grow"><b>${t("tags.moveDown", { group: label })}</b>${last ? html`<small class="reason">${t("tags.lastGroup")}</small>` : nothing}</span>
					</button>
				</li>
				<li>
					<button type="button" class="item danger" data-action="delete-group"
						aria-label=${t("tags.deleteGroupLabel", { group: label })}
						@click=${() => this.askDeleteGroup(group)}>
						<span class="lead">${icon("trash", 20)}</span>
						<span class="grow"><b>${t("tags.delete")}</b></span>
					</button>
				</li>
			</ul>`;
		return html`<div class="group-options" data-group=${group}>${body}</div>`;
	}
```

`renderGroupTitle(group, label)` now only renders the rename form (when the prompt is open); the plain `<h2>` lives in `renderGroup`. Delete `renderGroupActions`.

A disabled button keeps its reason visible as text; since disabled buttons are not focusable, `moveGroupBy` already moves focus to the other arrow at the ends.

11. Styles: replace the component's `css` block so it matches the Calm neutral lists. Keep any existing rule still used by the prompt forms (`.prompt`, `.rename`, `select`); add:

```css
			:host { display: grid; gap: 1rem; }
			.back { display: inline-flex; align-items: center; gap: 0.25rem; min-height: var(--tap); margin: -0.5rem 0 -0.5rem -0.5rem; padding: 0 0.5rem; font-weight: 600; text-decoration: none; }
			.layout { display: grid; gap: 1rem; }
			.groups-col { display: grid; gap: 1rem; align-content: start; }
			.group-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
			.group-head h2 { font-size: 1rem; font-weight: 600; }
			.options { width: var(--tap); padding: 0; }
			.values .item .count { white-space: nowrap; }
			.value-row[aria-current="true"] { background: var(--color-surface-2); box-shadow: inset 3px 0 0 var(--color-primary); }
			.item:disabled { opacity: 1; color: var(--color-muted); cursor: not-allowed; }
			.reason { color: var(--color-muted); }
			.value-panel { gap: 0.75rem; }
			.value-panel h2 { font-size: 1.125rem; font-weight: 600; }
			@media (forced-colors: active) { .value-row[aria-current="true"] { outline: 2px solid CanvasText; outline-offset: -2px; } }
			@media (min-width: 48rem) {
				.layout.wide { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 1.5rem; }
				.value-panel { position: sticky; top: 1rem; }
			}
```

(written in the file's normal one-property-per-line style).

12. `tests/styles/ui.test.ts`: remove `"tag-manager.ts"` from `LEGACY_COMPONENTS`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/components/tag-manager.test.ts`
Expected: PASS. If an existing test fails, it is a lookup that still points at the card or the row — move it to `openValue`/`openGroup` without changing what it expects.

- [ ] **Step 6: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): tags as tappable value rows with actions in a sheet or side panel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Page shells and spec notes

**Files:**
- Modify: `src/routes/tags.html` (`<main … class="wide">`), `tests/routes/pages.test.ts` (`WIDE_PAGES` gains `tags.html`), `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md`

- [ ] **Step 1: Test first** — add `"tags.html"` to `WIDE_PAGES` in `tests/routes/pages.test.ts`; run `bun test tests/routes/pages.test.ts` and see it fail.
- [ ] **Step 2:** `src/routes/tags.html`: `<main id="main" tabindex="-1">` → `<main id="main" tabindex="-1" class="wide">`. Run the test; PASS.
- [ ] **Step 3: Spec notes** — in the Tags section record: value actions open in a sheet on phones and a side panel from 48rem (which shows a hint until a value is chosen); custom group options are a sheet at every width; moves at the ends are disabled with a visible reason; "Add a group" stays an inline card at the end (not a sheet) so its field is always there to receive focus after a move or delete; another tab removing the open value or group closes it. In the History section record: day headings are `h3` group labels (Today, Yesterday, date) built with `groupByDay`/`relativeDay`; visit rows show the time only; the stats table scrolls inside a focusable region with a hidden caption; clear history comes last.
- [ ] **Step 4: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(routes): tags gets the wide main; spec notes for tags and history

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Then the controller runs the final review and opens the pull request (shipping-a-change).
