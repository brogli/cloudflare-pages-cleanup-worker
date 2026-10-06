import { PagesApi } from "./pages-api";
import { selectStale } from "./select-stale";

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    validate(env);
    const api = new PagesApi(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN);
    for (const project of env.PROJECTS) {
      try {
        await cleanupProject(api, project, env);
      } catch (error) {
        console.error(`[${project}] failed, skipping project`, error);
      }
    }
  },

  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function cleanupProject(api: PagesApi, project: string, env: Env): Promise<void> {
  const [deployments, liveProductionId] = await Promise.all([
    api.listDeployments(project),
    api.liveProductionId(project),
  ]);
  const stale = selectStale(deployments, env.KEEP_PER_ENV, liveProductionId);
  console.log(`[${project}] ${stale.length} stale deployment(s)`);

  if (env.DRY_RUN) {
    for (const { id } of stale) console.log(`[${project}] would delete ${id}`);
    return;
  }
  for (const { id } of stale) {
    try {
      await api.deleteDeployment(project, id);
      console.log(`[${project}] deleted ${id}`);
    } catch (error) {
      console.error(`[${project}] deleting ${id} failed`, error);
    }
  }
}

function validate(env: Env): void {
  if (env.PROJECTS.length === 0) throw new Error("PROJECTS is empty");
  if (!Number.isInteger(env.KEEP_PER_ENV) || env.KEEP_PER_ENV < 1) {
    throw new Error("KEEP_PER_ENV must be a positive integer");
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN secrets are required");
  }
}
