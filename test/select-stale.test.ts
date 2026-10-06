import { describe, expect, it } from "vitest";
import type { Deployment } from "../src/pages-api";
import { selectStale } from "../src/select-stale";

function deployment(
  id: string,
  environment: Deployment["environment"],
  daysAgo: number,
  aliases: string[] | null = null,
): Deployment {
  return {
    id,
    environment,
    created_on: new Date(Date.UTC(2026, 0, 31 - daysAgo)).toISOString(),
    aliases,
  };
}

const ids = (deployments: Deployment[]) => deployments.map((d) => d.id).sort();

describe("selectStale", () => {
  it("keeps the newest N per environment and returns the rest", () => {
    const deployments = [
      deployment("prod-0", "production", 0),
      deployment("prod-1", "production", 1),
      deployment("prod-2", "production", 2),
      deployment("prev-0", "preview", 0),
      deployment("prev-1", "preview", 1),
      deployment("prev-2", "preview", 2),
    ];
    expect(ids(selectStale(deployments, 2))).toEqual(["prev-2", "prod-2"]);
  });

  it("sorts by created_on, not by input order", () => {
    const deployments = [deployment("old", "preview", 5), deployment("new", "preview", 0)];
    expect(ids(selectStale(deployments, 1))).toEqual(["old"]);
  });

  it("never returns aliased deployments", () => {
    const deployments = [
      deployment("new", "preview", 0),
      deployment("branch-head", "preview", 3, ["https://feature.project.pages.dev"]),
      deployment("old", "preview", 4),
    ];
    expect(ids(selectStale(deployments, 1))).toEqual(["old"]);
  });

  it("never returns the live production deployment", () => {
    const deployments = [
      deployment("newest", "production", 0),
      deployment("rolled-back-to", "production", 5),
      deployment("old", "production", 6),
    ];
    expect(ids(selectStale(deployments, 1, "rolled-back-to"))).toEqual(["old"]);
  });

  it("returns nothing when fewer than N deployments exist", () => {
    expect(selectStale([deployment("a", "preview", 0)], 5)).toEqual([]);
  });
});
