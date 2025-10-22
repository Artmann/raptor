import { EmbeddingEngine } from "./src/index";

async function main() {
  // Create an embedding engine with append-only storage
  const engine = new EmbeddingEngine({
    storePath: "./data/embeddings.jsonl",
  });

  // Store some example text embeddings
  await engine.store("doc1", "The quick brown fox jumps over the lazy dog");
  await engine.store("doc2", "Machine learning is a subset of artificial intelligence");
  await engine.store("doc3", "Bun is a fast JavaScript runtime");

  console.log("✓ Embeddings stored successfully in ./data/embeddings.jsonl");
}

main().catch(console.error);
