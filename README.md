# Raptor

An embedding database that stores text indexes in an append-only file format.

## Features

- Simple key-value storage for text embeddings
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
await engine.store("doc1", "Your text here");
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
