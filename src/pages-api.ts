export interface Deployment {
  id: string;
  environment: "production" | "preview";
  created_on: string;
  aliases: string[] | null;
}

interface Envelope<T> {
  success: boolean;
  errors: unknown[];
  result: T;
}

interface Project {
  canonical_deployment: { id: string } | null;
}

const PAGE_SIZE = 100;

export class PagesApi {
  constructor(
    private readonly accountId: string,
    private readonly token: string,
  ) {}

  async liveProductionId(project: string): Promise<string | undefined> {
    const { canonical_deployment } = await this.request<Project>(`/pages/projects/${project}`);
    return canonical_deployment?.id;
  }

  async listDeployments(project: string): Promise<Deployment[]> {
    const deployments: Deployment[] = [];
    for (let page = 1; ; page++) {
      const batch = await this.request<Deployment[]>(
        `/pages/projects/${project}/deployments?per_page=${PAGE_SIZE}&page=${page}`,
      );
      deployments.push(...batch);
      if (batch.length < PAGE_SIZE) return deployments;
    }
  }

  async deleteDeployment(project: string, id: string): Promise<void> {
    await this.request(`/pages/projects/${project}/deployments/${id}`, "DELETE");
  }

  private async request<T>(path: string, method = "GET"): Promise<T> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}${path}`;
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const body = (await response.json()) as Envelope<T>;
    if (!response.ok || !body.success) {
      throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(body.errors)}`);
    }
    return body.result;
  }
}
