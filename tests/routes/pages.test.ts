import { expect, test } from "bun:test";
import { Glob } from "bun";

const pages = Array.from(new Glob("**/*.html").scanSync({ cwd: "src/routes" }));
const WIDE_PAGES = ["index.html", "restaurants.html", "settings/tags.html"];
const PINNED_PAGES = [
	"index.html",
	"restaurants.html",
	"settings/presets.html",
];

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
		'<meta name="theme-color" content="#f6f5f2" media="(prefers-color-scheme: light)" />',
	);
	expect(html).toContain(
		'<meta name="theme-color" content="#161513" media="(prefers-color-scheme: dark)" />',
	);
});

test.each(pages)("%s gives the skip link a focusable target", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	expect(html).toMatch(/<main id="main" tabindex="-1"( class="wide")?>/);
});

test("home and restaurants use the wide main; other pages keep the narrow one", async () => {
	for (const page of pages) {
		const html = await Bun.file(`src/routes/${page}`).text();
		expect(html.includes('<main id="main" tabindex="-1" class="wide">')).toBe(
			WIDE_PAGES.includes(page),
		);
	}
	const css = await Bun.file("src/styles/global.css").text();
	expect(css).toMatch(
		/@media \(min-width: 48rem\)\s*\{[\s\S]*?main\.wide\s*\{[^}]*max-width:\s*65rem/,
	);
});

test.each(pages)("%s links the site icon", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	const match = html.match(
		/<link rel="icon" type="image\/svg\+xml" href="((?:\.\.\/)+assets\/favicon\.svg)" \/>/,
	);
	expect(match).not.toBeNull();
	expect(
		await Bun.file(
			new URL(match![1]!, `file://${process.cwd()}/src/routes/${page}`),
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

test("home, restaurants and settings/presets opt into room for their pinned areas; other pages do not", async () => {
	for (const page of pages) {
		const html = await Bun.file(`src/routes/${page}`).text();
		const tag = html.match(/<html[^>]*>/)?.[0];
		expect(tag).not.toBeUndefined();
		expect(tag?.includes('class="has-pinned"')).toBe(
			PINNED_PAGES.includes(page),
		);
	}
});

test.each(pages)(
	"%s links the web app manifest and the home screen icon",
	async (page) => {
		const html = await Bun.file(`src/routes/${page}`).text();
		expect(html).toMatch(
			/<link rel="manifest" href="(\.\.\/)+assets\/manifest\.webmanifest" \/>/,
		);
		expect(html).toMatch(
			/<link rel="apple-touch-icon" href="(\.\.\/)+assets\/icons\/icon-180\.png" \/>/,
		);
	},
);

test.each(pages)(
	"%s opens full screen from the home screen with a short title",
	async (page) => {
		const html = await Bun.file(`src/routes/${page}`).text();
		expect(html).toContain(
			'<meta name="mobile-web-app-capable" content="yes" />',
		);
		expect(html).toContain(
			'<meta name="apple-mobile-web-app-capable" content="yes" />',
		);
		expect(html).toContain(
			'<meta name="apple-mobile-web-app-title" content="What to Eat" />',
		);
	},
);

test.each([
	"settings/presets.html",
	"settings/tags.html",
	"settings/profiles.html",
])("%s links its assets one folder deeper", async (page) => {
	const html = await Bun.file(`src/routes/${page}`).text();
	const links = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g)).map(
		(match) => match[1]!,
	);
	expect(links.length).toBeGreaterThan(0);
	for (const link of links) {
		if (link === "#main") continue;
		expect(link.startsWith("../../")).toBe(true);
	}
});

test("the tags page lives under settings and points its links one folder up", async () => {
	expect(await Bun.file("src/routes/tags.html").exists()).toBe(false);
	const html = await Bun.file("src/routes/settings/tags.html").text();
	expect(html).toContain('<app-header current="tags" base="../"></app-header>');
	expect(html).toContain('<tag-manager base="../"></tag-manager>');
});
