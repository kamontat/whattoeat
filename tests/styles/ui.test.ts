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
			new RegExp(
				`(?:^|[\\s,}])${selector.replace(".", "\\.")}[^{]*\\{([^}]*)\\}`,
			),
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
