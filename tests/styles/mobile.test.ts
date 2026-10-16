import { expect, test } from "bun:test";
import "#components/app-header";
import "#components/random-picker";
import { AppHeader } from "#components/app-header";
import { RandomPicker } from "#components/random-picker";
import { uiStyles } from "#styles/ui";

const css = await Bun.file("src/styles/global.css").text();

const flatten = (styles: unknown): string =>
	[styles]
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

/** The first `{ ... }` block that follows `marker`. */
const block = (source: string, marker: string): string => {
	const start = source.indexOf(marker);
	if (start === -1) throw new Error(`no ${marker}`);
	return source.slice(
		start,
		source.indexOf("}", source.indexOf("{", start) + 1) + 1,
	);
};

test("the page is as tall as the visible screen, not iOS's toolbar-hidden 100vh", () => {
	expect(block(css, "body {")).toContain("min-height: 100vh;");
	expect(css).toMatch(
		/@supports \(min-height: 100dvh\)\s*\{\s*body\s*\{\s*min-height:\s*100dvh;/,
	);
});

test("the tab bar has one exact height and the page reserves only a little more", () => {
	const root = block(css, ":root {");
	expect(root).toContain(
		"--tab-bar-height: calc(3.75rem + env(safe-area-inset-bottom, 0px));",
	);
	expect(root).toContain(
		"--tab-bar-space: calc(var(--tab-bar-height) + 0.5rem);",
	);
	const wide = css.slice(css.indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(/--tab-bar-height:\s*0px;/);
});

test("the phone tab bar is exactly that height", () => {
	const nav = block(flatten(AppHeader.styles), "nav {");
	expect(nav).toContain("height: var(--tab-bar-height)");
	expect(nav).toContain("box-sizing: border-box");
});

test("the wide top bar nav sizes to its links, not the 0px phone tab bar height", () => {
	const header = flatten(AppHeader.styles);
	const wide = header.slice(header.indexOf("@media (min-width: 48rem)"));
	expect(block(wide, "nav {")).toContain("height: auto");
});

test("the pinned pick button sits right on the tab bar", () => {
	// Only the component's own styles: the shared uiStyles come first and have their own :host.
	const picker = flatten((RandomPicker.styles as unknown[]).slice(1));
	expect(block(picker, ".pinned {")).toContain("bottom: var(--tab-bar-height)");
	expect(block(picker, ":host {")).toContain(
		"min-height: calc(100dvh - 1.25rem - var(--tab-bar-height))",
	);
	expect(block(picker, ":host {")).toContain(
		"margin-bottom: calc(var(--tab-bar-height) - var(--tab-bar-space))",
	);
});

test("a quick second tap never zooms the page, but pinch zoom still works", () => {
	expect(block(css, "html {")).toContain("touch-action: manipulation");
	expect(block(uiStyles.cssText, "button {")).toContain(
		"touch-action: manipulation",
	);
	expect(css).not.toMatch(/touch-action:\s*none/);
});
