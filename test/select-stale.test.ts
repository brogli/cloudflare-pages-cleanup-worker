import { describe, expect, it } from "vitest";
import type { Deployment } from "../src/pages-api";
import { assertNewestFirst, selectStale } from "../src/select-stale";

function deployment(id: string, daysAgo: number, aliases: string[] | null = null): Deployment {
  return {
    id,
    environment: "preview",
    created_on: new Date(Date.UTC(2026, 0, 31 - daysAgo)).toISOString(),
    aliases,
  };
}

const ids = (deployments: Deployment[]) => deployments.map((d) => d.id);

describe("selectStale", () => {
  const page = [deployment("a", 0), deployment("b", 1), deployment("c", 2)];

  it("skips the first keepCount entries", () => {
    expect(ids(selectStale(page, 2))).toEqual(["c"]);
  });

  it("never returns aliased deployments", () => {
    const withAlias = [
      deployment("a", 0),
      deployment("head", 1, ["https://x.pages.dev"]),
      deployment("c", 2),
    ];
    expect(ids(selectStale(withAlias, 0))).toEqual(["a", "c"]);
  });

  it("never returns the live production deployment", () => {
    expect(ids(selectStale(page, 0, "b"))).toEqual(["a", "c"]);
  });
});

describe("assertNewestFirst", () => {
  it("accepts a descending page", () => {
    expect(() => assertNewestFirst([deployment("a", 0), deployment("b", 1)])).not.toThrow();
  });

  it("rejects an ascending page", () => {
    expect(() => assertNewestFirst([deployment("a", 1), deployment("b", 0)])).toThrow(
      /newest first/,
    );
  });

  it("rejects a page older than the page that followed it", () => {
    const olderPageNewest = deployment("x", 1).created_on;
    expect(() =>
      assertNewestFirst([deployment("a", 0), deployment("b", 2)], olderPageNewest),
    ).toThrow();
    expect(() =>
      assertNewestFirst([deployment("a", 0), deployment("b", 1)], olderPageNewest),
    ).not.toThrow();
  });
});
