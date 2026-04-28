/**
 * API client for Cursor Cloud Agents API
 */

export interface Agent {
  id: string;
  name: string;
  status: 'CREATING' | 'RUNNING' | 'FINISHED' | 'STOPPED' | 'FAILED';
  source: {
    repository: string;
    ref?: string;
  };
  target: {
    branchName?: string;
    url?: string;
    prUrl?: string;
    autoCreatePr?: boolean;
    openAsCursorGithubApp?: boolean;
    skipReviewerRequest?: boolean;
  };
  summary?: string;
  createdAt: string;
}

export interface AgentListResponse {
  agents: Agent[];
  nextCursor?: string;
}

export interface ConversationMessage {
  id: string;
  type: 'user_message' | 'assistant_message';
  text: string;
}

export interface AgentConversation {
  id: string;
  messages: ConversationMessage[];
}

export interface LaunchAgentRequest {
  prompt: {
    text: string;
    images?: Array<{
      data: string;
      dimension: {
        width: number;
        height: number;
      };
    }>;
  };
  model?: string;
  source: {
    repository: string;
    ref?: string;
  };
  target?: {
    autoCreatePr?: boolean;
    openAsCursorGithubApp?: boolean;
    skipReviewerRequest?: boolean;
    branchName?: string;
  };
  webhook?: {
    url: string;
    secret?: string;
  };
}

export interface FollowUpRequest {
  prompt: {
    text: string;
    images?: Array<{
      data: string;
      dimension: {
        width: number;
        height: number;
      };
    }>;
  };
}

export interface ApiKeyInfo {
  apiKeyName: string;
  createdAt: string;
  userEmail: string;
}

export interface ModelsResponse {
  models: string[];
}

export interface Repository {
  owner: string;
  name: string;
  repository: string;
}

export interface RepositoriesResponse {
  repositories: Repository[];
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

export class CursorApiClient {
  private baseUrl = 'https://api.cursor.com';
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = apiKey;
  }

  private getAuthHeader(): string {
    const encoded = Buffer.from(`${this.apiKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = (await response.json()) as ApiErrorResponse;
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }

      if (response.status === 429) {
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      } else if (response.status === 401) {
        throw new Error(`Authentication failed: ${errorMessage}`);
      } else if (response.status === 403) {
        throw new Error(`Forbidden: ${errorMessage}`);
      } else if (response.status === 404) {
        throw new Error(`Not found: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  async listAgents(limit?: number, cursor?: string): Promise<AgentListResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }
    if (cursor) {
      params.append('cursor', cursor);
    }
    const query = params.toString();
    return this.request<AgentListResponse>(
      'GET',
      `/v0/agents${query ? `?${query}` : ''}`
    );
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>('GET', `/v0/agents/${id}`);
  }

  async getAgentConversation(id: string): Promise<AgentConversation> {
    return this.request<AgentConversation>('GET', `/v0/agents/${id}/conversation`);
  }

  async launchAgent(request: LaunchAgentRequest): Promise<Agent> {
    return this.request<Agent>('POST', '/v0/agents', request);
  }

  async addFollowUp(id: string, request: FollowUpRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', `/v0/agents/${id}/followup`, request);
  }

  async stopAgent(id: string): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', `/v0/agents/${id}/stop`);
  }

  async deleteAgent(id: string): Promise<{ id: string }> {
    return this.request<{ id: string }>('DELETE', `/v0/agents/${id}`);
  }

  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    return this.request<ApiKeyInfo>('GET', '/v0/me');
  }

  async listModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('GET', '/v0/models');
  }

  async listRepositories(): Promise<RepositoriesResponse> {
    return this.request<RepositoriesResponse>('GET', '/v0/repositories');
  }
}

