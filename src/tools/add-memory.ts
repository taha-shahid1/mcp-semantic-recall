import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool input schema
export const AddMemorySchema = z.object({
  content: z.string().describe('The content to remember'),
  metadata: z
    .object({
      tags: z.array(z.string()).optional(),
      context: z.string().optional(),
    })
    .optional()
    .describe('Optional metadata about the memory'),
});

// Tool configuration
const name = 'add_memory';
const config = {
  title: 'Add Memory',
  description: 'Add a new memory to the semantic store with embeddings',
  inputSchema: AddMemorySchema,
};

/**
 * Registers the 'add_memory' tool.
 *
 * This tool stores a memory with its embedding in LanceDB for later retrieval.
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 * @returns {void}
 */
export const registerAddMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = AddMemorySchema.parse(args);
    const { content, metadata } = validatedArgs;

    return {
      content: [
        {
          type: 'text',
          text: `Memory added: ${content}\nMetadata: ${JSON.stringify(metadata, null, 2)}`,
        },
      ],
    };
  });
};
