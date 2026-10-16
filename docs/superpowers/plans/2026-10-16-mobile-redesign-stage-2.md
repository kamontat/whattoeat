# Mobile redesign, stage 2: Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Home (`random-picker`) to the Calm neutral design: visible title and count, a filter that opens in a bottom sheet on phones and sits in a left panel from 48rem, white result tiles with a soft "Eat here" button, a pick button pinned above the tab bar on phones (in the heading row on wide screens), and a live announcement of the picks by name.

**Architecture:** A small reactive controller `MediaController` (`src/lib/media.ts`) tells components whether a media query matches, so `random-picker` renders exactly one copy of the filter: inside `<app-sheet>` on phones, inside an `<aside>` panel from 48rem. All picking, filtering and visit logic in `random-picker` stays as it is; only styles and `render` helpers change. The Home page's `<main>` gets a `wide` class so the two-column layout has room.

**Tech Stack:** Lit 3.3, Bun 1.4 (`bun test` + happy-dom 21), Biome 2.5, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md` (Pages → Home; Visual system; Accessibility checklist). Mockup: Refine page, "Calm neutral" row, of <https://claude.ai/code/artifact/7cabd42f-544c-4073-8299-3dbb384f2604>.

## Global Constraints

- Work in the worktree `.claude/worktrees/redesign-home` on branch `worktree-redesign-home`; never edit `main`.
- Test first for every task: write the failing test, run it, watch it fail for the right reason, then code.
- Imports through `#components/*`, `#lib/*`, `#styles/*`.
- No change to filter, random, history or store logic in `src/lib/`; `src/lib/media.ts` is new.
- Every user-visible string through `t()`; every new key in both `en` and `th` of `src/lib/i18n.ts`.
- Keep today's wording and every existing selector the Home tests use: `button.pick`, `.result h2`, `button.tag[data-group][data-tag][data-state]`, `.active-filter`, `button[data-action="clear-filter"]`, `.no-match`, `.count`, `button.visit`, `.foot button.visit`, `.result.visited`, `.visited-label`, `section.filter`, `.filter-title`, `.filter-group h3`, `a[href="./restaurants"]`, `.skipped`, `.warning`.
- Tokens from `src/styles/global.css` only (`--color-*`, `--tap`, `--pad-x`, `--radius-*`, `--tab-bar-space`); no new colours.
- Breakpoint: phone layout below `48rem`, wide layout from `48rem` (same value in CSS and in `MediaController`).
- Before each commit: `bun run format && bun run check && bun run test && bun run build`; `git add -A` after `format`.
- Conventional commits, lower case, scoped. End every commit message with exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md`.

## Review Focus

- **Window resized across 48rem with a filter sheet open.** Expected: the layout switches, the sheet's content is not lost and the filter keeps its state (state lives in `this.filter`, not in the DOM). Pinned in Task 2 ("switching layouts keeps the filter").
- **Picking from a pool of one.** Expected: one tile and the announcement "Picked A" (no "and"). Pinned in Task 2.
- **Filter that matches nothing on a phone.** Expected: the pinned button is disabled and "No restaurant matches this filter." shows above the tiles. Covered by the existing test (runs wide) plus a phone variant in Task 2.
- **No groups in use.** Expected: no Filter button, no sheet, no panel, and the wide layout has no empty left column. Pinned in Task 2.
- **Keyboard on phone.** Expected: Filter button opens the sheet, Done and Esc close it and focus returns to the Filter button (from `app-sheet`). Pinned in Task 2 ("Done closes the sheet").

---

### Task 1: `MediaController`

**Files:**
- Create: `src/lib/media.ts`
- Test: `tests/lib/media.test.ts`

**Interfaces:**
- Produces: `export class MediaController implements ReactiveController { constructor(host: ReactiveControllerHost, query: string); readonly query: string; get matches(): boolean }` — re-renders the host when the match changes (media `change` event, or a window `resize`, since happy-dom does not fire `change`).
- Produces: `export const WIDE = "(min-width: 48rem)";`

- [ ] **Step 1: Write the failing test** — `tests/lib/media.test.ts`:

```ts
import { afterEach, expect, test } from "bun:test";
import { LitElement } from "lit";
import { MediaController, WIDE } from "#lib/media";

type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};
const setWidth = (width: number) => {
	(window as HappyWindow).happyDOM.setViewport({ width, height: 900 });
	window.dispatchEvent(new Event("resize"));
};

class Probe extends LitElement {
	readonly media = new MediaController(this, WIDE);
	renders = 0;
	override render() {
		this.renders++;
		return null;
	}
}
customElements.define("media-probe", Probe);

afterEach(() => {
	document.body.innerHTML = "";
	setWidth(1024);
});

const mount = async () => {
	const el = document.createElement("media-probe") as Probe;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("wide is 48rem and up", () => {
	expect(WIDE).toBe("(min-width: 48rem)");
});

test("reports whether the query matches", async () => {
	setWidth(1024);
	expect((await mount()).media.matches).toBe(true);
	document.body.innerHTML = "";
	setWidth(390);
	expect((await mount()).media.matches).toBe(false);
});

test("re-renders the host when the width crosses the query", async () => {
	setWidth(1024);
	const el = await mount();
	const before = el.renders;
	setWidth(390);
	await el.updateComplete;
	expect(el.media.matches).toBe(false);
	expect(el.renders).toBe(before + 1);
});

test("a resize that keeps the same answer does not re-render", async () => {
	setWidth(1024);
	const el = await mount();
	const before = el.renders;
	setWidth(1200);
	await el.updateComplete;
	expect(el.renders).toBe(before);
});

test("stops listening when the host disconnects", async () => {
	setWidth(1024);
	const el = await mount();
	el.remove();
	const before = el.renders;
	setWidth(390);
	await el.updateComplete;
	expect(el.renders).toBe(before);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/media.test.ts`
Expected: FAIL — `Cannot find module '#lib/media'`.

- [ ] **Step 3: Write `src/lib/media.ts`**

```ts
import type { ReactiveController, ReactiveControllerHost } from "lit";

/** The width from which pages use their wide layout; keep in step with the CSS `48rem` breakpoint. */
export const WIDE = "(min-width: 48rem)";

/**
 * Whether a media query matches, re-rendering the host when the answer changes. Listens to the
 * query's `change` event and to window `resize` (happy-dom only updates `matches` on resize).
 */
export class MediaController implements ReactiveController {
	private readonly host: ReactiveControllerHost;
	private list: MediaQueryList | undefined;
	private last = false;

	constructor(
		host: ReactiveControllerHost,
		readonly query: string,
	) {
		this.host = host;
		host.addController(this);
	}

	get matches(): boolean {
		return this.list?.matches ?? window.matchMedia(this.query).matches;
	}

	private readonly onChange = (): void => {
		const next = this.matches;
		if (next === this.last) return;
		this.last = next;
		this.host.requestUpdate();
	};

	hostConnected(): void {
		this.list = window.matchMedia(this.query);
		this.last = this.list.matches;
		this.list.addEventListener("change", this.onChange);
		window.addEventListener("resize", this.onChange);
	}

	hostDisconnected(): void {
		this.list?.removeEventListener("change", this.onChange);
		window.removeEventListener("resize", this.onChange);
		this.list = undefined;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/media.test.ts`
Expected: PASS (5 tests). If "reports whether the query matches" fails after `setWidth(390)`, check that `window.matchMedia(...)` created after the resize reports `false` (it did in a probe on 2026-10-16).

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(lib): media controller re-renders a component when a media query flips

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Home redesign (`random-picker`)

**Files:**
- Modify: `src/components/random-picker.ts` (imports, the `css` block, new state `filterOpen`, `render`, `renderFilter` → `renderFilterBody` + `renderFilterRow`, `renderResult`; new helpers `activeValueCount`, `announcement`)
- Modify: `src/lib/i18n.ts` (new keys)
- Test: `tests/components/random-picker.test.ts` (append tests; existing tests keep passing unchanged — they run at happy-dom's default width 1024, so they see the wide layout)

**Interfaces:**
- Consumes: `MediaController`, `WIDE` (Task 1); `<app-sheet heading open @sheet-close>` with `slot="footer"` (stage 1, `src/components/app-sheet.ts`); `icon(name, size)` from `#lib/icons` (`dice`, `funnel`, `pin` exist); `uiStyles` classes `.page-title`, `.page-sub`, `.card`, `.chips`, `.chip`, `button.primary`, `button.soft`, `.visually-hidden`.
- Produces: phone markup `button.filter-open[data-action="open-filter"]`, `ul.summary`, `<app-sheet>` holding `section.filter`, sheet footer `button[data-action="filter-done"]`, `.pinned > button.pick`; wide markup `aside.filter-panel > section.filter` and `.head > button.pick`; `p.announce[role="status"]` with the picks' names.

- [ ] **Step 1: Add the i18n keys** — in `en` after `"filter.clear": "Clear",` add:

```ts
	"filter.openCount": "Filter · {count} on",
	"filter.done": "Done",
```

and after `"picker.visited": "✓ Going here · {time}",` add:

```ts
	"picker.announce.one": "Picked {a}",
	"picker.announce.two": "Picked {a} and {b}",
```

In `th`, at the same places:

```ts
	"filter.openCount": "ตัวกรอง · {count} รายการ",
	"filter.done": "เสร็จ",
```

```ts
	"picker.announce.one": "สุ่มได้ {a}",
	"picker.announce.two": "สุ่มได้ {a} และ {b}",
```

- [ ] **Step 2: Write the failing tests** — append to `tests/components/random-picker.test.ts`:

```ts
type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};
const setWidth = (width: number) => {
	(window as HappyWindow).happyDOM.setViewport({ width, height: 900 });
	window.dispatchEvent(new Event("resize"));
};
const phone = async () => {
	setWidth(390);
	return mount();
};

afterEach(() => setWidth(1024));

test("shows the app name as a visible title with the count under it", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(root(el).querySelector("h1.page-title")?.textContent?.trim()).toBe(
		"What to Eat",
	);
	expect(root(el).querySelector(".head .count")?.textContent?.trim()).toBe(
		"1 restaurant",
	);
});

test("wide: the filter sits in a side panel and the pick button in the heading row", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await mount();
	expect(root(el).querySelector("aside.filter-panel section.filter")).not.toBeNull();
	expect(root(el).querySelector("app-sheet")).toBeNull();
	expect(root(el).querySelector(".head button.pick")).not.toBeNull();
	expect(root(el).querySelector(".pinned")).toBeNull();
	expect(root(el).querySelectorAll("button.pick")).toHaveLength(1);
});

test("wide: no groups in use means no panel and no empty column", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	expect(root(el).querySelector(".layout.with-panel")).toBeNull();
});

test("phone: the filter opens in a sheet from a Filter button", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	const open = root(el).querySelector<HTMLButtonElement>(
		'button.filter-open[data-action="open-filter"]',
	)!;
	expect(open.textContent?.trim()).toBe("Filter");
	expect(open.getAttribute("aria-haspopup")).toBe("dialog");
	const sheet = root(el).querySelector("app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(sheet.querySelector("section.filter")).not.toBeNull();
	open.click();
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Filter");
});

test("phone: Done closes the sheet", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	root(el).querySelector<HTMLButtonElement>('[data-action="open-filter"]')!.click();
	await el.updateComplete;
	const done = root(el).querySelector<HTMLButtonElement>(
		'app-sheet button[slot="footer"][data-action="filter-done"]',
	)!;
	expect(done.textContent?.trim()).toBe("Done");
	done.click();
	await el.updateComplete;
	expect(root(el).querySelector("app-sheet")!.hasAttribute("open")).toBe(false);
});

test("phone: the Filter button counts active values and the summary lists them", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam", "asok"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["asok"] } });
	const el = await phone();
	await cycle(el, "siam");
	await cycle(el, "asok");
	await cycle(el, "asok");
	expect(
		root(el).querySelector('[data-action="open-filter"]')?.textContent?.trim(),
	).toBe("Filter · 2 on");
	expect(
		[...root(el).querySelectorAll("ul.summary li")].map((li) => [
			li.className,
			li.textContent?.trim(),
		]),
	).toEqual([
		["include", "✓ siam"],
		["exclude", "✕ asok"],
	]);
});

test("phone: the pick button is pinned at the end, once", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await phone();
	expect(root(el).querySelector(".pinned button.pick")).not.toBeNull();
	expect(root(el).querySelector(".head button.pick")).toBeNull();
	expect(root(el).querySelectorAll("button.pick")).toHaveLength(1);
});

test("phone: a filter that matches nothing disables the pinned button", async () => {
	addRestaurant({ ...base, name: "A", kinds: ["food"] });
	addRestaurant({ ...base, name: "B", kinds: ["drinks", "dessert"] });
	const el = await phone();
	await cycle(el, "drinks", "kind");
	await cycle(el, "dessert", "kind");
	await cycle(el, "dessert", "kind");
	expect(root(el).querySelector<HTMLButtonElement>(".pinned button.pick")?.disabled).toBe(
		true,
	);
	expect(root(el).querySelector(".no-match")).not.toBeNull();
});

test("switching layouts keeps the filter", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	addRestaurant({ ...base, name: "B", groups: { area: ["asok"] } });
	const el = await mount();
	await cycle(el, "siam");
	setWidth(390);
	await el.updateComplete;
	expect(root(el).querySelector("aside.filter-panel")).toBeNull();
	expect(tagButton(el, "siam")?.getAttribute("data-state")).toBe("include");
	setWidth(1024);
	await el.updateComplete;
	expect(root(el).querySelector("aside.filter-panel")).not.toBeNull();
	expect(tagButton(el, "siam")?.getAttribute("data-state")).toBe("include");
});

test("the picks are announced by name", async () => {
	addRestaurant({ ...base, name: "A" });
	addRestaurant({ ...base, name: "B" });
	const el = await mount();
	const announce = () =>
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim();
	expect(announce()).toBe("");
	await pickOnce(el);
	const [a, b] = pickedNames(el);
	expect(announce()).toBe(`Picked ${a} and ${b}`);
});

test("a pick from one restaurant is announced alone", async () => {
	addRestaurant({ ...base, name: "Solo" });
	const el = await mount();
	await pickOnce(el);
	expect(
		root(el).querySelector('p.announce[role="status"]')?.textContent?.trim(),
	).toBe("Picked Solo");
});

test("Eat here is a soft button and the result area is not a live region", async () => {
	addRestaurant({ ...base, name: "A" });
	const el = await mount();
	await pickOnce(el);
	expect(root(el).querySelector("button.visit")?.classList.contains("soft")).toBe(
		true,
	);
	expect(root(el).querySelector(".results")?.hasAttribute("aria-live")).toBe(false);
});

test("the empty state links to Restaurants as a button-styled link", async () => {
	const el = await mount();
	expect(
		root(el).querySelector('a.button-link[href="./restaurants"]'),
	).not.toBeNull();
});
```

`pickOnce`, `pickedNames`, `cycle`, `tagButton`, `root`, `mount` and `base` already exist in this test file; check `pickOnce` with `grep -n "const pickOnce" tests/components/random-picker.test.ts` and use it as defined there.

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/components/random-picker.test.ts`
Expected: the new tests FAIL (no `.head`, no `filter-panel`, no `filter-open`, no `announce`); all existing tests still PASS.

- [ ] **Step 4: Implement** — in `src/components/random-picker.ts`:

1. Imports: add `import "#components/app-sheet";`, `import { icon } from "#lib/icons";`, `import { MediaController, WIDE } from "#lib/media";`. Keep every existing import that is still used.

2. Replace the whole `css` block (the second entry of `static override styles`) with:

```ts
		css`
			:host {
				display: grid;
				gap: 1rem;
			}

			.layout {
				display: grid;
				gap: 1rem;
			}

			.main-col {
				display: grid;
				align-content: start;
				gap: 0.75rem;
				min-width: 0;
			}

			.head {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-end;
				justify-content: space-between;
				gap: 0.75rem;
			}

			/* Phone: a Filter button and the active values beside it. */
			.filter-row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.375rem;
			}

			.filter-open {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
			}

			.summary li {
				display: inline-flex;
				align-items: center;
				min-height: 2.25rem;
				padding: 0 0.75rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
			}

			.summary .include {
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			.summary .exclude {
				border: 1px dashed var(--color-control);
				color: var(--color-muted);
				text-decoration: line-through;
			}

			/* The filter itself: in the sheet on phones, in the side panel when wide. */
			.filter {
				display: grid;
				gap: 0.875rem;
			}

			.filter-title {
				font-size: 1rem;
				font-weight: 600;
			}

			.filter-group {
				display: grid;
				gap: 0.375rem;
			}

			.filter-group h3 {
				margin: 0;
				color: var(--color-muted);
				font-size: 0.8125rem;
				font-weight: 500;
			}

			button.tag {
				min-height: 2.25rem;
				padding: 0 0.75rem;
				border-radius: var(--radius-pill);
				font-size: 0.875rem;
				font-weight: 500;
				line-height: 1.2;
			}

			button.tag.include {
				border-color: var(--color-primary);
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			button.tag.exclude {
				border-style: dashed;
				color: var(--color-muted);
				text-decoration: line-through;
			}

			.active-filter {
				padding-top: 0.75rem;
				border-top: 1px solid var(--color-border);
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			/* An inline text button inside the sentence, not a 44px box. */
			button.link {
				display: inline;
				min-height: 0;
				margin-left: 0.25rem;
				padding: 0;
				border: 0;
				background: none;
				color: var(--color-link);
				font-weight: 600;
				text-decoration: underline;
			}

			.no-match {
				color: var(--color-danger);
			}

			.results {
				display: grid;
				gap: 0.75rem;
			}

			.results:empty {
				display: none;
			}

			.result {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}

			.result h2 {
				font-size: 1.25rem;
				line-height: 1.25;
				font-weight: 600;
			}

			.result .meta {
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.result .location {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				font-size: 0.875rem;
			}

			.result .location .icon {
				flex: none;
				color: var(--color-muted);
			}

			.notes {
				white-space: pre-wrap;
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.result .chips {
				margin-top: 0.25rem;
			}

			.result .chip {
				font-size: 0.75rem;
			}

			.result .foot {
				margin-top: auto;
				padding-top: 0.625rem;
			}

			.result.visited {
				border-color: var(--color-success);
				box-shadow: 0 0 0 1px var(--color-success);
			}

			.visited-label {
				padding: 0.5rem 0;
				color: var(--color-success);
				font-weight: 600;
			}

			.visited-label:focus {
				outline: none;
			}

			.pick {
				width: 100%;
				min-height: 3.125rem;
				font-size: 1.0625rem;
			}

			/* Phone: the pick button stays in reach, just above the tab bar. */
			.pinned {
				position: sticky;
				z-index: 5;
				bottom: calc(var(--tab-bar-space) - 0.75rem);
				padding: 0.75rem 0 0.25rem;
				background: linear-gradient(to bottom, transparent, var(--color-bg) 35%);
			}

			.empty {
				justify-items: center;
				text-align: center;
			}

			.button-link {
				display: inline-flex;
				align-items: center;
				min-height: var(--tap);
				padding: 0 var(--pad-x);
				border-radius: var(--radius-sm);
				background: var(--color-primary);
				color: var(--color-primary-text);
				font-weight: 600;
				text-decoration: none;
			}

			@media (min-width: 48rem) {
				.layout.with-panel {
					grid-template-columns: 17.5rem minmax(0, 1fr);
					align-items: start;
					gap: 1.5rem;
				}

				.filter-panel {
					position: sticky;
					top: 1rem;
					padding: var(--pad-x);
					border: 1px solid var(--color-border);
					border-radius: var(--radius);
					background: var(--color-surface);
				}

				.results {
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 1rem;
				}

				.pick {
					width: auto;
					min-height: var(--tap);
					font-size: 0.9375rem;
				}
			}
		`,
```

3. Add fields after `protected readonly langController = new LangController(this);`:

```ts
	/** Wide screens show the filter in a side panel; phones open it in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	/** Whether the phone filter sheet is open. */
	@state()
	private filterOpen = false;
```

4. Replace `render()` with:

```ts
	override render() {
		const warnings = html`
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			${isHistoryMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
		`;
		const title = html`<h1 class="page-title">${t("app.title")}</h1>`;
		if (this.restaurants.length === 0) {
			return html`
				<header class="head"><div>${title}</div></header>
				${warnings}
				<div class="card empty">
					<p>${t("picker.empty")}</p>
					<a class="button-link" href="./restaurants">${t("picker.addLink")}</a>
				</div>
			`;
		}
		const groups = allGroupIds(this.defs)
			.map((group) => ({
				group,
				values: valuesByUsage(this.restaurants, group),
			}))
			.filter(({ values }) => values.length > 0);
		const empty = this.pool.length === 0;
		const wide = this.wide.matches;
		const panel = wide && groups.length > 0;
		const pick = html`<button type="button" class="primary pick" ?disabled=${empty} @click=${this.pick}>
			${icon("dice", 22)}<span>${this.picked.length > 0 ? t("picker.again") : t("picker.button")}</span>
		</button>`;
		return html`
			${warnings}
			<div class="layout ${panel ? "with-panel" : ""}">
				${panel ? html`<aside class="filter-panel">${this.renderFilterBody(groups, true)}</aside>` : nothing}
				<div class="main-col">
					<header class="head">
						<div>${title}<p class="count page-sub">${this.countText()}</p></div>
						${wide ? pick : nothing}
					</header>
					${!wide && groups.length > 0 ? this.renderFilterRow(groups) : nothing}
					${empty ? html`<p class="no-match" role="status">${t("filter.noMatch")}</p>` : nothing}
					<p class="announce visually-hidden" role="status">${this.announcement()}</p>
					<div class="results">${this.picked.map((item) => this.renderResult(item))}</div>
				</div>
			</div>
			${wide ? nothing : html`<div class="pinned">${pick}</div>`}
		`;
	}

	/** Screen readers hear the new picks by name rather than both whole tiles. */
	private announcement(): string {
		const [a, b] = this.picked.map((item) => item.name);
		if (a === undefined) return "";
		return b === undefined
			? t("picker.announce.one", { a })
			: t("picker.announce.two", { a, b });
	}

	/** How many values the filter includes or excludes, across every group. */
	private activeValueCount(): number {
		return Object.values(this.filter).reduce(
			(count, group) => count + group.include.length + group.exclude.length,
			0,
		);
	}
```

5. Replace `renderFilter(groups)` with the two methods below. `renderFilterBody` keeps the old filter markup (groups, chips, active line) and only adds the title when it sits in the panel; the `symbol` map and the `summary` string are the same as before — move them into a private helper `filterSummary(): { symbol: Record<TagState, string>; summary: string }` so both methods use one copy:

```ts
	private filterSummary(): { symbol: Record<TagState, string>; summary: string } {
		const symbol: Record<TagState, string> = {
			off: "",
			include: "✓ ",
			exclude: "✕ ",
		};
		const summary = allGroupIds(this.defs)
			.map((group) => {
				const filterGroup = Object.hasOwn(this.filter, group)
					? this.filter[group]
					: undefined;
				if (filterGroup === undefined) return "";
				const { include, exclude } = filterGroup;
				const values = [
					...include.map(
						(value) => `${symbol.include}${valueLabel(group, value)}`,
					),
					...exclude.map(
						(value) => `${symbol.exclude}${valueLabel(group, value)}`,
					),
				];
				return values.length > 0
					? `${groupLabel(group, this.defs)}: ${values.join(", ")}`
					: "";
			})
			.filter((part) => part !== "")
			.join("; ");
		return { symbol, summary };
	}

	/** The filter's groups and chips; titled in the side panel, untitled in the sheet (the sheet has the heading). */
	private renderFilterBody(
		groups: { group: string; values: string[] }[],
		titled: boolean,
	) {
		const { symbol, summary } = this.filterSummary();
		return html`
			<section class="filter" aria-labelledby=${titled ? "filter-title" : nothing} aria-label=${titled ? nothing : t("filter.title")}>
				${titled ? html`<h2 id="filter-title" class="filter-title">${t("filter.title")}</h2>` : nothing}
				<p class="hint">${t("filter.hint")}</p>
				${groups.map(
					({
						group,
						values,
					}) => html`<div class="filter-group" role="group" aria-labelledby="group-${group}">
						<h3 id="group-${group}">${groupLabel(group, this.defs)}</h3>
						<ul class="chips">
							${values.map((value) => {
								const state = tagState(this.filter, group, value);
								const label = valueLabel(group, value);
								return html`<li>
									<button
										type="button"
										class="chip tag ${state}"
										data-group=${group}
										data-tag=${value}
										data-state=${state}
										aria-pressed=${state === "off" ? "false" : "true"}
										aria-label=${t("filter.tagState", {
											group: groupLabel(group, this.defs),
											tag: label,
											state: t(`filter.state.${state}`),
										})}
										@click=${() => this.setFilter(cycleTag(this.filter, group, value))}
									>
										${symbol[state]}${label}
									</button>
								</li>`;
							})}
						</ul>
					</div>`,
				)}
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

	/** Phone: the Filter button, the active values beside it, and the sheet it opens. */
	private renderFilterRow(groups: { group: string; values: string[] }[]) {
		const { symbol } = this.filterSummary();
		const count = this.activeValueCount();
		const active = allGroupIds(this.defs).flatMap((group) => {
			const filterGroup = Object.hasOwn(this.filter, group)
				? this.filter[group]
				: undefined;
			if (filterGroup === undefined) return [];
			return [
				...filterGroup.include.map((value) => ({
					state: "include" as const,
					label: valueLabel(group, value),
				})),
				...filterGroup.exclude.map((value) => ({
					state: "exclude" as const,
					label: valueLabel(group, value),
				})),
			];
		});
		return html`
			<div class="filter-row">
				<button
					type="button"
					class="filter-open"
					data-action="open-filter"
					aria-haspopup="dialog"
					@click=${() => {
						this.filterOpen = true;
					}}
				>
					${icon("funnel", 18)}<span>${count > 0 ? t("filter.openCount", { count }) : t("filter.title")}</span>
				</button>
				${
					active.length > 0
						? html`<ul class="chips summary">
								${active.map(({ state, label }) => html`<li class=${state}>${symbol[state]}${label}</li>`)}
							</ul>`
						: nothing
				}
			</div>
			<app-sheet
				heading=${t("filter.title")}
				?open=${this.filterOpen}
				@sheet-close=${() => {
					this.filterOpen = false;
				}}
			>
				${this.renderFilterBody(groups, false)}
				<button
					slot="footer"
					type="button"
					class="primary"
					data-action="filter-done"
					@click=${() => {
						this.filterOpen = false;
					}}
				>
					${t("filter.done")}
				</button>
			</app-sheet>
		`;
	}
```

6. In `renderVisit`, change the Eat here button class from `primary visit` to `soft visit` (text and `data-id` unchanged).

7. In `renderResult`, keep the markup but wrap the location in an icon row: replace

```ts
						? html`<p class="location">
```

with

```ts
						? html`<p class="location">${icon("pin", 16)}
```

(the rest of the location expression unchanged). Keep `class="card result …"`, the `h2`, `.meta`, `.notes`, `restaurantChips(item, this.defs)` and `.foot`.

8. Delete the now-unused old `renderFilter` method.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/components/random-picker.test.ts`
Expected: PASS, old and new. If an existing test fails, it is a selector the redesign dropped — restore that selector rather than editing the old test.

- [ ] **Step 6: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): home with a filter sheet, side panel, soft eat here and a pinned pick button

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Room for two columns on Home

**Files:**
- Modify: `src/routes/index.html` (`<main>` gets `class="wide"`), `src/styles/global.css` (wide main from 48rem)
- Test: `tests/routes/pages.test.ts`

**Interfaces:**
- Produces: `main.wide` is `max-width: 65rem` from 48rem; every other page keeps 40rem.

- [ ] **Step 1: Write the failing test** — in `tests/routes/pages.test.ts`, change the skip-target test to allow a class, and add a Home test:

```ts
test.each(pages)("%s gives the skip link a focusable target", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toMatch(/<main id="main" tabindex="-1"( class="wide")?>/);
});

test("home uses the wide main for its two columns; other pages keep the narrow one", async () => {
	for (const page of pages) {
		const html = await Bun.file(`src/routes/${page}`).text();
		expect(html.includes('<main id="main" tabindex="-1" class="wide">')).toBe(
			page === "index.html",
		);
	}
	const css = await Bun.file("src/styles/global.css").text();
	expect(css).toMatch(
		/@media \(min-width: 48rem\)\s*\{[\s\S]*?main\.wide\s*\{[^}]*max-width:\s*65rem/,
	);
});
```

(Replace the existing `"%s gives the skip link a focusable target"` test; keep all others.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/routes/pages.test.ts`
Expected: FAIL — index.html has no `class="wide"`, no `main.wide` rule.

- [ ] **Step 3: Implement**
- `src/routes/index.html`: `<main id="main" tabindex="-1">` → `<main id="main" tabindex="-1" class="wide">`.
- `src/styles/global.css`: inside the existing `@media (min-width: 48rem)` block, after its `main { … }` rule, add:

```css
	/* Pages with a side panel (Home) get room for two columns. */
	main.wide {
		max-width: 65rem;
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/routes/pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(routes): home gets a wide main for its filter panel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Spec notes for stage 2

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md`

- [ ] **Step 1:** In the Home section of the spec, record what stage 2 built where it differs from the text: filter chips are 36px tall (2.25rem, above the 24px AA minimum) rather than 44px, to match the Calm neutral mockup; the layout switch uses `MediaController` (`src/lib/media.ts`) so only one copy of the filter exists; Clear stays inside the filter content (sheet and panel), the sheet footer holds Done; the Home page uses `main.wide` (65rem) from 48rem. Keep the rest of the section.

- [ ] **Step 2: Checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "docs(specs): home as built in stage 2

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Then the controller runs the final review and opens the pull request (shipping-a-change).
