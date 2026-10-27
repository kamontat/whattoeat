import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir = "";

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true });
	dir = "";
});

/** A fake build output: two pages, a hashed chunk and its map, and a preset file. */
const fakeDist = async (preset = "{}") => {
	dir = await mkdtemp(join(tmpdir(), "whattoeat-sw-"));
	await Bun.write(join(dir, "index.html"), "<p>home</p>");
	await Bun.write(join(dir, "settings/tags.html"), "<p>tags</p>");
	await Bun.write(join(dir, "chunk-0qjgjvjg.js"), "console.log(1)");
	await Bun.write(join(dir, "chunk-0qjgjvjg.js.map"), "{}");
	await Bun.write(join(dir, "data/presets/index.json"), preset);
	return dir;
};

const run = async (out: string) => {
	const proc = Bun.spawn(["bun", "scripts/service-worker.ts", out], {
		stdout: "pipe",
		stderr: "pipe",
	});
	expect(await proc.exited, await new Response(proc.stderr).text()).toBe(0);
	return Bun.file(join(out, "sw.js")).text();
};

const version = (worker: string) => worker.match(/"([0-9a-f]{12})"/)?.[1];

test("writes sw.js listing every build file except source maps", async () => {
	const worker = await run(await fakeDist());
	for (const url of [
		'"/"',
		'"/settings/tags"',
		'"/chunk-0qjgjvjg.js"',
		'"/data/presets/index.json"',
	])
		expect(worker).toContain(url);
	expect(worker).not.toContain("chunk-0qjgjvjg.js.map");
	expect(worker).not.toContain("PRECACHE");
	expect(version(worker)).toBeDefined();
});

test("gives a build with different files a different cache version", async () => {
	const first = version(await run(await fakeDist("{}")));
	await rm(dir, { recursive: true, force: true });
	const same = version(await run(await fakeDist("{}")));
	await rm(dir, { recursive: true, force: true });
	const changed = version(await run(await fakeDist('{"presets":[]}')));
	expect(same).toBe(first);
	expect(changed).not.toBe(first);
});

test("the build script writes the service worker after bundling", async () => {
	const pkg = (await Bun.file("package.json").json()) as {
		scripts: Record<string, string>;
	};
	expect(pkg.scripts["build"]).toEndWith(
		"src/routes && bun scripts/service-worker.ts",
	);
	expect(pkg.scripts["dev"]).not.toContain("service-worker");
});
