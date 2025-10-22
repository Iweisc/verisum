import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';

export interface Entry<T> {
  str: string;
  metadata: T;
}

export interface VectorizedEntry<T> extends Entry<T> {
  vector: Array<number>;
  vectorMagnitude: number;
}

const DEFAULTS = {
  CHUNK_SIZE: 50,
  SEARCH_RESULTS: 5,
  SIMILARITY_THRESHOLD: 0.6,
  MODEL_NAME: 'Xenova/all-MiniLM-L6-v2',
  MODEL_DEVICE: 'wasm',
  MODEL_DTYPE: 'q8',
} as const;

class VectorDB<T = {}> {
  public entries: Array<VectorizedEntry<T>> = [];
  private extractor: FeatureExtractionPipeline | null = null;

  public async setModel(): Promise<void> {
    if (!this.extractor) {
      await this.loadExtractor();
    }
  }

  private loadExtractor = async () => {
    this.extractor = await pipeline('feature-extraction', DEFAULTS.MODEL_NAME, {
      device: DEFAULTS.MODEL_DEVICE,
      dtype: DEFAULTS.MODEL_DTYPE,
    });
  };

  public async addEntries(
    entries: Array<Entry<T>>,
    callback: ((processed: number, total: number) => void) | null = null
  ): Promise<Array<Entry<T>>> {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('Invalid entries array provided to addEntries');
    }

    const chunkSize = DEFAULTS.CHUNK_SIZE;
    const chunks = [];
    const numberOfChunks = Math.ceil(entries.length / chunkSize);
    for (let i = 0; i < entries.length; i += chunkSize) {
      chunks.push(
        await this.embedTexts(
          entries.slice(i, i + chunkSize).map((entry) => entry.str)
        )
      );
      if (callback) {
        callback(i / chunkSize + 1, numberOfChunks);
      }
    }
    const embeddings = chunks.flat();
    entries.map((entry, i) => {
      this.entries.push({
        str: entry.str,
        metadata: entry.metadata,
        vector: embeddings[i],
        vectorMagnitude: this.calculateMagnitude(embeddings[i]),
      });
    });
    return this.entries;
  }

  public async search(
    query: string,
    numberOfResults: number = DEFAULTS.SEARCH_RESULTS,
    similarityThreshold: number = DEFAULTS.SIMILARITY_THRESHOLD
  ): Promise<Array<[VectorizedEntry<T>, number]>> {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Invalid query provided to search');
    }

    if (this.entries.length === 0) {
      throw new Error('No entries in VectorDB to search');
    }

    const [queryEmbedding] = await this.embedTexts([query]);
    const queryMagnitude = this.calculateMagnitude(queryEmbedding);
    const scores = this.calculateSimilarityScores(
      this.entries,
      queryEmbedding,
      queryMagnitude
    );
    const sorted = scores.sort((a, b) => b[1] - a[1]);
    const similarityFiltered = sorted.filter(
      (entry) => entry[1] > similarityThreshold
    );
    return similarityFiltered.slice(0, numberOfResults);
  }

  public clear(): void {
    this.entries = [];
  }

  private async embedTexts(
    texts: Array<string>
  ): Promise<Array<Array<number>>> {
    try {
      if (!this.extractor || typeof this.extractor !== 'function') {
        await this.loadExtractor();
      }

      if (!this.extractor) {
        throw new Error('Failed to load extractor model');
      }

      const output = await this.extractor(texts, {
        pooling: 'mean',
        normalize: true,
      });
      const result = output.tolist();
      return result;
    } catch (error) {
      throw error;
    }
  }

  private calculateMagnitude(embedding: number[]): number {
    let sumOfSquares = 0;
    for (const val of embedding) {
      sumOfSquares += val * val;
    }
    return Math.sqrt(sumOfSquares);
  }

  private calculateSimilarityScores<T>(
    entries: Array<VectorizedEntry<T>>,
    queryVector: number[],
    queryMagnitude: number
  ): Array<[VectorizedEntry<T>, number]> {
    return entries
      .map((entry) => {
        let dotProduct = 0;
        if (!entry.vector || !entry.vectorMagnitude) {
          return null;
        }
        for (let i = 0; i < entry.vector.length; i++) {
          dotProduct += entry.vector[i] * queryVector[i];
        }
        let score = this.getCosineSimilarityScore(
          dotProduct,
          entry.vectorMagnitude,
          queryMagnitude
        );
        score = this.normalizeScore(score);
        return [entry, score] as [VectorizedEntry<T>, number];
      })
      .filter(
        (result): result is [VectorizedEntry<T>, number] => result !== null
      );
  }

  private getCosineSimilarityScore(
    dotProduct: number,
    magnitudeA: number,
    magnitudeB: number
  ): number {
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private normalizeScore(score: number): number {
    return (score + 1) / 2;
  }
}

export default VectorDB;
