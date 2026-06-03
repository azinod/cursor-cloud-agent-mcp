# Cursor Cloud Agent MCP Connector

A Model Context Protocol (MCP) server that exposes the **Cursor Cloud Agents API v1** over stdio transport. Create durable agents, manage runs, stream progress, and work with artifacts programmatically from any MCP-compatible client.

## Overview

This package (`@azinod/cursor-cloud-agent-mcp` **v2.x**) maps v1 REST endpoints to MCP tools. v1 separates a durable **agent** from one or more **runs**: each prompt creates a run; status, results, streaming, and cancellation are run-scoped.

- **OpenAPI (v1)**: <https://cursor.com/docs-static/cloud-agents-openapi.yaml>
- **API docs**: <https://cursor.com/docs/cloud-agent/api/endpoints>
- **Legacy v0 OpenAPI**: <https://cursor.com/docs-static/cloud-agents-openapi-v0.yaml>

Authentication uses `CURSOR_API_KEY` with HTTP Basic Auth (API key as username, empty password), matching Cursor’s documentation.

## Breaking changes in v2.0.0

| v1.x (v0 API) | v2.0.0 (v1 API) | Notes |
|---------------|-----------------|-------|
| `launch_agent` | `create_agent` | Returns `{ agent, run }`, not a single agent object |
| `add_followup` | `create_run` | Requires `agentId`; returns `{ run }` |
| `stop_agent` | `cancel_run` | Requires `agentId` and `runId` |
| `get_agent_conversation` | *(removed)* | Use `get_run`, `list_runs`, or `stream_run` |
| `list_agents` response | `items` + `nextCursor` | Was `agents` |
| `list_models` response | `items` | Was `models` string array |
| `list_repositories` response | `items[].url` | Was `repositories[]` with owner/name |
| Agent status | `ACTIVE` / `ARCHIVED` | Run status: `CREATING`, `RUNNING`, `FINISHED`, etc. |
| Image inputs | `data` + `mimeType` or `url` | v0 used `data` + `dimension` only |

## Features

- **v1 agent + run lifecycle**: create agents, follow-up runs, list/get runs, cancel runs, SSE stream helper
- **Agent lifecycle**: archive, unarchive, permanent delete
- **Artifacts**: list and presigned download URLs
- **Metadata**: API key info, models (with params/variants), repositories
- **Create-time options**: `repos`, `workOnCurrentBranch`, `autoCreatePR`, `skipReviewerRequest`, `env`, `envVars`, `mcpServers`, `customSubagents`, `mode`, v1 image shape
- **Type-safe TypeScript** types aligned with the v1 OpenAPI spec
- **Secure auth**: `CURSOR_API_KEY` via Basic Auth (no secrets logged or stored)

## Installation

### Prerequisites

- Node.js 18+
- Cursor API key ([Cursor Dashboard → Integrations](https://cursor.com/dashboard))

### Quick start (npx)

```bash
export CURSOR_API_KEY=key_...
npx @azinod/cursor-cloud-agent-mcp
```

If `npx` fails from a stale cache: `rm -rf ~/.npm/_npx` and retry.

### MCP client configuration

```json
{
  "mcpServers": {
    "cursor-cloud-agents": {
      "command": "npx",
      "args": ["-y", "@azinod/cursor-cloud-agent-mcp"],
      "env": {
        "CURSOR_API_KEY": "your-api-key-here",
        "NODE_TLS_REJECT_UNAUTHORIZED": "1"
      }
    }
  }
}
```

## Available MCP tools (16)

### Agents

| Tool | HTTP | Description |
|------|------|-------------|
| `list_agents` | `GET /v1/agents` | Paginated agents (`limit`, `cursor`, `prUrl`, `includeArchived`) |
| `get_agent` | `GET /v1/agents/{id}` | Durable agent metadata |
| `create_agent` | `POST /v1/agents` | Create agent + initial run |
| `archive_agent` | `POST /v1/agents/{id}/archive` | Archive (no new runs) |
| `unarchive_agent` | `POST /v1/agents/{id}/unarchive` | Restore active agent |
| `delete_agent` | `DELETE /v1/agents/{id}` | Permanent delete |

### Runs

| Tool | HTTP | Description |
|------|------|-------------|
| `create_run` | `POST /v1/agents/{id}/runs` | Follow-up prompt as new run |
| `list_runs` | `GET /v1/agents/{id}/runs` | Paginated runs |
| `get_run` | `GET /v1/agents/{id}/runs/{runId}` | Status, `result`, `git` |
| `cancel_run` | `POST .../runs/{runId}/cancel` | Cancel active run |
| `stream_run` | `GET .../runs/{runId}/stream` | Collect SSE events (bounded; see below) |

### Artifacts & metadata

| Tool | HTTP | Description |
|------|------|-------------|
| `list_artifacts` | `GET /v1/agents/{id}/artifacts` | Workspace artifacts |
| `download_artifact` | `GET .../artifacts/download?path=` | 15-minute presigned URL |
| `get_api_key_info` | `GET /v1/me` | API key metadata |
| `list_models` | `GET /v1/models` | Models for `create_agent.model.id` |
| `list_repositories` | `GET /v1/repositories` | GitHub repos (strict rate limits) |

### `create_agent` highlights

- **`prompt`**: `{ text, images? }` — images use `data`+`mimeType` or `url` (see OpenAPI)
- **`repos`**: `[{ url, startingRef?, prUrl? }]`
- **`model`**: `{ id, params? }` — omit for default model
- **`workOnCurrentBranch`**, **`autoCreatePR`**, **`skipReviewerRequest`**
- **`env`**: `{ type: cloud|pool|machine, name? }`
- **`envVars`**, **`mcpServers`**, **`customSubagents`**, **`mode`**: `agent` | `plan`

Response: `{ "agent": { ... }, "run": { ... } }` — store `run.id` for polling and cancellation.

### `stream_run` behavior

MCP stdio is request/response; this tool **reads the SSE stream until the run ends or limits are hit** (`maxEvents`, `maxBytes`), then returns collected events as JSON. For long runs, prefer polling `get_run` or calling `stream_run` again with `lastEventId` to resume.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

### Project structure

```
src/
  index.ts           # MCP server entry
  api-client.ts      # v1 HTTP client
  types.ts           # OpenAPI-aligned types
  mcp-tools.ts       # Tool schemas
  tool-handlers.ts   # Tool dispatch
  api-client.test.ts # Unit tests (no live API)
```

## Rate limits

`list_repositories` is heavily rate-limited (about 1/min, 30/hour). The client surfaces `429` with clear messages; implement backoff in your client.

## Error handling

v1 errors use `{ "error": { "code", "message" } }`. The MCP server returns `isError: true` with a text message for tool failures.

## License

MIT

## Package

- npm: [@azinod/cursor-cloud-agent-mcp](https://www.npmjs.com/package/@azinod/cursor-cloud-agent-mcp)
- Issues: [GitHub](https://github.com/azinod/cursor-cloud-agent-mcp/issues)
