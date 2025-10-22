import { EmbeddingEngine } from './src/index'

async function main() {
  // Create an embedding engine with append-only storage
  const engine = new EmbeddingEngine({
    storePath: './data/embeddings.jsonl'
  })

  console.log('Storing embeddings...')
  // Store some example text embeddings
  await engine.store('doc1', 'The quick brown fox jumps over the lazy dog')
  await engine.store(
    'doc2',
    'Machine learning is a subset of artificial intelligence'
  )
  await engine.store('doc3', 'Bun is a fast JavaScript runtime')

  console.log('✓ Embeddings stored successfully\n')

  // Retrieve embeddings by key
  console.log('Retrieving embeddings...')
  const doc1 = await engine.get('doc1')
  const doc2 = await engine.get('doc2')
  const notFound = await engine.get('doc999')

  if (doc1) {
    console.log(`\nKey: ${doc1.key}`)
    console.log(`Text: ${doc1.text}`)
    console.log(`Embedding dimensions: ${doc1.embedding.length}`)
    console.log(`Timestamp: ${new Date(doc1.timestamp).toISOString()}`)
  }

  if (doc2) {
    console.log(`\nKey: ${doc2.key}`)
    console.log(`Text: ${doc2.text}`)
    console.log(`Embedding dimensions: ${doc2.embedding.length}`)
  }

  console.log(
    `\nNon-existent key: ${notFound === null ? 'null (not found)' : 'found'}`
  )

  // Search for similar embeddings
  console.log('\n' + '='.repeat(50))
  console.log('Searching for similar texts...\n')

  const query1 = 'animals and dogs'
  console.log(`Query: "${query1}"`)
  const results1 = await engine.search(query1, 3)
  console.log(`Found ${results1.length} results:`)
  for (const result of results1) {
    console.log(
      `  - [${result.similarity.toFixed(4)}] ${result.entry.key}: ${result.entry.text}`
    )
  }

  const query2 = 'artificial intelligence and computers'
  console.log(`\nQuery: "${query2}"`)
  const results2 = await engine.search(query2, 3)
  console.log(`Found ${results2.length} results:`)
  for (const result of results2) {
    console.log(
      `  - [${result.similarity.toFixed(4)}] ${result.entry.key}: ${result.entry.text}`
    )
  }

  const query3 = 'fast performance runtime'
  console.log(`\nQuery: "${query3}"`)
  const results3 = await engine.search(query3, 3)
  console.log(`Found ${results3.length} results:`)
  for (const result of results3) {
    console.log(
      `  - [${result.similarity.toFixed(4)}] ${result.entry.key}: ${result.entry.text}`
    )
  }
}

main().catch(console.error)
