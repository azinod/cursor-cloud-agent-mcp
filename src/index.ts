#!/usr/bin/env node

/**
 * MCP Server for Cursor Cloud Agents API
 * Implements Model Context Protocol over stdio
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { FollowUpRequest, LaunchAgentRequest } from './api-client.js';
import { CursorApiClient } from './api-client.js';

const API_KEY_ENV = 'CURSOR_API_KEY';

function getApiKey(): string {
  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) {
    throw new Error(
      `API key not found. Please set the ${API_KEY_ENV} environment variable.`
    );
  }
  return apiKey;
}

// Initialize API client
let apiClient: CursorApiClient;

try {
  apiClient = new CursorApiClient(getApiKey());
} catch (error) {
  console.error('Failed to initialize API client:', error);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: 'cursor-agent-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const tools: Tool[] = [
  {
    name: 'list_agents',
    description: 'List all cloud agents for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of cloud agents to return (default: 20, max: 100)',
          minimum: 1,
          maximum: 100,
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from the previous response',
        },
      },
    },
  },
  {
    name: 'get_agent',
    description: 'Retrieve the current status and results of a cloud agent',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for the cloud agent (e.g., bc_abc123)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_agent_conversation',
    description: 'Retrieve the conversation history of a cloud agent, including all user prompts and assistant responses',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for the cloud agent (e.g., bc_abc123)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'launch_agent',
    description: 'Start a new cloud agent to work on your repository',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The instruction text for the agent',
            },
            images: {
              type: 'array',
              description: 'Array of image objects with base64 data and dimensions (max 5)',
              items: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    description: 'Base64 encoded image data',
                  },
                  dimension: {
                    type: 'object',
                    properties: {
                      width: { type: 'number' },
                      height: { type: 'number' },
                    },
                    required: ['width', 'height'],
                  },
                },
                required: ['data', 'dimension'],
              },
              maxItems: 5,
            },
          },
          required: ['text'],
        },
        model: {
          type: 'string',
          description: 'The LLM to use (e.g., claude-4-sonnet). If not provided, we will pick the most appropriate model.',
        },
        source: {
          type: 'object',
          properties: {
            repository: {
              type: 'string',
              description: 'GitHub repository URL (e.g., https://github.com/your-org/your-repo)',
            },
            ref: {
              type: 'string',
              description: 'Git ref (branch name, tag, or commit hash) to use as the base branch',
            },
          },
          required: ['repository'],
        },
        target: {
          type: 'object',
          properties: {
            autoCreatePr: {
              type: 'boolean',
              description: 'Whether to automatically create a pull request when the agent completes',
            },
            openAsCursorGithubApp: {
              type: 'boolean',
              description: 'Whether to open the pull request as the Cursor GitHub App instead of as the user',
            },
            skipReviewerRequest: {
              type: 'boolean',
              description: 'Whether to skip adding the user as a reviewer to the pull request',
            },
            branchName: {
              type: 'string',
              description: 'Custom branch name for the agent to create',
            },
          },
        },
        webhook: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to receive webhook notifications about agent status changes',
            },
            secret: {
              type: 'string',
              description: 'Secret key for webhook payload verification (minimum 32 characters)',
            },
          },
          required: ['url'],
        },
      },
      required: ['prompt', 'source'],
    },
  },
  {
    name: 'add_followup',
    description: 'Add a follow-up instruction to an existing cloud agent',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for the cloud agent (e.g., bc_abc123)',
        },
        prompt: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The follow-up instruction text for the agent',
            },
            images: {
              type: 'array',
              description: 'Array of image objects with base64 data and dimensions (max 5)',
              items: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    description: 'Base64 encoded image data',
                  },
                  dimension: {
                    type: 'object',
                    properties: {
                      width: { type: 'number' },
                      height: { type: 'number' },
                    },
                    required: ['width', 'height'],
                  },
                },
                required: ['data', 'dimension'],
              },
              maxItems: 5,
            },
          },
          required: ['text'],
        },
      },
      required: ['id', 'prompt'],
    },
  },
  {
    name: 'stop_agent',
    description: 'Stop a running cloud agent. This pauses the agent\'s execution without deleting it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for the cloud agent (e.g., bc_abc123)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_agent',
    description: 'Delete a cloud agent. This action is permanent and cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for the cloud agent (e.g., bc_abc123)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_api_key_info',
    description: 'Retrieve information about the API key being used for authentication',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_models',
    description: 'Retrieve a list of recommended models for cloud agents',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_repositories',
    description: 'Retrieve a list of GitHub repositories accessible to the authenticated user. Note: This endpoint has strict rate limits (1/user/minute, 30/user/hour)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_agents': {
        const agents = await apiClient.listAgents(
          args?.limit as number | undefined,
          args?.cursor as string | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agents, null, 2),
            },
          ],
        };
      }

      case 'get_agent': {
        const agent = await apiClient.getAgent(args?.id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agent, null, 2),
            },
          ],
        };
      }

      case 'get_agent_conversation': {
        const conversation = await apiClient.getAgentConversation(
          args?.id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(conversation, null, 2),
            },
          ],
        };
      }

      case 'launch_agent': {
        const agent = await apiClient.launchAgent({
          prompt: args?.prompt as LaunchAgentRequest['prompt'],
          model: args?.model as string | undefined,
          source: args?.source as { repository: string; ref?: string },
          target: args?.target as {
            autoCreatePr?: boolean;
            openAsCursorGithubApp?: boolean;
            skipReviewerRequest?: boolean;
            branchName?: string;
          } | undefined,
          webhook: args?.webhook as {
            url: string;
            secret?: string;
          } | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agent, null, 2),
            },
          ],
        };
      }

      case 'add_followup': {
        const result = await apiClient.addFollowUp(
          args?.id as string,
          {
            prompt: args?.prompt as FollowUpRequest['prompt'],
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'stop_agent': {
        const result = await apiClient.stopAgent(args?.id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete_agent': {
        const result = await apiClient.deleteAgent(args?.id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_api_key_info': {
        const info = await apiClient.getApiKeyInfo();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }

      case 'list_models': {
        const models = await apiClient.listModels();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      }

      case 'list_repositories': {
        const repos = await apiClient.listRepositories();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(repos, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cursor Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});

