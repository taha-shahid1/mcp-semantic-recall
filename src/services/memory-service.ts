import type { Table } from '@lancedb/lancedb';
import { embeddingService } from '../lib/embeddings.js';

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

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

class MemoryService {
  private getTable: () => Table | null;

  constructor(getTableFn: () => Table | null) {
    this.getTable = getTableFn;
  }

  async addMemory(
    content: string,
    metadata?: { project?: string; tags?: string[] }
  ): Promise<string> {
    const table = this.getTable();
    if (!table) {
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

    await table.add([memory]);
    return id;
  }

  async addMemories(
    memories: Array<{ content: string; project?: string; tags?: string[] }>,
    defaults?: { project?: string; tags?: string[] }
  ): Promise<string[]> {
    const table = this.getTable();
    if (!table) {
      throw new Error('Database not initialized');
    }

    // Generate all embeddings in parallel (key optimization!)
    const embeddingPromises = memories.map((m) => embeddingService.generateEmbedding(m.content));
    const embeddings = await Promise.all(embeddingPromises);

    // Create memory objects with same timestamp for batch cohesion
    const now = Date.now();
    const memoryObjects: Memory[] = memories.map((m, i) => {
      const embedding = embeddings[i];
      if (!embedding) {
        throw new Error(`Failed to generate embedding for memory: ${m.content.slice(0, 50)}...`);
      }
      return {
        id: crypto.randomUUID(),
        content: m.content,
        embedding,
        timestamp: now,
        project: m.project ?? defaults?.project,
        tags: m.tags ?? defaults?.tags,
        usage_count: 0,
      };
    });

    // Single batch insert
    await table.add(memoryObjects);

    return memoryObjects.map((m) => m.id);
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
    const table = this.getTable();
    if (!table) {
      throw new Error('Database not initialized');
    }

    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Hybrid search: vector similarity + full-text search
    const results = await table
      .vectorSearch(queryEmbedding)
      .fullTextSearch(query)
      .limit(limit * 3)
      .toArray();

    let processedResults = results.map((result: any) => ({
      id: result.id as string,
      content: result.content as string,
      score: (result._distance as number) ?? 0,
      timestamp: result.timestamp as number,
      project: result.project as string | undefined,
      tags: result.tags ? (Array.from(result.tags) as string[]) : undefined,
      usage_count: result.usage_count as number | undefined,
    }));

    // Update usage tracking for retrieved memories
    const updatePromises = processedResults.slice(0, limit).map(async (result) => {
      try {
        await table.update({
          where: `id = '${escapeSqlString(result.id)}'`,
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

    // Don't await, let updates happen async
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
    const table = this.getTable();
    if (!table) {
      throw new Error('Database not initialized');
    }

    const escapedId = escapeSqlString(memoryId);
    const results = await table.query().where(`id = '${escapedId}'`).limit(1).toArray();

    if (results.length === 0) {
      throw new Error(`Memory with id ${memoryId} not found`);
    }

    const existing: any = results[0];
    await table.delete(`id = '${escapedId}'`);

    const existingTags = existing.tags ? (Array.from(existing.tags) as string[]) : undefined;
    // Convert Arrow embedding to plain number array
    // Use Array.prototype.slice to ensure clean copy without Arrow metadata
    const existingEmbedding: number[] = existing.embedding
      ? Array.prototype.slice.call(existing.embedding)
      : [];

    const updatedMemory: Memory = {
      id: memoryId,
      content: content ?? existing.content,
      embedding:
        content !== undefined
          ? await embeddingService.generateEmbedding(content)
          : existingEmbedding,
      timestamp: existing.timestamp,
      project: metadata?.project ?? existing.project,
      tags: metadata?.tags ?? existingTags,
      usage_count: existing.usage_count,
      last_used: existing.last_used,
    };

    await table.add([updatedMemory]);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    const table = this.getTable();
    if (!table) {
      throw new Error('Database not initialized');
    }

    await table.delete(`id = '${escapeSqlString(memoryId)}'`);
  }

  async listMemories(options?: {
    project?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<
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
    const table = this.getTable();
    if (!table) {
      throw new Error('Database not initialized');
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = table.query();

    // Filter by project if specified
    if (options?.project) {
      query = query.where(`project = '${escapeSqlString(options.project)}'`);
    }

    // Filter by tags if specified
    if (options?.tags && options.tags.length > 0) {
      const tagFilter = options.tags
        .map((tag) => `array_contains(tags, '${escapeSqlString(tag)}')`)
        .join(' OR ');
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
      tags: result.tags ? (Array.from(result.tags) as string[]) : undefined,
      usage_count: result.usage_count as number | undefined,
      last_used: result.last_used as number | undefined,
    }));
  }

  async getRelatedMemories(
    memoryId: string,
    limit: number = 5,
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
    const table = this.getTable();
    if (!table) {
      throw new Error('Database not initialized');
    }

    // 1. Get the source memory
    const escapedId = escapeSqlString(memoryId);
    const sourceResults = await table.query().where(`id = '${escapedId}'`).limit(1).toArray();

    if (sourceResults.length === 0) {
      throw new Error(`Memory with id ${memoryId} not found`);
    }

    const source: any = sourceResults[0];

    // 2. Search using the source memory's content
    // This reuses the hybrid search (vector + keyword) functionality
    const results = await this.searchMemories(source.content, limit + 1, boostFrequent);

    // 3. Filter out the source memory itself and limit results
    return results.filter((r) => r.id !== memoryId).slice(0, limit);
  }
}

export default MemoryService;
