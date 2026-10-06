import type { Deployment } from "./pages-api";

/**
 * Per environment (production and preview separately), keep the newest `keepPerEnv`
 * deployments. Never returned: the live production deployment, and aliased deployments
 * (the latest of a branch; the API refuses to delete them without `force`).
 */
export function selectStale(
  deployments: Deployment[],
  keepPerEnv: number,
  liveProductionId?: string,
): Deployment[] {
  const byEnvironment = Object.groupBy(deployments, (deployment) => deployment.environment);
  return Object.values(byEnvironment).flatMap((group) =>
    group
      .toSorted((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))
      .slice(keepPerEnv)
      .filter((deployment) => deployment.id !== liveProductionId && !deployment.aliases?.length),
  );
}
