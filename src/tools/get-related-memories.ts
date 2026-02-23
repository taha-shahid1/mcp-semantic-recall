import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { memoryService } from '../lib/database.js';

export const GetRelatedMemoriesSchema = z.object({
  memory_id: z.string().describe('The unique ID of the memory to find related memories for'),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe('Maximum number of related memories to return (default: 5)'),
  boost_frequent: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Whether to boost frequently-accessed memories in ranking. Set to true to prioritize "warm" memories. Default: false'
    ),
});

const name = 'get_related_memories';
const config = {
  title: 'Get Related Memories',
  description:
    'Find memories related to a specific memory by searching for semantically similar content. This uses the same hybrid search (vector similarity + keyword matching) as search_memories, but automatically uses the content of the specified memory as the search query.\n\nUseful for exploring connected information and following trains of thought through your memory system.\n\nThe source memory itself is excluded from results.',
  inputSchema: GetRelatedMemoriesSchema,
};

export const registerGetRelatedMemoriesTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = GetRelatedMemoriesSchema.parse(args);
    const { memory_id, limit, boost_frequent } = validatedArgs;

    try {
      const results = await memoryService.getRelatedMemories(memory_id, limit, boost_frequent);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No related memories found for memory ${memory_id}.`,
            },
          ],
        };
      }

      const resultText = results
        .map(
          (result, index) =>
            `${index + 1}. [ID: ${result.id}] (Score: ${result.score.toFixed(4)})\n   ${result.content}${
              result.project ? `\n   Project: ${result.project}` : ''
            }${result.tags?.length ? `\n   Tags: ${result.tags.join(', ')}` : ''}\n   Timestamp: ${new Date(result.timestamp).toLocaleString()}${
              result.usage_count !== undefined ? `\n   Used: ${result.usage_count} times` : ''
            }`
        )
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} related ${results.length === 1 ? 'memory' : 'memories'}:\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get related memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
