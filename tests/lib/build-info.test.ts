import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type BuildInfo,
	CHANGELOG_URL,
	commitUrl,
	parseBuildDate,
	pullUrl,
	REPO_URL,
	readBuildInfo,
	shortSha,
} from "#lib/build-info";

const SHA = "0123456789abcdef0123456789abcdef01234567";

afterEach(() => {
	delete process.env.BUN_PUBLIC_COMMIT_SHA;
	delete process.env.BUN_PUBLIC_BUILD_DATE;
	delete process.env.BUN_PUBLIC_BRANCH;
	delete process.env.BUN_PUBLIC_PR_NUMBER;
	delete process.env.BUN_PUBLIC_ENVIRONMENT;
});

test("points at the GitHub repository and its changelog", () => {
	expect(REPO_URL).toBe("https://github.com/kamontat/whattoeat");
	expect(CHANGELOG_URL).toBe(
		"https://github.com/kamontat/whattoeat/blob/main/CHANGELOG.md",
	);
});

test("links a commit by its full sha", () => {
	expect(commitUrl(SHA)).toBe(
		`https://github.com/kamontat/whattoeat/commit/${SHA}`,
	);
});

test("links a pull request by its number", () => {
	expect(pullUrl(34)).toBe("https://github.com/kamontat/whattoeat/pull/34");
});

test("shortens a sha to seven characters", () => {
	expect(shortSha(SHA)).toBe("0123456");
});

test("parses an ISO build date and rejects anything else", () => {
	expect(parseBuildDate("2026-10-13T08:30:00Z")?.toISOString()).toBe(
		"2026-10-13T08:30:00.000Z",
	);
	expect(parseBuildDate("not a date")).toBeUndefined();
	expect(parseBuildDate("")).toBeUndefined();
	expect(parseBuildDate(undefined)).toBeUndefined();
});

test("reads nothing when the build inlined no values", () => {
	expect(readBuildInfo()).toEqual({
		environment: "development",
		sha: undefined,
		date: undefined,
		branch: undefined,
		pr: undefined,
	});
});

test("reads a well-formed sha and date", () => {
	process.env.BUN_PUBLIC_COMMIT_SHA = SHA;
	process.env.BUN_PUBLIC_BUILD_DATE = "2026-10-13T08:30:00Z";
	const info = readBuildInfo();
	expect(info.sha).toBe(SHA);
	expect(info.date?.toISOString()).toBe("2026-10-13T08:30:00.000Z");
});

test("reads the production and preview environments the deploys set", () => {
	for (const environment of ["production", "preview"] as const) {
		process.env.BUN_PUBLIC_ENVIRONMENT = environment;
		expect(readBuildInfo().environment).toBe(environment);
	}
});

test("calls a build local when no deploy named its environment", () => {
	process.env.BUN_PUBLIC_BUILD_DATE = "2026-10-13T08:30:00Z";
	for (const environment of [undefined, "", "staging"]) {
		if (environment === undefined) delete process.env.BUN_PUBLIC_ENVIRONMENT;
		else process.env.BUN_PUBLIC_ENVIRONMENT = environment;
		expect(readBuildInfo().environment).toBe("local");
	}
});

test("ignores a malformed sha", () => {
	process.env.BUN_PUBLIC_COMMIT_SHA = "not-a-sha";
	expect(readBuildInfo().sha).toBeUndefined();
});

test("reads the branch a preview was built from", () => {
	process.env.BUN_PUBLIC_BRANCH = "worktree-foo";
	expect(readBuildInfo().branch).toBe("worktree-foo");
});

test("reads the pull request number of a preview", () => {
	process.env.BUN_PUBLIC_PR_NUMBER = "34";
	expect(readBuildInfo().pr).toBe(34);
});

test("ignores a malformed pull request number", () => {
	for (const value of ["", "abc", "0", "-1", "3.5"]) {
		process.env.BUN_PUBLIC_PR_NUMBER = value;
		expect(readBuildInfo().pr).toBeUndefined();
	}
});

test("ignores an empty branch", () => {
	process.env.BUN_PUBLIC_BRANCH = "  ";
	expect(readBuildInfo().branch).toBeUndefined();
});

/**
 * Bundles `readBuildInfo` the way a deploy does, with only the given variables set, and runs it
 * without `process`, as a browser would. The bundler reads the environment once at startup, so
 * the build runs in its own process.
 */
const readBundled = (env: Record<string, string>): BuildInfo | undefined => {
	const dir = mkdtempSync(join(tmpdir(), "build-info-"));
	const entry = join(dir, "entry.ts");
	const source = join(import.meta.dir, "../../src/lib/build-info.ts");
	writeFileSync(
		entry,
		`import { readBuildInfo } from ${JSON.stringify(source)};\nglobalThis.__buildInfo = readBuildInfo();\n`,
	);
	try {
		const build = Bun.spawnSync(
			[
				process.execPath,
				"build",
				entry,
				"--target=browser",
				"--format=iife",
				"--env=BUN_PUBLIC_*",
			],
			{ env: { PATH: process.env["PATH"], ...env } },
		);
		expect(build.exitCode).toBe(0);
		const scope: { __buildInfo?: BuildInfo } = {};
		new Function("process", "globalThis", build.stdout.toString())(
			undefined,
			scope,
		);
		return scope.__buildInfo;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

test("keeps the sha and date when a production build leaves branch and pull request unset", () => {
	const info = readBundled({
		BUN_PUBLIC_ENVIRONMENT: "production",
		BUN_PUBLIC_COMMIT_SHA: SHA,
		BUN_PUBLIC_BUILD_DATE: "2026-10-13T08:30:00Z",
	});
	expect(info?.environment).toBe("production");
	expect(info?.sha).toBe(SHA);
	expect(info?.date?.toISOString()).toBe("2026-10-13T08:30:00.000Z");
	expect(info?.branch).toBeUndefined();
	expect(info?.pr).toBeUndefined();
});

test("calls a build with only a build date local", () => {
	const info = readBundled({ BUN_PUBLIC_BUILD_DATE: "2026-10-13T08:30:00Z" });
	expect(info?.environment).toBe("local");
	expect(info?.sha).toBeUndefined();
	expect(info?.date?.toISOString()).toBe("2026-10-13T08:30:00.000Z");
});

test("calls a bundle with nothing inlined development", () => {
	expect(readBundled({})).toEqual({
		environment: "development",
		sha: undefined,
		date: undefined,
		branch: undefined,
		pr: undefined,
	});
});
