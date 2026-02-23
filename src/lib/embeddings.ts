import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

type EmbeddingProvider = 'ollama' | 'transformers';

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimension: number;
}

class EmbeddingService {
  private config: EmbeddingConfig | null = null;
  private transformerPipeline: FeatureExtractionPipeline | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const ollamaAvailable = await this.checkOllamaAvailable();

    if (ollamaAvailable) {
      this.config = {
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimension: 768,
      };
      console.error('Using Ollama with nomic-embed-text');
    } else {
      this.config = {
        provider: 'transformers',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimension: 384,
      };
      console.error('Ollama not available, using Transformers.js with all-MiniLM-L6-v2');
      
      // Initialize the transformers pipeline
      this.transformerPipeline = await pipeline(
        'feature-extraction',
        this.config.model
      );
    }

    this.initialized = true;
  }

  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };

      const hasNomicEmbed = data.models?.some((model) =>
        model.name.includes('nomic-embed-text')
      );

      return hasNomicEmbed ?? false;
    } catch (error) {
      return false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized || !this.config) {
      throw new Error('EmbeddingService not initialized');
    }

    if (this.config.provider === 'ollama') {
      return this.generateOllamaEmbedding(text);
    } else {
      return this.generateTransformersEmbedding(text);
    }
  }

  private async generateOllamaEmbedding(text: string): Promise<number[]> {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  private async generateTransformersEmbedding(text: string): Promise<number[]> {
    if (!this.transformerPipeline) {
      throw new Error('Transformers pipeline not initialized');
    }

    const output = await this.transformerPipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }

  getConfig(): EmbeddingConfig {
    if (!this.config) {
      throw new Error('EmbeddingService not initialized');
    }
    return this.config;
  }

  getDimension(): number {
    return this.getConfig().dimension;
  }
}

export const embeddingService = new EmbeddingService();
