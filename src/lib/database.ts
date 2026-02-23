import { connect, type Connection, type Table, Index } from '@lancedb/lancedb';
import { embeddingService } from './embeddings.js';
import * as path from 'path';
import * as os from 'os';

interface Memory extends Record<string, unknown> {
  id: string;
  content: string;
  embedding: number[];
  timestamp: number;
  project?: string;
  tags?: string[];
  last_used?: number;
  usage_count?: number;
}

interface ConfigMetadata extends Record<string, unknown> {
  embedding_provider: string;
  embedding_model: string;
  embedding_dimension: number;
}

class DatabaseService {
  private db: Connection | null = null;
  private table: Table | null = null;
  private configTable: Table | null = null;
  private readonly dbPath: string;
  private readonly tableName = 'memories';
  private readonly configTableName = 'config';

  constructor() {
    this.dbPath = path.join(os.homedir(), '.mcp-semantic-recall');
  }

  async initialize(): Promise<void> {
    this.db = await connect(this.dbPath);

    // Check if config table exists
    const tableNames = await this.db.tableNames();
    const configExists = tableNames.includes(this.configTableName);

    if (configExists) {
      // Load config and verify embedding model matches
      this.configTable = await this.db.openTable(this.configTableName);
      const configData = await this.configTable.query().limit(1).toArray();

      if (configData.length > 0) {
        const config = configData[0] as ConfigMetadata;
        const currentConfig = embeddingService.getConfig();

        // Verify model compatibility
        if (
          config.embedding_provider !== currentConfig.provider ||
          config.embedding_model !== currentConfig.model
        ) {
          throw new Error(
            `Database was created with ${config.embedding_provider}/${config.embedding_model} ` +
              `but current session is using ${currentConfig.provider}/${currentConfig.model}. ` +
              `Either switch to the original model or delete ${this.dbPath} to start fresh.`
          );
        }
      }
    } else {
      // Create config table with current embedding settings
      const currentConfig = embeddingService.getConfig();
      const configData: ConfigMetadata[] = [
        {
          embedding_provider: currentConfig.provider,
          embedding_model: currentConfig.model,
          embedding_dimension: currentConfig.dimension,
        },
      ];

      this.configTable = await this.db.createTable(this.configTableName, configData);
    }

    // Open or create memories table
    if (tableNames.includes(this.tableName)) {
      this.table = await this.db.openTable(this.tableName);
      
      // Check if FTS index exists, create if missing
      const indices = await this.table.listIndices();
      const hasFtsIndex = indices.some((idx) => idx.columns.includes('content'));
      if (!hasFtsIndex) {
        await this.table.createIndex('content', {
          config: Index.fts(),
        });
      }
    } else {
      // Create table with a dummy row to establish schema, then delete it
      const dummyMemory: Memory = {
        id: '__init__',
        content: 'initialization',
        embedding: new Array(embeddingService.getDimension()).fill(0),
        timestamp: Date.now(),
        usage_count: 0,
      };
      this.table = await this.db.createTable(this.tableName, [dummyMemory]);
      await this.table.delete("id = '__init__'");
      
      // Create FTS index on content column for hybrid search
      await this.table.createIndex('content', {
        config: Index.fts(),
      });
    }
  }

  async addMemory(
    content: string,
    metadata?: { project?: string; tags?: string[] }
  ): Promise<string> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const embedding = await embeddingService.generateEmbedding(content);
    const id = crypto.randomUUID();

    const memory: Memory = {
      id,
      content,
      embedding,
      timestamp: Date.now(),
      project: metadata?.project,
      tags: metadata?.tags,
      usage_count: 0,
    };

    await this.table.add([memory]);
    return id;
  }

  async searchMemories(
    query: string,
    limit: number = 10,
    boostFrequent: boolean = false
  ): Promise<
    Array<{
      id: string;
      content: string;
      score: number;
      timestamp: number;
      project?: string;
      tags?: string[];
      usage_count?: number;
    }>
  > {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Hybrid search: vector similarity + full-text search
    const results = await this.table
      .vectorSearch(queryEmbedding)
      .fullTextSearch(query)
      .limit(limit * 3)
      .toArray();

    let processedResults = results.map((result: any) => ({
      id: result.id as string,
      content: result.content as string,
      score: result._distance as number,
      timestamp: result.timestamp as number,
      project: result.project as string | undefined,
      tags: result.tags as string[] | undefined,
      usage_count: result.usage_count as number | undefined,
    }));

    // Update usage tracking for retrieved memories
    const updatePromises = processedResults.slice(0, limit).map(async (result) => {
      try {
        await this.table!.update({
          where: `id = '${result.id}'`,
          values: {
            usage_count: (result.usage_count ?? 0) + 1,
            last_used: Date.now(),
          },
        });
      } catch (error) {
        // Non-critical: log but don't fail the search
        console.error(`Failed to update usage for ${result.id}:`, error);
      }
    });

    // Don't await - let updates happen async
    Promise.all(updatePromises).catch(() => {});

    if (boostFrequent) {
      processedResults = processedResults.map((result) => {
        const usageCount = result.usage_count ?? 0;
        // Usage factor: 0.0 for never used, caps at 1.0 for 10+ uses
        const usageFactor = Math.min(1.0, usageCount / 10);
        // For distance metrics (lower is better), reduce score for frequently used items
        const boostedScore = result.score * (1 - usageFactor * 0.4);

        return {
          ...result,
          score: boostedScore,
        };
      });

      processedResults.sort((a, b) => a.score - b.score);
    }

    return processedResults.slice(0, limit);
  }

  async updateMemory(
    memoryId: string,
    content?: string,
    metadata?: { project?: string; tags?: string[] }
  ): Promise<void> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const results = await this.table.query().where(`id = '${memoryId}'`).limit(1).toArray();

    if (results.length === 0) {
      throw new Error(`Memory with id ${memoryId} not found`);
    }

    const existing = results[0] as Memory;
    await this.table.delete(`id = '${memoryId}'`);

    const updatedMemory: Memory = {
      id: memoryId,
      content: content ?? existing.content,
      embedding:
        content !== undefined
          ? await embeddingService.generateEmbedding(content)
          : existing.embedding,
      timestamp: existing.timestamp,
      project: metadata?.project ?? existing.project,
      tags: metadata?.tags ?? existing.tags,
      usage_count: existing.usage_count,
      last_used: existing.last_used,
    };

    await this.table.add([updatedMemory]);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    await this.table.delete(`id = '${memoryId}'`);
  }

  async listMemories(
    options?: {
      project?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<
    Array<{
      id: string;
      content: string;
      timestamp: number;
      project?: string;
      tags?: string[];
      usage_count?: number;
      last_used?: number;
    }>
  > {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = this.table.query();

    // Filter by project if specified
    if (options?.project) {
      query = query.where(`project = '${options.project}'`);
    }

    // Filter by tags if specified
    if (options?.tags && options.tags.length > 0) {
      const tagFilter = options.tags.map((tag) => `array_contains(tags, '${tag}')`).join(' OR ');
      query = query.where(tagFilter);
    }

    const results = await query.limit(limit + offset).toArray();

    // Manual offset (LanceDB doesn't have native offset)
    const slicedResults = results.slice(offset, offset + limit);

    return slicedResults.map((result: any) => ({
      id: result.id as string,
      content: result.content as string,
      timestamp: result.timestamp as number,
      project: result.project as string | undefined,
      tags: result.tags as string[] | undefined,
      usage_count: result.usage_count as number | undefined,
      last_used: result.last_used as number | undefined,
    }));
  }

  async close(): Promise<void> {
    this.db = null;
    this.table = null;
    this.configTable = null;
  }
}

export const databaseService = new DatabaseService();
