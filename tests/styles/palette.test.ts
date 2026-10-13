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
	"text",
	"muted",
	"primary",
	"primary-text",
	"border",
	"danger",
	"success",
];

/** Foreground on background pairs that carry normal-size text. */
const PAIRS: [string, string][] = [
	["text", "bg"],
	["text", "surface"],
	["muted", "bg"],
	["muted", "surface"],
	["primary", "bg"],
	["primary", "surface"],
	["primary-text", "primary"],
	["danger", "bg"],
	["danger", "surface"],
	["success", "bg"],
	["success", "surface"],
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
	test.each(PAIRS)(`${name}: %s on %s meets WCAG AA (4.5:1)`, (fg, bg) => {
		expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5);
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
