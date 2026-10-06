import { describe, expect, it, vi } from "vitest";
import { cleanupProject, type Api } from "../src/cleanup";
import { BudgetExhausted, PAGE_SIZE, type Deployment, type Environment } from "../src/pages-api";

/** A fake API over an in-memory list per environment, newest first, that records deletions. */
function fakeApi(counts: Record<Environment, number>, liveProductionId = "production-0") {
  const all: Record<Environment, Deployment[]> = { production: [], preview: [] };
  for (const environment of ["production", "preview"] as const) {
    for (let i = 0; i < counts[environment]; i++) {
      all[environment].push({
        id: `${environment}-${i}`,
        environment,
        created_on: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 100_000 - i)).toISOString(),
        aliases: null,
      });
    }
  }
  const deleted: string[] = [];
  const api: Api = {
    liveProductionId: vi.fn(async () => liveProductionId),
    listPage: vi.fn(async (_project: string, environment: Environment, page: number) => ({
      deployments: all[environment].slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: all[environment].length,
    })),
    deleteDeployment: vi.fn(async (_project: string, id: string) => {
      deleted.push(id);
      const list = all[id.startsWith("production") ? "production" : "preview"];
      list.splice(
        list.findIndex((d) => d.id === id),
        1,
      );
    }),
  };
  return { api, deleted, all };
}

describe("cleanupProject", () => {
  it("deletes everything beyond the keep count in each environment, oldest page first", async () => {
    const { api, deleted, all } = fakeApi({ production: 3, preview: 60 });
    await cleanupProject(api, "site", { keep: { production: 2, preview: 2 }, dryRun: false });
    expect(all.production.map((d) => d.id)).toEqual(["production-0", "production-1"]);
    expect(all.preview.map((d) => d.id)).toEqual(["preview-0", "preview-1"]);
    expect(deleted.slice(0, 3)).toEqual(["production-2", "preview-50", "preview-51"]);
  });

  it("fetches only the first page when nothing is stale", async () => {
    const { api, deleted } = fakeApi({ production: 1, preview: 5 });
    await cleanupProject(api, "site", { keep: { production: 10, preview: 10 }, dryRun: false });
    expect(deleted).toEqual([]);
    expect(api.listPage).toHaveBeenCalledTimes(2);
  });

  it("deletes nothing in dry run", async () => {
    const { api, deleted } = fakeApi({ production: 1, preview: 40 });
    await cleanupProject(api, "site", { keep: { production: 1, preview: 1 }, dryRun: true });
    expect(deleted).toEqual([]);
  });

  it("stops at once when the request budget is exhausted", async () => {
    const { api, deleted } = fakeApi({ production: 0, preview: 10 });
    const realDelete = api.deleteDeployment;
    api.deleteDeployment = vi.fn(async (project: string, id: string) => {
      if (deleted.length === 2) throw new BudgetExhausted();
      await realDelete(project, id);
    });
    await expect(
      cleanupProject(api, "site", { keep: { production: 1, preview: 1 }, dryRun: false }),
    ).rejects.toBeInstanceOf(BudgetExhausted);
    expect(deleted).toHaveLength(2);
    expect(api.deleteDeployment).toHaveBeenCalledTimes(3);
  });

  it("keeps the live production deployment even when it is old", async () => {
    const { api, all } = fakeApi({ production: 5, preview: 0 }, "production-4");
    await cleanupProject(api, "site", { keep: { production: 1, preview: 1 }, dryRun: false });
    expect(all.production.map((d) => d.id)).toEqual(["production-0", "production-4"]);
  });
});
