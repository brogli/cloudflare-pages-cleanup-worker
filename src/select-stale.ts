import type { Deployment } from "./pages-api";

/**
 * From one page of deployments (newest first), the ones to delete: everything after the first
 * `keepCount`, except the live production deployment and aliased deployments (the latest of a
 * branch; the API refuses to delete them without `force`).
 */
export function selectStale(
  page: Deployment[],
  keepCount: number,
  liveProductionId?: string,
): Deployment[] {
  return page.filter(
    (deployment, index) =>
      index >= keepCount && deployment.id !== liveProductionId && !deployment.aliases?.length,
  );
}

/**
 * Deleting by position is only safe if the API lists newest first. Throws otherwise.
 * `olderThan` is the newest `created_on` of the following (older) page, if already seen.
 */
export function assertNewestFirst(page: Deployment[], olderThan?: string): void {
  const timestamps = page.map((deployment) => Date.parse(deployment.created_on));
  const descending = timestamps.every((t, i) => i === 0 || t <= timestamps[i - 1]);
  const beforeOlderPage = olderThan === undefined || timestamps.at(-1)! >= Date.parse(olderThan);
  if (!descending || !beforeOlderPage) {
    throw new Error("deployments are not listed newest first; refusing to delete by position");
  }
}
