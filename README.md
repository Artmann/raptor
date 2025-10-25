# Raptor

An embedding database that stores text indexes in an append-only file format.

## Features

- Simple key-value storage for text embeddings
- Semantic search using cosine similarity
- Binary append-only file format (.raptor)
- Built for Bun runtime
- TypeScript support
- ~50% smaller file size vs JSONL format

## Installation

```bash
bun install
```

## CLI Usage

Raptor includes a command-line interface for storing and searching embeddings.

### Commands

**Store a text embedding:**

```bash
raptor store <key> <text> [--storePath path]
```

**Retrieve an embedding by key:**

```bash
raptor get <key> [--storePath path]
```

**Search for similar embeddings:**

```bash
raptor search <query> [--limit 10] [--minSimilarity 0] [--storePath path]
```

### Options

- `-s, --storePath` - Path to the embeddings store file (default:
  ./database.raptor)
- `-l, --limit` - Maximum number of results to return (default: 10)
- `-m, --minSimilarity` - Minimum similarity threshold 0-1 (default: 0)

### Examples

```bash
# Store some documents
raptor store doc1 "The quick brown fox jumps over the lazy dog"
raptor store doc2 "Machine learning is a subset of artificial intelligence"
raptor store doc3 "Bun is a fast JavaScript runtime"

# Retrieve a specific document
raptor get doc1

# Search for similar documents
raptor search "artificial intelligence" --limit 5

# Use a custom storage path
raptor store key1 "Some text" --storePath ./custom/path.raptor
```

## Programmatic Usage

```typescript
import { EmbeddingEngine } from './src/index'

const engine = new EmbeddingEngine({
  storePath: './database.raptor'
})

// Store text with embeddings
await engine.store('doc1', 'The quick brown fox jumps over the lazy dog')
await engine.store(
  'doc2',
  'Machine learning is a subset of artificial intelligence'
)

// Retrieve embeddings by key
const entry = await engine.get('doc1')
if (entry) {
  console.log(entry.text)
  console.log(entry.embedding)
}

// Search for similar texts
const results = await engine.search('artificial intelligence', 5)
for (const result of results) {
  console.log(`[${result.similarity.toFixed(4)}] ${result.entry.text}`)
}
```

## Examples

See the [examples/](examples/) directory for practical use cases:

- **Document Search / RAG** - Semantic search over documentation chunks
- **FAQ Bot** - Match user questions to FAQs with confidence thresholds
- **Code Snippet Library** - Search code by natural language descriptions
- **Content Recommendation** - "More like this" functionality

Each example is self-contained and runnable:

```bash
bun run examples/01-document-search.ts
bun run examples/02-faq-bot.ts
bun run examples/03-code-snippets.ts
bun run examples/04-content-recommendation.ts
```

## Storage Format

Embeddings are stored in a compact binary format (.raptor files) with the
following structure:

**Header (16 bytes):**

- Magic bytes: "EMBD" (4 bytes)
- Version: 1 (2 bytes, uint16)
- Embedding dimension: e.g., 768 for BGE-Base-EN (4 bytes, uint32)
- Reserved: 6 bytes for future use

**Records (variable length):**

- Key length (2 bytes, uint16)
- Key (UTF-8 encoded, variable length)
- Embedding vector (dimension × 4 bytes, float32 array)
- Record length footer (4 bytes, uint32)

The append-only format means duplicate keys can exist. The latest value (closest
to end of file) is used when reading.

**Benefits:**

- ~50% smaller than JSONL format
- Faster parsing (no JSON decode)
- Efficient reverse reading for deduplication
- Single-file storage

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

**Note:** If a key is stored multiple times, the most recent entry (based on
timestamp) is returned.

#### `search(query: string, limit?: number, minSimilarity?: number): Promise<SearchResult[]>`

Search for similar embeddings using cosine similarity.

- `query` - Text query to search for
- `limit` - Maximum number of results to return (default: 10)
- `minSimilarity` - Minimum similarity threshold, range -1 to 1 (default: 0)
- Returns array of results sorted by similarity (highest first)

**SearchResult** structure:

```typescript
{
  entry: EmbeddingEntry // The matching entry
  similarity: number // Cosine similarity score (1 = identical, 0 = orthogonal, -1 = opposite)
}
```

**How it works:**

1. Generates an embedding for the query text
2. Compares the query embedding against all stored embeddings using cosine
   similarity
3. Returns the most similar results above the minimum threshold
4. Automatically deduplicates by key (uses most recent entry)
