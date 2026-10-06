export type Environment = "production" | "preview";

export interface Deployment {
  id: string;
  environment: Environment;
  created_on: string;
  aliases: string[] | null;
}

export interface Page {
  deployments: Deployment[];
  total: number;
}

interface Envelope<T> {
  success: boolean;
  errors: unknown[];
  result: T;
  result_info?: { total_count: number };
}

interface Project {
  canonical_deployment: { id: string } | null;
}

// Larger values are rejected by the API (error 8000024).
export const PAGE_SIZE = 25;

export class BudgetExhausted extends Error {}

export class PagesApi {
  constructor(
    private readonly accountId: string,
    private readonly token: string,
    private budget: number,
  ) {}

  async liveProductionId(project: string): Promise<string | undefined> {
    const { result } = await this.request<Project>(`/pages/projects/${project}`);
    return result.canonical_deployment?.id;
  }

  /** One page of deployments, newest first. */
  async listPage(project: string, environment: Environment, page: number): Promise<Page> {
    const query = `env=${environment}&per_page=${PAGE_SIZE}&page=${page}`;
    const { result, result_info } = await this.request<Deployment[]>(
      `/pages/projects/${project}/deployments?${query}`,
    );
    return { deployments: result, total: result_info?.total_count ?? result.length };
  }

  async deleteDeployment(project: string, id: string): Promise<void> {
    await this.request(`/pages/projects/${project}/deployments/${id}`, "DELETE");
  }

  private async request<T>(path: string, method = "GET"): Promise<Envelope<T>> {
    if (this.budget <= 0) throw new BudgetExhausted();
    this.budget--;
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}${path}`;
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const body = (await response.json()) as Envelope<T>;
    if (!response.ok || !body.success) {
      throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(body.errors)}`);
    }
    return body;
  }
}
