export const REPO_URL = "https://github.com/kamontat/whattoeat";
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

const SHA = /^[0-9a-f]{40}$/;
const PR = /^[1-9][0-9]*$/;

export const commitUrl = (sha: string): string => `${REPO_URL}/commit/${sha}`;

export const pullUrl = (pr: number): string => `${REPO_URL}/pull/${pr}`;

export const shortSha = (sha: string): string => sha.slice(0, 7);

export const parseBuildDate = (value: string | undefined): Date | undefined => {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
};

export interface BuildInfo {
	sha: string | undefined;
	date: Date | undefined;
	/** Set only by the preview workflow, like `pr`, so production shows neither. */
	branch: string | undefined;
	pr: number | undefined;
}

/**
 * The commit, build time, branch and pull request baked in by `bun-server build`, which inlines
 * `BUN_PUBLIC_*` variables written as property access; the deploy workflows set them. The dev
 * server inlines nothing and has no `process`, so the read throws there and all stay unset.
 */
export const readBuildInfo = (): BuildInfo => {
	try {
		const sha = process.env.BUN_PUBLIC_COMMIT_SHA;
		const branch = process.env.BUN_PUBLIC_BRANCH?.trim();
		const pr = process.env.BUN_PUBLIC_PR_NUMBER;
		return {
			sha: sha !== undefined && SHA.test(sha) ? sha : undefined,
			date: parseBuildDate(process.env.BUN_PUBLIC_BUILD_DATE),
			branch: branch ? branch : undefined,
			pr: pr !== undefined && PR.test(pr) ? Number(pr) : undefined,
		};
	} catch {
		return {
			sha: undefined,
			date: undefined,
			branch: undefined,
			pr: undefined,
		};
	}
};
