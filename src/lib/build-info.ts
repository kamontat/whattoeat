export const REPO_URL = "https://github.com/kamontat/whattoeat";
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

const SHA = /^[0-9a-f]{40}$/;

export const commitUrl = (sha: string): string => `${REPO_URL}/commit/${sha}`;

export const shortSha = (sha: string): string => sha.slice(0, 7);

export const parseBuildDate = (value: string | undefined): Date | undefined => {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
};

export interface BuildInfo {
	sha: string | undefined;
	date: Date | undefined;
}

/**
 * The commit and build time baked in by `bun-server build`, which inlines `BUN_PUBLIC_*`
 * variables written as property access; the deploy workflows set both. The dev server
 * inlines nothing and has no `process`, so the read throws there and both stay unset.
 */
export const readBuildInfo = (): BuildInfo => {
	try {
		const sha = process.env.BUN_PUBLIC_COMMIT_SHA;
		return {
			sha: sha !== undefined && SHA.test(sha) ? sha : undefined,
			date: parseBuildDate(process.env.BUN_PUBLIC_BUILD_DATE),
		};
	} catch {
		return { sha: undefined, date: undefined };
	}
};
