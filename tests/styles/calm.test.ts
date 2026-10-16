import { expect, test } from "bun:test";
import { Glob } from "bun";
import "#components/app-header";
import { AppHeader } from "#components/app-header";
import { uiStyles } from "#styles/ui";

const flatten = (styles: unknown): string =>
	[styles]
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

const ui = uiStyles.cssText;
const header = flatten(AppHeader.styles);

test("nothing uses the retired yellow accent", async () => {
	const files = [...new Glob("src/**/*.{ts,css}").scanSync()];
	for (const file of files)
		expect(await Bun.file(file).text(), file).not.toContain("--color-accent");
});

test("lists and cards are white with a hairline border, not shadows", () => {
	expect(ui).toMatch(
		/\.group\s*\{[^}]*border:\s*1px solid var\(--color-border\)/,
	);
	expect(ui).toMatch(
		/\.card\s*\{[^}]*border:\s*1px solid var\(--color-border\)/,
	);
	expect(ui).not.toMatch(/\.group\s*\{[^}]*box-shadow/);
});

test("group labels are sentence case and row text is medium weight", () => {
	expect(ui).not.toContain("text-transform: uppercase");
	expect(ui).toMatch(/\.item b\s*\{[^}]*font-weight:\s*500/);
});

test("the checked segment is a raised light face with a visible edge, not solid ink", () => {
	const checked =
		ui.match(/\.seg input:checked \+ span\s*\{([^}]*)\}/)?.[1] ?? "";
	expect(checked).toContain("background: var(--color-surface)");
	expect(checked).toContain("var(--color-muted)");
	expect(checked).not.toContain("background: var(--color-text)");
});

test("buttons have rounded corners, not pills, and a soft variant for secondary actions", () => {
	expect(ui).toMatch(/button\s*\{[^}]*border-radius:\s*var\(--radius-sm\)/);
	expect(ui).toMatch(
		/button\.soft\s*\{[^}]*background:\s*var\(--color-primary-soft\)[^}]*color:\s*var\(--color-link\)/,
	);
});

test("the phone tab bar is attached to the bottom edge and marks the current tab in red", () => {
	expect(header).toMatch(
		/nav\s*\{[^}]*left:\s*0;[^}]*right:\s*0;[^}]*bottom:\s*0;/,
	);
	expect(header).toMatch(
		/nav a\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--color-primary\)/,
	);
	expect(header).toMatch(/nav a\[aria-current="page"\]::before\s*\{/);
});
