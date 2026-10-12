# bun-lit-template

A starter template for static websites built with [Lit](https://lit.dev/) web
components, bundled by [Bun](https://bun.com/) through
[`@kctools/bun-server`](https://www.npmjs.com/package/@kctools/bun-server), and
deployed to [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/)
as static assets.

- [Stack](#stack)
- [Getting started](#getting-started)
- [Customize the template](#customize-the-template)
- [Project layout](#project-layout)
- [Scripts](#scripts)
- [Writing components](#writing-components)
- [Adding pages](#adding-pages)
- [Testing](#testing)
- [Deployment](#deployment)
- [Google Tag Manager](#google-tag-manager)
- [Agent skills](#agent-skills)

## Stack

| Concern         | Tool                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Runtime         | [Bun](https://bun.com/) (pinned via [mise](https://mise.jdx.dev/))   |
| UI              | [Lit](https://lit.dev/) web components                               |
| Dev / build     | [`@kctools/bun-server`](https://www.npmjs.com/package/@kctools/bun-server) |
| CSS reset       | [`@kcstyles/reset.css`](https://www.npmjs.com/package/@kcstyles/reset.css) |
| Lint / format   | [Biome](https://biomejs.dev/) with `@kcconfigs/biome`                |
| Type checking   | TypeScript with `@kcconfigs/tsconfig`                                |
| Tests           | `bun test` with [happy-dom](https://github.com/capricorn86/happy-dom) |
| Hosting         | Cloudflare Workers static assets via [Wrangler](https://developers.cloudflare.com/workers/wrangler/) |
| CI / CD         | GitHub Actions                                                       |

## Getting started

> [!TIP]
> Prefer to let an AI agent do it? After step 1, open an agent in the
> repository and give it the prompt in [GET_START.md](GET_START.md). It
> customizes the project, sets up Cloudflare Workers and (optionally) Google
> Tag Manager, and deploys the hello-world page.

1. Create a new repository from this template (**Use this template** on GitHub),
   or clone it directly:

   ```bash
   git clone https://github.com/kamontat/bun-lit-template.git my-app
   cd my-app
   ```

2. Install the pinned toolchain (Bun) with mise, or install Bun yourself
   (see `mise.toml` for the expected version):

   ```bash
   mise install
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Start the development server with hot reloading on
   <http://127.0.0.1:3000>:

   ```bash
   bun run dev
   ```

## Customize the template

After creating a project from this template, replace every `<TODO>`
placeholder (`grep -rn "<TODO>" --exclude-dir=node_modules .`):

| File                                      | Placeholder                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `package.json`                            | `name`, the package name                                            |
| `bun.lock`                                | `name`, kept in sync with `package.json` (or rerun `bun install`)   |
| `wrangler.jsonc`                          | `name`, the Cloudflare Worker name                                  |
| `src/routes/index.html`                   | `<title>TODO</title>`, the page title (plain `TODO`, not matched by the grep) |
| `.github/workflows/deploy-preview.yml`    | `environment.url`, `https://pr-<number>-<TODO>.kcinth.workers.dev`  |
| `.github/workflows/deploy-production.yml` | `environment.url`, `https://<TODO>.kc.in.th`                        |

> [!IMPORTANT]
> `<TODO>` is not a valid package or Worker name, so `bun install` and
> `wrangler deploy` fail until it is replaced. Use the same value for the
> Worker name in `wrangler.jsonc` and in the preview URL.

The workflow URLs also contain the original author's domains. Replace
`kcinth.workers.dev` with your own `workers.dev` subdomain and `kc.in.th` with
your custom domain, or point the production URL at
`https://<worker-name>.<subdomain>.workers.dev` if you have no custom domain.

Then delete or replace the sample `hello-world` component and its test.

## Project layout

```text
.
├── src/                 # application code
│   ├── routes/          # HTML entrypoints (index.html is the app shell)
│   ├── components/      # Lit components        (import as #components/*)
│   ├── lib/             # shared TypeScript     (import as #lib/*), e.g. gtm.ts
│   ├── styles/          # global CSS and shared Lit styles (#styles/*)
│   └── types/           # global type declarations (HTMLElementTagNameMap, Bun.Env)
├── tests/               # tests, mirroring src/ (src/lib/gtm.ts -> tests/lib/gtm.test.ts)
│   └── setup-happydom.ts  # registers happy-dom globals for bun test
├── scripts/             # standalone programs run by package scripts (none yet)
├── .claude/skills/      # Claude Code skills for working in this repo
├── .github/workflows/   # CI, preview, and production deploy pipelines
├── CHANGELOG.md         # what changed and why, newest first
├── GET_START.md         # setup prompt for an AI agent
├── biome.json           # lint / format config
├── bunfig.toml          # bun install + bun test config
├── mise.toml            # pinned tool versions
├── tsconfig.json        # TypeScript config (checks every .ts file)
└── wrangler.jsonc       # Cloudflare Workers config
```

### Import aliases

`package.json` defines [subpath imports](https://nodejs.org/api/packages.html#subpath-imports)
so you never need long relative paths:

```ts
import "#components/hello-world"; // ./src/components/hello-world.ts
import { something } from "#lib/utils"; // ./src/lib/utils.ts
import { sharedStyles } from "#styles/shared"; // ./src/styles/shared.ts
```

## Scripts

| Command               | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `bun run dev`         | Start the dev server with hot reloading on port 3000     |
| `bun run build`       | Empty `dist/`, then build for production into it         |
| `bun run preview`     | Serve the production build from `dist/` on port 4000     |
| `bun run test`        | Run tests with `bun test`                                |
| `bun run check`       | `check:type` then `check:biome`                          |
| `bun run check:type`  | Type check every `.ts` file with `tsc --noEmit`          |
| `bun run check:biome` | Lint and format check with Biome, without changing files |
| `bun run format`      | Apply Biome fixes and formatting (including unsafe ones) |

`dev` and `preview` accept `--port` / `--hostname`, for example
`bun run dev --port 3001`, and move to the next free port when theirs is busy.
`dev` answers every unknown path with `index.html`, while `preview` and
Cloudflare return 404, so check new links with `bun run build && bun run preview`. See the
[`@kctools/bun-server` docs](https://www.npmjs.com/package/@kctools/bun-server)
for all options, including `--statics` for files no HTML document references
(favicons, `robots.txt`, images).

## Writing components

Components live in `src/components/` and use Lit decorators:

```ts
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("my-greeting")
export class MyGreeting extends LitElement {
	static override styles = css`
		:host {
			display: block;
		}
	`;

	@property()
	name = "World";

	override render() {
		return html`<p>Hello, ${this.name}!</p>`;
	}
}
```

Register the tag in `src/types/global.d.ts` so `document.createElement` and
`querySelector` return the correct type:

```ts
import type { MyGreeting } from "#components/my-greeting";

declare global {
	interface HTMLElementTagNameMap {
		"my-greeting": MyGreeting;
	}
}
```

Then load it from a page:

```html
<script type="module" src="../components/my-greeting.ts"></script>
```

> [!NOTE]
> `tsconfig.json` enables `experimentalDecorators` and disables
> `useDefineForClassFields`, which Lit's decorators require under Bun
> ([oven-sh/bun#43097](https://github.com/oven-sh/bun/issues/43097)). Keep both
> settings until that issue is resolved.

## Adding pages

`src/routes/index.html` is the entrypoint. It links global CSS and component
scripts with relative paths, and Bun bundles everything it references.

Every `.html` file under `src/routes` becomes its own route, with no script
change needed:

```text
src/routes/index.html        ->  /
src/routes/about.html        ->  /about
src/routes/blog/post.html    ->  /blog/post
```

Every page must load Google Tag Manager in its `<head>`, with the path
adjusted to its depth (`tests/routes/pages.test.ts` fails otherwise):

```html
<script type="module" src="../lib/gtm.ts"></script>
```

## Testing

Tests run with `bun test` and live in `tests/`, mirroring `src/`
(`tests/components/hello-world.test.ts`); `bun run check` typechecks them too.
`bunfig.toml` preloads `tests/setup-happydom.ts`, which registers a happy-dom
`window` and `document`, so components render without a browser, and reports
external scripts as loaded instead of fetching them:

```ts
import { afterEach, expect, test } from "bun:test";
import "#components/hello-world";

afterEach(() => {
	document.body.innerHTML = "";
});

test("renders custom name", async () => {
	const el = document.createElement("hello-world");
	el.name = "Bun";
	document.body.append(el);
	await el.updateComplete;
	expect(el.shadowRoot?.querySelector("h1")?.textContent).toBe("Hello, Bun!");
});
```

## Deployment

The site deploys to Cloudflare Workers as static assets. `wrangler.jsonc` runs
`bun run build` and uploads `dist/`.

### Manual deploy

A manual deploy builds without `BUN_PUBLIC_GTM_ID`, so it ships with Google Tag
Manager off unless you set the variable in your shell first.

```bash
bunx wrangler login
bunx wrangler deploy
```

### GitHub Actions

| Workflow                  | Trigger            | Does                                                                  |
| ------------------------- | ------------------ | --------------------------------------------------------------------- |
| `main.yml`                | every push         | `check`, `build`, `test`                                              |
| `deploy-preview.yml`      | pull requests      | uploads a preview version aliased `pr-<number>`                       |
| `deploy-production.yml`   | push to `main`     | deploys to production, with `BUN_PUBLIC_GTM_ID` from `vars.GTM_ID`    |

Both deploy jobs skip in a template repository
(`github.event.repository.is_template`), so this template never tries to deploy
itself while repositories created from it do.

Set these repository secrets for the deploy workflows:

| Secret                  | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account ID                                            |
| `CLOUDFLARE_API_TOKEN`  | an API token with the **Edit Cloudflare Workers** permission          |

And optionally this repository variable (see [Google Tag Manager](#google-tag-manager)):

| Variable | Value                                                                             |
| -------- | --------------------------------------------------------------------------------- |
| `GTM_ID` | your Google Tag Manager container ID (`GTM-XXXXXXX`); leave unset to keep GTM off |

Also create `preview` and `production` environments in the repository settings
(**Settings → Environments**). Each workflow's `environment.url` is only the
link GitHub shows on the deployment, so it must be updated by hand to match
your Worker (see [Customize the template](#customize-the-template)).

## Google Tag Manager

`src/lib/gtm.ts` loads a Google Tag Manager container on every page. It reads
the container ID from `BUN_PUBLIC_GTM_ID`, which `bun-server build` inlines at
build time, and does nothing when the ID is missing or not shaped like
`GTM-XXXXXXX`. So GTM is off in `bun run dev`, in tests and in local builds.

Only `deploy-production.yml` passes the ID, from the `GTM_ID` repository
variable, so pull request previews never send data:

```bash
gh variable set GTM_ID --body "GTM-XXXXXXX"
```

Publish the container in Tag Manager at least once before deploying; an
unpublished container serves no `gtm.js`. To try it locally, build with the
variable and preview:

```bash
BUN_PUBLIC_GTM_ID=GTM-XXXXXXX bun run build && bun run preview
```

The module script is deferred, so GTM starts after the HTML is parsed rather
than at the top of `<head>` as in Google's snippet, and there is no
`<noscript>` fallback, since that needs the ID in the HTML.

## Agent skills

`.claude/skills/` holds [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills)
that teach an agent this repository's workflow and conventions:

| Skill                | Covers                                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| `shipping-a-change`  | every change in a worktree, test first, ending in a PR with a preview URL   |
| `landing-a-change`   | after approval: changelog entry, merge commit, worktree cleanup             |
| `changelog`          | the `CHANGELOG.md` entry format and which section a change belongs in        |
| `adding-a-page`      | adding a route under `src/routes/`, what each page must link                 |
| `ui-components`      | Lit component conventions, shadow DOM styling, events, happy-dom test limits |
| `build-and-deploy`   | the build, `--statics`, `wrangler.jsonc`, workflows, pinned action SHAs      |
| `repo-scripts`       | package scripts, what `check` reads, TypeScript and Biome strictness         |

`shipping-a-change` and `landing-a-change` assume merge commits are allowed and
head branches are deleted after merge (`gh repo edit --enable-merge-commit
--delete-branch-on-merge`).
