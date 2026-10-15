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

// Components not yet redesigned keep their own layouts; none of them may use a class name
// from the shared grouped-list or segmented-control styles, or it picks up that look too.
const LEGACY_COMPONENTS = [
	"random-picker.ts",
	"restaurant-manager.ts",
	"tag-manager.ts",
	"visit-history.ts",
	"tag-input.ts",
	"restaurant-chips.ts",
];
const RESERVED_CLASSES = [
	"group",
	"item",
	"seg",
	"group-label",
	"lead",
	"trail",
	"grow",
];

test("not-yet-redesigned components never use a class name reserved by the shared grouped-list or segmented-control styles", async () => {
	for (const file of LEGACY_COMPONENTS) {
		const source = await Bun.file(`src/components/${file}`).text();
		for (const match of source.matchAll(/class="([^"]*)"/g)) {
			const tokens = match[1]!.split(/\s+/).filter(Boolean);
			for (const reserved of RESERVED_CLASSES) {
				expect(
					tokens,
					`${file}: class="${match[1]}" should not use the reserved class "${reserved}"`,
				).not.toContain(reserved);
			}
		}
	}
});
