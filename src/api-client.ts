/**
 * API client for Cursor Cloud Agents API v1
 */

import type {
  Agent,
  ApiErrorBody,
  ApiKeyInfo,
  CreateAgentRequest,
  CreateAgentResponse,
  CreateRunRequest,
  CreateRunResponse,
  DownloadArtifactResponse,
  IdResponse,
  ListAgentsResponse,
  ListArtifactsResponse,
  ListModelsResponse,
  ListRepositoriesResponse,
  ListRunsResponse,
  Run,
  StreamRunOptions,
  StreamRunResult,
} from './types.js';

export type {
  Agent,
  AgentEnv,
  AgentMode,
  AgentSummary,
  AgentLifecycleStatus,
  ApiKeyInfo,
  Artifact,
  CreateAgentRequest,
  CreateAgentResponse,
  CreateRunRequest,
  CreateRunResponse,
  CustomSubagent,
  DownloadArtifactResponse,
  Image,
  ImageDataInput,
  ImageUrlInput,
  ListAgentsResponse,
  ListArtifactsResponse,
  ListModelsResponse,
  ListRepositoriesResponse,
  ListRunsResponse,
  McpServer,
  ModelListItem,
  ModelRef,
  PromptInput,
  RemoteMcpServer,
  RepoConfig,
  Repository,
  Run,
  RunStatus,
  StdioMcpServer,
  StreamRunResult,
} from './types.js';

interface LegacyApiErrorResponse {
  message?: string;
  error?: string;
}

export function formatApiError(
  status: number,
  body: unknown,
  fallback: string
): string {
  if (body && typeof body === 'object') {
    const v1 = body as ApiErrorBody;
    if (v1.error?.message) {
      const code = v1.error.code ? ` (${v1.error.code})` : '';
      return `${v1.error.message}${code}`;
    }
    const legacy = body as LegacyApiErrorResponse;
    if (legacy.message || legacy.error) {
      return legacy.message || legacy.error || fallback;
    }
  }
  return fallback;
}

export function buildBasicAuthHeader(apiKey: string): string {
  const encoded = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${encoded}`;
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

  getAuthHeader(): string {
    return buildBasicAuthHeader(this.apiKey);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      ...extraHeaders,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = formatApiError(response.status, errorData, errorMessage);
      } catch {
        // Ignore JSON parse errors
      }

      if (response.status === 429) {
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      }
      if (response.status === 401) {
        throw new Error(`Authentication failed: ${errorMessage}`);
      }
      if (response.status === 403) {
        throw new Error(`Forbidden: ${errorMessage}`);
      }
      if (response.status === 404) {
        throw new Error(`Not found: ${errorMessage}`);
      }
      if (response.status === 409) {
        throw new Error(`Conflict: ${errorMessage}`);
      }
      if (response.status === 410) {
        throw new Error(`Gone: ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  private buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        search.append(key, String(value));
      }
    }
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  async listAgents(options?: {
    limit?: number;
    cursor?: string;
    prUrl?: string;
    includeArchived?: boolean;
  }): Promise<ListAgentsResponse> {
    return this.request<ListAgentsResponse>(
      'GET',
      `/v1/agents${this.buildQuery({
        limit: options?.limit,
        cursor: options?.cursor,
        prUrl: options?.prUrl,
        includeArchived: options?.includeArchived,
      })}`
    );
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>('GET', `/v1/agents/${encodeURIComponent(id)}`);
  }

  async createAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
    return this.request<CreateAgentResponse>('POST', '/v1/agents', request);
  }

  async deleteAgent(id: string): Promise<IdResponse> {
    return this.request<IdResponse>(
      'DELETE',
      `/v1/agents/${encodeURIComponent(id)}`
    );
  }

  async archiveAgent(id: string): Promise<IdResponse> {
    return this.request<IdResponse>(
      'POST',
      `/v1/agents/${encodeURIComponent(id)}/archive`
    );
  }

  async unarchiveAgent(id: string): Promise<IdResponse> {
    return this.request<IdResponse>(
      'POST',
      `/v1/agents/${encodeURIComponent(id)}/unarchive`
    );
  }

  async createRun(agentId: string, request: CreateRunRequest): Promise<CreateRunResponse> {
    return this.request<CreateRunResponse>(
      'POST',
      `/v1/agents/${encodeURIComponent(agentId)}/runs`,
      request
    );
  }

  async listRuns(
    agentId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<ListRunsResponse> {
    return this.request<ListRunsResponse>(
      'GET',
      `/v1/agents/${encodeURIComponent(agentId)}/runs${this.buildQuery({
        limit: options?.limit,
        cursor: options?.cursor,
      })}`
    );
  }

  async getRun(agentId: string, runId: string): Promise<Run> {
    return this.request<Run>(
      'GET',
      `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`
    );
  }

  async cancelRun(agentId: string, runId: string): Promise<IdResponse> {
    return this.request<IdResponse>(
      'POST',
      `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/cancel`
    );
  }

  async streamRun(
    agentId: string,
    runId: string,
    options?: StreamRunOptions
  ): Promise<StreamRunResult> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    };
    if (options?.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId;
    }

    const url = `${this.baseUrl}/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/stream`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(),
        ...headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = formatApiError(response.status, errorData, errorMessage);
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    const retentionHeader = response.headers.get('X-Cursor-Stream-Retention-Seconds');
    const retentionSeconds = retentionHeader ? Number(retentionHeader) : undefined;

    const maxEvents = options?.maxEvents ?? 500;
    const maxBytes = options?.maxBytes ?? 2 * 1024 * 1024;
    const events: StreamRunResult['events'] = [];
    let bytesRead = 0;
    let truncated = false;

    const body = response.body;
    if (!body) {
      return { events, truncated: false, retentionSeconds };
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const flushBlock = (block: string) => {
      if (!block.trim()) return;
      let id: string | undefined;
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('id:')) {
          id = line.slice(3).trim();
        } else if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length > 0) {
        events.push({ id, event, data: dataLines.join('\n') });
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        truncated = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let splitIndex: number;
      while ((splitIndex = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        flushBlock(block);
        if (events.length >= maxEvents) {
          truncated = true;
          await reader.cancel();
          return { events, truncated, retentionSeconds };
        }
      }
    }

    if (buffer.trim()) {
      flushBlock(buffer);
    }

    if (events.length >= maxEvents) {
      truncated = true;
    }

    return { events, truncated, retentionSeconds };
  }

  async listArtifacts(agentId: string): Promise<ListArtifactsResponse> {
    return this.request<ListArtifactsResponse>(
      'GET',
      `/v1/agents/${encodeURIComponent(agentId)}/artifacts`
    );
  }

  async downloadArtifact(agentId: string, path: string): Promise<DownloadArtifactResponse> {
    return this.request<DownloadArtifactResponse>(
      'GET',
      `/v1/agents/${encodeURIComponent(agentId)}/artifacts/download${this.buildQuery({ path })}`
    );
  }

  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    return this.request<ApiKeyInfo>('GET', '/v1/me');
  }

  async listModels(): Promise<ListModelsResponse> {
    return this.request<ListModelsResponse>('GET', '/v1/models');
  }

  async listRepositories(): Promise<ListRepositoriesResponse> {
    return this.request<ListRepositoriesResponse>('GET', '/v1/repositories');
  }
}
