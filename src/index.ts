import { cleanupProject } from "./cleanup";
import { BudgetExhausted, PagesApi } from "./pages-api";

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    validate(env);
    const api = new PagesApi(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_API_TOKEN,
      env.MAX_REQUESTS_PER_RUN,
    );
    for (const project of env.PROJECTS) {
      try {
        await cleanupProject(api, project, {
          keep: { production: env.KEEP_PRODUCTION, preview: env.KEEP_PREVIEW },
          dryRun: env.DRY_RUN,
        });
      } catch (error) {
        if (error instanceof BudgetExhausted) {
          console.log("request budget exhausted, continuing next run");
          return;
        }
        console.error(`[${project}] failed, skipping project`, error);
      }
    }
  },

  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function validate(env: Env): void {
  if (env.PROJECTS.length === 0) throw new Error("PROJECTS is empty");
  for (const name of ["KEEP_PRODUCTION", "KEEP_PREVIEW", "MAX_REQUESTS_PER_RUN"] as const) {
    if (!Number.isInteger(env[name]) || env[name] < 1) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN secrets are required");
  }
}
