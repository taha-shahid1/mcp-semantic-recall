import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { databaseService } from '../lib/database.js';

export const ListMemoriesSchema = z.object({
  project: z
    .string()
    .optional()
    .describe('Filter memories by project path (e.g., /Users/name/projects/myapp)'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter memories by tags (returns memories matching ANY of these tags)'),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of memories to return (default: 50, max: 100)'),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe('Number of memories to skip for pagination (default: 0)'),
});

const name = 'list_memories';
const config = {
  title: 'List Memories',
  description:
    'List stored memories with optional filtering by project or tags. Useful for browsing all memories, seeing what exists in a project, or reviewing memories by category. Results are sorted by timestamp (newest first).',
  inputSchema: ListMemoriesSchema,
};

export const registerListMemoriesTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = ListMemoriesSchema.parse(args);
    const { project, tags, limit, offset } = validatedArgs;

    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);

    try {
      const results = await databaseService.listMemories({
        project,
        tags,
        limit: cappedLimit,
        offset,
      });

      if (results.length === 0) {
        let message = 'No memories found';
        if (project) message += ` for project: ${project}`;
        if (tags?.length) message += ` with tags: ${tags.join(', ')}`;
        message += '.';

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      }

      const filterInfo = [];
      if (project) filterInfo.push(`Project: ${project}`);
      if (tags?.length) filterInfo.push(`Tags: ${tags.join(', ')}`);
      if (offset > 0) filterInfo.push(`Offset: ${offset}`);

      const header = filterInfo.length > 0 ? `Filters: ${filterInfo.join(' | ')}\n\n` : '';

      const memoriesList = results
        .map((memory, index) => {
          const position = offset + index + 1;
          const lines = [
            `${position}. [ID: ${memory.id}]`,
            `   ${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''}`,
          ];

          if (memory.project) lines.push(`   Project: ${memory.project}`);
          if (memory.tags?.length) lines.push(`   Tags: ${memory.tags.join(', ')}`);
          lines.push(`   Created: ${new Date(memory.timestamp).toLocaleString()}`);
          if (memory.usage_count !== undefined && memory.usage_count > 0) {
            const lastUsedStr = memory.last_used
              ? `, Last used: ${new Date(memory.last_used).toLocaleString()}`
              : '';
            lines.push(`   Usage: ${memory.usage_count} times${lastUsedStr}`);
          }

          return lines.join('\n');
        })
        .join('\n\n');

      const footer =
        results.length === cappedLimit
          ? `\n\nShowing ${results.length} memories. Use offset=${offset + cappedLimit} to see more.`
          : `\n\nTotal: ${results.length} ${results.length === 1 ? 'memory' : 'memories'}.`;

      return {
        content: [
          {
            type: 'text',
            text: `${header}${memoriesList}${footer}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
