/**
 * Writes `<out>/sw.js` (default `dist/sw.js`) from `src/sw.ts`, with every built file's path to
 * cache and a version hashed from their names and contents. Runs after `bun-server build` in
 * the `build` script, so it sees the finished output.
 */

import { join } from "node:path";
import { Glob } from "bun";
import { precacheUrls } from "#lib/precache";

const OUT = process.argv[2] ?? "dist";

const files = Array.from(new Glob("**/*").scanSync({ cwd: OUT }))
	.filter((file) => !file.endsWith(".map") && file !== "sw.js")
	.sort();

const hasher = new Bun.CryptoHasher("sha256");
for (const file of files) {
	hasher.update(file);
	hasher.update(await Bun.file(join(OUT, file)).bytes());
}
const version = hasher.digest("hex").slice(0, 12);
const urls = precacheUrls(files);

const result = await Bun.build({
	entrypoints: ["src/sw.ts"],
	target: "browser",
	minify: true,
	define: { PRECACHE: JSON.stringify(urls), VERSION: JSON.stringify(version) },
});
const [output] = result.outputs;
if (!result.success || output === undefined) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

await Bun.write(join(OUT, "sw.js"), await output.text());
console.log(
	`service-worker: ${join(OUT, "sw.js")} caches ${urls.length} files as version ${version}`,
);
