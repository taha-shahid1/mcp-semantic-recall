import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { databaseService } from '../lib/database.js';

export const SearchMemoriesSchema = z.object({
  query: z.string().describe('Natural language search query describing what you want to remember (e.g., "how did we handle authentication", "bug fixes for React hooks")'),
  limit: z.number().optional().default(10).describe('Maximum number of results to return (default: 10)'),
  boost_frequent: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to boost frequently-accessed memories in ranking. Set to true to prioritize "warm" memories that have been useful before. Default: false'),
});

const name = 'search_memories';
const config = {
  title: 'Search Memories',
  description: 'Search for relevant memories using hybrid search combining vector similarity (semantic meaning) and keyword matching. Returns memories ranked by relevance, with optional recency boosting. Results include the memory content, project, tags, usage count, and timestamp.',
  inputSchema: SearchMemoriesSchema,
};

export const registerSearchMemoriesTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = SearchMemoriesSchema.parse(args);
    const { query, limit, boost_frequent } = validatedArgs;

    try {
      const results = await databaseService.searchMemories(query, limit, boost_frequent);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No memories found matching your query.',
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
            text: `Found ${results.length} matching ${results.length === 1 ? 'memory' : 'memories'}:\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to search memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
};
