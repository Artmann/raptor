import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EngineOptions, EmbeddingEntry, SearchResult } from "./types";

export class EmbeddingEngine {
  private storePath: string;

  constructor(options: EngineOptions) {
    this.storePath = options.storePath;
  }

  /**
   * Generates a simple embedding from text
   * In production, this would call an actual embedding API (OpenAI, Cohere, etc.)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder: Generate a simple hash-based embedding
    // In production, replace this with actual embedding API call
    const normalized = text.toLowerCase().trim();
    const embedding: number[] = new Array(384).fill(0);

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      embedding[i % 384] += charCode;
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Calculates cosine similarity between two embeddings
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity score between -1 and 1 (1 = identical, -1 = opposite)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same dimensions");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Stores a text embedding in the append-only file
   * @param key - Unique identifier for this entry
   * @param text - Text to embed and store
   */
  async store(key: string, text: string): Promise<void> {
    // Generate embedding
    const embedding = await this.generateEmbedding(text);

    // Create entry
    const entry: EmbeddingEntry = {
      key,
      text,
      embedding,
      timestamp: Date.now(),
    };

    // Ensure directory exists
    const dir = dirname(this.storePath);
    await mkdir(dir, { recursive: true });

    // Append to file in JSONL format (one JSON object per line)
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.storePath, line, "utf-8");
  }

  /**
   * Retrieves an embedding entry by key
   * @param key - Unique identifier for the entry
   * @returns The embedding entry, or null if not found
   */
  async get(key: string): Promise<EmbeddingEntry | null> {
    try {
      // Check if file exists using Bun's file API
      const file = Bun.file(this.storePath);
      const fileExists = await file.exists();

      if (!fileExists) {
        return null;
      }

      // Read file content
      const content = await file.text();

      if (!content.trim()) {
        return null;
      }

      // Parse JSONL and find matching entries
      const lines = content.trim().split("\n");
      let latestEntry: EmbeddingEntry | null = null;

      // Iterate through all lines to find the most recent entry with the key
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as EmbeddingEntry;
          if (entry.key === key) {
            // Keep the most recent entry (later entries override earlier ones)
            if (!latestEntry || entry.timestamp > latestEntry.timestamp) {
              latestEntry = entry;
            }
          }
        } catch (parseError) {
          // Skip malformed lines
          continue;
        }
      }

      return latestEntry;
    } catch (error) {
      // Return null if file doesn't exist or other errors
      return null;
    }
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
    minSimilarity: number = 0
  ): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Check if file exists
      const file = Bun.file(this.storePath);
      const fileExists = await file.exists();

      if (!fileExists) {
        return [];
      }

      // Read file content
      const content = await file.text();

      if (!content.trim()) {
        return [];
      }

      // Parse all entries and deduplicate by key (keep most recent)
      const lines = content.trim().split("\n");
      const entriesMap = new Map<string, EmbeddingEntry>();

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as EmbeddingEntry;
          const existing = entriesMap.get(entry.key);

          // Keep the most recent entry for each key
          if (!existing || entry.timestamp > existing.timestamp) {
            entriesMap.set(entry.key, entry);
          }
        } catch (parseError) {
          // Skip malformed lines
          continue;
        }
      }

      // Calculate similarity for each unique entry
      const results: SearchResult[] = [];

      for (const entry of entriesMap.values()) {
        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

        // Only include results above the minimum similarity threshold
        if (similarity >= minSimilarity) {
          results.push({
            entry,
            similarity,
          });
        }
      }

      // Sort by similarity (highest first) and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);
    } catch (error) {
      // Return empty array on errors
      return [];
    }
  }
}
