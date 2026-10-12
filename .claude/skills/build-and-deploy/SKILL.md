---
name: build-and-deploy
description: Use when changing `bun run build`, `bun run dev`, `bun run preview`, `--statics`, wrangler.jsonc, the dist/ output shape, or anything under .github/workflows/ — including bumping a pinned action SHA or debugging a Cloudflare deploy.
---

# Build and deployment

## Build

`dev`, `build` and `preview` are each one `@kctools/bun-server` command in `package.json`,
with no wrapper script (see the `repo-scripts` skill). `build` bundles every `.html` under
`src/routes/` (see the `adding-a-page` skill) into `dist/`: the HTML entries, hashed JS and
CSS chunks, and linked `.map` files. Pages link all of it relatively.

**Lit needs `NODE_ENV=production` at build time, and `bun-server build` sets it.**
`lit-html`'s export map carries a `development` condition, and Bun's bundler resolves it
unless `NODE_ENV` says otherwise. `build`'s `--environment` defaults to `production`, so
the script needs no `NODE_ENV=` prefix. Don't pass `--no-environment` or another value
to the production build: every visitor would download Lit's development build — about
twice the size, with per-update assertions and a `lit.dev/msg/dev-mode` console warning.
`dev` runs in development mode on purpose — the warnings are the point there. Verify a
build with:

```sh
grep -l "dev-mode" dist/*.js   # prints nothing for a production build
```

`build` runs with `--clean`, so `dist/` is emptied first and no stale file or chunk from an
earlier build survives into a deploy. Keep the flag: without it `bun-server` writes over
the old output and leaves everything else in place. It refuses to clean a directory that
is the working directory or one of its parents, so `--out` must stay a subdirectory.

`--statics` ships files no HTML references (favicon, `robots.txt`, images). Each value is
`<source>[:<target>]`, repeatable, on both `dev` and `build`. The target is a directory
inside `dist/`, `.` being its root, and defaults to the source root: `--statics public:.`
puts `public/favicon.ico` at `dist/favicon.ico`, while `--statics public` puts it at
`dist/public/favicon.ico`. A target that leaves `dist/` (`/`, `..`) is an error. Quote a
glob (`'assets/**/*.png'`) — an unquoted one is expanded by the shell, and each extra path
arrives as a positional argument that `bun-server` reads as another route input. HTML files
are copied like any other static file; a static file that would overwrite build output
stops the build before anything is copied. Static dotfiles *are* matched, so
`.well-known/` works. `dev` copies nothing and serves each file at the URL it would have in
the build.

`bun-server build` passes `env: "BUN_PUBLIC_*"` to `Bun.build`, so a
`process.env.BUN_PUBLIC_…` written as property access (never `process.env[name]`) is
inlined as a string at build time. The dev server inlines nothing and ships no `process`
shim, so wrap such a read in a `try` and give it a fallback. Declare each variable on
`Bun.Env` in `src/types/global.d.ts`, or `noPropertyAccessFromIndexSignature` forces the
subscript form, which the build does not inline. One exists today: `BUN_PUBLIC_GTM_ID`,
read by `src/lib/gtm.ts` (see "Google Tag Manager" below). A variable that is unset at build
time is left as `process.env.…` in the bundle, so the `try` is what keeps it harmless.

`dist/` is what Cloudflare serves — `wrangler.jsonc` names it as `assets.directory` — so
its shape is part of the deployment contract, not a local convenience.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` sets
`build.command` to `bun run build` and points `assets.directory` at `dist/`, so wrangler
runs the build itself and neither deploy workflow builds beforehand. Changing where the
build writes means changing that file too.

Three workflows, each pinning every action to a full commit SHA with the release tag in a
trailing comment:

- `main.yml` — every push: install, `bun run check`, `bun run build`, `bun run test`.
- `deploy-preview.yml` — pull requests: `wrangler versions upload --preview-alias
  pr-<number>`, reporting into the `preview` environment.
- `deploy-production.yml` — pushes to `main`: `wrangler deploy`, reporting into the
  `production` environment.

Both deploy jobs carry `if: ${{ !github.event.repository.is_template }}`: the template
repository has no Worker of its own, so it skips them, while a repository created from it
is not a template and deploys. Keep the guard on any new deploy job.

Each workflow's `environment.url` is only the link GitHub shows on the deployment; wrangler
does not read it. It is built by hand because the action's `deployment-url` output knows
neither preview aliases nor custom domains, so it must be edited whenever the Worker name,
the workers.dev subdomain or the custom domain changes.

Both deploy workflows need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository
secrets, and grant `deployments: write` on the job rather than at the top — the files open
with `permissions: {}` and hand back only what each job needs. Keep that shape in anything
new.

Bun's local version is pinned in `mise.toml`; keep any CI pin in sync with it.

A pinned SHA is bumped by resolving the tag again, never by hand:

```sh
gh api repos/actions/checkout/releases/latest --jq .tag_name   # e.g. v7.0.1
gh api repos/actions/checkout/commits/v7.0.1 --jq .sha         # the SHA to pin
```

Update the trailing comment in the same edit — a stale comment is worse than none, since it
is the only readable record of which version the SHA is.

Pushing any change under `.github/workflows/` needs a token with the `workflow` scope:
`gh auth refresh -h github.com -s workflow`.

## Google Tag Manager

`deploy-production.yml` sets `BUN_PUBLIC_GTM_ID: ${{ vars.GTM_ID }}` on the wrangler step,
since wrangler runs the build as its own child; `deploy-preview.yml` deliberately does not,
so previews never send analytics. An unset `GTM_ID` variable arrives as `""`, which
`loadGtm` rejects, so GTM is simply off. Changing the container means changing the
variable and re-running `Deploy Production` — the ID is baked into the bundle, not read at
runtime. To confirm a deploy carries it, grep the page's JS chunks for the ID (GTM is
injected by script, so it never appears in the HTML).

## Debugging a failed deploy

- `gh run view <id> --log-failed` first; quote the decisive line.
- `Authentication error` / `10000`: token missing **Edit Cloudflare Workers** permission or
  scoped to another account than `CLOUDFLARE_ACCOUNT_ID`.
- Worker name in the error is `<TODO>`: the template was never customized — see
  `GET_START.md`.
- Deploy passed but the page is blank: open the browser console. A 404 on a chunk means a
  stale or partial `dist/`; a 404 on the page itself means no `.html` under `src/routes/`
  maps to that path (see `adding-a-page`).
