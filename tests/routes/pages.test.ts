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
