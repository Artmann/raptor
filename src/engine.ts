import { EmbeddingModel, FlagEmbedding } from 'fastembed'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { EngineOptions, EmbeddingEntry, SearchResult } from './types'
import { EmbeddingFileReader } from './embedding-file-reader'
import invariant from 'tiny-invariant'
import { CandidateSet } from './candidate-set'

export class EmbeddingEngine {
  private storePath: string
  private fileReader: EmbeddingFileReader

  constructor(options: EngineOptions) {
    this.storePath = options.storePath
    this.fileReader = new EmbeddingFileReader(options.storePath)
  }

  /**
   * Retrieves an embedding entry by key
   * Reads the file in reverse order in chunks for efficiency
   * @param key - Unique identifier for the entry
   * @returns The embedding entry, or null if not found
   */
  async get(key: string): Promise<EmbeddingEntry | null> {
    invariant(key, 'Key must be provided.')

    for await (const entry of this.fileReader.iterateEmbeddings()) {
      if (entry.key === key) {
        return entry
      }
    }

    return null
  }

  /**
   * Searches for similar embeddings using cosine similarity
   * @param query - Text query to search for
   * @param limit - Maximum number of results to return (default: 10)
   * @param minSimilarity - Minimum similarity threshold (default: 0, range: -1 to 1)
   * @returns Array of search results sorted by similarity (highest first)
   */
  async search(
    query: string,
    limit: number = 10,
    minSimilarity: number = 0.5
  ): Promise<SearchResult[]> {
    invariant(query, 'Query text must be provided.')
    invariant(limit > 0, 'Limit must be a positive integer.')
    invariant(
      minSimilarity >= 0 && minSimilarity <= 1,
      'minSimilarity must be between 0 and 1.'
    )

    const queryEmbedding = await this.generateEmbedding(query)

    const candidateSet = new CandidateSet(limit)

    for await (const entry of this.fileReader.iterateEmbeddings()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding)

      if (similarity < minSimilarity) {
        continue
      }

      candidateSet.add(entry.key, similarity)
    }

    const results: SearchResult[] = candidateSet.getEntries().map((entry) => ({
      key: entry.key,
      similarity: entry.value
    }))

    return results
  }

  /**
   * Stores a text embedding in the append-only file
   * @param key - Unique identifier for this entry
   * @param text - Text to embed and store
   */
  async store(key: string, text: string): Promise<void> {
    const embedding = await this.generateEmbedding(text)

    const entry: EmbeddingEntry = {
      key,
      text,
      embedding,
      timestamp: Date.now()
    }

    const dir = dirname(this.storePath)

    await mkdir(dir, { recursive: true })

    const line = JSON.stringify(entry) + '\n'

    await appendFile(this.storePath, line, 'utf-8')
  }

  /**
   * Calculates cosine similarity between two embeddings
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity score between -1 and 1 (1 = identical, -1 = opposite)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions')
    }

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }

    magnitudeA = Math.sqrt(magnitudeA)
    magnitudeB = Math.sqrt(magnitudeB)

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0
    }

    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Generates a simple embedding from text
   * In production, this would call an actual embedding API (OpenAI, Cohere, etc.)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = await FlagEmbedding.init({
      model: EmbeddingModel.BGEBaseEN
    })

    const embeddings = embeddingModel.embed([text])

    for await (const batch of embeddings) {
      // Convert Float32Array to regular array for proper JSON serialization
      return Array.from(batch[0])
    }

    return []
  }
}
