import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool input schema
export const SearchMemoriesSchema = z.object({
  query: z.string().describe('The search query'),
  limit: z.number().optional().default(10).describe('Maximum number of results to return'),
  boost_recent: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to boost more recent memories in ranking'),
});

// Tool configuration
const name = 'search_memories';
const config = {
  title: 'Search Memories',
  description: 'Search for relevant memories using hybrid search (vector + keyword)',
  inputSchema: SearchMemoriesSchema,
};

/**
 * Registers the 'search_memories' tool.
 *
 * This tool performs hybrid search over stored memories using vector similarity
 * and optional time-based boosting.
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 * @returns {void}
 */
export const registerSearchMemoriesTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const validatedArgs = SearchMemoriesSchema.parse(args);
    const { query, limit, boost_recent } = validatedArgs;
    
    return {
      content: [
        {
          type: 'text',
          text: `Searching for: "${query}"\nLimit: ${limit}\nBoost recent: ${boost_recent}`,
        },
      ],
    };
  });
};
