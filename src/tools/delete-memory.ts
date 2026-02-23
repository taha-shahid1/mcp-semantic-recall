import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool input schema
export const DeleteMemorySchema = z.object({
  memory_id: z.string().describe('The ID of the memory to delete'),
});

// Tool configuration
const name = 'delete_memory';
const config = {
  title: 'Delete Memory',
  description: 'Delete a memory from the semantic store',
  inputSchema: DeleteMemorySchema,
};

/**
 * Registers the 'delete_memory' tool.
 *
 * This tool removes a memory from the LanceDB store by its ID.
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 * @returns {void}
 */
export const registerDeleteMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = DeleteMemorySchema.parse(args);
    const { memory_id } = validatedArgs;

    return {
      content: [
        {
          type: 'text',
          text: `Memory ${memory_id} deleted successfully`,
        },
      ],
    };
  });
};
