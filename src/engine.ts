import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EngineOptions, EmbeddingEntry } from "./types";

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
}
