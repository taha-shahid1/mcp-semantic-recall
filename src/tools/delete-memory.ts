import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { memoryService } from '../lib/database.js';

export const DeleteMemorySchema = z.object({
  memory_id: z
    .string()
    .describe('The unique ID of the memory to delete (obtained from search results)'),
});

const name = 'delete_memory';
const config = {
  title: 'Delete Memory',
  description:
    'Permanently delete a memory from the semantic store. This action cannot be undone. Use this when information is outdated, incorrect, or no longer relevant.',
  inputSchema: DeleteMemorySchema,
};

export const registerDeleteMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = DeleteMemorySchema.parse(args);
    const { memory_id } = validatedArgs;

    try {
      await memoryService.deleteMemory(memory_id);

      return {
        content: [
          {
            type: 'text',
            text: `Memory ${memory_id} deleted successfully`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
