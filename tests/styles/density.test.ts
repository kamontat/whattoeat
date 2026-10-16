import { expect, test } from "bun:test";
import "#components/app-header";
import "#components/app-preferences";
import { AppHeader } from "#components/app-header";
import { AppPreferences } from "#components/app-preferences";
import { uiStyles } from "#styles/ui";

const css = await Bun.file("src/styles/global.css").text();

/** Custom properties declared in the first block that follows `marker`. */
const block = (marker: string): string => {
	const start = css.indexOf(marker);
	if (start === -1) throw new Error(`no ${marker} in global.css`);
	return css.slice(start, css.indexOf("}", css.indexOf("{", start) + 1) + 1);
};

const value = (source: string, name: string): string | undefined =>
	source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();

const flatten = (styles: unknown): string =>
	[styles]
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

const MOUSE = "@media (hover: hover) and (pointer: fine)";

const TOUCH = {
	tap: "2.75rem",
	"pad-x": "1.125rem",
	"row-pad-y": "0.625rem",
	"title-size": "2rem",
	"row-text": "1.0625rem",
	"seg-min": "3.5rem",
	"bar-height": "4.75rem",
	"brand-size": "1.375rem",
} as const;

const COMPACT = {
	tap: "2.25rem",
	"pad-x": "0.875rem",
	"row-pad-y": "0.375rem",
	"title-size": "1.625rem",
	"row-text": "0.9375rem",
	"seg-min": "2.75rem",
	"bar-height": "3.75rem",
	"brand-size": "1.125rem",
} as const;

test.each(Object.entries(TOUCH))("touch size %s is %s", (name, size) => {
	expect(value(block(":root {"), name)).toBe(size);
});

test.each(Object.entries(COMPACT))(
	"a mouse or trackpad makes %s %s",
	(name, size) => {
		expect(value(block(MOUSE), name)).toBe(size);
	},
);

test("the compact tap size still clears WCAG 2.5.8 (24px)", () => {
	expect(Number.parseFloat(COMPACT.tap) * 16).toBeGreaterThanOrEqual(24);
});

test("shared styles size rows, buttons, titles and segments from the tokens", () => {
	const ui = uiStyles.cssText;
	expect(ui).toMatch(/\.page-title\s*\{[^}]*font-size:\s*var\(--title-size\)/);
	expect(ui).toMatch(/button\s*\{[^}]*padding:\s*0 var\(--pad-x\)/);
	expect(ui).toMatch(
		/\.item\s*\{[^}]*padding:\s*var\(--row-pad-y\) 0\.875rem var\(--row-pad-y\) var\(--pad-x\)/,
	);
	expect(ui).toMatch(/\.item b\s*\{[^}]*font-size:\s*var\(--row-text\)/);
	expect(ui).toMatch(/\.card\s*\{[^}]*padding:\s*var\(--pad-x\)/);
});

test("the header sizes its top bar, brand and links from the tokens", () => {
	const header = flatten(AppHeader.styles);
	expect(header).toContain("min-height: var(--bar-height)");
	expect(header).toContain("font-size: var(--brand-size)");
	expect(header).toContain("padding: 0 var(--pad-x)");
});

test("the preferences rows and segments size from the tokens", () => {
	const prefs = flatten(AppPreferences.styles);
	expect(prefs).toContain(
		"padding: var(--row-pad-y) 0.875rem var(--row-pad-y) var(--pad-x)",
	);
	expect(prefs).toContain("min-width: var(--seg-min)");
	expect(prefs).toContain("font-size: var(--row-text)");
});
