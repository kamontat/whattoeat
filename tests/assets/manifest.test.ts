import { expect, test } from "bun:test";

type Icon = { src: string; sizes: string; type: string; purpose?: string };
const manifest = (await Bun.file("src/assets/manifest.webmanifest").json()) as {
	name: string;
	short_name: string;
	start_url: string;
	scope: string;
	id: string;
	display: string;
	theme_color: string;
	background_color: string;
	icons: Icon[];
};

/** Width and height from a PNG's IHDR chunk. */
const pngSize = async (path: string) => {
	const bytes = new DataView(await Bun.file(path).arrayBuffer());
	return [bytes.getUint32(16), bytes.getUint32(20)];
};

test("names the app as the pages do and opens standalone at the home page", () => {
	expect(manifest.name).toBe("What to Eat");
	expect(manifest.short_name).toBe("What to Eat");
	expect(manifest.start_url).toBe("./");
	expect(manifest.scope).toBe("./");
	expect(manifest.id).toBe("./");
	expect(manifest.display).toBe("standalone");
});

test("uses the light page colour, matching the theme-color meta", () => {
	expect(manifest.theme_color).toBe("#f6f5f2");
	expect(manifest.background_color).toBe("#f6f5f2");
});

test("offers an SVG icon, 192 and 512 PNGs, and a maskable 512", () => {
	expect(manifest.icons).toEqual([
		{ src: "./icons/icon.svg", sizes: "any", type: "image/svg+xml" },
		{ src: "./icons/icon-192.png", sizes: "192x192", type: "image/png" },
		{ src: "./icons/icon-512.png", sizes: "512x512", type: "image/png" },
		{
			src: "./icons/icon-512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "maskable",
		},
	]);
});

test("every icon file exists and each PNG is the size it claims", async () => {
	for (const icon of manifest.icons) {
		const path = `src/assets/${icon.src.slice(2)}`;
		expect(await Bun.file(path).exists(), path).toBe(true);
		if (icon.type === "image/png") {
			const [width, height] = await pngSize(path);
			expect(`${width}x${height}`, path).toBe(icon.sizes);
		}
	}
	expect(await pngSize("src/assets/icons/icon-180.png")).toEqual([180, 180]);
});

test("the build ships the icons folder beside the manifest, in dev and build", async () => {
	const pkg = (await Bun.file("package.json").json()) as {
		scripts: Record<string, string>;
	};
	for (const script of ["dev", "build"])
		expect(pkg.scripts[script], script).toContain(
			"--statics src/assets/icons:icons",
		);
});
