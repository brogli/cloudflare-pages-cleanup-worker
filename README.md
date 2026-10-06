# cloudflare-pages-cleanup-worker

A Cloudflare Worker that deletes old Cloudflare Pages deployments on a schedule. Runs on Cloudflare
itself, so no CI minutes are used.

## What it does

Once a day, for each configured Pages project and for each environment (production, preview)
separately:

1. keep the newest `KEEP_PER_ENV` deployments
2. skip deployments that still have an alias (the latest deployment of each branch)
3. delete the rest

The live production deployment is never deleted.

## Setup

Prerequisites: a Cloudflare account and either [Nix](https://nixos.org/download/) with
[direnv](https://direnv.net/) (run `direnv allow` once, or use `nix develop`) or Node.js 24 and pnpm
installed yourself.

1. Install dependencies

   ```sh
   pnpm install
   ```

2. Log in to Cloudflare

   ```sh
   pnpm wrangler login
   ```

3. Configure the projects to clean up in `wrangler.jsonc`

   ```jsonc
   "vars": {
     "PROJECTS": ["my-site", "my-other-site"],
     "KEEP_PER_ENV": 10,
     "DRY_RUN": true
   }
   ```

4. Create an API token at <https://dash.cloudflare.com/profile/api-tokens>. Use **Create Custom
   Token** with the permission **Account / Cloudflare Pages / Edit**, scoped to your account.

5. Deploy, then store the account ID (shown by `pnpm wrangler whoami`) and the token as secrets

   ```sh
   pnpm deploy
   pnpm wrangler secret put CLOUDFLARE_ACCOUNT_ID
   pnpm wrangler secret put CLOUDFLARE_API_TOKEN
   ```

6. Verify the dry run. Either run it locally (see below) or wait for the schedule and open the
   worker's **Logs** tab in the Cloudflare dashboard. Every deployment that would be deleted is
   listed as `would delete`.

7. Set `DRY_RUN` to `false` in `wrangler.jsonc` and deploy again.

   ```sh
   pnpm deploy
   ```

## Configuration

| Variable                | Where            | Meaning                                                 |
| ----------------------- | ---------------- | ------------------------------------------------------- |
| `PROJECTS`              | `wrangler.jsonc` | Pages project names. Only these are touched.            |
| `KEEP_PER_ENV`          | `wrangler.jsonc` | Newest deployments to keep per environment per project. |
| `DRY_RUN`               | `wrangler.jsonc` | `true` only logs what would be deleted.                 |
| `CLOUDFLARE_ACCOUNT_ID` | secret           | From `wrangler whoami`.                                 |
| `CLOUDFLARE_API_TOKEN`  | secret           | Token with Pages Edit permission.                       |

The schedule is `triggers.crons` in `wrangler.jsonc`, default `0 3 * * *` (daily at 03:00 UTC).

## Run locally

```sh
cp .dev.vars.example .dev.vars   # fill in the secrets
pnpm dev
curl http://localhost:8787/cdn-cgi/local/scheduled
```

Local runs call the real Pages API, so keep `DRY_RUN` at `true` unless you mean it.

## Development

```sh
pnpm test    # unit tests
pnpm check   # type check (run `pnpm types` once first)
```

`treefmt` formats everything: TypeScript, JSON, YAML and Markdown via oxfmt, Nix via nixfmt.
