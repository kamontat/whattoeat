# What to Eat

Can't decide where to eat? Add the restaurants you like, press one button, and get two random
options. Press **Eat here** on one to save it to your history with the date and time. The
list and the history live in your browser (`localStorage`); move them between devices with
JSON export and import on the Settings page, as a file or by copy and paste. The interface is available in English and Thai,
in a light or dark theme that follows the system setting unless you pick one in Settings.

| Page           | What it does                                   |
| -------------- | ---------------------------------------------- |
| `/`            | Two random options; press Eat here to save a visit to History |
| `/restaurants` | Add, edit and delete restaurants               |
| `/history`     | Every visit with its date and time, stats per restaurant, delete a visit |
| `/settings`    | Language and theme; export or import JSON as a file or by copy and paste, with replace or merge; about |
| `/tags`        | Groups and their values: counts, add, rename, reorder and delete groups; rename, merge, move and delete values |

Built from [bun-lit-template](https://github.com/kamontat/bun-lit-template): static
[Lit](https://lit.dev/) web components, bundled by [Bun](https://bun.com/) through
[`@kctools/bun-server`](https://www.npmjs.com/package/@kctools/bun-server), and deployed to
[Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) as static assets.

- [Stack](#stack)
- [Getting started](#getting-started)
- [Data and storage](#data-and-storage)
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

1. Clone the repository:

   ```bash
   git clone git@github.com:kamontat/whattoeat.git
   cd whattoeat
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

## Data and storage

Everything is kept in the browser's `localStorage`, per device and per browser. Nothing
is sent to a server.

| Key                     | Holds                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `whattoeat:restaurants` | The restaurant list (JSON array)                           |
| `whattoeat:history`     | Visits from **Eat here**, newest first (JSON array)        |
| `whattoeat:lang`        | The chosen language, `en` or `th`                          |
| `whattoeat:theme`       | The chosen theme, `auto`, `light` or `dark`                |
| `whattoeat:groups`      | Custom groups, like "price" (JSON array of `{ id, name }`) |

A stored entry that fails validation is skipped when the list loads, and every page shows a
warning with how many were skipped. The next change to the list saves only the valid entries,
so the skipped ones are gone after that. To keep one, copy the value from the browser's
developer tools (Application, then Local Storage) before changing the list; fixed entries can
be re-imported from **Settings** by pasting them inside an export
(`{ "app": "whattoeat", "version": 4, "restaurants": [...], "history": [], "groups": [] }`).

Ideas for future work live in [IDEAS.md](IDEAS.md).

## Project layout

```text
.
├── src/                 # application code
│   ├── routes/          # HTML pages: index, restaurants, history, settings, tags
│   ├── assets/          # files pages link to, e.g. favicon.svg
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
├── IDEAS.md             # features left for later
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
import "#components/app-header"; // ./src/components/app-header.ts
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
(`tests/components/app-header.test.ts`); `bun run check` typechecks them too.
`bunfig.toml` preloads `tests/setup-happydom.ts`, which registers a happy-dom
`window` and `document`, so components render without a browser, and reports
external scripts as loaded instead of fetching them:

```ts
import { afterEach, expect, test } from "bun:test";
import "#components/app-header";

afterEach(() => {
	document.body.innerHTML = "";
});

test("marks the current page", async () => {
	const el = document.createElement("app-header");
	el.current = "restaurants";
	document.body.append(el);
	await el.updateComplete;
	expect(el.shadowRoot?.querySelector('nav a[aria-current="page"]')?.getAttribute("href")).toBe("./restaurants");
});
```

## Deployment

The site deploys to Cloudflare Workers as static assets. `wrangler.jsonc` runs
`bun run build` and uploads `dist/`.

### Manual deploy

A manual deploy builds without `BUN_PUBLIC_GTM_ID`, so it ships with Google Tag
Manager off unless you set the variable in your shell first. It also leaves out
`BUN_PUBLIC_COMMIT_SHA` and `BUN_PUBLIC_BUILD_DATE`, so the footer says
"Development build" instead of linking the commit and showing the build time.

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

Both deploy jobs set `BUN_PUBLIC_COMMIT_SHA` (the pull request head for a preview)
and `BUN_PUBLIC_BUILD_DATE` for the footer, which links the commit and shows when
the page was built.

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
your Worker (`.github/workflows/deploy-preview.yml` and `deploy-production.yml`).

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
