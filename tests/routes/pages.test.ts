import { expect, test } from "bun:test";
import { Glob } from "bun";

const pages = Array.from(new Glob("**/*.html").scanSync({ cwd: "src/routes" }));

test("src/routes has at least one page", () => {
	expect(pages.length).toBeGreaterThan(0);
});

test.each(pages)("%s loads lib/gtm.ts", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toMatch(
		/<script type="module" src="(\.\.\/)+lib\/gtm\.ts"><\/script>/,
	);
});

test.each(pages)(
	"%s loads the global stylesheet and the app header",
	async (page) => {
		const html = await Bun.file(`src/routes/${page}`).text();
		expect(html).toMatch(
			/<link rel="stylesheet" href="(\.\.\/)+styles\/global\.css" \/>/,
		);
		expect(html).toMatch(
			/<script type="module" src="(\.\.\/)+components\/app-header\.ts"><\/script>/,
		);
		expect(html).toContain("<app-header");
	},
);

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

test.each(pages)("%s links the site icon", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	const match = html.match(
		/<link rel="icon" type="image\/svg\+xml" href="((?:\.\.\/)+assets\/favicon\.svg)" \/>/,
	);
	expect(match).not.toBeNull();
	expect(
		await Bun.file(
			new URL(match![1]!, `file://${process.cwd()}/src/routes/`),
		).exists(),
	).toBe(true);
});

test.each(pages)(
	"%s loads lib/theme.ts before the stylesheet",
	async (page) => {
		const html = await Bun.file(`src/routes/${page}`).text();
		const theme = html.search(
			/<script type="module" src="(\.\.\/)+lib\/theme\.ts"><\/script>/,
		);
		expect(theme).toBeGreaterThan(-1);
		expect(theme).toBeLessThan(html.indexOf('<link rel="stylesheet"'));
	},
);
