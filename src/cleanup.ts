import { BudgetExhausted, PAGE_SIZE, type Environment, type PagesApi } from "./pages-api";
import { assertNewestFirst, selectStale } from "./select-stale";

export type Api = Pick<PagesApi, "liveProductionId" | "listPage" | "deleteDeployment">;

export interface Policy {
  keep: Record<Environment, number>;
  dryRun: boolean;
}

const ENVIRONMENTS: Environment[] = ["production", "preview"];

export async function cleanupProject(api: Api, project: string, policy: Policy): Promise<void> {
  const liveProductionId = await api.liveProductionId(project);
  for (const environment of ENVIRONMENTS) {
    await cleanupEnvironment({ api, project, environment, liveProductionId, ...policy });
  }
}

interface Target extends Policy {
  api: Api;
  project: string;
  environment: Environment;
  liveProductionId?: string;
}

/** Walks pages from the oldest to the kept window, so deletions never shift unvisited pages. */
async function cleanupEnvironment(target: Target): Promise<void> {
  const { api, project, environment } = target;
  const keepCount = target.keep[environment];
  const firstPage = await api.listPage(project, environment, 1);
  const stale = Math.max(0, firstPage.total - keepCount);
  console.log(`[${project}/${environment}] ${stale} stale deployment(s)`);
  if (stale === 0) return;

  const lastPage = Math.ceil(firstPage.total / PAGE_SIZE);
  const firstStalePage = Math.floor(keepCount / PAGE_SIZE) + 1;
  let olderPageNewest: string | undefined;
  for (let page = lastPage; page >= firstStalePage; page--) {
    const { deployments } = page === 1 ? firstPage : await api.listPage(project, environment, page);
    assertNewestFirst(deployments, olderPageNewest);
    olderPageNewest = deployments[0]?.created_on;
    const keepOnPage = Math.max(0, keepCount - (page - 1) * PAGE_SIZE);
    for (const { id } of selectStale(deployments, keepOnPage, target.liveProductionId)) {
      await deleteOne(target, id);
    }
  }
}

async function deleteOne({ api, project, dryRun }: Target, id: string): Promise<void> {
  if (dryRun) {
    console.log(`[${project}] would delete ${id}`);
    return;
  }
  try {
    await api.deleteDeployment(project, id);
    console.log(`[${project}] deleted ${id}`);
  } catch (error) {
    if (error instanceof BudgetExhausted) throw error;
    console.error(`[${project}] deleting ${id} failed`, error);
  }
}
