import { expect, test } from "bun:test";

const css = await Bun.file("src/styles/global.css").text();

/** The first `{ ... }` block that follows `marker`. */
const block = (marker: string): string => {
	const start = css.indexOf(marker);
	if (start === -1) throw new Error(`no ${marker} in global.css`);
	return css.slice(start, css.indexOf("}", css.indexOf("{", start) + 1) + 1);
};

test("the light :root reserves no room for a pinned action by default", () => {
	expect(block(":root {")).toMatch(/--pinned-space:\s*0px;/);
});

test("scroll-padding-bottom covers the tab bar and any pinned action together", () => {
	expect(block(":root {")).toContain(
		"scroll-padding-bottom: calc(var(--tab-bar-space) + var(--pinned-space));",
	);
});

test("a page opts in to pinned-action room with html.has-pinned", () => {
	expect(css).toMatch(
		/:root\.has-pinned\s*\{\s*--pinned-space:\s*4\.5rem;\s*\}/,
	);
});

test("wide screens have no pinned bar, so html.has-pinned resets the space", () => {
	const wide = css.slice(css.indexOf("@media (min-width: 48rem)"));
	expect(wide).toMatch(/:root\.has-pinned\s*\{\s*--pinned-space:\s*0px;\s*\}/);
});
