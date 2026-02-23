import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { databaseService } from '../lib/database.js';

export const AddMemorySchema = z.object({
  content: z.string().describe('The content to remember - can include code examples, decisions, patterns, or any information'),
  metadata: z
    .object({
      project: z.string().optional().describe('Project identifier - MUST be the current working directory path (e.g., /Users/name/projects/myapp). Do not use custom strings or project names, use the actual directory path where you are working.'),
      tags: z.array(z.string()).optional().describe('Tags for categorization (e.g., ["typescript", "bug-fix", "api-design"])'),
    })
    .optional()
    .describe('Optional metadata about the memory'),
});

const name = 'add_memory';
const config = {
  title: 'Add Memory',
  description: 'Store a memory in the semantic memory system. Memories are embedded using vector embeddings and can be retrieved later via semantic search. Use this to remember important decisions, code patterns, solutions to problems, or any information that might be useful later.',
  inputSchema: AddMemorySchema,
};

export const registerAddMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = AddMemorySchema.parse(args);
    const { content, metadata } = validatedArgs;

    try {
      const memoryId = await databaseService.addMemory(content, metadata);

      return {
        content: [
          {
            type: 'text',
            text: `Memory added successfully!\nID: ${memoryId}\nContent: ${content}${
              metadata?.project ? `\nProject: ${metadata.project}` : ''
            }${metadata?.tags ? `\nTags: ${metadata.tags.join(', ')}` : ''}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
