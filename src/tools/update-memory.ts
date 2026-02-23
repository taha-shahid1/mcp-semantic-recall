import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { memoryService } from '../lib/database.js';

export const UpdateMemorySchema = z.object({
  memory_id: z
    .string()
    .describe('The unique ID of the memory to update (obtained from search results)'),
  content: z
    .string()
    .optional()
    .describe(
      'New content to replace the existing memory content. If content is changed, embeddings will be regenerated.'
    ),
  metadata: z
    .object({
      project: z
        .string()
        .optional()
        .describe(
          'Updated project path - MUST be the current working directory path (e.g., /Users/name/projects/myapp)'
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe('Updated tags for categorization (e.g., ["typescript", "bug-fix"])'),
    })
    .optional()
    .describe('Updated metadata for the memory'),
});

const name = 'update_memory';
const config = {
  title: 'Update Memory',
  description:
    'Update an existing memory. You can change the content (which regenerates embeddings), project path, or tags. The original timestamp is preserved. Use this when a memory needs correction or additional information.',
  inputSchema: UpdateMemorySchema,
};

export const registerUpdateMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = UpdateMemorySchema.parse(args);
    const { memory_id, content, metadata } = validatedArgs;

    try {
      await memoryService.updateMemory(memory_id, content, metadata);

      return {
        content: [
          {
            type: 'text',
            text: `Memory ${memory_id} updated successfully!${
              content ? `\nNew content: ${content}` : ''
            }${metadata?.project ? `\nNew project: ${metadata.project}` : ''}${
              metadata?.tags ? `\nNew tags: ${metadata.tags.join(', ')}` : ''
            }`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
