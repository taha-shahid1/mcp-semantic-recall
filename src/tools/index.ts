import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAddMemoryTool } from './add-memory.js';
import { registerSearchMemoriesTool } from './search-memories.js';
import { registerUpdateMemoryTool } from './update-memory.js';
import { registerDeleteMemoryTool } from './delete-memory.js';
import { registerListMemoriesTool } from './list-memories.js';

export const registerTools = (server: McpServer): void => {
  registerAddMemoryTool(server);
  registerSearchMemoriesTool(server);
  registerUpdateMemoryTool(server);
  registerDeleteMemoryTool(server);
  registerListMemoriesTool(server);
};
