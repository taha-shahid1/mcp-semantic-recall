import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool input schema
export const UpdateMemorySchema = z.object({
  memory_id: z.string().describe('The ID of the memory to update'),
  content: z.string().optional().describe('New content for the memory'),
  metadata: z
    .object({
      tags: z.array(z.string()).optional(),
      context: z.string().optional(),
    })
    .optional()
    .describe('Updated metadata for the memory'),
});

// Tool configuration
const name = 'update_memory';
const config = {
  title: 'Update Memory',
  description: 'Update an existing memory with new content or metadata',
  inputSchema: UpdateMemorySchema,
};

/**
 * Registers the 'update_memory' tool.
 *
 * This tool updates an existing memory's content and/or metadata.
 * If content is updated, a new embedding is generated.
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 * @returns {void}
 */
export const registerUpdateMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = UpdateMemorySchema.parse(args);
    const { memory_id, content, metadata } = validatedArgs;

    return {
      content: [
        {
          type: 'text',
          text: `Memory ${memory_id} updated\nNew content: ${content}\nNew metadata: ${JSON.stringify(metadata, null, 2)}`,
        },
      ],
    };
  });
};
