# Get started with an AI agent

Use this after you have your own copy of the template:

1. Click **Use this template** on GitHub and clone the new repository, or
   clone `kamontat/bun-lit-template` directly.
2. Open an AI coding agent (Claude Code, Codex, Cursor, …) in that directory
   and paste the prompt below, or tell it to read `GET_START.md` and follow
   the prompt inside.

The agent customizes the project, deploys it to Cloudflare Workers, and
optionally wires up Google Tag Manager. It finishes with the hello-world page
live.

Before you start, have ready:

- A GitHub account, with the [GitHub CLI](https://cli.github.com/) installed
- A Cloudflare account (free plan is enough)
- A Google account, if you want Google Tag Manager
- [mise](https://mise.jdx.dev/) or [Bun](https://bun.com/) installed

The agent asks you for a few values and pauses for steps only you can do:
logging in to Cloudflare in the browser, typing the API token into a hidden
prompt, and creating the Google Tag Manager container. The token never passes
through the agent.

## Prompt

````markdown
You are setting up a web project in the current directory, which is a copy of
the template repository `kamontat/bun-lit-template` (Lit + Bun, deployed to
Cloudflare Workers static assets through GitHub Actions, with optional Google
Tag Manager). Work through the phases below in order. Stop and ask me whenever
a step needs my input or fails in a way you cannot fix. Do not skip
verification steps, and report real command output when something fails.

The template ships Claude Code skills in `.claude/skills/`. Two of them,
`shipping-a-change` and `landing-a-change`, require a worktree and pull request
for every change. They apply to changes made after this setup. This initial
setup commits directly to `main`, because there is no deployed site to preview
yet.

## Phase 0: Check prerequisites

Run and confirm each of these. If one is missing, tell me how to install it
and wait.

- `git rev-parse --show-toplevel` succeeds and `src/routes/index.html`
  exists (we are inside the template copy). If not, stop and tell me to
  clone the repository first.
- `gh --version` and `gh auth status`: logged in with `repo` and `workflow`
  scopes. If not, ask me to run `gh auth login` or
  `gh auth refresh -s workflow`. If several accounts are listed, make sure
  the active one can write to my repository.
- `mise --version` (preferred) or `bun --version`.

## Phase 1: Find out which repository this is

Run `git remote get-url origin` and decide:

- **origin is my own repository** (created with **Use this template**): keep
  it. Read GITHUB_OWNER and REPO_NAME from
  `gh repo view --json owner,name --jq '.owner.login + "/" + .name'`.
- **origin is `kamontat/bun-lit-template`** (cloned directly): I need my own
  repository. Ask for GITHUB_OWNER (default `gh api user --jq .login`),
  REPO_NAME (default: the directory name) and visibility (default
  `private`) in Phase 2, then in Phase 3 step 1 create it.
- **No origin, or something else**: show me what you found and ask.

## Phase 2: Gather inputs

Ask me for these values in one message, and suggest defaults:

1. PROJECT_NAME: lowercase letters, digits, and dashes. Used as the package
   name and the Cloudflare Worker name. Default: REPO_NAME, lowercased.
2. PAGE_TITLE: the HTML `<title>`. Default: PROJECT_NAME.
3. CUSTOM_DOMAIN: optional hostname such as `app.example.com`. Only valid if
   its zone is already on my Cloudflare account. Leave empty to use the free
   `workers.dev` URL.
4. GTM: yes or no, do I want Google Tag Manager? Default: yes. I will create
   the container in Phase 6, so you do not need the ID yet.
5. Only for a direct clone: GITHUB_OWNER, REPO_NAME and visibility (see
   Phase 1).

## Phase 3: Prepare the repository

1. Only for a direct clone, create my repository and start a fresh history
   (my project should not carry the template's commits). Tell me before you
   run this:

   ```bash
   git remote rename origin template
   git checkout --orphan fresh-main
   git add -A
   git commit -m "chore: initialize project from bun-lit-template"
   git branch -D main
   git branch -m main
   gh repo create GITHUB_OWNER/REPO_NAME --VISIBILITY --source . --remote origin
   git remote remove template
   ```

   This commit is replaced by the real setup commit in Phase 7, so do not
   push yet.
2. Install the pinned toolchain with `mise install` (skip if only Bun is
   available). Do not run `bun install` yet: it fails until Phase 4 replaces
   `<TODO>`, which is not a valid package name.
3. Delete `GET_START.md`; it only applies to the template.

## Phase 4: Replace template placeholders

List every placeholder with:

```bash
grep -rn "<TODO>" --exclude-dir=node_modules .
```

Replace them as follows:

| File | Change |
| ---- | ------ |
| `package.json` | `"name": "<TODO>"` to `"name": "PROJECT_NAME"` |
| `bun.lock` | `"name": "<TODO>"` to `"name": "PROJECT_NAME"` |
| `wrangler.jsonc` | `"name": "<TODO>"` to `"name": "PROJECT_NAME"` |
| `src/routes/index.html` | `<title>TODO</title>` to `<title>PAGE_TITLE</title>` (plain `TODO`, because Biome cannot parse a tag-like `<TODO>` inside `<title>`, so the grep above does not list it) |
| `.github/workflows/deploy-preview.yml` | `environment.url`: fix in Phase 5 once the workers.dev subdomain is known |
| `.github/workflows/deploy-production.yml` | `environment.url`: fix in Phase 5 |

The workflow URLs also contain the template author's domains
(`kcinth.workers.dev` and `kc.in.th`). Both must be replaced; never leave
them in my repository.

If CUSTOM_DOMAIN is set, add this top-level key to `wrangler.jsonc` so
Wrangler attaches the domain on deploy:

```jsonc
"routes": [{ "pattern": "CUSTOM_DOMAIN", "custom_domain": true }]
```

Keep the sample `hello-world` component and its test; it is the page we are
deploying. Keep `src/lib/gtm.ts` and its `<script>` tag in
`src/routes/index.html` even if GTM is "no": without a container ID it does
nothing.

Then verify locally. All four must pass before going further:

```bash
bun install
bun run check
bun run test
bun run build
```

Confirm the grep prints nothing except the two workflow URLs still pending
Phase 5.

## Phase 5: Set up Cloudflare

1. Log in to Wrangler. This opens a browser, so ask me to run it myself:

   ```
   ! bunx wrangler login
   ```

   Then run `bunx wrangler whoami` and read the account ID from the output.
   If I have several accounts, ask which one to use. Call it ACCOUNT_ID.
2. Ask me to create an API token, because Wrangler cannot create one:
   - Open <https://dash.cloudflare.com/profile/api-tokens>
   - **Create Token**, use the **Edit Cloudflare Workers** template
   - Account Resources: the ACCOUNT_ID account. Zone Resources: all zones,
     or the CUSTOM_DOMAIN zone if one is set
   - Create it and keep the page open for the next step
3. Store both secrets in the GitHub repository. Set the account ID yourself:

   ```bash
   gh secret set CLOUDFLARE_ACCOUNT_ID --repo GITHUB_OWNER/REPO_NAME --body "ACCOUNT_ID"
   ```

   For the token, ask me to run this so it is typed into a hidden prompt and
   never appears in your context or logs:

   ```
   ! gh secret set CLOUDFLARE_API_TOKEN --repo GITHUB_OWNER/REPO_NAME
   ```

   Never ask me to paste the token into the chat, and never write it to a
   file. Confirm both secrets exist with
   `gh secret list --repo GITHUB_OWNER/REPO_NAME`.
4. Find my workers.dev subdomain (call it SUBDOMAIN, the part before
   `.workers.dev`). Ask me to open **Workers & Pages** in the Cloudflare
   dashboard and read it from the overview page (accounts that never opened
   that page must do so once to register a subdomain). If I prefer, I can
   tell you the subdomain directly.
5. Fix the workflow URLs:
   - `deploy-preview.yml`:
     `url: https://pr-${{ github.event.number }}-PROJECT_NAME.SUBDOMAIN.workers.dev`
   - `deploy-production.yml`: `url: https://CUSTOM_DOMAIN` if set, otherwise
     `url: https://PROJECT_NAME.SUBDOMAIN.workers.dev`

   Call the production URL PRODUCTION_URL. Confirm
   `grep -rn "<TODO>\|kcinth\|kc\.in\.th" --exclude-dir=node_modules .`
   prints nothing.
6. Create the GitHub environments the deploy workflows reference:

   ```bash
   gh api -X PUT repos/GITHUB_OWNER/REPO_NAME/environments/preview
   gh api -X PUT repos/GITHUB_OWNER/REPO_NAME/environments/production
   ```
7. Match the repository settings the bundled skills expect (merge commits
   allowed, head branches deleted after merge):

   ```bash
   gh repo edit GITHUB_OWNER/REPO_NAME --enable-merge-commit --delete-branch-on-merge
   ```

## Phase 6: Set up Google Tag Manager

Skip this phase if I answered "no" to GTM. GTM can be turned on later by
doing this phase and redeploying.

The template loads GTM from `src/lib/gtm.ts`, which reads the container ID
from `BUN_PUBLIC_GTM_ID` at build time. Only `deploy-production.yml` passes
it, from the `GTM_ID` repository variable, so local dev and pull request
previews never send data.

1. Ask me to create the container, since it needs my Google account:
   - Open <https://tagmanager.google.com/> and create an account (or pick an
     existing one)
   - Add a container named after PROJECT_NAME, target platform **Web**
   - Close the install-snippet dialog (the template already does that part)
     and copy the container ID, which looks like `GTM-XXXXXXX`
   - Click **Submit** and **Publish** once, even with no tags yet. An
     unpublished container serves no `gtm.js`, so the page would request
     it and get a 404
2. Check the ID matches `^GTM-[A-Z0-9]+$`; `src/lib/gtm.ts` silently ignores
   anything else. Then confirm the container is published:

   ```bash
   curl -fsS -o /dev/null -w "%{http_code}\n" "https://www.googletagmanager.com/gtm.js?id=GTM_ID"
   ```

   Expect `200`. A `404` means it is not published yet.
3. Store it as a repository variable (not a secret: it ends up in public page
   source anyway):

   ```bash
   gh variable set GTM_ID --repo GITHUB_OWNER/REPO_NAME --body "GTM_ID"
   ```

## Phase 7: Commit, push, and deploy

1. Commit on `main` and push. For a direct clone, amend the Phase 3 commit so
   the history stays a single initial commit:

   ```bash
   git add -A
   git commit -m "chore: initialize project from bun-lit-template"   # or: git commit --amend --no-edit
   git push -u origin main
   ```

   The push triggers two workflows: `Main` (check, build, test) and
   `Deploy Production`. For a repository made with **Use this template**,
   GitHub already ran both on the template's copied commit, before the
   placeholders were replaced; that failed run is expected, ignore it.
2. Watch the runs until they finish:

   ```bash
   gh run list --repo GITHUB_OWNER/REPO_NAME --limit 5
   gh run watch <run-id> --repo GITHUB_OWNER/REPO_NAME --exit-status
   ```

   If `Deploy Production` fails, read the log with
   `gh run view <run-id> --log-failed`, fix the cause (usual suspects: wrong
   ACCOUNT_ID, token missing a permission, Worker name mismatch), push again,
   and re-watch. Do not retry blindly.
3. Verify the live site. The page is client-rendered, so check that the HTML
   shell is served with the `<hello-world>` element:

   ```bash
   curl -fsS https://PRODUCTION_URL | grep -i "<hello-world>"
   ```

   A new Worker or custom domain can take a minute to resolve; retry a few
   times before treating it as a failure.
4. If GTM was set up, verify the container ID was built in. GTM is injected
   at runtime, so it is not in the HTML; check the JavaScript the page loads:

   ```bash
   for js in $(curl -fsS https://PRODUCTION_URL | grep -o 'src="[^"]*\.js"' | sed 's/src="\.\{0,1\}\/\{0,1\}//; s/"$//'); do
     curl -fsS "https://PRODUCTION_URL/$js" | grep -l "GTM_ID" >/dev/null && echo "found in $js"
   done
   ```

   At least one line must print. If none does, the `GTM_ID` variable was not
   set when `Deploy Production` ran: set it and re-run the workflow with
   `gh run rerun <run-id>`. Then ask me to open the site with GTM's
   **Preview** mode (Tag Assistant) to confirm the container connects.

## Phase 8: Report

Finish with a short summary:

- Repository URL
- Production URL (and the preview URL pattern for pull requests)
- Google Tag Manager: container ID, or "off" with how to turn it on later
- What I still need to do by hand, if anything (for example, a custom domain
  waiting on DNS, or adding tags in GTM)
- Next steps: open a pull request to see a preview deploy, then replace the
  `hello-world` component with real content (see the README)
````
