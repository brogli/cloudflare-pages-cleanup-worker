// Mirrors `vars` in wrangler.jsonc plus the secrets set with `wrangler secret put`.
interface Env {
  PROJECTS: string[];
  KEEP_PRODUCTION: number;
  KEEP_PREVIEW: number;
  MAX_REQUESTS_PER_RUN: number;
  DRY_RUN: boolean;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}
