# Mobile redesign, stage 3: Restaurants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Restaurants (`restaurant-manager`) to the Calm neutral design: a compact grouped list (name and type line per row), the add/edit form in a bottom sheet on phones with a pinned **Add** button, and list plus edit panel side by side from 48rem; Delete moves into the edit form. Also close two stage 2 leftovers: focus after rotating with the sheet's own Close button focused, and a larger Clear target in Home's filter.

**Architecture:** One form instance (its state and `tag-input`s) rendered either inside `<app-sheet>` (phones, opened by Add or a row) or inside a right-hand `section.edit-panel` (wide), switched with `MediaController` like Home. Rows become `button.item` rows in a `.group` list. Every save and delete is confirmed in a visible `role="status"` line. `app-sheet` gains `containsFocus()` so pages can tell whether focus was inside it (including its own Close button).

**Tech Stack:** Lit 3.3, Bun 1.4 (`bun test` + happy-dom 21), Biome 2.5, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md` (Pages → Restaurants; Shell → Pinned action; Accessibility checklist). Mockup: Refine page, "Calm neutral" row, of <https://claude.ai/code/artifact/7cabd42f-544c-4073-8299-3dbb384f2604> (phone rows and pinned Add follow it; the desktop panel follows the "Chosen — Desktop · Restaurants" artboard restyled in Calm neutral).

## Global Constraints

- Work in the worktree `.claude/worktrees/redesign-restaurants` on branch `worktree-redesign-restaurants`; never edit `main`.
- Test first for every task: write the failing test, run it, watch it fail for the right reason, then code.
- Imports through `#components/*`, `#lib/*`, `#styles/*`.
- No change to store, restaurant, groups or tag-input logic in `src/lib/` or `src/components/tag-input.ts`.
- Every user-visible string through `t()`; every new key in both `en` and `th` of `src/lib/i18n.ts`.
- Keep these selectors working: `#name`, `#location`, `#notes`, `form` (submit), `input[name="kinds"][value=…]`, `tag-input[data-group=…]`, `button[type="submit"]` (text "Add"/"Save", Thai "เพิ่ม"/"บันทึก"), `li[data-id]`, `li[data-id] .name`, `li[data-id] button[data-action="edit"]`, `button[data-action="cancel-edit"]`, `button[data-action="delete"]`, `button[data-action="confirm-delete"]`, `button[data-action="cancel-delete"]`, `a.tags-link`, `.empty`, `.skipped`, `.warning`, `#name-error`.
- Tokens from `src/styles/global.css` only; breakpoint `48rem` in CSS and `WIDE` in JS.
- Before each commit: `bun run format && bun run check && bun run test && bun run build`; `git add -A` after `format`.
- Conventional commits, lower case, scoped. End every commit message with exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md`.

## Review Focus

- **Rotating a phone while editing in the sheet.** Expected: the sheet closes when the screen turns wide, the same restaurant stays loaded in the side panel, and focus moves to the panel's heading if it was in the sheet. Pinned in Task 2 ("rotating to wide keeps the edit in the panel").
- **Closing the sheet with Esc, the backdrop or ✕ while editing.** Expected: nothing is saved, the form resets, and focus returns to the row that opened it (from `app-sheet`). Pinned in Task 2 ("closing the sheet discards the edit").
- **Another tab deletes the restaurant being edited in the sheet.** Expected: the form resets and the sheet closes. Pinned in Task 2.
- **Saving on a phone.** Expected: the sheet closes, the list shows the change, and "Saved {name}" appears in the status line. Pinned in Task 2.
- **Delete is only reachable while editing.** Expected: there is no Delete in the add form or in rows. Pinned in Task 2.

---

### Task 1: `app-sheet.containsFocus()` and Home's rotation focus

**Files:**
- Modify: `src/components/app-sheet.ts`, `src/components/random-picker.ts` (`willUpdate`)
- Test: `tests/components/app-sheet.test.ts`, `tests/components/random-picker.test.ts`

**Interfaces:**
- Produces: `AppSheet.containsFocus(): boolean` — true when the deepest focused element is a slotted child of the sheet or inside the sheet's own shadow root (its Close button).

- [ ] **Step 1: Write the failing tests** — append to `tests/components/app-sheet.test.ts`:

```ts
test("containsFocus sees slotted content and the sheet's own Close button", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	expect(sheet.containsFocus()).toBe(false);
	sheet.open = true;
	await sheet.updateComplete;
	sheet.querySelector<HTMLButtonElement>('button[slot="footer"]')!.focus();
	expect(sheet.containsFocus()).toBe(true);
	sheet
		.shadowRoot!.querySelector<HTMLButtonElement>('button[data-action="close-sheet"]')!
		.focus();
	expect(sheet.containsFocus()).toBe(true);
});
```

and append to `tests/components/random-picker.test.ts`:

```ts
test("rotating to wide with focus on the sheet's Close button moves focus to the panel", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await phone();
	root(el)
		.querySelector<HTMLButtonElement>('[data-action="open-filter"]')!
		.click();
	await el.updateComplete;
	const sheet = root(el).querySelector("app-sheet")!;
	sheet
		.shadowRoot!.querySelector<HTMLButtonElement>('button[data-action="close-sheet"]')!
		.focus();
	setWidth(1024);
	await el.updateComplete;
	await el.updateComplete;
	expect(root(el).activeElement?.id).toBe("filter-title");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/components/app-sheet.test.ts tests/components/random-picker.test.ts`
Expected: FAIL — `containsFocus is not a function`; the rotation test leaves focus on `body`.

- [ ] **Step 3: Implement** — in `src/components/app-sheet.ts` add a public method to `AppSheet`:

```ts
	/** Whether focus is in this sheet: in its slotted content or on its own Close button. */
	containsFocus(): boolean {
		const active = deepActiveElement();
		if (active === null) return false;
		return this.contains(active) || (this.shadowRoot?.contains(active) ?? false);
	}
```

In `src/components/random-picker.ts` `willUpdate`, replace

```ts
		const sheet = this.renderRoot.querySelector("app-sheet");
		const focusWasInSheet = sheet?.contains(deepActiveElement()) ?? false;
```

with

```ts
		const focusWasInSheet =
			this.renderRoot.querySelector("app-sheet")?.containsFocus() ?? false;
```

and remove the now-unused `deepActiveElement` import if nothing else in the file uses it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/components/app-sheet.test.ts tests/components/random-picker.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "fix(components): rotating with the sheet's close button focused keeps focus

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Restaurants redesign (`restaurant-manager`)

**Files:**
- Modify: `src/components/restaurant-manager.ts` (imports, `css` block, state, `render`, `renderForm`, `renderRow`, new handlers), `src/lib/i18n.ts` (keys)
- Test: `tests/components/restaurant-manager.test.ts` (update the tests listed in Step 2; append new tests)

**Interfaces:**
- Consumes: `MediaController`, `WIDE` (`#lib/media`); `<app-sheet heading open @sheet-close>` and `containsFocus()` (Task 1); `icon` (`plus`, `tag`, `chevron`, `trash`); `uiStyles` (`.page-title`, `.page-sub`, `.group`, `.item`, `.grow`, `.trail`, `.card`, `button.primary`, `button.danger`, `.success`).
- Produces: phone `.pinned > button.add[data-action="add"]` and `<app-sheet>` holding `form#restaurant-form`; wide `.head button.add[data-action="add"]` and `section.edit-panel > h2#form-title + form#restaurant-form`; rows `li[data-id] > button.item.row[data-action="edit"]` with `.name` and `.meta`; `p.status[role="status"]`.

- [ ] **Step 1: Add the i18n keys** — in `en`, after `"manager.nameTaken": …,`:

```ts
	"manager.addTitle": "New restaurant",
	"manager.editTitle": "Edit {name}",
	"manager.saved": "Saved {name}",
	"manager.deleted": "Deleted {name}",
	"manager.deletePrompt": "Delete {name}? This cannot be undone.",
```

and change `"manager.empty"` to `"No restaurants yet. Add your first one."`. In `th`:

```ts
	"manager.addTitle": "ร้านใหม่",
	"manager.editTitle": "แก้ไข {name}",
	"manager.saved": "บันทึก {name} แล้ว",
	"manager.deleted": "ลบ {name} แล้ว",
	"manager.deletePrompt": "ลบ {name} ใช่ไหม? ย้อนกลับไม่ได้",
```

and change `"manager.empty"` to `"ยังไม่มีร้านอาหาร เพิ่มร้านแรกได้เลย"`.

- [ ] **Step 2: Update the tests whose behaviour changes** — in `tests/components/restaurant-manager.test.ts`:

1. `"shows the empty message with no restaurants"`: expect `"No restaurants yet. Add your first one."`.
2. Replace `"a non-http location in the list renders as text"` with:

```ts
test("rows show the name and type line only; location and notes stay in the form", async () => {
	addRestaurant({
		name: "Sneaky",
		tags: ["x"],
		location: "javascript:alert(1)",
		notes: "secret",
		kinds: ["food"],
	});
	const el = await mount();
	const row = $(el, "li[data-id]")!;
	expect(row.querySelector(".name")?.textContent?.trim()).toBe("Sneaky");
	expect(row.querySelector(".meta")?.textContent?.trim()).toBe("Food");
	expect(row.querySelector("a")).toBeNull();
	expect(row.textContent).not.toContain("javascript:alert(1)");
	expect(row.textContent).not.toContain("secret");
	await click(el, 'li[data-id] button[data-action="edit"]');
	expect($<HTMLInputElement>(el, "#location")?.value).toBe("javascript:alert(1)");
});
```

3. In `"saves custom group values and shows them as labelled chips"`, replace the last four lines (reading `li[data-id] .chip`) with a check of the saved data only — the `toMatchObject` above it already covers it — and rename the test `"saves custom group values"`.
4. `"delete needs confirmation"`, `"delete moves focus to the confirm button, cancel moves it back"` and `"a confirmed delete moves focus to the name field"`: before the first `click(el, 'button[data-action="delete"]')`, add `await click(el, 'button[data-action="edit"]');` (Delete now lives in the edit form).

Keep every other existing test unchanged; they run at happy-dom's default width 1024 (wide layout, form always visible in the panel).

- [ ] **Step 3: Write the new failing tests** — append:

```ts
type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};
const setWidth = (width: number) => {
	(window as unknown as HappyWindow).happyDOM.setViewport({ width, height: 900 });
	window.dispatchEvent(new Event("resize"));
};
const phone = async () => {
	setWidth(390);
	return mount();
};
afterEach(() => setWidth(1024));

test("the title shows the count, with the Tags link beside it", async () => {
	addRestaurant({ ...blank, name: "A" });
	addRestaurant({ ...blank, name: "B" });
	const el = await mount();
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Restaurants");
	expect($(el, ".head .count")?.textContent?.trim()).toBe("2 restaurants");
	expect($(el, ".head a.tags-link")).not.toBeNull();
});

test("rows are buttons named for editing, in a grouped list", async () => {
	addRestaurant({ ...blank, name: "Jay Fai" });
	const el = await mount();
	const row = $<HTMLButtonElement>(el, "ul.group li[data-id] button.item.row")!;
	expect(row.getAttribute("data-action")).toBe("edit");
	expect(row.getAttribute("aria-label")).toBe("Edit Jay Fai");
	expect(row.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("wide: the form sits in a side panel titled for adding, then for editing", async () => {
	addRestaurant({ ...blank, name: "Jay Fai" });
	const el = await mount();
	expect($(el, "app-sheet")).toBeNull();
	expect($(el, ".pinned")).toBeNull();
	expect($(el, "section.edit-panel #form-title")?.textContent?.trim()).toBe(
		"New restaurant",
	);
	expect($(el, ".head button.add")).not.toBeNull();
	await click(el, 'button[data-action="edit"]');
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Edit Jay Fai");
	expect($(el, 'button[data-action="edit"]')?.getAttribute("aria-current")).toBe(
		"true",
	);
	await click(el, ".head button.add");
	expect($(el, "#form-title")?.textContent?.trim()).toBe("New restaurant");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement?.id).toBe("name");
});

test("Delete is only in the edit form, never in rows or the add form", async () => {
	addRestaurant({ ...blank, name: "A" });
	const el = await mount();
	expect($(el, 'li[data-id] [data-action="delete"]')).toBeNull();
	expect($(el, 'form [data-action="delete"]')).toBeNull();
	await click(el, 'button[data-action="edit"]');
	expect($(el, 'form [data-action="delete"]')).not.toBeNull();
	expect($(el, 'li[data-id] [data-action="delete"]')).toBeNull();
});

test("the delete prompt names the restaurant", async () => {
	addRestaurant({ ...blank, name: "Bye" });
	const el = await mount();
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	expect($(el, ".delete-prompt")?.textContent?.trim()).toBe(
		"Delete Bye? This cannot be undone.",
	);
});

test("saving and deleting are confirmed in the status line", async () => {
	const el = await mount();
	type(el, "#name", "Fresh");
	await submit(el);
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved Fresh",
	);
	await click(el, 'button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Deleted Fresh",
	);
});

test("phone: Add is pinned and opens the form in a sheet", async () => {
	const el = await phone();
	expect($(el, "section.edit-panel")).toBeNull();
	const add = $<HTMLButtonElement>(el, '.pinned button.add[data-action="add"]')!;
	expect(add.textContent?.trim()).toBe("Add");
	const sheet = $(el, "app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(sheet.querySelector("form#restaurant-form")).not.toBeNull();
	add.click();
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("New restaurant");
});

test("phone: tapping a row opens its edit sheet; saving closes it", async () => {
	addRestaurant({ ...blank, name: "Old" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	const sheet = $(el, "app-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Edit Old");
	type(el, "#name", "New");
	await submit(el);
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(loadRestaurants()[0]?.name).toBe("New");
	expect($(el, 'p.status[role="status"]')?.textContent?.trim()).toBe(
		"Saved New",
	);
});

test("phone: closing the sheet discards the edit", async () => {
	addRestaurant({ ...blank, name: "Keep" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "Changed");
	const sheet = $(el, "app-sheet")!;
	sheet.shadowRoot!.querySelector("dialog")!.close();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
	expect(loadRestaurants()[0]?.name).toBe("Keep");
});

test("phone: deleting from the sheet closes it", async () => {
	addRestaurant({ ...blank, name: "Bye" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	await click(el, 'button[data-action="delete"]');
	await click(el, 'button[data-action="confirm-delete"]');
	expect(loadRestaurants()).toEqual([]);
	expect($(el, "app-sheet")!.hasAttribute("open")).toBe(false);
});

test("phone: another tab deleting the restaurant being edited closes the sheet", async () => {
	const [item] = addRestaurant({ ...blank, name: "Gone" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	removeRestaurant(item!.id);
	await el.updateComplete;
	expect($(el, "app-sheet")!.hasAttribute("open")).toBe(false);
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("");
});

test("rotating to wide keeps the edit in the panel", async () => {
	addRestaurant({ ...blank, name: "Mine" });
	const el = await phone();
	await click(el, 'li[data-id] button[data-action="edit"]');
	type(el, "#name", "Mine 2");
	setWidth(1024);
	await el.updateComplete;
	expect($(el, "app-sheet")).toBeNull();
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Edit Mine");
	expect($<HTMLInputElement>(el, "#name")?.value).toBe("Mine 2");
});
```

`removeRestaurant`, `addRestaurant`, `loadRestaurants`, `blank`, `$`, `type`, `submit`, `click`, `mount` are already defined or imported in this file; add `removeRestaurant` and `afterEach` to the imports if missing (`grep -n "^import" tests/components/restaurant-manager.test.ts`).

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: the new tests and the four updated delete tests FAIL; the rest PASS.

- [ ] **Step 5: Implement** — in `src/components/restaurant-manager.ts`:

1. Imports: add `import "#components/app-sheet";`, `import { MediaController, WIDE } from "#lib/media";`. Remove `restaurantChips` and `isLink` imports if unused after the change.

2. Replace the `css` block with:

```ts
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.head {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-end;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.head-actions {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}

			.tags-link {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				min-height: 2.25rem;
				padding: 0 0.875rem;
				border: 1px solid var(--color-control);
				border-radius: var(--radius-pill);
				background: var(--color-surface);
				color: var(--color-text);
				font-size: 0.875rem;
				font-weight: 500;
				text-decoration: none;
			}

			.status:empty {
				display: none;
			}

			.layout {
				display: grid;
				gap: 1rem;
			}

			.list .row {
				min-height: 3.5rem;
			}

			.list .meta {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.list .row[aria-current="true"] {
				background: var(--color-surface-2);
				box-shadow: inset 3px 0 0 var(--color-primary);
			}

			.edit-panel {
				gap: 1rem;
			}

			.edit-panel h2 {
				font-size: 1.125rem;
				font-weight: 600;
			}

			form {
				display: grid;
				gap: 1rem;
			}

			/* Type: each checkbox is a pill that fills in when ticked. */
			fieldset.kinds {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				border: 0;
			}

			fieldset.kinds legend {
				padding: 0;
				margin-bottom: 0.375rem;
				font-weight: 600;
			}

			fieldset.kinds label {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				min-height: 2.25rem;
				padding: 0 0.875rem 0 0.625rem;
				border: 1px solid var(--color-control);
				border-radius: var(--radius-pill);
				background: var(--color-surface);
				font-weight: 500;
				cursor: pointer;
			}

			fieldset.kinds label:has(input:checked) {
				border-color: var(--color-primary);
				background: var(--color-primary-soft);
				color: var(--color-link);
				font-weight: 600;
			}

			fieldset.kinds label:has(input:focus-visible) {
				outline: 3px solid var(--color-focus);
				outline-offset: 2px;
			}

			fieldset.kinds input {
				width: 1rem;
				height: 1rem;
				margin: 0;
				padding: 0;
				accent-color: var(--color-primary);
			}

			/* Cuisine and area side by side when there is room. */
			.pair {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
				gap: 1rem;
			}

			.delete-zone {
				display: grid;
				gap: 0.625rem;
				padding-top: 1rem;
				border-top: 1px solid var(--color-border);
			}

			/* Phone: Add stays at the bottom right, just above the tab bar. */
			.pinned {
				position: sticky;
				z-index: 5;
				bottom: var(--tab-bar-height);
				display: flex;
				justify-content: flex-end;
				margin-top: auto;
				padding: 0.75rem 0 0.5rem;
			}

			.pinned .add {
				min-height: 3rem;
				padding: 0 1.25rem;
				box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
			}

			@media (min-width: 48rem) {
				.layout.wide {
					grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
					align-items: start;
					gap: 1.5rem;
				}

				.edit-panel {
					position: sticky;
					top: 1rem;
				}
			}
		`,
```

3. Add fields after `protected readonly langController = new LangController(this);`:

```ts
	/** Wide screens show the form in a side panel; phones open it in a sheet. */
	protected readonly wide = new MediaController(this, WIDE);

	/** Whether the phone form sheet is open. */
	@state()
	private sheetOpen = false;

	/** The last save or delete, read out and shown under the title. */
	@state()
	private status = "";
```

4. In `connectedCallback`'s `onRestaurantsChanged` handler, where the edited restaurant is gone (`if (editing === undefined) this.resetForm();`), also close the sheet: `{ this.resetForm(); this.sheetOpen = false; }`.

5. Add `willUpdate` (rotation: the sheet unmounts without a close event, so close it here and move focus to the panel heading when it was inside):

```ts
	protected override willUpdate(): void {
		if (!this.wide.matches || !this.sheetOpen) return;
		const focusWasInSheet =
			this.renderRoot.querySelector("app-sheet")?.containsFocus() ?? false;
		this.sheetOpen = false;
		if (focusWasInSheet)
			this.focusAfterRender(() => this.renderRoot.querySelector("#form-title"));
	}
```

6. Replace `submit`'s last lines (from `const editingId = this.editingId;`) with:

```ts
		const editingId = this.editingId;
		const name = input.name.trim();
		// Reset before saving so the store's change callback already sees a clean form.
		this.resetForm();
		this.sheetOpen = false;
		if (editingId === undefined) addRestaurant(input);
		else updateRestaurant(editingId, input);
		this.status = t("manager.saved", { name });
```

7. `startEdit(item)`: keep its body and add `this.sheetOpen = !this.wide.matches;` before `this.focusAfterRender(...)`.

8. Add `startAdd` and `onSheetClose`:

```ts
	private readonly startAdd = (): void => {
		this.confirmingId = undefined;
		this.resetForm();
		this.sheetOpen = !this.wide.matches;
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	};

	/** The sheet closed by ✕, Esc or the backdrop: drop whatever was typed. */
	private readonly onSheetClose = (): void => {
		this.sheetOpen = false;
		this.confirmingId = undefined;
		this.resetForm();
	};
```

9. Delete handlers now find their buttons in the form, not in a row:

```ts
	private askDelete(id: string): void {
		this.confirmingId = id;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="confirm-delete"]'),
		);
	}

	private cancelDelete(): void {
		this.confirmingId = undefined;
		this.focusAfterRender(() =>
			this.renderRoot.querySelector('[data-action="delete"]'),
		);
	}

	private confirmDelete(id: string): void {
		const name = this.restaurants.find((item) => item.id === id)?.name ?? "";
		this.confirmingId = undefined;
		this.sheetOpen = false;
		removeRestaurant(id);
		this.resetForm();
		this.status = t("manager.deleted", { name });
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	}
```

Remove `rowAction` if nothing else uses it.

10. Replace `render()`:

```ts
	override render() {
		const sorted = [...this.restaurants].sort((a, b) =>
			a.name.localeCompare(b.name, getLang()),
		);
		const wide = this.wide.matches;
		const editing = this.restaurants.find((item) => item.id === this.editingId);
		const formTitle =
			editing === undefined
				? t("manager.addTitle")
				: t("manager.editTitle", { name: editing.name });
		const count =
			sorted.length === 1
				? t("picker.count.one")
				: t("picker.count.other", { count: sorted.length });
		const add = html`<button type="button" class="primary add" data-action="add" @click=${this.startAdd}>
			${icon("plus", 20)}<span>${t("manager.add")}</span>
		</button>`;
		return html`
			<header class="head">
				<div>
					<h1 class="page-title">${t("manager.title")}</h1>
					<p class="count page-sub">${count}</p>
				</div>
				<div class="head-actions">
					<a class="tags-link" href="./tags">${icon("tag", 18)}<span>${t("nav.tags")}</span></a>
					${wide ? add : nothing}
				</div>
			</header>
			${isMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			<p class="status success" role="status">${this.status}</p>
			<div class="layout ${wide ? "wide" : ""}">
				<div class="list-col">
					${
						sorted.length === 0
							? html`<p class="muted empty">${t("manager.empty")}</p>`
							: html`<ul class="group list">${sorted.map((item) => this.renderRow(item))}</ul>`
					}
				</div>
				${
					wide
						? html`<section class="card edit-panel" aria-labelledby="form-title">
								<h2 id="form-title" tabindex="-1">${formTitle}</h2>
								${this.renderForm()}
							</section>`
						: nothing
				}
			</div>
			${
				wide
					? nothing
					: html`<div class="pinned">${add}</div>
							<app-sheet heading=${formTitle} ?open=${this.sheetOpen} @sheet-close=${this.onSheetClose}>
								${this.renderForm()}
							</app-sheet>`
			}
		`;
	}
```

11. In `renderForm()`: give the form `id="restaurant-form"` and drop `class="card"`; keep every field as it is; replace the `.actions` block with:

```ts
				<div class="actions">
					<button type="submit" class="primary">${editing ? t("manager.save") : t("manager.add")}</button>
					${
						editing
							? html`<button type="button" data-action="cancel-edit" @click=${this.cancelEdit}>
									${t("manager.cancel")}
								</button>`
							: nothing
					}
				</div>
				${editing ? this.renderDelete() : nothing}
```

and add:

```ts
	private readonly cancelEdit = (): void => {
		this.resetForm();
		this.sheetOpen = false;
		this.focusAfterRender(() => this.renderRoot.querySelector("#name"));
	};

	/** Delete lives at the end of the edit form, behind an inline confirmation. */
	private renderDelete() {
		const id = this.editingId;
		if (id === undefined) return nothing;
		const name = this.restaurants.find((item) => item.id === id)?.name ?? "";
		return html`<div class="delete-zone">
			${
				this.confirmingId === id
					? html`<p class="delete-prompt" role="alert">${t("manager.deletePrompt", { name })}</p>
							<div class="actions">
								<button type="button" class="danger" data-action="confirm-delete" @click=${() => this.confirmDelete(id)}>
									${t("manager.confirmDelete")}
								</button>
								<button type="button" data-action="cancel-delete" @click=${() => this.cancelDelete()}>
									${t("manager.cancel")}
								</button>
							</div>`
					: html`<div class="actions">
							<button type="button" class="danger" data-action="delete" @click=${() => this.askDelete(id)}>
								${icon("trash", 18)}<span>${t("manager.delete")}</span>
							</button>
						</div>`
			}
		</div>`;
	}
```

12. Replace `renderRow(item)`:

```ts
	private renderRow(item: Restaurant) {
		const meta = metaLine(item);
		return html`<li data-id=${item.id}>
			<button
				type="button"
				class="item row"
				data-action="edit"
				aria-current=${this.editingId === item.id ? "true" : nothing}
				aria-label=${t("manager.editTitle", { name: item.name })}
				@click=${() => this.startEdit(item)}
			>
				<span class="grow">
					<b class="name">${item.name}</b>
					${meta ? html`<small class="meta">${meta}</small>` : nothing}
				</span>
				<span class="trail">${icon("chevron", 20)}</span>
			</button>
		</li>`;
	}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test tests/components/restaurant-manager.test.ts`
Expected: PASS. If `"delete delete prompt"` focus tests fail because the confirm button is inside the closed sheet on phone, check they run at the default (wide) width.

- [ ] **Step 7: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): restaurants as a compact list with the form in a sheet or side panel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Restaurants page shell

**Files:**
- Modify: `src/routes/restaurants.html`
- Test: `tests/routes/pages.test.ts`

- [ ] **Step 1: Write the failing test** — in `tests/routes/pages.test.ts`, change the wide-main test so both Home and Restaurants use it, and the pinned-room test (`has-pinned`) so both opt in:

```ts
const WIDE_PAGES = ["index.html", "restaurants.html"];
```

Use `WIDE_PAGES.includes(page)` wherever the current tests compare `page === "index.html"` for `class="wide"` and for `<html … class="has-pinned">`. (Find them with `grep -n 'index.html' tests/routes/pages.test.ts`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/routes/pages.test.ts`
Expected: FAIL for restaurants.html.

- [ ] **Step 3: Implement** — in `src/routes/restaurants.html`: `<html lang="en">` → `<html lang="en" class="has-pinned">`, and `<main id="main" tabindex="-1">` → `<main id="main" tabindex="-1" class="wide">`.

- [ ] **Step 4: Run test to verify it passes**, then full checks and commit:

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(routes): restaurants gets the wide main and pinned-action room

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A real Clear button in Home's filter, and spec notes

**Files:**
- Modify: `src/components/random-picker.ts` (`button.link` style for Clear), `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md`
- Test: `tests/components/random-picker.test.ts`

- [ ] **Step 1: Write the failing test** — append:

```ts
test("Clear is a full-size quiet button, not a tiny inline link", async () => {
	addRestaurant({ ...base, name: "A", groups: { area: ["siam"] } });
	const el = await mount();
	await cycle(el, "siam");
	const clear = root(el).querySelector<HTMLButtonElement>(
		'[data-action="clear-filter"]',
	)!;
	expect(clear.classList.contains("quiet")).toBe(true);
	expect(clear.classList.contains("link")).toBe(false);
	const css = (RandomPicker.styles as { cssText: string }[])
		.map((style) => style.cssText)
		.join("\n");
	expect(css).toMatch(/\.active-filter\s*\{[^}]*display:\s*flex/);
});
```

(`RandomPicker` is already imported in this test file — check with `grep -n "RandomPicker" tests/components/random-picker.test.ts`; import it from `#components/random-picker` if not.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components/random-picker.test.ts`
Expected: FAIL — the button has class `link`.

- [ ] **Step 3: Implement** — in `random-picker.ts` change the Clear button's class from `link` to `quiet`, delete the `button.link { … }` rule, and make the `.active-filter` rule a wrapping row so the button sits after the sentence at full size:

```css
			.active-filter {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.25rem 0.5rem;
				padding-top: 0.75rem;
				border-top: 1px solid var(--color-border);
				color: var(--color-muted);
				font-size: 0.875rem;
			}

			.active-filter .quiet {
				min-height: 2.25rem;
				padding: 0 0.5rem;
			}
```

The existing test reading `.active-filter` text (`"Filter active: Area: ✓ thai, ✕ spicy Clear"`) must still pass; wrap the sentence in a `<span>` if whitespace changes it.

- [ ] **Step 4: Spec notes** — in the spec's Restaurants section record: rows show only name and type line (location, notes and chips are in the form); Delete sits at the end of the edit form with a prompt naming the restaurant; the sheet and the panel share one form switched by `MediaController`; closing the sheet discards unsaved edits; the status line confirms saves and deletes; the pinned Add uses `html.has-pinned`. In the Home section note that Clear is now a 36px quiet button.

- [ ] **Step 5: Run tests, full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "fix(components): clear in the home filter is a full-size button; spec notes for restaurants

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Then the controller runs the final review and opens the pull request (shipping-a-change).
