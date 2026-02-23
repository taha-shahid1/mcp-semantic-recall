#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/index.js';
import { embeddingService } from './lib/embeddings.js';
import { databaseService } from './lib/database.js';

const createServer = () => {
  const server = new McpServer(
    {
      name: 'mcp-semantic-recall',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerTools(server);
  return server;
};

async function main(): Promise<void> {
  console.error('Initializing MCP Semantic Recall...');

  await embeddingService.initialize();
  await databaseService.initialize();

  console.error('Services initialized successfully');

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('MCP Semantic Recall server running on stdio');

  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await databaseService.close();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
