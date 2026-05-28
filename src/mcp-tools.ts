/**
 * MCP tool definitions for Cursor Cloud Agents API v1
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const imageItemSchema = {
  type: 'object',
  description:
    'Image input: provide data+mimeType+dimension, or url+dimension (mimeType omitted for url).',
  properties: {
    data: {
      type: 'string',
      description: 'Base64 encoded image bytes (max 15 MB). Mutually exclusive with url.',
    },
    url: {
      type: 'string',
      description: 'HTTP(S) URL for Cursor to fetch. Mutually exclusive with data.',
    },
    mimeType: {
      type: 'string',
      description:
        'Required with data (image/png, image/jpeg, image/gif, image/webp). Omit when using url.',
    },
    dimension: {
      type: 'object',
      properties: {
        width: { type: 'number', minimum: 1 },
        height: { type: 'number', minimum: 1 },
      },
      required: ['width', 'height'],
    },
  },
} as const;

const promptSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'Instruction text for the agent or run.',
    },
    images: {
      type: 'array',
      maxItems: 5,
      items: imageItemSchema,
    },
  },
  required: ['text'],
} as const;

const modelRefSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Model ID from list_models. Omit model entirely to use the configured default.',
    },
    params: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['id', 'value'],
      },
    },
  },
  required: ['id'],
} as const;

const repoConfigSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'GitHub repository URL (required even when prUrl is set).',
    },
    startingRef: {
      type: 'string',
      description: 'Branch or commit SHA. Ignored when prUrl is set.',
    },
    prUrl: {
      type: 'string',
      description: 'GitHub PR URL; agent works on that PR repo/branches.',
    },
  },
  required: ['url'],
} as const;

const agentIdProperty = {
  type: 'string',
  description: 'Agent ID (e.g. bc-00000000-0000-0000-0000-000000000001).',
} as const;

const runIdProperty = {
  type: 'string',
  description: 'Run ID (e.g. run-00000000-0000-0000-0000-000000000001).',
} as const;

export const MCP_TOOLS: Tool[] = [
  {
    name: 'list_agents',
    description:
      'List cloud agents (v1), newest first. Returns items[] and optional nextCursor. Agent execution status is on runs, not agents.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Number of agents to return.',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from a previous response.',
        },
        prUrl: {
          type: 'string',
          description: 'Filter agents by GitHub pull request URL.',
        },
        includeArchived: {
          type: 'boolean',
          default: true,
          description: 'Include archived agents.',
        },
      },
    },
  },
  {
    name: 'get_agent',
    description:
      'Get durable agent metadata (v1). Use list_runs/get_run for execution status and results.',
    inputSchema: {
      type: 'object',
      properties: { id: agentIdProperty },
      required: ['id'],
    },
  },
  {
    name: 'create_agent',
    description:
      'Create a cloud agent and enqueue its initial run (POST /v1/agents). Returns { agent, run }. Breaking change: replaces v0 launch_agent.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: promptSchema,
        model: modelRefSchema,
        name: { type: 'string', description: 'Display name; auto-derived from prompt if omitted.' },
        agentId: {
          type: 'string',
          description:
            'Optional client-supplied bc-<uuid> ID. Cannot combine with envVars.',
        },
        env: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['cloud', 'pool', 'machine'] },
            name: { type: 'string' },
          },
          required: ['type'],
        },
        repos: {
          type: 'array',
          maxItems: 20,
          items: repoConfigSchema,
          description: 'Repository config. Omit or [] for no-repo agents.',
        },
        workOnCurrentBranch: {
          type: 'boolean',
          description: 'When true, push to starting ref/PR head; when false, use cursor/... branch.',
        },
        autoCreatePR: { type: 'boolean' },
        skipReviewerRequest: { type: 'boolean' },
        envVars: {
          type: 'object',
          description: 'Session-scoped env vars (max 50). Cannot combine with agentId.',
          additionalProperties: { type: 'string' },
        },
        mcpServers: {
          type: 'array',
          maxItems: 50,
          description: 'Inline MCP servers for the initial run.',
          items: { type: 'object' },
        },
        customSubagents: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              prompt: { type: 'string' },
              model: {},
            },
            required: ['name', 'description', 'prompt'],
          },
        },
        mode: {
          type: 'string',
          enum: ['agent', 'plan'],
          description: 'Initial conversation mode for the first run.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'create_run',
    description:
      'Send a follow-up prompt as a new run on an existing agent (POST /v1/agents/{id}/runs). Breaking change: replaces v0 add_followup; returns { run }.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: agentIdProperty,
        prompt: promptSchema,
        mcpServers: {
          type: 'array',
          maxItems: 50,
          description: 'Inline MCP servers for this run (replaces create-time servers for this run).',
          items: { type: 'object' },
        },
        mode: { type: 'string', enum: ['agent', 'plan'] },
      },
      required: ['agentId', 'prompt'],
    },
  },
  {
    name: 'list_runs',
    description: 'List runs for an agent, newest first (GET /v1/agents/{id}/runs).',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: agentIdProperty,
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        cursor: { type: 'string' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'get_run',
    description: 'Get run status, result text, and git snapshot (GET /v1/agents/{id}/runs/{runId}).',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: agentIdProperty,
        runId: runIdProperty,
      },
      required: ['agentId', 'runId'],
    },
  },
  {
    name: 'cancel_run',
    description:
      'Cancel an active run (POST .../cancel). Terminal state CANCELLED. Breaking change: replaces v0 stop_agent; requires runId.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: agentIdProperty,
        runId: runIdProperty,
      },
      required: ['agentId', 'runId'],
    },
  },
  {
    name: 'stream_run',
    description:
      'Read Server-Sent Events for a run until complete or limits. For long runs, poll get_run or reconnect with lastEventId. Not a live subscription over MCP.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: agentIdProperty,
        runId: runIdProperty,
        lastEventId: {
          type: 'string',
          description: 'Resume after disconnect (Last-Event-ID header).',
        },
        maxEvents: {
          type: 'number',
          minimum: 1,
          description: 'Max SSE events to collect (default 500).',
        },
        maxBytes: {
          type: 'number',
          minimum: 1,
          description: 'Max raw stream bytes (default 2097152).',
        },
      },
      required: ['agentId', 'runId'],
    },
  },
  {
    name: 'archive_agent',
    description: 'Archive an agent; archived agents cannot accept new runs until unarchived.',
    inputSchema: {
      type: 'object',
      properties: { id: agentIdProperty },
      required: ['id'],
    },
  },
  {
    name: 'unarchive_agent',
    description: 'Unarchive an agent so it can accept new runs again.',
    inputSchema: {
      type: 'object',
      properties: { id: agentIdProperty },
      required: ['id'],
    },
  },
  {
    name: 'delete_agent',
    description: 'Permanently delete an agent. Irreversible; use archive_agent for reversible removal.',
    inputSchema: {
      type: 'object',
      properties: { id: agentIdProperty },
      required: ['id'],
    },
  },
  {
    name: 'list_artifacts',
    description: 'List artifacts under the agent workspace artifacts/ directory.',
    inputSchema: {
      type: 'object',
      properties: { agentId: agentIdProperty },
      required: ['agentId'],
    },
  },
  {
    name: 'download_artifact',
    description: 'Get a 15-minute presigned URL for an artifact path from list_artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: agentIdProperty,
        path: {
          type: 'string',
          description: 'Relative path under artifacts/ (e.g. artifacts/screenshot.png).',
        },
      },
      required: ['agentId', 'path'],
    },
  },
  {
    name: 'get_api_key_info',
    description: 'Retrieve metadata for the API key used for authentication (GET /v1/me).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_models',
    description: 'List recommended models for create_agent model.id (GET /v1/models).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_repositories',
    description:
      'List GitHub repositories accessible via Cursor GitHub App. Strict rate limits (1/min, 30/hour).',
    inputSchema: { type: 'object', properties: {} },
  },
];
