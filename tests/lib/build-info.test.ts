import { afterEach, expect, test } from "bun:test";
import {
	branchUrl,
	CHANGELOG_URL,
	commitUrl,
	parseBuildDate,
	REPO_URL,
	readBuildInfo,
	shortSha,
} from "#lib/build-info";

const SHA = "0123456789abcdef0123456789abcdef01234567";

afterEach(() => {
	delete process.env.BUN_PUBLIC_COMMIT_SHA;
	delete process.env.BUN_PUBLIC_BUILD_DATE;
	delete process.env.BUN_PUBLIC_BRANCH;
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

test("links a branch by its name, keeping slashes", () => {
	expect(branchUrl("worktree-foo")).toBe(
		"https://github.com/kamontat/whattoeat/tree/worktree-foo",
	);
	expect(branchUrl("feat/a#b")).toBe(
		"https://github.com/kamontat/whattoeat/tree/feat/a%23b",
	);
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
		sha: undefined,
		date: undefined,
		branch: undefined,
	});
});

test("reads a well-formed sha and date", () => {
	process.env.BUN_PUBLIC_COMMIT_SHA = SHA;
	process.env.BUN_PUBLIC_BUILD_DATE = "2026-10-13T08:30:00Z";
	const info = readBuildInfo();
	expect(info.sha).toBe(SHA);
	expect(info.date?.toISOString()).toBe("2026-10-13T08:30:00.000Z");
});

test("ignores a malformed sha", () => {
	process.env.BUN_PUBLIC_COMMIT_SHA = "not-a-sha";
	expect(readBuildInfo().sha).toBeUndefined();
});

test("reads the branch a preview was built from", () => {
	process.env.BUN_PUBLIC_BRANCH = "worktree-foo";
	expect(readBuildInfo().branch).toBe("worktree-foo");
});

test("ignores an empty branch", () => {
	process.env.BUN_PUBLIC_BRANCH = "  ";
	expect(readBuildInfo().branch).toBeUndefined();
});
