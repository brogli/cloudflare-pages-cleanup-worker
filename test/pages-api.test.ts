import { afterEach, describe, expect, it, vi } from "vitest";
import { PagesApi } from "../src/pages-api";

const ok = (result: unknown) => ({ success: true, errors: [], result });
const deployments = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    environment: "preview",
    created_on: "",
    aliases: null,
  }));

function mockFetch(bodies: object[]) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(bodies.shift())));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("PagesApi", () => {
  const api = new PagesApi("account", "token");

  it("fetches pages until one comes back short", async () => {
    const fetchMock = mockFetch([ok(deployments(100, "a")), ok(deployments(1, "b"))]);
    const result = await api.listDeployments("site");
    expect(result).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the API reports success: false", async () => {
    mockFetch([
      { success: false, errors: [{ code: 10000, message: "Authentication error" }], result: null },
    ]);
    await expect(api.listDeployments("site")).rejects.toThrow("Authentication error");
  });

  it("returns the canonical deployment id", async () => {
    mockFetch([ok({ canonical_deployment: { id: "live" } })]);
    expect(await api.liveProductionId("site")).toBe("live");
  });
});
