import { connect, type Connection, type Table, Index } from '@lancedb/lancedb';
import { embeddingService } from './embeddings.js';
import * as path from 'path';
import * as os from 'os';
import * as arrow from 'apache-arrow';
import MemoryService from '../services/memory-service.js';

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
      // Create table with explicit schema to handle optional fields
      const schema = new arrow.Schema([
        new arrow.Field('id', new arrow.Utf8()),
        new arrow.Field('content', new arrow.Utf8()),
        new arrow.Field(
          'embedding',
          new arrow.FixedSizeList(
            embeddingService.getDimension(),
            new arrow.Field('item', new arrow.Float32())
          )
        ),
        new arrow.Field('timestamp', new arrow.Float64()),
        new arrow.Field('project', new arrow.Utf8(), true), // nullable
        new arrow.Field('tags', new arrow.List(new arrow.Field('item', new arrow.Utf8())), true), // nullable
        new arrow.Field('last_used', new arrow.Float64(), true), // nullable
        new arrow.Field('usage_count', new arrow.Int32()),
      ]);

      // Create table with explicit schema
      this.table = await this.db.createEmptyTable(this.tableName, schema);

      // Create FTS index on content column for hybrid search
      await this.table.createIndex('content', {
        config: Index.fts(),
      });
    }
  }

  getTable(): Table | null {
    return this.table;
  }

  async close(): Promise<void> {
    this.db = null;
    this.table = null;
    this.configTable = null;
  }
}

const databaseService = new DatabaseService();
export const memoryService = new MemoryService(() => databaseService.getTable());
export { databaseService };
