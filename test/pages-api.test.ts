import { afterEach, describe, expect, it, vi } from "vitest";
import { BudgetExhausted, PagesApi } from "../src/pages-api";

const ok = (result: unknown, total?: number) => ({
  success: true,
  errors: [],
  result,
  result_info: total === undefined ? undefined : { total_count: total },
});

function mockFetch(bodies: object[]) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(bodies.shift())));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("PagesApi", () => {
  it("lists one page with the environment filter and returns the total", async () => {
    const fetchMock = mockFetch([ok([{ id: "a" }], 120)]);
    const page = await new PagesApi("account", "token", 10).listPage("site", "preview", 3);
    expect(page).toEqual({ deployments: [{ id: "a" }], total: 120 });
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/pages/projects/site/deployments?env=preview&per_page=25&page=3",
    );
  });

  it("throws BudgetExhausted once the request budget is used up", async () => {
    mockFetch([ok([], 0), ok([], 0)]);
    const api = new PagesApi("account", "token", 1);
    await api.listPage("site", "preview", 1);
    await expect(api.listPage("site", "preview", 1)).rejects.toBeInstanceOf(BudgetExhausted);
  });

  it("throws when the API reports success: false", async () => {
    mockFetch([
      { success: false, errors: [{ code: 10000, message: "Authentication error" }], result: null },
    ]);
    await expect(
      new PagesApi("account", "token", 10).listPage("site", "preview", 1),
    ).rejects.toThrow("Authentication error");
  });

  it("returns the canonical deployment id", async () => {
    mockFetch([ok({ canonical_deployment: { id: "live" } })]);
    expect(await new PagesApi("account", "token", 10).liveProductionId("site")).toBe("live");
  });
});
