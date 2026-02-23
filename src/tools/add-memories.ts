import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { memoryService } from '../lib/database.js';

export const AddMemoriesSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z
          .string()
          .describe(
            'The content to remember - can include code examples, decisions, patterns, or any information. Keep it atomic and focused (~250 words max).'
          ),
        project: z
          .string()
          .optional()
          .describe(
            'Project path for this specific memory (overrides default_project if provided)'
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe('Tags for this specific memory (overrides default_tags if provided)'),
      })
    )
    .min(1)
    .describe('Array of memories to add. Each memory can optionally override default metadata.'),
  default_project: z
    .string()
    .optional()
    .describe(
      'Default project path applied to all memories that do not specify their own project. MUST be the current working directory path (e.g., /Users/name/projects/myapp).'
    ),
  default_tags: z
    .array(z.string())
    .optional()
    .describe(
      'Default tags applied to all memories that do not specify their own tags (e.g., ["session-2026-02-22"]).'
    ),
});

const name = 'add_memories';
const config = {
  title: 'Add Multiple Memories',
  description:
    'Store multiple memories at once in the semantic memory system. This is more efficient than calling add_memory multiple times, as embeddings are generated in parallel.\n\nAll memories in a batch share the same timestamp, making it easy to track what was learned in a single session.\n\nYou can provide default_project and default_tags that apply to all memories, but individual memories can override these by specifying their own project or tags.\n\nExample:\n{\n  "default_project": "/Users/name/myapp",\n  "default_tags": ["session-feb-22"],\n  "memories": [\n    { "content": "Auth uses JWT tokens", "tags": ["auth"] },\n    { "content": "Database is PostgreSQL", "tags": ["database"] },\n    { "content": "Tests use vitest" }\n  ]\n}',
  inputSchema: AddMemoriesSchema,
};

export const registerAddMemoriesTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = AddMemoriesSchema.parse(args);
    const { memories, default_project, default_tags } = validatedArgs;

    try {
      const memoryIds = await memoryService.addMemories(memories, {
        project: default_project,
        tags: default_tags,
      });

      const summaryLines = memories.map((m, i) => {
        const project = m.project ?? default_project;
        const tags = m.tags ?? default_tags;
        return `${i + 1}. [ID: ${memoryIds[i]}]\n   ${m.content.slice(0, 80)}${m.content.length > 80 ? '...' : ''}${
          project ? `\n   Project: ${project}` : ''
        }${tags?.length ? `\n   Tags: ${tags.join(', ')}` : ''}`;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Successfully added ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}!\n\n${summaryLines.join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
