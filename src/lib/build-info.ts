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

/**
 * Where a page came from: `production` is `main` deployed, `preview` a pull request deployed,
 * `local` a `bun run build` on a workstation and `development` the `bun run dev` server.
 */
export type Environment = "production" | "preview" | "local" | "development";

export interface BuildInfo {
	environment: Environment;
	sha: string | undefined;
	date: Date | undefined;
	/** Set only by the preview workflow, like `pr`, so production shows neither. */
	branch: string | undefined;
	pr: number | undefined;
}

/** Runs one variable read, which throws where the build left it as a read of `process`. */
const readEnv = (read: () => string | undefined): string | undefined => {
	try {
		return read();
	} catch {
		return undefined;
	}
};

/**
 * The environment, commit, build time, branch and pull request baked in by `bun-server build`,
 * which inlines `BUN_PUBLIC_*` variables written as property access. The `build` script stamps
 * the build time and the deploy workflows set the rest. Only set variables are inlined, and the
 * browser has no `process`, so each unset one throws on its own: production sets no branch or
 * pull request, a local build sets only the build time, and the dev server inlines nothing.
 */
export const readBuildInfo = (): BuildInfo => {
	const sha = readEnv(() => process.env.BUN_PUBLIC_COMMIT_SHA);
	const branch = readEnv(() => process.env.BUN_PUBLIC_BRANCH)?.trim();
	const pr = readEnv(() => process.env.BUN_PUBLIC_PR_NUMBER);
	const deployed = readEnv(() => process.env.BUN_PUBLIC_ENVIRONMENT);
	const date = parseBuildDate(readEnv(() => process.env.BUN_PUBLIC_BUILD_DATE));
	return {
		environment:
			deployed === "production" || deployed === "preview"
				? deployed
				: date === undefined
					? "development"
					: "local",
		sha: sha !== undefined && SHA.test(sha) ? sha : undefined,
		date,
		branch: branch ? branch : undefined,
		pr: pr !== undefined && PR.test(pr) ? Number(pr) : undefined,
	};
};
