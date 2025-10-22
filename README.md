# Raptor

An embedding database that stores text indexes in an append-only file format.

## Features

- Simple key-value storage for text embeddings
- Semantic search using cosine similarity
- Append-only file format (JSONL)
- Built for Bun runtime
- TypeScript support

## Installation

```bash
bun install
```

## Usage

```typescript
import { EmbeddingEngine } from "./src/index";

const engine = new EmbeddingEngine({
  storePath: "./data/embeddings.jsonl",
});

// Store text with embeddings
await engine.store("doc1", "The quick brown fox jumps over the lazy dog");
await engine.store("doc2", "Machine learning is a subset of artificial intelligence");

// Retrieve embeddings by key
const entry = await engine.get("doc1");
if (entry) {
  console.log(entry.text);
  console.log(entry.embedding);
}

// Search for similar texts
const results = await engine.search("artificial intelligence", 5);
for (const result of results) {
  console.log(`[${result.similarity.toFixed(4)}] ${result.entry.text}`);
}
```

## Example

Run the example:

```bash
bun run example.ts
```

## Storage Format

Embeddings are stored in JSONL format (JSON Lines), with each line containing:

```json
{
  "key": "doc1",
  "text": "original text",
  "embedding": [0.1, 0.2, ...],
  "timestamp": 1234567890
}
```

## API

### `EmbeddingEngine`

#### `constructor(options: EngineOptions)`

Create a new embedding engine.

- `options.storePath` - Path to the append-only storage file

#### `store(key: string, text: string): Promise<void>`

Store a text embedding.

- `key` - Unique identifier for the entry
- `text` - Text to embed and store

#### `get(key: string): Promise<EmbeddingEntry | null>`

Retrieve an embedding entry by key.

- `key` - Unique identifier for the entry
- Returns the most recent entry with the given key, or `null` if not found

**Note:** If a key is stored multiple times, the most recent entry (based on timestamp) is returned.

#### `search(query: string, limit?: number, minSimilarity?: number): Promise<SearchResult[]>`

Search for similar embeddings using cosine similarity.

- `query` - Text query to search for
- `limit` - Maximum number of results to return (default: 10)
- `minSimilarity` - Minimum similarity threshold, range -1 to 1 (default: 0)
- Returns array of results sorted by similarity (highest first)

**SearchResult** structure:
```typescript
{
  entry: EmbeddingEntry;  // The matching entry
  similarity: number;     // Cosine similarity score (1 = identical, 0 = orthogonal, -1 = opposite)
}
```

**How it works:**
1. Generates an embedding for the query text
2. Compares the query embedding against all stored embeddings using cosine similarity
3. Returns the most similar results above the minimum threshold
4. Automatically deduplicates by key (uses most recent entry)
