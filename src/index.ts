import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Create MCP server instance
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

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Semantic Recall server running on stdio');

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
