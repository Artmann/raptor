import { EmbeddingEngine } from "./src/index";

async function main() {
  // Create an embedding engine with append-only storage
  const engine = new EmbeddingEngine({
    storePath: "./data/embeddings.jsonl",
  });

  console.log("Storing embeddings...");
  // Store some example text embeddings
  await engine.store("doc1", "The quick brown fox jumps over the lazy dog");
  await engine.store("doc2", "Machine learning is a subset of artificial intelligence");
  await engine.store("doc3", "Bun is a fast JavaScript runtime");

  console.log("✓ Embeddings stored successfully\n");

  // Retrieve embeddings by key
  console.log("Retrieving embeddings...");
  const doc1 = await engine.get("doc1");
  const doc2 = await engine.get("doc2");
  const notFound = await engine.get("doc999");

  if (doc1) {
    console.log(`\nKey: ${doc1.key}`);
    console.log(`Text: ${doc1.text}`);
    console.log(`Embedding dimensions: ${doc1.embedding.length}`);
    console.log(`Timestamp: ${new Date(doc1.timestamp).toISOString()}`);
  }

  if (doc2) {
    console.log(`\nKey: ${doc2.key}`);
    console.log(`Text: ${doc2.text}`);
    console.log(`Embedding dimensions: ${doc2.embedding.length}`);
  }

  console.log(`\nNon-existent key: ${notFound === null ? "null (not found)" : "found"}`);
}

main().catch(console.error);
