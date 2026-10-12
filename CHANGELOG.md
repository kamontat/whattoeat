# Changelog

What changed in this project and why, newest first.

## 2026-10-12: Agent skills and a green template CI, Google Tag Manager, and clean, fully typechecked builds

### BREAKING CHANGES

- `GET_START.md` no longer creates the repository: run its prompt inside a copy you already
  have, made with **Use this template** or by cloning the template. An agent started in an
  empty directory now stops and asks you to clone first.

### Features

- Claude Code skills in `.claude/skills/` teach an agent the repository's workflow and
  conventions: `shipping-a-change` (worktree, test first, pull request with a preview URL),
  `landing-a-change` (changelog, merge commit, cleanup), `changelog`, `adding-a-page`,
  `ui-components`, `build-and-deploy` and `repo-scripts`.
- Google Tag Manager loads on every page from `src/lib/gtm.ts` when the production build
  carries a container id. `Deploy Production` passes it from the `GTM_ID` repository
  variable as `BUN_PUBLIC_GTM_ID`; without it, and in dev, tests and PR previews, nothing
  loads. `tests/routes/pages.test.ts` fails if a page under `src/routes/` stops loading it.
- `GET_START.md` has an optional Google Tag Manager phase: create and publish a Web
  container, store its id with `gh variable set GTM_ID`, and check the deployed bundle
  carries it.

### Improvements

- `@kctools/bun-server` is upgraded to 0.4.2, alongside `@kcstyles/reset.css` 2.0.0,
  `@kcconfigs/biome` 3.0.0, `@kcconfigs/tsconfig` 2.1.0, happy-dom 21 and wrangler 4.149.0.
- `bun run build` empties `dist/` first (`--clean`, new in bun-server 0.4.1), so no stale
  file or chunk from an earlier build reaches a deploy.
- `bun run check` typechecks every TypeScript file, not only `src/`: the `bun` preset of
  `@kcconfigs/tsconfig` 2.1.0 includes the whole repository, so `tests/` and future
  `scripts/` are covered with no `include` to maintain.
- The README matches the project again: the real scripts (`check` is `check:type` plus
  `check:biome`), where code lives (`src/`, `tests/`, `scripts/`), the template deploy skip,
  the `GTM_ID` variable, and the routing difference between `dev` and `preview`.
- `GET_START.md` enables merge commits and head-branch deletion on the new repository,
  which `landing-a-change` relies on.
- `GET_START.md` follows the clone-then-ask flow: it detects whether `origin` is your own
  repository or the template, and for a direct clone creates your repository and starts a
  fresh single-commit history.
- Tests never fetch external scripts: happy-dom reports them as loaded instead.

### Bug fixes

- Production builds ship Lit's production build instead of its development build, about
  half the size and without the dev-mode console warning, because `bun-server build` 0.4.0
  sets `NODE_ENV=production`.
- `bun run check` passes on the template: the page title placeholder is plain `TODO`
  instead of `<TODO>`, which Biome parsed as an unclosed tag.
- The template repository no longer runs its deploy jobs, which failed on every push and
  pull request because it has no Worker of its own.

### Decisions

- The deploy jobs are skipped with `github.event.repository.is_template` rather than a
  hardcoded repository name, so repositories created from the template deploy without
  editing the condition.
- The title placeholder is plain `TODO` rather than an escaped `&lt;TODO&gt;`, so it reads
  the same in source and browser tab; the README and `GET_START.md` call it out because the
  `<TODO>` grep no longer lists it.
- GTM loads through a module script reading a build-time id, not Google's inline snippet
  with the id in the HTML. That keeps the id out of the repository and GTM off everywhere
  but production, at the cost of starting after the HTML is parsed and having no
  `<noscript>` fallback.
- The id is a repository variable, not a secret, because it ends up in public page source
  anyway; only production receives it so preview traffic never reaches the container.
