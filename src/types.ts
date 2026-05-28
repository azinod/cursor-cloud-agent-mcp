/**
 * TypeScript types aligned with Cursor Cloud Agents API v1 OpenAPI.
 * @see https://cursor.com/docs-static/cloud-agents-openapi.yaml
 */

export interface ImageDimension {
  width: number;
  height: number;
}

/** Image with base64 data (requires mimeType). */
export interface ImageDataInput {
  data: string;
  mimeType: string;
  dimension?: ImageDimension;
  url?: never;
}

/** Image fetched from URL (mimeType must be omitted). */
export interface ImageUrlInput {
  url: string;
  dimension?: ImageDimension;
  data?: never;
  mimeType?: never;
}

export type Image = ImageDataInput | ImageUrlInput;

export interface PromptInput {
  text: string;
  images?: Image[];
}

export interface ModelParam {
  id: string;
  value: string;
}

export interface ModelRef {
  id: string;
  params?: ModelParam[];
}

export interface RepoConfig {
  url: string;
  startingRef?: string;
  prUrl?: string;
}

export type AgentEnvType = 'cloud' | 'pool' | 'machine';

export interface AgentEnv {
  type: AgentEnvType;
  name?: string;
}

export interface McpAuth {
  CLIENT_ID: string;
  CLIENT_SECRET?: string;
  scopes?: string[];
}

export interface StdioMcpServer {
  name: string;
  command: string;
  type?: 'stdio';
  args?: string[];
  env?: Record<string, string>;
}

export interface RemoteMcpServer {
  name: string;
  url: string;
  type?: 'http' | 'sse';
  headers?: Record<string, string>;
  auth?: McpAuth;
}

export type McpServer = StdioMcpServer | RemoteMcpServer;

export interface CustomSubagent {
  name: string;
  description: string;
  prompt: string;
  model?: 'inherit' | string | ModelRef;
}

export type AgentMode = 'agent' | 'plan';

export type AgentLifecycleStatus = 'ACTIVE' | 'ARCHIVED';

export type RunStatus =
  | 'CREATING'
  | 'RUNNING'
  | 'FINISHED'
  | 'ERROR'
  | 'CANCELLED'
  | 'EXPIRED';

export interface AgentSummary {
  id: string;
  name?: string;
  status: AgentLifecycleStatus;
  env: AgentEnv;
  url: string;
  createdAt: string;
  updatedAt: string;
  latestRunId?: string;
}

export interface Agent extends AgentSummary {
  repos?: RepoConfig[];
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
  skipReviewerRequest?: boolean;
  customSubagents?: CustomSubagent[];
}

export interface RunGitBranch {
  repoUrl: string;
  branch?: string;
  prUrl?: string;
}

export interface RunGit {
  branches: RunGitBranch[];
}

export interface Run {
  id: string;
  agentId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  result?: string;
  git?: RunGit;
}

export interface CreateAgentRequest {
  prompt: PromptInput;
  model?: ModelRef;
  name?: string;
  agentId?: string;
  env?: AgentEnv;
  repos?: RepoConfig[];
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
  skipReviewerRequest?: boolean;
  envVars?: Record<string, string>;
  mcpServers?: McpServer[];
  customSubagents?: CustomSubagent[];
  mode?: AgentMode;
}

export interface CreateRunRequest {
  prompt: PromptInput;
  mcpServers?: McpServer[];
  mode?: AgentMode;
}

export interface CreateAgentResponse {
  agent: Agent;
  run: Run;
}

export interface CreateRunResponse {
  run: Run;
}

export interface ListAgentsResponse {
  items: AgentSummary[];
  nextCursor?: string;
}

export interface ListRunsResponse {
  items: Run[];
  nextCursor?: string;
}

export interface IdResponse {
  id: string;
}

export interface Artifact {
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface ListArtifactsResponse {
  items: Artifact[];
}

export interface DownloadArtifactResponse {
  url: string;
  expiresAt: string;
}

export interface ApiKeyInfo {
  apiKeyName: string;
  createdAt: string;
  userId?: number;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
}

export interface ModelParameterValueDefinition {
  value: string;
  displayName?: string;
}

export interface ModelParameterDefinition {
  id: string;
  displayName?: string;
  values: ModelParameterValueDefinition[];
}

export interface ModelVariant {
  params: ModelParam[];
  displayName: string;
  description?: string;
  isDefault?: boolean;
}

export interface ModelListItem {
  id: string;
  displayName: string;
  description?: string;
  aliases?: string[];
  parameters?: ModelParameterDefinition[];
  variants?: ModelVariant[];
}

export interface ListModelsResponse {
  items: ModelListItem[];
}

export interface Repository {
  url: string;
}

export interface ListRepositoriesResponse {
  items: Repository[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    helpUrl?: string;
    provider?: string;
  };
}

export interface StreamRunOptions {
  lastEventId?: string;
  /** Stop after this many SSE data events (default 500). */
  maxEvents?: number;
  /** Stop after this many bytes of raw stream (default 2MB). */
  maxBytes?: number;
}

export interface StreamRunResult {
  events: Array<{
    id?: string;
    event: string;
    data: string;
  }>;
  truncated: boolean;
  retentionSeconds?: number;
}
