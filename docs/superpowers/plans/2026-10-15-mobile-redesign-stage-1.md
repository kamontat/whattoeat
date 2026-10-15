# Mobile redesign, stage 1: foundation, shell and Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the new visual system (paper/ink/chili/yellow palette, Anuphan font, 44 px targets, focus ring), the new shell (skip link, floating phone tab bar, desktop top bar with language and theme switches from 72 rem), the shared `app-sheet` and `app-preferences` components, and the redesigned Settings page.

**Architecture:** Tokens and `@font-face` live in `src/styles/global.css`; shared component CSS in `src/styles/ui.ts` (`uiStyles`), which every Lit component already includes. New pure helper `src/lib/icons.ts` returns inline SVG templates. New components `app-sheet` (native `<dialog>`) and `app-preferences` (radio segmented controls) are built here and reused by later stages. `app-header` renders one `<nav>` that CSS turns into a bottom tab bar on phones and a top bar from 48 rem. Settings (`data-transfer`) becomes grouped lists and hosts `app-preferences` and `app-footer`.

**Tech Stack:** Lit 3.3, Bun 1.4 (`bun test` + happy-dom 21), `@kctools/bun-server` 0.4.2, Biome 2.5, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md` (stage 1 of the Delivery section). Mockups: "Chosen" page of <https://claude.ai/code/artifact/7cabd42f-544c-4073-8299-3dbb384f2604>.

## Global Constraints

- Work in the worktree `.claude/worktrees/mobile-redesign` on branch `worktree-mobile-redesign`; never edit `main`.
- Test first for every task: write the failing test, run it, watch it fail for the right reason, then code.
- Imports through `#components/*`, `#lib/*`, `#styles/*`; every new element is registered in `src/types/global.d.ts`.
- No change to `src/lib/` storage, keys or export format. New pure helper modules are allowed (`#lib/icons`).
- Every user-visible string goes through `t()`; every new key is added to both `en` and `th` in `src/lib/i18n.ts` (`tests/lib/i18n.test.ts` fails otherwise).
- Keep today's wording for existing controls. Keep every existing `data-action` attribute on controls that keep their job.
- Minimum target 44 × 44 CSS px (`var(--tap)`); inputs 16 px text; never `outline: none` without a replacement.
- Breakpoints: phone layout below `48rem`; top bar from `48rem`; header language and theme switches from `72rem`.
- Colours exactly as in Task 1; `--color-border` and `--color-danger` keep their names.
- Before each commit: `bun run format && bun run check && bun run test && bun run build` all pass; `git add -A` after `format`.
- Conventional commits, lower case, scoped: `feat(styles): ...`, `feat(components): ...`, `feat(lib): ...`, `docs: ...`. End every commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `CHANGELOG.md` (that happens when landing).

## Review Focus

- **Two `app-preferences` on one page (Settings at ≥ 72 rem: header and Settings).** Expected: each has its own radio group; choosing Dark in one updates the other. Pinned in Task 5 ("two instances stay in step").
- **Theme or language changed in another tab.** Expected: the checked radio follows (the existing `storage` listener dispatches the change events). Pinned in Task 5 ("follows a change event").
- **Sheet closed by Esc or the backdrop instead of the Close button.** Expected: `open` becomes false, `sheet-close` fires once, focus returns to the opener. Pinned in Task 4 ("closing the dialog directly").
- **Tags page.** Expected: the Restaurants tab is marked current and the tab title stays "Tags · What to Eat". Pinned in Task 6.
- **Settings import still works with the file input visually hidden inside a row.** Expected: the input stays in the DOM, focusable, and `change` reads the file as before. Pinned in Task 8 ("file input is still a real input").

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/assets/fonts/anuphan-thai.woff2`, `anuphan-latin.woff2`, `OFL.txt` | Font files and licence | 1 |
| `src/styles/global.css` | Tokens (light, system dark, chosen dark), `@font-face`, page layout, tab-bar padding | 1 |
| `tests/styles/palette.test.ts` | Contrast rules for every token pair | 1 |
| `src/styles/ui.ts` | Shared component CSS: buttons, inputs, grouped lists, segmented, chips, focus | 2 |
| `tests/styles/ui.test.ts` | Pins the focus ring and target sizes in `uiStyles` | 2 |
| `src/lib/icons.ts` | `icon(name, size)` and `logo(size)` SVG templates | 3 |
| `tests/lib/icons.test.ts` | Icon markup | 3 |
| `src/components/app-sheet.ts` | Modal bottom sheet on `<dialog>` | 4 |
| `tests/components/app-sheet.test.ts` | Sheet behaviour | 4 |
| `src/components/app-preferences.ts` | Language and theme radio segmented controls (`compact` for the header) | 5 |
| `tests/components/app-preferences.test.ts` | Preferences behaviour | 5 |
| `src/components/app-header.ts` | Skip link, brand, four-link nav (tab bar / top bar), compact preferences | 6 |
| `tests/components/app-header.test.ts` | Header behaviour (rewritten) | 6 |
| `src/routes/*.html` | Meta tags, `main#main`, no page-level footer | 7 |
| `tests/routes/pages.test.ts` | Page shell checks | 7 |
| `src/components/app-footer.ts` | About rows | 8 |
| `src/components/data-transfer.ts` | Settings as grouped lists with Appearance and About | 8 |
| `tests/components/app-footer.test.ts`, `tests/components/data-transfer.test.ts` | Updated and new tests | 8 |
| `src/lib/i18n.ts` | New keys (Tasks 4, 6, 8) | 4, 6, 8 |
| `src/types/global.d.ts` | Register `app-sheet`, `app-preferences` | 4, 5 |
| `README.md`, `IDEAS.md` | Docs | 9 |

(Task numbers in this table match the task headings below.)

---

### Task 1: Palette tokens, Anuphan font and page layout

**Files:**
- Create: `src/assets/fonts/anuphan-thai.woff2`, `src/assets/fonts/anuphan-latin.woff2`, `src/assets/fonts/OFL.txt`
- Modify: `src/styles/global.css` (whole file)
- Test: `tests/styles/palette.test.ts` (whole file)

**Interfaces:**
- Produces CSS custom properties used by every later task: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-text`, `--color-muted`, `--color-primary`, `--color-primary-text`, `--color-link`, `--color-accent`, `--color-accent-text`, `--color-control`, `--color-border`, `--color-danger`, `--color-success`, `--color-focus`, `--font`, `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill`, `--tap`, `--duration`, `--shadow`, `--shadow-lg`, `--tab-bar-space`.

- [ ] **Step 1: Write the failing test** — replace `tests/styles/palette.test.ts` with:

```ts
import { expect, test } from "bun:test";

const css = await Bun.file("src/styles/global.css").text();

/** The `--color-*` tokens declared in the first rule whose selector is exactly `selector`. */
const tokens = (selector: string): Record<string, string> => {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const block = css.match(
		new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`),
	)?.[1];
	if (block === undefined) throw new Error(`no rule for ${selector}`);
	return Object.fromEntries(
		[...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
			m[1]!,
			m[2]!.toLowerCase(),
		]),
	);
};

const luminance = (hex: string): number => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

/** WCAG 2 contrast ratio between two colours. */
const contrast = (a: string, b: string): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi! + 0.05) / (lo! + 0.05);
};

const light = tokens(":root");
const dark = tokens(':root[data-theme="dark"]');
const systemDark = tokens(':root:not([data-theme="light"])');

const NAMES = [
	"bg",
	"surface",
	"surface-2",
	"text",
	"muted",
	"primary",
	"primary-text",
	"link",
	"accent",
	"accent-text",
	"control",
	"border",
	"danger",
	"success",
	"focus",
];

/** Foreground on background pairs that carry normal-size text: WCAG 1.4.3, 4.5:1. */
const TEXT_PAIRS: [string, string][] = [
	["text", "bg"],
	["text", "surface"],
	["text", "surface-2"],
	["muted", "bg"],
	["muted", "surface"],
	["muted", "surface-2"],
	["link", "bg"],
	["link", "surface"],
	["link", "surface-2"],
	["danger", "bg"],
	["danger", "surface"],
	["danger", "surface-2"],
	["success", "bg"],
	["success", "surface"],
	["success", "surface-2"],
	["primary", "bg"],
	["primary", "surface"],
	["primary-text", "primary"],
	["accent-text", "accent"],
];

/** Control edges and the focus ring against what sits around them: WCAG 1.4.11, 3:1. */
const UI_PAIRS: [string, string][] = [
	["control", "bg"],
	["control", "surface"],
	["focus", "bg"],
	["focus", "surface"],
];

test("the light and dark palettes define every colour token", () => {
	expect(Object.keys(light).sort()).toEqual([...NAMES].sort());
	expect(Object.keys(dark).sort()).toEqual([...NAMES].sort());
});

test("the system dark palette is the same as the chosen dark palette", () => {
	expect(systemDark).toEqual(dark);
});

for (const [name, palette] of [
	["light", light],
	["dark", dark],
] as const) {
	test.each(TEXT_PAIRS)(`${name}: %s on %s meets WCAG AA (4.5:1)`, (fg, bg) => {
		expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5);
	});
	test.each(UI_PAIRS)(`${name}: %s on %s meets 3:1`, (fg, bg) => {
		expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3);
	});
}

test("each palette sets the matching color-scheme", () => {
	expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light dark/);
	expect(css).toMatch(
		/:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/,
	);
	expect(css).toMatch(
		/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light/,
	);
});

test("Anuphan is loaded from the committed Thai and Latin files", async () => {
	for (const script of ["thai", "latin"]) {
		expect(css).toContain(`url("../assets/fonts/anuphan-${script}.woff2")`);
		expect(
			await Bun.file(`src/assets/fonts/anuphan-${script}.woff2`).exists(),
		).toBe(true);
	}
	expect(await Bun.file("src/assets/fonts/OFL.txt").exists()).toBe(true);
	expect(css).toMatch(/--font:\s*\n?\s*"Anuphan"/);
});

test("reduced motion turns transitions off", () => {
	expect(css).toMatch(
		/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*:root\s*\{[^}]*--duration:\s*0ms/,
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/styles/palette.test.ts`
Expected: FAIL — "the light and dark palettes define every colour token" (missing `surface-2`, `link`, …) and the Anuphan test (no font files).

- [ ] **Step 3: Add the font files and licence**

```bash
mkdir -p src/assets/fonts
curl -sSfo src/assets/fonts/anuphan-thai.woff2 https://fonts.gstatic.com/s/anuphan/v6/2sDeZGxYgY7LkLT0mX4Dam--C70lZQ.woff2
curl -sSfo src/assets/fonts/anuphan-latin.woff2 https://fonts.gstatic.com/s/anuphan/v6/2sDeZGxYgY7LkLT0mWoDam--C70.woff2
curl -sSfo src/assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/anuphan/OFL.txt
file src/assets/fonts/*.woff2   # both: "Web Open Font Format (Version 2)"
head -3 src/assets/fonts/OFL.txt   # Copyright line for Anuphan
```

Expected sizes: Thai about 19 KB, Latin about 35 KB.

- [ ] **Step 4: Replace `src/styles/global.css`**

```css
@import "@kcstyles/reset.css";

/* Anuphan is a variable font (100–700); one file per script, inlined into the CSS bundle by the build. */
@font-face {
	font-family: "Anuphan";
	font-style: normal;
	font-weight: 400 700;
	font-display: swap;
	src: url("../assets/fonts/anuphan-thai.woff2") format("woff2");
	unicode-range: U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC;
}

@font-face {
	font-family: "Anuphan";
	font-style: normal;
	font-weight: 400 700;
	font-display: swap;
	src: url("../assets/fonts/anuphan-latin.woff2") format("woff2");
	unicode-range:
		U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
		U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
		U+2212, U+2215, U+FEFF, U+FFFD;
}

/* Light palette, used unless the system or a theme switch asks for dark. */
:root {
	--color-bg: #fff3dc;
	--color-surface: #fffaf0;
	--color-surface-2: #f5e6c8;
	--color-text: #1c1712;
	--color-muted: #6b5d50;
	--color-primary: #d62a1e;
	--color-primary-text: #fff8eb;
	--color-link: #b8231a;
	--color-accent: #ffc533;
	--color-accent-text: #1c1712;
	--color-control: #8c7b6a;
	--color-border: #eedfc3;
	--color-danger: #b8231a;
	--color-success: #2b6e35;
	--color-focus: #1c1712;
	--shadow: 0 1px 2px rgb(28 23 18 / 0.06), 0 8px 24px rgb(28 23 18 / 0.08);
	--shadow-lg: 0 -8px 30px rgb(28 23 18 / 0.2);
	--scrim: rgb(28 23 18 / 0.45);
	--radius-sm: 0.75rem;
	--radius: 1.375rem;
	--radius-lg: 1.625rem;
	--radius-pill: 999px;
	--tap: 2.75rem;
	--duration: 180ms;
	/* Room the floating tab bar takes at the bottom of a phone screen. */
	--tab-bar-space: calc(7rem + env(safe-area-inset-bottom, 0px));
	--font:
		"Anuphan", "Noto Sans Thai", system-ui, -apple-system, "Segoe UI",
		"Leelawadee UI", Tahoma, sans-serif;

	color-scheme: light dark;
	font-family: var(--font);
	font-size: 100%;
	line-height: 1.55;
	color: var(--color-text);
	background: var(--color-bg);
	scroll-padding-bottom: var(--tab-bar-space);
}

:root[data-theme="light"] {
	color-scheme: light;
}

/* Dark palette for "auto" on a dark system; keep it in step with the rule below. */
@media (prefers-color-scheme: dark) {
	:root:not([data-theme="light"]) {
		--color-bg: #17130f;
		--color-surface: #231d17;
		--color-surface-2: #2f271f;
		--color-text: #f7ecdc;
		--color-muted: #b9a894;
		--color-primary: #ff6a4d;
		--color-primary-text: #17130f;
		--color-link: #ff6a4d;
		--color-accent: #ffc533;
		--color-accent-text: #1c1712;
		--color-control: #8a7a69;
		--color-border: #362c23;
		--color-danger: #ff6a4d;
		--color-success: #6fd08a;
		--color-focus: #ffc533;
		--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 8px 24px rgb(0 0 0 / 0.35);
		--shadow-lg: 0 -8px 30px rgb(0 0 0 / 0.5);
		--scrim: rgb(0 0 0 / 0.6);

		color-scheme: dark;
	}
}

/* Dark palette chosen with a theme switch (`data-theme` set by #lib/theme). */
:root[data-theme="dark"] {
	--color-bg: #17130f;
	--color-surface: #231d17;
	--color-surface-2: #2f271f;
	--color-text: #f7ecdc;
	--color-muted: #b9a894;
	--color-primary: #ff6a4d;
	--color-primary-text: #17130f;
	--color-link: #ff6a4d;
	--color-accent: #ffc533;
	--color-accent-text: #1c1712;
	--color-control: #8a7a69;
	--color-border: #362c23;
	--color-danger: #ff6a4d;
	--color-success: #6fd08a;
	--color-focus: #ffc533;
	--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 8px 24px rgb(0 0 0 / 0.35);
	--shadow-lg: 0 -8px 30px rgb(0 0 0 / 0.5);
	--scrim: rgb(0 0 0 / 0.6);

	color-scheme: dark;
}

@media (prefers-reduced-motion: reduce) {
	:root {
		--duration: 0ms;
	}
}

body {
	min-height: 100vh;
}

/* Phones: the floating tab bar covers the bottom of the screen, so main ends above it. */
main {
	width: 100%;
	max-width: 40rem;
	margin: 0 auto;
	padding: 1.5rem 1.125rem var(--tab-bar-space);
}

main:focus {
	outline: none;
}

/* From 48rem the links move to a top bar and nothing covers the bottom. */
@media (min-width: 48rem) {
	:root {
		--tab-bar-space: 0px;
	}

	main {
		max-width: 72.5rem;
		padding: 2.25rem 2.5rem 3rem;
	}
}

:focus-visible {
	outline: 3px solid var(--color-focus);
	outline-offset: 2px;
}
```

Note: `main:focus { outline: none }` is safe because `main` only takes focus from the skip link (`tabindex="-1"`, Task 7); it is not an interactive control.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/styles/palette.test.ts`
Expected: PASS (all pairs; the lowest is light `primary` on `bg` at 4.54).

- [ ] **Step 6: Confirm the build inlines the fonts**

Run: `bun run build && grep -c "data:font/woff2" dist/*.css`
Expected: `2` (one per `@font-face`). Then `rm -rf dist`.

- [ ] **Step 7: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(styles): paper, ink, chili and yellow palette with the anuphan font

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Shared component styles (`uiStyles`)

**Files:**
- Modify: `src/styles/ui.ts` (whole file)
- Test: `tests/styles/ui.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces class names later tasks use: `button.primary`, `button.accent`, `button.danger`, `button.quiet`, `.group`, `.item` (on `a`, `button`, `label`, `summary`, `div`), `.item .grow`, `.item .lead`, `.item .trail`, `.item small`, `.group-label`, `.seg` (segmented track holding `label > input[type=radio] + span`), `.chip`, `.chips`, `.card`, `.actions`, `.muted`, `.hint`, `.error`, `.success`, `.warning`, `.visually-hidden`, `.page-title`, `.page-sub`.

- [ ] **Step 1: Write the failing test** — `tests/styles/ui.test.ts`:

```ts
import { expect, test } from "bun:test";
import { uiStyles } from "#styles/ui";

const css = uiStyles.cssText;

test("every control shows the focus ring when focused by keyboard", () => {
	expect(css).toMatch(
		/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)/,
	);
});

test("buttons, inputs, list rows and segments are at least the tap size", () => {
	for (const selector of ["button", "input", ".item", ".seg span"]) {
		const rule = css.match(
			new RegExp(`(?:^|[\\s,}])${selector.replace(".", "\\.")}[^{]*\\{([^}]*)\\}`),
		)?.[1];
		expect(rule, selector).toContain("min-height: var(--tap)");
	}
});

test("inputs use 16px text so iOS does not zoom", () => {
	expect(css).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*1rem/);
});

test("grouped list rows keep a visible divider and no outline override", () => {
	expect(css).toMatch(/\.item \+ \.item[^{]*\{[^}]*border-top:/);
	expect(css).not.toMatch(/outline:\s*none/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/styles/ui.test.ts`
Expected: FAIL — no `:focus-visible` rule, no `min-height: var(--tap)`.

- [ ] **Step 3: Replace `src/styles/ui.ts`**

```ts
import { css } from "lit";

/** Shared look for buttons, form fields, grouped lists, segmented controls and chips inside component shadow roots. */
export const uiStyles = css`
	:host {
		display: block;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	a {
		color: var(--color-link);
	}

	:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}

	.page-title {
		font-size: 2rem;
		line-height: 1.15;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.page-sub {
		color: var(--color-muted);
		font-size: 0.9375rem;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--tap);
		padding: 0 1.125rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		border: 1.5px solid var(--color-control);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	button.primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-primary-text);
	}

	button.accent {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	button.danger {
		background: transparent;
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	button.quiet {
		border-color: transparent;
		background: transparent;
		color: var(--color-link);
	}

	label {
		display: grid;
		gap: 0.375rem;
		font-weight: 600;
	}

	input,
	select,
	textarea {
		font: inherit;
		font-size: 1rem;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap);
		padding: 0.5rem 0.75rem;
		border: 1.5px solid var(--color-control);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: inherit;
	}

	input[type="checkbox"],
	input[type="radio"] {
		width: auto;
		min-height: 0;
		accent-color: var(--color-primary);
	}

	.card {
		display: grid;
		gap: 0.75rem;
		padding: 1.125rem;
		border-radius: var(--radius);
		background: var(--color-surface);
		box-shadow: var(--shadow);
		overflow-wrap: anywhere;
	}

	.card > * {
		min-width: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
	}

	/* Grouped list: rounded surface, one row per item, dividers between rows. */
	.group-label {
		padding: 0.375rem 1.125rem 0;
		color: var(--color-muted);
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.group {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border-radius: var(--radius);
		background: var(--color-surface);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap);
		padding: 0.625rem 0.875rem 0.625rem 1.125rem;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-weight: 400;
		text-align: start;
		text-decoration: none;
	}

	.item + .item,
	.group > * + * > .item {
		border-top: 1px solid var(--color-border);
	}

	.item:focus-visible {
		outline-offset: -3px;
	}

	.item .lead,
	.item .trail {
		display: flex;
		flex: none;
		color: var(--color-muted);
	}

	.item .grow {
		display: grid;
		flex: 1;
		min-width: 0;
	}

	.item b {
		font-weight: 600;
		font-size: 1.0625rem;
	}

	.item small {
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.item.danger,
	.item.danger .lead {
		color: var(--color-danger);
	}

	/* Segmented control: native radios, the checked one in ink. */
	.seg {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--color-control);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
	}

	.seg label {
		display: block;
		position: relative;
		font-weight: 600;
	}

	.seg input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.seg span {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: var(--tap);
		padding: 0 0.75rem;
		border-radius: calc(var(--radius-sm) - 3px);
		font-size: 0.875rem;
	}

	.seg input:checked + span {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.seg input:focus-visible + span {
		outline: 3px solid var(--color-focus);
		outline-offset: 1px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		padding: 0.125rem 0.625rem;
		border-radius: var(--radius-pill);
		background: var(--color-surface-2);
		font-size: 0.8125rem;
	}

	.muted,
	.hint {
		color: var(--color-muted);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.error {
		color: var(--color-danger);
	}

	.success {
		color: var(--color-success);
	}

	.warning {
		margin: 0;
		padding: 0.75rem 1rem;
		border: 1.5px solid var(--color-danger);
		border-radius: var(--radius-sm);
		color: var(--color-danger);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	@media (forced-colors: active) {
		.seg input:checked + span {
			outline: 2px solid CanvasText;
		}
	}
`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/styles/ui.test.ts && bun run test`
Expected: PASS everywhere. Existing component tests do not read styles, so none should change.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(styles): shared buttons, grouped lists, segmented controls and focus ring

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Inline SVG icons (`#lib/icons`)

**Files:**
- Create: `src/lib/icons.ts`
- Test: `tests/lib/icons.test.ts`

**Interfaces:**
- Produces: `export type IconName = "dice" | "bowl" | "clock" | "sliders" | "x" | "check" | "funnel" | "pin" | "chevron" | "back" | "plus" | "edit" | "download" | "copy" | "upload" | "tag" | "trash" | "move" | "dots" | "up" | "down" | "auto" | "sun" | "moon" | "code" | "list";`, `export const ICON_NAMES: readonly IconName[]`, `export const icon = (name: IconName, size = 24): TemplateResult`, `export const logo = (size = 34): TemplateResult`.

- [ ] **Step 1: Write the failing test** — `tests/lib/icons.test.ts`:

```ts
import { expect, test } from "bun:test";
import { render } from "lit";
import { ICON_NAMES, icon, logo } from "#lib/icons";

const mount = (template: unknown): SVGElement => {
	const host = document.createElement("div");
	render(template, host);
	return host.querySelector("svg")!;
};

test.each([...ICON_NAMES])("%s is a hidden 24px stroke icon with a shape", (name) => {
	const svg = mount(icon(name));
	expect(svg.getAttribute("aria-hidden")).toBe("true");
	expect(svg.getAttribute("focusable")).toBe("false");
	expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
	expect(svg.getAttribute("width")).toBe("24");
	expect(svg.getAttribute("stroke")).toBe("currentColor");
	expect(svg.querySelector("path, circle, rect")).not.toBeNull();
});

test("icon takes a size", () => {
	expect(mount(icon("x", 18)).getAttribute("height")).toBe("18");
});

test("the logo is hidden and drawn in the primary colours", () => {
	const svg = mount(logo());
	expect(svg.getAttribute("aria-hidden")).toBe("true");
	expect(svg.querySelector("circle")?.getAttribute("fill")).toBe(
		"var(--color-primary)",
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/icons.test.ts`
Expected: FAIL — `Cannot find module '#lib/icons'`.

- [ ] **Step 3: Write `src/lib/icons.ts`**

```ts
import { html, type SVGTemplateResult, svg, type TemplateResult } from "lit";

/** 24px stroke shapes, drawn for `stroke-width="2"` with round caps. */
const SHAPES = {
	dice: svg`<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>`,
	bowl: svg`<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7.5c0-1.5 1-2 1-3.5M12 7.5c0-1.5 1-2 1-3.5M16 7.5c0-1.5 1-2 1-3.5"/>`,
	clock: svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
	sliders: svg`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
	x: svg`<path d="M6 6l12 12M18 6L6 18"/>`,
	check: svg`<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
	funnel: svg`<path d="M4 5h16l-6 7.5V18l-4 2v-7.5z"/>`,
	pin: svg`<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>`,
	chevron: svg`<path d="M9 6l6 6-6 6"/>`,
	back: svg`<path d="M15 6l-6 6 6 6"/>`,
	plus: svg`<path d="M12 5v14M5 12h14"/>`,
	edit: svg`<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>`,
	download: svg`<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
	copy: svg`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>`,
	upload: svg`<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>`,
	tag: svg`<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor"/>`,
	trash: svg`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,
	move: svg`<path d="M5 12h14M13 6l6 6-6 6"/>`,
	dots: svg`<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>`,
	up: svg`<path d="M12 19V5M6 11l6-6 6 6"/>`,
	down: svg`<path d="M12 5v14M6 13l6 6 6-6"/>`,
	auto: svg`<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>`,
	sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
	moon: svg`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>`,
	code: svg`<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>`,
	list: svg`<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type IconName = keyof typeof SHAPES;

export const ICON_NAMES = Object.keys(SHAPES) as readonly IconName[];

/** A decorative icon: always pair it with visible text or give its control an accessible name. */
export const icon = (name: IconName, size = 24): TemplateResult =>
	html`<svg
		class="icon"
		width=${size}
		height=${size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		focusable="false"
	>${SHAPES[name]}</svg>`;

/** The site mark from favicon.svg, in the theme's primary colours. */
export const logo = (size = 34): TemplateResult =>
	html`<svg class="logo" width=${size} height=${size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
		<circle cx="32" cy="32" r="30" fill="var(--color-primary)" />
		<g fill="none" stroke="var(--color-primary-text)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="32" cy="32" r="17" />
			<path d="M14 14v12a4 4 0 0 0 4 4v20M18 14v10M22 14v12a4 4 0 0 1-4 4" />
			<path d="M48 50V14c-4 2-6 8-6 16h6" />
		</g>
	</svg>`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/icons.test.ts`
Expected: PASS (26 icon cases + 2).

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(lib): inline svg icons and the site logo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `app-sheet` modal bottom sheet

**Files:**
- Create: `src/components/app-sheet.ts`
- Modify: `src/types/global.d.ts` (register `app-sheet`), `src/lib/i18n.ts` (add `sheet.close` to `en` and `th`)
- Test: `tests/components/app-sheet.test.ts`

**Interfaces:**
- Consumes: `icon` from `#lib/icons`, `t`/`LangController` from `#lib/i18n`, `uiStyles`.
- Produces: element `<app-sheet heading="…" subheading="…" ?open=${…}>` with default slot (body) and `slot="footer"`; fires `sheet-close` (`bubbles`, `composed`) once each time it closes for any reason; property `open` becomes `false` on close. Exported helper `deepActiveElement(): HTMLElement | null`.

- [ ] **Step 1: Add the i18n key** — in `src/lib/i18n.ts`, after `"nav.settings": "Settings",` in `en` add `"sheet.close": "Close",`; after `"nav.settings": "ตั้งค่า",` in `th` add `"sheet.close": "ปิด",`.

- [ ] **Step 2: Write the failing test** — `tests/components/app-sheet.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-sheet";
import type { AppSheet } from "#components/app-sheet";
import { setLang } from "#lib/i18n";

beforeEach(() => setLang("en"));

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
});

const mount = async () => {
	const opener = document.createElement("button");
	opener.textContent = "Open";
	const sheet = document.createElement("app-sheet") as AppSheet;
	sheet.heading = "Filter";
	sheet.subheading = "Cuisine · 2 restaurants";
	sheet.innerHTML = `<p>Body</p><button slot="footer" type="button">Done</button>`;
	document.body.append(opener, sheet);
	await sheet.updateComplete;
	return { opener, sheet };
};

/** The dialog's close event may be queued; let it run, then let Lit re-render. */
const settle = async (sheet: AppSheet) => {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await sheet.updateComplete;
};

const dialog = (sheet: AppSheet) =>
	sheet.shadowRoot!.querySelector("dialog")!;

test("is closed until open is set", async () => {
	const { sheet } = await mount();
	expect(dialog(sheet).open).toBe(false);
});

test("opening shows a modal dialog labelled by its heading", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	const d = dialog(sheet);
	expect(d.open).toBe(true);
	const title = sheet.shadowRoot!.getElementById(
		d.getAttribute("aria-labelledby")!,
	);
	expect(title?.tagName).toBe("H2");
	expect(title?.textContent?.trim()).toBe("Filter");
	expect(sheet.shadowRoot!.querySelector(".sub")?.textContent?.trim()).toBe(
		"Cuisine · 2 restaurants",
	);
});

test("the close button has an accessible name and closes the sheet", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	let events = 0;
	sheet.addEventListener("sheet-close", () => events++);
	const close = sheet.shadowRoot!.querySelector<HTMLButtonElement>(
		'button[data-action="close-sheet"]',
	)!;
	expect(close.getAttribute("aria-label")).toBe("Close");
	close.click();
	await settle(sheet);
	expect(dialog(sheet).open).toBe(false);
	expect(sheet.open).toBe(false);
	expect(events).toBe(1);
	expect(document.activeElement).toBe(opener);
});

test("closing the dialog directly (Esc or backdrop) updates open and fires once", async () => {
	const { opener, sheet } = await mount();
	opener.focus();
	sheet.open = true;
	await sheet.updateComplete;
	let events = 0;
	sheet.addEventListener("sheet-close", () => events++);
	dialog(sheet).close();
	await settle(sheet);
	expect(sheet.open).toBe(false);
	expect(events).toBe(1);
	expect(document.activeElement).toBe(opener);
});

test("setting open to false closes it", async () => {
	const { sheet } = await mount();
	sheet.open = true;
	await sheet.updateComplete;
	sheet.open = false;
	await settle(sheet);
	expect(dialog(sheet).open).toBe(false);
});

test("the footer area hides when nothing is slotted into it", async () => {
	const sheet = document.createElement("app-sheet") as AppSheet;
	sheet.heading = "Tags";
	document.body.append(sheet);
	await sheet.updateComplete;
	expect(
		sheet.shadowRoot!.querySelector<HTMLElement>(".foot")!.hidden,
	).toBe(true);
});

test("close label follows the language", async () => {
	const { sheet } = await mount();
	setLang("th");
	await sheet.updateComplete;
	expect(
		sheet
			.shadowRoot!.querySelector('button[data-action="close-sheet"]')
			?.getAttribute("aria-label"),
	).toBe("ปิด");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tests/components/app-sheet.test.ts`
Expected: FAIL — `Cannot find module '#components/app-sheet'`.

- [ ] **Step 4: Write `src/components/app-sheet.ts`**

```ts
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { LangController, t } from "#lib/i18n";
import { icon } from "#lib/icons";
import { uiStyles } from "#styles/ui";

/** The focused element, looking inside open shadow roots. */
export const deepActiveElement = (): HTMLElement | null => {
	let active = document.activeElement;
	while (active?.shadowRoot?.activeElement)
		active = active.shadowRoot.activeElement;
	return active instanceof HTMLElement ? active : null;
};

/**
 * A modal sheet: slides up from the bottom on phones, centred from 48rem. Built on `<dialog>`
 * so focus moves in, the page behind is inert and Esc closes it.
 */
@customElement("app-sheet")
export class AppSheet extends LitElement {
	static override styles = [
		uiStyles,
		css`
			:host {
				display: contents;
			}

			dialog {
				box-sizing: border-box;
				width: 100%;
				max-width: 100%;
				max-height: 90dvh;
				margin: auto auto 0;
				padding: 0;
				border: 0;
				border-radius: var(--radius-lg) var(--radius-lg) 0 0;
				background: var(--color-bg);
				color: var(--color-text);
				box-shadow: var(--shadow-lg);
			}

			dialog[open] {
				animation: slide-up var(--duration) ease-out;
			}

			dialog::backdrop {
				background: var(--scrim);
			}

			@keyframes slide-up {
				from {
					transform: translateY(100%);
				}
			}

			.box {
				display: flex;
				flex-direction: column;
				max-height: 90dvh;
			}

			.grabber {
				align-self: center;
				width: 2.5rem;
				height: 0.3125rem;
				margin: 0.5rem 0 0.125rem;
				border-radius: 3px;
				background: var(--color-control);
			}

			.head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.25rem 0.625rem 0.25rem 1.25rem;
			}

			h2 {
				font-size: 1.375rem;
				font-weight: 700;
			}

			.sub {
				color: var(--color-muted);
				font-size: 0.9375rem;
			}

			.close {
				width: var(--tap);
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: var(--color-surface-2);
			}

			.body {
				display: grid;
				gap: 1rem;
				padding: 0.25rem 1.25rem 1rem;
				overflow-y: auto;
			}

			.foot {
				display: flex;
				gap: 0.625rem;
				padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
				border-top: 1px solid var(--color-border);
			}

			.foot[hidden] {
				display: none;
			}

			::slotted([slot="footer"]) {
				flex: 1;
			}

			@media (min-width: 48rem) {
				dialog {
					max-width: 32rem;
					margin: auto;
					border-radius: var(--radius-lg);
				}

				.grabber {
					display: none;
				}
			}
		`,
	];

	@property()
	heading = "";

	@property()
	subheading = "";

	@property({ type: Boolean, reflect: true })
	open = false;

	@state()
	private hasFooter = false;

	@query("dialog")
	private dialog!: HTMLDialogElement;

	/** Where focus was when the sheet opened; it goes back there on close. */
	private opener: HTMLElement | null = null;

	protected readonly langController = new LangController(this);

	protected override updated(changed: PropertyValues<this>): void {
		if (!changed.has("open")) return;
		if (this.open && !this.dialog.open) {
			this.opener = deepActiveElement();
			this.dialog.showModal();
		} else if (!this.open && this.dialog.open) {
			this.dialog.close();
		}
	}

	/** The dialog closed: by the Close button, Esc, a backdrop tap or `open = false`. */
	private readonly onClose = (): void => {
		this.open = false;
		this.dispatchEvent(
			new CustomEvent("sheet-close", { bubbles: true, composed: true }),
		);
		const opener = this.opener;
		this.opener = null;
		opener?.focus();
	};

	/** A click on the dialog itself, not its content box, is a tap on the backdrop. */
	private readonly onClick = (event: MouseEvent): void => {
		if (event.target === this.dialog) this.dialog.close();
	};

	private readonly onFooterChange = (event: Event): void => {
		this.hasFooter =
			(event.target as HTMLSlotElement).assignedElements().length > 0;
	};

	override render() {
		return html`
			<dialog aria-labelledby="sheet-title" @close=${this.onClose} @click=${this.onClick}>
				<div class="box">
					<span class="grabber" aria-hidden="true"></span>
					<div class="head">
						<div>
							<h2 id="sheet-title">${this.heading}</h2>
							${this.subheading ? html`<p class="sub">${this.subheading}</p>` : nothing}
						</div>
						<button
							type="button"
							class="close"
							data-action="close-sheet"
							aria-label=${t("sheet.close")}
							@click=${() => this.dialog.close()}
						>
							${icon("x", 20)}
						</button>
					</div>
					<div class="body"><slot></slot></div>
					<div class="foot" ?hidden=${!this.hasFooter}>
						<slot name="footer" @slotchange=${this.onFooterChange}></slot>
					</div>
				</div>
			</dialog>
		`;
	}
}
```

- [ ] **Step 5: Register the element** — in `src/types/global.d.ts` add `import type { AppSheet } from "#components/app-sheet";` beside the other imports and `"app-sheet": AppSheet;` inside `HTMLElementTagNameMap` (keep alphabetical order of the import lines as Biome sorts them).

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test tests/components/app-sheet.test.ts tests/lib/i18n.test.ts`
Expected: PASS. If happy-dom does not move focus back (opener check fails), confirm `opener.focus()` was called by logging `document.activeElement` — happy-dom 21 supports `focus()` on buttons, so a failure means `deepActiveElement()` returned the wrong element.

- [ ] **Step 7: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): app-sheet, a modal bottom sheet on dialog

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `app-preferences` language and theme switches

**Files:**
- Create: `src/components/app-preferences.ts`
- Modify: `src/types/global.d.ts` (register `app-preferences`)
- Test: `tests/components/app-preferences.test.ts`

**Interfaces:**
- Consumes: `getLang`, `setLang`, `LANGS`, `LangController`, `t` from `#lib/i18n`; `getTheme`, `setTheme`, `THEMES`, `ThemeController`, `type Theme` from `#lib/theme`; `icon` from `#lib/icons`; `uiStyles`.
- Produces: `<app-preferences>` (Settings rows) and `<app-preferences compact>` (header). Inside: `fieldset.lang` and `fieldset.theme`, each with a `legend` and radios `input[name="lang"][value="en|th"]`, `input[name="theme"][value="auto|light|dark"]`.

- [ ] **Step 1: Write the failing test** — `tests/components/app-preferences.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-preferences";
import type { AppPreferences } from "#components/app-preferences";
import { LANG_EVENT, setLang } from "#lib/i18n";
import { setTheme } from "#lib/theme";

beforeEach(() => {
	setLang("en");
	setTheme("auto");
});

afterEach(() => {
	document.body.innerHTML = "";
	setLang("en");
	setTheme("auto");
	localStorage.clear();
});

const mount = async (compact = false) => {
	const el = document.createElement("app-preferences") as AppPreferences;
	el.compact = compact;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const radio = (el: AppPreferences, name: string, value: string) =>
	el.shadowRoot!.querySelector<HTMLInputElement>(
		`input[name="${name}"][value="${value}"]`,
	)!;

const choose = async (el: AppPreferences, name: string, value: string) => {
	const input = radio(el, name, value);
	input.checked = true;
	input.dispatchEvent(new Event("change", { bubbles: true }));
	await el.updateComplete;
};

test("groups each choice in a fieldset with a legend", async () => {
	const el = await mount();
	const legends = [...el.shadowRoot!.querySelectorAll("fieldset legend")].map(
		(legend) => legend.textContent?.trim(),
	);
	expect(legends).toEqual(["Language", "Theme"]);
});

test("checks the current language and theme", async () => {
	const el = await mount();
	expect(radio(el, "lang", "en").checked).toBe(true);
	expect(radio(el, "lang", "th").checked).toBe(false);
	expect(radio(el, "theme", "auto").checked).toBe(true);
});

test("language options are written in their own language", async () => {
	const el = await mount();
	const th = radio(el, "lang", "th").closest("label")!;
	expect(th.textContent?.trim()).toBe("ไทย");
	expect(th.querySelector("[lang]")?.getAttribute("lang")).toBe("th");
	expect(radio(el, "lang", "en").closest("label")!.textContent).toContain(
		"English",
	);
});

test("choosing Thai switches the language and the page lang", async () => {
	const el = await mount();
	await choose(el, "lang", "th");
	expect(document.documentElement.lang).toBe("th");
	expect(
		el.shadowRoot!.querySelector("fieldset.theme legend")?.textContent?.trim(),
	).toBe("ธีม");
});

test("choosing dark marks the page", async () => {
	const el = await mount();
	await choose(el, "theme", "dark");
	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	expect(radio(el, "theme", "dark").checked).toBe(true);
});

test("theme options show their names as text in the full layout", async () => {
	const el = await mount();
	const labels = ["auto", "light", "dark"].map((value) =>
		radio(el, "theme", value).closest("label")!.textContent?.trim(),
	);
	expect(labels).toEqual(["Auto", "Light", "Dark"]);
});

test("the compact layout keeps the theme names for screen readers", async () => {
	const el = await mount(true);
	const dark = radio(el, "theme", "dark").closest("label")!;
	expect(dark.querySelector(".visually-hidden")?.textContent?.trim()).toBe(
		"Dark",
	);
	expect(dark.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("follows a change event from elsewhere, such as another tab", async () => {
	const el = await mount();
	setLang("th");
	window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: "th" }));
	await el.updateComplete;
	expect(radio(el, "lang", "th").checked).toBe(true);
});

test("two instances stay in step", async () => {
	const header = await mount(true);
	const settings = await mount();
	await choose(settings, "theme", "light");
	await header.updateComplete;
	expect(radio(header, "theme", "light").checked).toBe(true);
	expect(radio(header, "theme", "auto").checked).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components/app-preferences.test.ts`
Expected: FAIL — `Cannot find module '#components/app-preferences'`.

- [ ] **Step 3: Write `src/components/app-preferences.ts`**

```ts
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
	getLang,
	LANGS,
	type Lang,
	LangController,
	type MessageKey,
	setLang,
	t,
} from "#lib/i18n";
import { type IconName, icon } from "#lib/icons";
import {
	getTheme,
	setTheme,
	THEMES,
	type Theme,
	ThemeController,
} from "#lib/theme";
import { uiStyles } from "#styles/ui";

/** Each language named in itself, so a reader of either language can find their own. */
const LANG_NAMES: Record<Lang, { short: string; full: string }> = {
	en: { short: "EN", full: "English" },
	th: { short: "ไทย", full: "ไทย" },
};

const THEME_LABELS: Record<Theme, MessageKey> = {
	auto: "theme.auto",
	light: "theme.light",
	dark: "theme.dark",
};

const THEME_ICONS: Record<Theme, IconName> = {
	auto: "auto",
	light: "sun",
	dark: "moon",
};

/**
 * Language and theme as native radio groups styled as segmented controls. The full layout is
 * two rows of a grouped list (Settings); `compact` is the pair of switches in the wide top bar.
 */
@customElement("app-preferences")
export class AppPreferences extends LitElement {
	static override styles = [
		uiStyles,
		css`
			fieldset {
				margin: 0;
				padding: 0;
				border: 0;
				min-width: 0;
			}

			.row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.625rem 0.875rem 0.625rem 1.125rem;
			}

			.row + .row {
				border-top: 1px solid var(--color-border);
			}

			.row-label {
				font-weight: 600;
				font-size: 1.0625rem;
			}

			.seg {
				flex: none;
			}

			.seg span {
				min-width: 3.5rem;
			}

			:host([compact]) .switches {
				display: flex;
				gap: 0.5rem;
			}

			:host([compact]) .seg span {
				min-width: var(--tap);
				padding: 0 0.625rem;
			}
		`,
	];

	/** The top-bar layout: no visible row labels, icons for the theme. */
	@property({ type: Boolean, reflect: true })
	compact = false;

	protected readonly langController = new LangController(this);
	protected readonly themeController = new ThemeController(this);

	private renderLang() {
		const lang = getLang();
		return html`<fieldset class="lang">
			<legend class="visually-hidden">${t("lang.label")}</legend>
			<div class="seg">
				${LANGS.map(
					(code) => html`<label>
						<input
							type="radio"
							name="lang"
							value=${code}
							.checked=${code === lang}
							@change=${() => setLang(code)}
						/>
						<span lang=${code}>
							${
								LANG_NAMES[code].short === LANG_NAMES[code].full
									? LANG_NAMES[code].full
									: html`<span aria-hidden="true">${LANG_NAMES[code].short}</span><span class="visually-hidden">${LANG_NAMES[code].full}</span>`
							}
						</span>
					</label>`,
				)}
			</div>
		</fieldset>`;
	}

	private renderTheme() {
		const theme = getTheme();
		return html`<fieldset class="theme">
			<legend class="visually-hidden">${t("theme.label")}</legend>
			<div class="seg">
				${THEMES.map(
					(name) => html`<label>
						<input
							type="radio"
							name="theme"
							value=${name}
							.checked=${name === theme}
							@change=${() => setTheme(name)}
						/>
						<span>
							${
								this.compact
									? html`${icon(THEME_ICONS[name], 20)}<span class="visually-hidden">${t(THEME_LABELS[name])}</span>`
									: t(THEME_LABELS[name])
							}
						</span>
					</label>`,
				)}
			</div>
		</fieldset>`;
	}

	override render() {
		if (this.compact)
			return html`<div class="switches">${this.renderLang()}${this.renderTheme()}</div>`;
		return html`<div class="group">
			<div class="row">
				<span class="row-label" aria-hidden="true">${t("lang.label")}</span>
				${this.renderLang()}
			</div>
			<div class="row">
				<span class="row-label" aria-hidden="true">${t("theme.label")}</span>
				${this.renderTheme()}
			</div>
		</div>`;
	}
}
```

Notes for the implementer:
- In the full layout the visible row label is `aria-hidden` because the `legend` carries the same text for screen readers, so the name is not read twice.
- The "English" option shows "EN" visually and "English" to screen readers; "English" contains "En", which keeps WCAG 2.5.3 (label in name) satisfied.
- Radios in two shadow roots never share a group, so `name="lang"` in the header and in Settings do not interfere.

- [ ] **Step 4: Register the element** — `src/types/global.d.ts`: `import type { AppPreferences } from "#components/app-preferences";` and `"app-preferences": AppPreferences;`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/components/app-preferences.test.ts`
Expected: PASS.

- [ ] **Step 6: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): app-preferences, language and theme as segmented radio groups

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `app-header` with skip link, floating tab bar and top bar

**Files:**
- Modify: `src/components/app-header.ts` (whole file), `src/lib/i18n.ts` (add `nav.skip`)
- Test: `tests/components/app-header.test.ts` (whole file)

**Interfaces:**
- Consumes: `icon`, `logo` from `#lib/icons`; `<app-preferences compact>` (Task 5); `t`, `LangController`, `MessageKey` from `#lib/i18n`.
- Produces: `export type Page = "home" | "restaurants" | "tags" | "history" | "settings";` (unchanged); `<app-header current="…">`. Skip link targets `#main` (Task 7 adds `id="main"`).

- [ ] **Step 1: Add the i18n key** — `en`: `"nav.skip": "Skip to content",` after `"nav.label": "Main",`; `th`: `"nav.skip": "ข้ามไปยังเนื้อหา",` after `"nav.label": "เมนูหลัก",`. Keep `nav.tags` (used for the Tags tab title and later the Tags link).

- [ ] **Step 2: Write the failing test** — replace `tests/components/app-header.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-header";
import type { Page } from "#components/app-header";
import { setLang } from "#lib/i18n";
import { setTheme } from "#lib/theme";

beforeEach(() => {
	setLang("en");
	setTheme("auto");
});

afterEach(() => {
	document.body.innerHTML = "";
	setLang("en");
	setTheme("auto");
	localStorage.clear();
});

const mount = async (current?: Page) => {
	const el = document.createElement("app-header");
	if (current) el.current = current;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("starts with a skip link to the main content", async () => {
	const el = await mount();
	const first = el.shadowRoot!.querySelector("a");
	expect(first?.classList.contains("skip")).toBe(true);
	expect(first?.getAttribute("href")).toBe("#main");
	expect(first?.textContent?.trim()).toBe("Skip to content");
});

test("the main nav links the four tabs with visible labels", async () => {
	const el = await mount();
	const nav = el.shadowRoot!.querySelector("nav")!;
	expect(nav.getAttribute("aria-label")).toBe("Main");
	const links = [...nav.querySelectorAll("a")];
	expect(links.map((a) => a.getAttribute("href"))).toEqual([
		"./",
		"./restaurants",
		"./history",
		"./settings",
	]);
	expect(links.map((a) => a.textContent?.trim())).toEqual([
		"Home",
		"Restaurants",
		"History",
		"Settings",
	]);
	for (const a of links)
		expect(a.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("marks the current page", async () => {
	const el = await mount("history");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./history");
});

test("the tags page marks the Restaurants tab and keeps its own title", async () => {
	const el = await mount("tags");
	const current = el.shadowRoot!.querySelectorAll('nav a[aria-current="page"]');
	expect(current).toHaveLength(1);
	expect(current[0]?.getAttribute("href")).toBe("./restaurants");
	expect(document.title).toBe("Tags · What to Eat");
});

test("the brand links home with the app name", async () => {
	const el = await mount();
	const brand = el.shadowRoot!.querySelector<HTMLAnchorElement>("a.brand")!;
	expect(brand.getAttribute("href")).toBe("./");
	expect(brand.textContent?.trim()).toBe("What to Eat");
});

test("carries the compact language and theme switches for wide screens", async () => {
	const el = await mount();
	const prefs = el.shadowRoot!.querySelector("app-preferences");
	expect(prefs).not.toBeNull();
	expect(prefs?.hasAttribute("compact")).toBe(true);
});

test("titles the history page", async () => {
	await mount("history");
	expect(document.title).toBe("History · What to Eat");
});

test("translates labels and the tab title", async () => {
	const el = await mount("restaurants");
	setLang("th");
	await el.updateComplete;
	expect(el.shadowRoot!.querySelector("nav a")?.textContent?.trim()).toBe(
		"หน้าแรก",
	);
	expect(el.shadowRoot!.querySelector("a.skip")?.textContent?.trim()).toBe(
		"ข้ามไปยังเนื้อหา",
	);
	expect(document.title).toBe("ร้านอาหาร · กินอะไรดี");
});

test("the home page title is the app name", async () => {
	await mount("home");
	expect(document.title).toBe("What to Eat");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tests/components/app-header.test.ts`
Expected: FAIL — no `.skip` link, five links instead of four, no `app-preferences`.

- [ ] **Step 4: Replace `src/components/app-header.ts`**

```ts
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "#components/app-preferences";
import { LangController, type MessageKey, t } from "#lib/i18n";
import { type IconName, icon, logo } from "#lib/icons";
import { uiStyles } from "#styles/ui";

export type Page = "home" | "restaurants" | "tags" | "history" | "settings";

type Tab = { page: Page; href: string; label: MessageKey; icon: IconName };

const TABS: readonly Tab[] = [
	{ page: "home", href: "./", label: "nav.home", icon: "dice" },
	{
		page: "restaurants",
		href: "./restaurants",
		label: "nav.restaurants",
		icon: "bowl",
	},
	{ page: "history", href: "./history", label: "nav.history", icon: "clock" },
	{
		page: "settings",
		href: "./settings",
		label: "nav.settings",
		icon: "sliders",
	},
];

/** Browser tab titles; the home page is the app name alone. */
const TITLES: Record<Page, MessageKey | undefined> = {
	home: undefined,
	restaurants: "nav.restaurants",
	tags: "nav.tags",
	history: "nav.history",
	settings: "nav.settings",
};

/** Tags has no tab of its own: it is part of Restaurants. */
const tabOf = (page: Page): Page => (page === "tags" ? "restaurants" : page);

@customElement("app-header")
export class AppHeader extends LitElement {
	static override styles = [
		uiStyles,
		css`
			.skip {
				position: fixed;
				z-index: 30;
				top: 0.5rem;
				left: 0.5rem;
				padding: 0.75rem 1rem;
				border-radius: var(--radius-sm);
				background: var(--color-text);
				color: var(--color-bg);
				font-weight: 600;
				transform: translateY(-200%);
			}

			.skip:focus {
				transform: none;
			}

			/* Phones: no top bar (pages show large titles); the nav floats at the bottom. */
			.brand,
			app-preferences {
				display: none;
			}

			nav {
				position: fixed;
				z-index: 20;
				left: 0.875rem;
				right: 0.875rem;
				bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 0.25rem;
				padding: 0.375rem;
				border: 1px solid var(--color-border);
				border-radius: 1.5rem;
				background: var(--color-surface);
				box-shadow: var(--shadow);
			}

			nav a {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.125rem;
				min-height: 3.5rem;
				border-radius: 1.125rem;
				color: var(--color-muted);
				font-size: 0.75rem;
				font-weight: 600;
				text-decoration: none;
			}

			nav a[aria-current="page"] {
				background: var(--color-accent);
				color: var(--color-accent-text);
			}

			@media (forced-colors: active) {
				nav a[aria-current="page"] {
					outline: 2px solid CanvasText;
				}
			}

			/* From 48rem: one top bar, brand on the left, the links as a rounded group. */
			@media (min-width: 48rem) {
				header {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 0.75rem 1.5rem;
					min-height: 4.75rem;
					padding: 0.5rem 2.5rem;
					background: var(--color-surface);
					border-bottom: 1px solid var(--color-border);
				}

				.brand {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					margin-right: auto;
					color: var(--color-text);
					font-size: 1.375rem;
					font-weight: 700;
					letter-spacing: -0.01em;
					text-decoration: none;
				}

				nav {
					position: static;
					display: flex;
					gap: 0.375rem;
					border-radius: 1.375rem;
					background: var(--color-bg);
					box-shadow: none;
				}

				nav a {
					flex-direction: row;
					gap: 0.5rem;
					min-height: var(--tap);
					padding: 0 1.125rem;
					border-radius: 1rem;
					font-size: 0.9375rem;
				}
			}

			/* From 72rem the language and theme switches fit after the links. */
			@media (min-width: 72rem) {
				app-preferences {
					display: block;
				}
			}
		`,
	];

	@property()
	current: Page = "home";

	protected readonly langController = new LangController(this);

	/** Keep the browser tab title in the current language. */
	override updated(): void {
		const page = TITLES[this.current];
		document.title =
			page === undefined
				? t("app.title")
				: `${t(page)} · ${t("app.title")}`;
	}

	override render() {
		const tab = tabOf(this.current);
		return html`
			<a class="skip" href="#main">${t("nav.skip")}</a>
			<header>
				<a class="brand" href="./">${logo()}<span>${t("app.title")}</span></a>
				<nav aria-label=${t("nav.label")}>
					${TABS.map(
						(link) =>
							html`<a href=${link.href} aria-current=${tab === link.page ? "page" : nothing}>
								${icon(link.icon)}<span>${t(link.label)}</span>
							</a>`,
					)}
				</nav>
				<app-preferences compact></app-preferences>
			</header>
		`;
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/components/app-header.test.ts`
Expected: PASS.

- [ ] **Step 6: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): floating tab bar on phones and a top bar from 48rem

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Page shell — meta tags, `main#main`, no page footer

**Files:**
- Modify: `src/routes/index.html`, `restaurants.html`, `tags.html`, `history.html`, `settings.html`
- Test: `tests/routes/pages.test.ts`

**Interfaces:**
- Consumes: skip link `href="#main"` (Task 6); `--color-bg` light `#fff3dc` and dark `#17130f` (Task 1).
- Produces: every page has `<main id="main" tabindex="-1">`; no `<app-footer>` in any page file (Task 8 renders it inside Settings).

- [ ] **Step 1: Write the failing tests** — in `tests/routes/pages.test.ts` replace the test `"%s loads the app footer after main"` with the tests below (keep every other test):

```ts
test.each(pages)("%s has no page-level footer", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).not.toContain("<app-footer");
	expect(html).not.toContain("components/app-footer.ts");
});

test.each(pages)("%s allows zoom and uses the whole screen", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toContain(
		'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
	);
	expect(html).not.toMatch(/maximum-scale|user-scalable/);
});

test.each(pages)("%s colours the browser bar for both themes", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toContain(
		'<meta name="theme-color" content="#fff3dc" media="(prefers-color-scheme: light)" />',
	);
	expect(html).toContain(
		'<meta name="theme-color" content="#17130f" media="(prefers-color-scheme: dark)" />',
	);
});

test.each(pages)("%s gives the skip link a focusable target", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toContain('<main id="main" tabindex="-1">');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/routes/pages.test.ts`
Expected: FAIL for all five pages on the four new tests.

- [ ] **Step 3: Update the five pages** — run from the worktree root:

```bash
for page in index restaurants tags history settings; do
	file="src/routes/$page.html"
	sed -i '' \
		-e 's#<meta name="viewport" content="width=device-width, initial-scale=1" />#<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\
		<meta name="theme-color" content="\#fff3dc" media="(prefers-color-scheme: light)" />\
		<meta name="theme-color" content="\#17130f" media="(prefers-color-scheme: dark)" />#' \
		-e 's#<main>#<main id="main" tabindex="-1">#' \
		-e '\#components/app-footer.ts#d' \
		-e '\#<app-footer></app-footer>#d' \
		"$file"
done
cat src/routes/index.html
```

Expected `src/routes/index.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="theme-color" content="#fff3dc" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#17130f" media="(prefers-color-scheme: dark)" />
		<title>What to Eat</title>
		<script type="module" src="../lib/gtm.ts"></script>
		<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
		<script type="module" src="../lib/theme.ts"></script>
		<link rel="stylesheet" href="../styles/global.css" />
		<script type="module" src="../components/app-header.ts"></script>
		<script type="module" src="../components/random-picker.ts"></script>
	</head>
	<body>
		<app-header current="home"></app-header>
		<main id="main" tabindex="-1">
			<random-picker></random-picker>
		</main>
	</body>
</html>
```

If `sed` mangles the indentation, edit the files by hand to match the block above (tabs, two levels inside `<head>`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/routes/pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(routes): viewport-fit, theme-color and a skip target on every page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Settings as grouped lists with Appearance and About

**Files:**
- Modify: `src/components/data-transfer.ts` (styles and `render`, `renderReset`, `renderCopied`), `src/components/app-footer.ts` (styles and `render`), `src/lib/i18n.ts` (add `settings.appearance`, `settings.about`)
- Test: `tests/components/data-transfer.test.ts` (append tests), `tests/components/app-footer.test.ts` (append one test)

**Interfaces:**
- Consumes: `<app-preferences>` (Task 5), `icon` (Task 3), `uiStyles` `.group`, `.item`, `.group-label`, `.page-title`, `.lead`, `.grow`, `.trail` (Task 2).
- Produces: Settings markup with sections `section.appearance`, `section.export`, `section.import`, `section.reset`, `section.about`, each headed by `h2.group-label`. Keeps every `data-action`, `.count`, `textarea.paste`, `input[type="file"]`, `.copied`, `.copy-failed`, `.copy-fallback`, `.found`, `.reset-prompt`, `.reset-done`, `.skipped`.

- [ ] **Step 1: Add the i18n keys** — `en` after `"settings.title": "Settings",`: `"settings.appearance": "Appearance",` and `"settings.about": "About",`; `th` after `"settings.title": "ตั้งค่า",`: `"settings.appearance": "การแสดงผล",` and `"settings.about": "เกี่ยวกับ",`.

- [ ] **Step 2: Write the failing tests** — append to `tests/components/data-transfer.test.ts` (it already has `mount`, `$` and `click` helpers):

```ts
test("settings is grouped under Appearance, Export, Import, Reset and About", async () => {
	const el = await mount();
	const headings = [
		...el.shadowRoot!.querySelectorAll("section > h2.group-label"),
	].map((h) => h.textContent?.trim());
	expect(headings).toEqual([
		"Appearance",
		"Export",
		"Import",
		"Reset",
		"About",
	]);
	for (const section of el.shadowRoot!.querySelectorAll("section")) {
		const id = section.getAttribute("aria-labelledby");
		expect(id).not.toBeNull();
		expect(section.querySelector(`#${id}`)?.tagName).toBe("H2");
	}
});

test("the appearance section holds the language and theme switches", async () => {
	const el = await mount();
	const prefs = $(el, "section.appearance app-preferences");
	expect(prefs).not.toBeNull();
	expect(prefs?.hasAttribute("compact")).toBe(false);
});

test("the about section holds the source, changelog and build links", async () => {
	const el = await mount();
	expect($(el, "section.about app-footer")).not.toBeNull();
});

test("export and copy are list rows with their labels and icons", async () => {
	const el = await mount();
	const exportRow = $(el, 'section.export button.item[data-action="export"]');
	expect(exportRow?.textContent).toContain("Download JSON");
	expect(exportRow?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
		"true",
	);
	expect(
		$(el, 'section.export button.item[data-action="copy"]')?.textContent,
	).toContain("Copy JSON");
});

test("the file input is still a real input inside its labelled row", async () => {
	const el = await mount();
	const input = $(el, 'section.import label.item input[type="file"]') as
		| HTMLInputElement
		| null;
	expect(input).not.toBeNull();
	expect(input?.closest("label")?.textContent).toContain("Choose a JSON file");
	expect(input?.disabled).toBe(false);
});

test("paste json opens from its own row and the textarea keeps its name", async () => {
	const el = await mount();
	const details = $(el, "section.import details.paste-row") as
		| HTMLDetailsElement
		| null;
	expect(details?.querySelector("summary")?.textContent).toContain(
		"Or paste JSON",
	);
	expect(
		$(el, "textarea.paste")?.getAttribute("aria-label"),
	).toBe("Or paste JSON");
});

test("the page title is a large title", async () => {
	const el = await mount();
	expect($(el, "h1.page-title")?.textContent?.trim()).toBe("Settings");
});
```

Append to `tests/components/app-footer.test.ts`:

```ts
test("lays the links out as list rows", async () => {
	const el = await mount(SHA, new Date("2026-10-15T08:00:00Z"));
	const rows = [...el.shadowRoot!.querySelectorAll(".group > .item")];
	expect(rows.map((row) => row.getAttribute("data-link") ?? row.tagName)).toEqual([
		"source",
		"changelog",
		"commit",
		"DIV",
	]);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/components/data-transfer.test.ts tests/components/app-footer.test.ts`
Expected: the new tests FAIL (no `section.appearance`, no `.group > .item` rows); the existing tests still PASS.

- [ ] **Step 4: Rewrite the footer as rows** — in `src/components/app-footer.ts`, replace the component's `css` block (keep `uiStyles` first in the array) with:

```ts
		css`
			code {
				font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			}

			.item .trail {
				margin-left: auto;
			}
		`,
```

and replace `render()` and `renderBuilt()` with:

```ts
	private renderBuilt(built: Date) {
		const lang = getLang();
		// dateStyle and timeStyle refuse timeZoneName, and spelling the fields out turns
		// Thai times into "15 นาฬิกา 30 นาที", so the zone is formatted on its own.
		const zone = new Intl.DateTimeFormat(lang, { timeZoneName: "short" })
			.formatToParts(built)
			.find((part) => part.type === "timeZoneName")?.value;
		const time = new Intl.DateTimeFormat(lang, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(built);
		const date = zone === undefined ? time : `${time} ${zone}`;
		return html`<div class="item">
			<span class="lead">${icon("clock", 22)}</span>
			<span class="grow"><span>${t("footer.built")} <time datetime=${built.toISOString()}>${date}</time></span></span>
		</div>`;
	}

	override render() {
		return html`
			<footer class="group">
				<a class="item" data-link="source" href=${REPO_URL} target="_blank" rel="noopener">
					<span class="lead">${icon("code", 22)}</span>
					<span class="grow"><b>${t("footer.source")}</b></span>
					<span class="trail">${icon("chevron", 20)}</span>
				</a>
				<a class="item" data-link="changelog" href=${CHANGELOG_URL} target="_blank" rel="noopener">
					<span class="lead">${icon("list", 22)}</span>
					<span class="grow"><b>${t("footer.changelog")}</b></span>
					<span class="trail">${icon("chevron", 20)}</span>
				</a>
				${
					this.sha === undefined
						? html`<div class="item"><span class="lead">${icon("tag", 22)}</span><span class="grow">${t("footer.dev")}</span></div>`
						: html`<a class="item" data-link="commit" href=${commitUrl(this.sha)} target="_blank" rel="noopener">
								<span class="lead">${icon("tag", 22)}</span>
								<span class="grow"><code>${shortSha(this.sha)}</code></span>
								<span class="trail">${icon("chevron", 20)}</span>
							</a>`
				}
				${this.built === undefined ? nothing : this.renderBuilt(this.built)}
			</footer>
		`;
	}
```

Add `import { icon } from "#lib/icons";` to the imports. The existing footer tests read `a[data-link=…]` text with `.trim()` and the date from `time`; both still match because the icons are SVGs without text.

- [ ] **Step 5: Rewrite the Settings layout** — in `src/components/data-transfer.ts`:

1. Add imports: `import "#components/app-footer";`, `import "#components/app-preferences";`, `import { icon } from "#lib/icons";`.
2. Replace the component `css` block with:

```ts
		css`
			:host {
				display: grid;
				gap: 1.25rem;
				max-width: 40rem;
				margin: 0 auto;
			}

			section {
				display: grid;
				gap: 0.5rem;
			}

			.file input {
				position: absolute;
				width: 1px;
				height: 1px;
				opacity: 0;
			}

			.file:focus-within {
				outline: 3px solid var(--color-focus);
				outline-offset: -3px;
			}

			summary.item {
				cursor: pointer;
				list-style: none;
			}

			summary.item::-webkit-details-marker {
				display: none;
			}

			details[open] summary .trail {
				transform: rotate(90deg);
			}

			.paste-body {
				display: grid;
				gap: 0.625rem;
				padding: 0 1.125rem 1rem;
			}

			textarea {
				font-family: ui-monospace, monospace;
				font-size: 0.875rem;
			}

			.reset-prompt {
				padding: 0 1.125rem;
			}

			.reset-actions {
				padding: 0 1.125rem 1rem;
			}
		`,
```

3. Replace `renderReset()` with:

```ts
	private renderReset() {
		if (this.reset === "confirm")
			return html`
				<div class="group">
					<p class="reset-prompt item" role="alert">${t("settings.resetPrompt", { count: this.count })}</p>
					<div class="actions reset-actions">
						<button type="button" class="danger" data-action="reset-confirm" @click=${this.confirmReset}>
							${t("settings.resetConfirm")}
						</button>
						<button
							type="button"
							data-action="reset-cancel"
							@click=${() => {
								this.reset = undefined;
							}}
						>
							${t("settings.cancel")}
						</button>
					</div>
				</div>
			`;
		return html`
			<div class="group">
				<button
					type="button"
					class="item danger"
					data-action="reset"
					@click=${() => {
						this.reset = "confirm";
					}}
				>
					<span class="lead">${icon("trash", 22)}</span>
					<span class="grow"><b>${t("settings.reset")}</b></span>
				</button>
			</div>
			${
				this.reset === "done"
					? html`<p class="success reset-done" role="status">${t("settings.resetDone")}</p>`
					: nothing
			}
		`;
	}
```

4. Replace `render()` with:

```ts
	override render() {
		return html`
			<h1 class="page-title">${t("settings.title")}</h1>
			${isMemoryOnly() || isHistoryMemoryOnly() || isGroupsMemoryOnly() ? html`<p class="warning" role="alert">${t("storage.warning")}</p>` : nothing}
			${
				this.skipped > 0
					? html`<p class="warning skipped" role="alert">
							${this.skipped === 1 ? t("storage.skipped.one") : t("storage.skipped.other", { count: this.skipped })}
						</p>`
					: nothing
			}
			<section class="appearance" aria-labelledby="appearance-title">
				<h2 id="appearance-title" class="group-label">${t("settings.appearance")}</h2>
				<app-preferences></app-preferences>
			</section>
			<section class="export" aria-labelledby="export-title">
				<h2 id="export-title" class="group-label">${t("settings.exportTitle")}</h2>
				<div class="group">
					<button type="button" class="item" data-action="export" @click=${this.exportData}>
						<span class="lead">${icon("download", 22)}</span>
						<span class="grow">
							<b>${t("settings.export")}</b>
							<small class="count">${t("settings.count", { count: this.count })}</small>
						</span>
					</button>
					<button type="button" class="item" data-action="copy" @click=${this.copyData}>
						<span class="lead">${icon("copy", 22)}</span>
						<span class="grow"><b>${t("settings.copy")}</b></span>
					</button>
				</div>
				${this.renderCopied()}
			</section>
			<section class="import" aria-labelledby="import-title">
				<h2 id="import-title" class="group-label">${t("settings.importTitle")}</h2>
				<div class="group">
					<label class="item file">
						<span class="lead">${icon("upload", 22)}</span>
						<span class="grow"><b>${t("settings.importFile")}</b></span>
						<span class="trail">${icon("chevron", 20)}</span>
						<input type="file" accept="application/json,.json" @change=${this.onFile} />
					</label>
					<details class="paste-row">
						<summary class="item">
							<span class="lead">${icon("copy", 22)}</span>
							<span class="grow"><b>${t("settings.pasteLabel")}</b></span>
							<span class="trail">${icon("chevron", 20)}</span>
						</summary>
						<div class="paste-body">
							<textarea
								class="paste"
								rows="4"
								spellcheck="false"
								aria-label=${t("settings.pasteLabel")}
								.value=${live(this.pasteText)}
								@input=${(event: Event) => {
									this.pasteText = (event.target as HTMLTextAreaElement).value;
								}}
							></textarea>
							<div class="actions">
								<button
									type="button"
									data-action="check-paste"
									?disabled=${this.pasteText.trim() === ""}
									@click=${() => this.readImport(this.pasteText)}
								>
									${t("settings.pasteCheck")}
								</button>
							</div>
						</div>
					</details>
				</div>
				${this.error ? html`<p class="error" role="alert">${t(this.error)}</p>` : nothing}
				${
					this.pending
						? html`
								<p class="found">${t("settings.importFound", { count: this.pending.restaurants.length })}</p>
								<div class="actions">
									<button type="button" class="danger" data-action="replace" @click=${() => this.apply("replace")}>
										${t("settings.replace")}
									</button>
									<button type="button" class="primary" data-action="merge" @click=${() => this.apply("merge")}>
										${t("settings.merge")}
									</button>
									<button
										type="button"
										data-action="cancel-import"
										@click=${() => {
											this.pending = undefined;
										}}
									>
										${t("settings.cancel")}
									</button>
								</div>
							`
						: nothing
				}
				${
					this.imported === undefined
						? nothing
						: html`<p class="success" role="status">${t("settings.imported", { count: this.imported })}</p>`
				}
			</section>
			<section class="reset" aria-labelledby="reset-title">
				<h2 id="reset-title" class="group-label">${t("settings.resetTitle")}</h2>
				${this.renderReset()}
			</section>
			<section class="about" aria-labelledby="about-title">
				<h2 id="about-title" class="group-label">${t("settings.about")}</h2>
				<app-footer></app-footer>
			</section>
		`;
	}
```

`renderCopied()` is unchanged.

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test tests/components/data-transfer.test.ts tests/components/app-footer.test.ts`
Expected: PASS, old and new. If "shows the saved restaurant count" fails, check `.count` still renders only `Restaurants saved: N` (no icon inside `small.count`).

- [ ] **Step 7: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "feat(components): settings as grouped lists with appearance and about

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Docs, preview check and pull request

**Files:**
- Modify: `README.md`, `IDEAS.md`

- [ ] **Step 1: Update `README.md`** — in the first paragraph replace

`The interface is available in English and Thai,\nin a light or dark theme that follows the system setting unless you pick one in the header.`

with

`The interface is available in English and Thai,\nin a light or dark theme that follows the system setting unless you pick one in Settings (on wide screens\nalso in the top bar).`

In the page table change the `/settings` row to `| \`/settings\` | Language and theme; export or import JSON as a file or by copy and paste, with replace or merge; about |`. Run `grep -n "header" README.md` and reword any other sentence that says the language or theme switch is in the header.

- [ ] **Step 2: Update `IDEAS.md`** — delete the whole "## Look and feel" section (its only item, "Rethink the phone header", is done by this redesign).

- [ ] **Step 3: Full checks and commit**

```bash
bun run format && bun run check && bun run test && bun run build
git add -A
git commit -m "docs: language and theme live in settings; drop the phone header idea

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Look at it locally before pushing** — `bun run dev`, open <http://127.0.0.1:3000/settings> at 390 × 844, 1024 × 800 and 1440 × 900, light and dark. Check: the tab bar floats above content and nothing hides behind it; Tab from the address bar shows "Skip to content" first; focus ring visible on every control; the theme switches appear only at 1440; Home, Restaurants, Tags and History still work (they keep their old layouts until stages 2–4 but use the new colours).

- [ ] **Step 5: Push and open the pull request** (per the `shipping-a-change` skill; use the personal `GH_TOKEN` for `kamontat`)

```bash
git push -u origin HEAD
gh pr create --base main \
  --title "feat: mobile redesign stage 1 — palette, font, tab bar, settings" \
  --body "$(cat <<'EOF'
## Summary
- New palette (paper, ink, chili red, sign yellow) with contrast rules tested in light and dark; Anuphan font inlined in the CSS bundle
- Shared styles: 44px targets, 3px focus ring, grouped lists, segmented controls
- Floating tab bar on phones (Home, Restaurants, History, Settings), top bar from 48rem, language and theme switches in the top bar from 72rem
- Skip link, `viewport-fit=cover`, `theme-color`, safe-area padding, reduced motion
- New `app-sheet` (dialog bottom sheet) and `app-preferences` components for the next stages
- Settings as grouped lists with Appearance and About; footer moved into Settings
- Spec and stage 1 plan for the whole redesign

## Test plan
- [x] `bun run check`
- [x] `bun run test`
- [x] `bun run build`
- [ ] Preview at 390px: tab bar floats, nothing hidden behind it, safe area on a notched phone
- [ ] Preview at 1024px: top bar with four links, no switches; 1440px: switches shown
- [ ] Keyboard: skip link first, focus ring on every control, segmented radios move with arrow keys
- [ ] VoiceOver (iOS Safari): tab names, current tab, Language and Theme groups announced
- [ ] Light and dark; Thai; 200% zoom; 320px width
- [ ] Home, Restaurants, Tags, History still usable with the new colours

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```

Report the preview URL from `.github/workflows/deploy-preview.yml` (`environment.url` with the PR number) only after the `deploy` check passes.

---

## Self-review notes

- Spec coverage for stage 1: tokens and contrast rules (Task 1), font (Task 1), `uiStyles` (Task 2), icons (Task 3), `app-sheet` (Task 4), language and theme in Settings and the top bar from 72 rem (Tasks 5, 6, 8), skip link and tab bar (Task 6), page meta and `main#main` (Task 7), Settings and About (Task 8), README and IDEAS (Task 9). `forced-colors` handled in `uiStyles` (segmented) and the header (current tab). `scroll-padding-bottom` set on `:root` (Task 1).
- Later stages (Home, Restaurants, Tags and History, installable) get their own plans built on these interfaces: `app-sheet` (`heading`, `subheading`, `open`, `sheet-close`), `icon()`, `.group`/`.item`/`.group-label`/`.page-title`, `button.accent`/`button.primary`/`button.danger`.
