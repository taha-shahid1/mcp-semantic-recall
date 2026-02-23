import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { memoryService } from '../lib/database.js';

export const AddMemorySchema = z.object({
  content: z
    .string()
    .describe(
      'The content to remember - can include code examples, decisions, patterns, or any information. Keep it atomic and focused (~250 words max). If more detail needed, create additional related memories.'
    ),
  metadata: z
    .object({
      project: z
        .string()
        .optional()
        .describe(
          'Project identifier - MUST be the current working directory path (e.g., /Users/name/projects/myapp). Do not use custom strings or project names, use the actual directory path where you are working.'
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe('Tags for categorization (e.g., ["typescript", "bug-fix", "api-design"])'),
    })
    .optional()
    .describe('Optional metadata about the memory'),
});

const name = 'add_memory';
const config = {
  title: 'Add Memory',
  description:
    'Store a memory in the semantic memory system. Memories are embedded using vector embeddings and can be retrieved later via semantic search. Use this to remember important decisions, code patterns, solutions to problems, or any information that might be useful later.\n\nIMPORTANT: Keep memories atomic and focused (recommended max ~250 words). Each memory should capture ONE concept, decision, or pattern. If you need more space, create multiple related memories instead of one large memory.\n\nGood: "Auth uses JWT tokens with 15min expiry. Refresh tokens stored in httpOnly cookies. Decided this over sessions for scalability."\nBad: "Here is our entire authentication system implementation [500+ words covering login, logout, refresh, middleware, error handling...]"',
  inputSchema: AddMemorySchema,
};

export const registerAddMemoryTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = AddMemorySchema.parse(args);
    const { content, metadata } = validatedArgs;

    try {
      const memoryId = await memoryService.addMemory(content, metadata);

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
