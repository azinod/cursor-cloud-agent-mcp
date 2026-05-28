#!/usr/bin/env node

/**
 * MCP Server for Cursor Cloud Agents API v1
 * Implements Model Context Protocol over stdio
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CursorApiClient } from './api-client.js';
import { MCP_TOOLS } from './mcp-tools.js';
import { handleToolCall } from './tool-handlers.js';

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

let apiClient: CursorApiClient;

try {
  apiClient = new CursorApiClient(getApiKey());
} catch (error) {
  console.error('Failed to initialize API client:', error);
  process.exit(1);
}

const server = new Server(
  {
    name: 'cursor-cloud-agent-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: MCP_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    return await handleToolCall(
      apiClient,
      name,
      (args as Record<string, unknown> | undefined) ?? undefined
    );
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cursor Cloud Agent MCP server (API v1) running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
