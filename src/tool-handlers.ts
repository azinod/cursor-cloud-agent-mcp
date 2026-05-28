/**
 * MCP tool call handlers for Cursor Cloud Agents API v1
 */

import type { CreateAgentRequest, CreateRunRequest } from './api-client.js';
import { CursorApiClient } from './api-client.js';

function jsonContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function getString(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing or invalid required parameter: ${key}`);
  }
  return value;
}

export async function handleToolCall(
  apiClient: CursorApiClient,
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case 'list_agents': {
      const result = await apiClient.listAgents({
        limit: args?.limit as number | undefined,
        cursor: args?.cursor as string | undefined,
        prUrl: args?.prUrl as string | undefined,
        includeArchived: args?.includeArchived as boolean | undefined,
      });
      return jsonContent(result);
    }

    case 'get_agent': {
      const result = await apiClient.getAgent(getString(args, 'id'));
      return jsonContent(result);
    }

    case 'create_agent': {
      const body: CreateAgentRequest = {
        prompt: args?.prompt as CreateAgentRequest['prompt'],
        model: args?.model as CreateAgentRequest['model'],
        name: args?.name as string | undefined,
        agentId: args?.agentId as string | undefined,
        env: args?.env as CreateAgentRequest['env'],
        repos: args?.repos as CreateAgentRequest['repos'],
        workOnCurrentBranch: args?.workOnCurrentBranch as boolean | undefined,
        autoCreatePR: args?.autoCreatePR as boolean | undefined,
        skipReviewerRequest: args?.skipReviewerRequest as boolean | undefined,
        envVars: args?.envVars as Record<string, string> | undefined,
        mcpServers: args?.mcpServers as CreateAgentRequest['mcpServers'],
        customSubagents: args?.customSubagents as CreateAgentRequest['customSubagents'],
        mode: args?.mode as CreateAgentRequest['mode'],
      };
      if (!body.prompt?.text) {
        throw new Error('prompt.text is required');
      }
      const result = await apiClient.createAgent(body);
      return jsonContent(result);
    }

    case 'create_run': {
      const agentId = getString(args, 'agentId');
      const body: CreateRunRequest = {
        prompt: args?.prompt as CreateRunRequest['prompt'],
        mcpServers: args?.mcpServers as CreateRunRequest['mcpServers'],
        mode: args?.mode as CreateRunRequest['mode'],
      };
      if (!body.prompt?.text) {
        throw new Error('prompt.text is required');
      }
      const result = await apiClient.createRun(agentId, body);
      return jsonContent(result);
    }

    case 'list_runs': {
      const agentId = getString(args, 'agentId');
      const result = await apiClient.listRuns(agentId, {
        limit: args?.limit as number | undefined,
        cursor: args?.cursor as string | undefined,
      });
      return jsonContent(result);
    }

    case 'get_run': {
      const result = await apiClient.getRun(
        getString(args, 'agentId'),
        getString(args, 'runId')
      );
      return jsonContent(result);
    }

    case 'cancel_run': {
      const result = await apiClient.cancelRun(
        getString(args, 'agentId'),
        getString(args, 'runId')
      );
      return jsonContent(result);
    }

    case 'stream_run': {
      const result = await apiClient.streamRun(
        getString(args, 'agentId'),
        getString(args, 'runId'),
        {
          lastEventId: args?.lastEventId as string | undefined,
          maxEvents: args?.maxEvents as number | undefined,
          maxBytes: args?.maxBytes as number | undefined,
        }
      );
      return jsonContent(result);
    }

    case 'archive_agent': {
      const result = await apiClient.archiveAgent(getString(args, 'id'));
      return jsonContent(result);
    }

    case 'unarchive_agent': {
      const result = await apiClient.unarchiveAgent(getString(args, 'id'));
      return jsonContent(result);
    }

    case 'delete_agent': {
      const result = await apiClient.deleteAgent(getString(args, 'id'));
      return jsonContent(result);
    }

    case 'list_artifacts': {
      const result = await apiClient.listArtifacts(getString(args, 'agentId'));
      return jsonContent(result);
    }

    case 'download_artifact': {
      const result = await apiClient.downloadArtifact(
        getString(args, 'agentId'),
        getString(args, 'path')
      );
      return jsonContent(result);
    }

    case 'get_api_key_info': {
      const result = await apiClient.getApiKeyInfo();
      return jsonContent(result);
    }

    case 'list_models': {
      const result = await apiClient.listModels();
      return jsonContent(result);
    }

    case 'list_repositories': {
      const result = await apiClient.listRepositories();
      return jsonContent(result);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
