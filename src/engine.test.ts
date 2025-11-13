import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EmbeddingEngine } from './engine'
import { unlink, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { readHeader } from './binary-format'

describe('EmbeddingEngine', () => {
  const testStorePath = './test-data/test-embeddings.raptor'
  let engine: EmbeddingEngine

  beforeEach(async () => {
    // Create test directory if it doesn't exist
    const dir = dirname(testStorePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    engine = new EmbeddingEngine({
      storePath: testStorePath
    })
  })

  afterEach(async () => {
    // Clean up test file
    try {
      if (existsSync(testStorePath)) {
        await unlink(testStorePath)
      }
    } catch {
      // Ignore errors if file doesn't exist
    }
  })

  describe('store', () => {
    it('should create binary file with header on first store', async () => {
      await engine.store('doc1', 'Hello world')

      expect(existsSync(testStorePath)).toBe(true)

      // Verify header was written
      const header = await readHeader(testStorePath)
      expect(header.version).toBe(1)
      expect(header.dimension).toBe(384) // bge-small-en-v1.5 dimension
    })

    it('should store entry and retrieve it back', async () => {
      await engine.store('doc1', 'Hello world')

      const entry = await engine.get('doc1')
      expect(entry).not.toBeNull()
      expect(entry?.key).toBe('doc1')
      expect(entry?.embedding).toBeInstanceOf(Array)
      expect(entry?.embedding.length).toBe(384)
    })

    it('should store multiple entries in append-only format', async () => {
      await engine.store('doc1', 'The quick brown fox')
      await engine.store('doc2', 'Machine learning is powerful')
      await engine.store('doc3', 'Bun is fast')

      // Verify file size increased (header + 3 records)
      const stats = await stat(testStorePath)
      expect(stats.size).toBeGreaterThan(16) // More than just header

      // Verify we can retrieve all entries
      const entry1 = await engine.get('doc1')
      const entry2 = await engine.get('doc2')
      const entry3 = await engine.get('doc3')

      expect(entry1?.key).toBe('doc1')
      expect(entry2?.key).toBe('doc2')
      expect(entry3?.key).toBe('doc3')
    })

    it('should append entries with same key (deduplication happens on read)', async () => {
      await engine.store('doc1', 'Original text')
      await engine.store('doc1', 'Updated text')

      // Get should return the latest version
      const entry = await engine.get('doc1')
      expect(entry?.key).toBe('doc1')

      // File should contain both records (append-only)
      const stats = await stat(testStorePath)
      // Header (16) + 2 records, each record is 2 + keyLen + 384*4 + 4
      const recordSize = 2 + 4 + 384 * 4 + 4 // key "doc1" = 4 bytes
      expect(stats.size).toBeGreaterThanOrEqual(16 + recordSize * 2)
    })

    it('should handle UTF-8 keys correctly', async () => {
      await engine.store('café☕', 'Coffee text')

      const entry = await engine.get('café☕')
      expect(entry?.key).toBe('café☕')
    })
  })

  describe('storeMany', () => {
    it('should store multiple entries in batch', async () => {
      const items = [
        { key: 'doc1', text: 'The quick brown fox' },
        { key: 'doc2', text: 'Machine learning is powerful' },
        { key: 'doc3', text: 'Bun is fast' }
      ]

      await engine.storeMany(items)

      // Verify file was created
      expect(existsSync(testStorePath)).toBe(true)

      // Verify all entries can be retrieved
      const entry1 = await engine.get('doc1')
      const entry2 = await engine.get('doc2')
      const entry3 = await engine.get('doc3')

      expect(entry1?.key).toBe('doc1')
      expect(entry2?.key).toBe('doc2')
      expect(entry3?.key).toBe('doc3')
    })

    it('should create header on first storeMany', async () => {
      const items = [
        { key: 'doc1', text: 'Hello world' },
        { key: 'doc2', text: 'Test content' }
      ]

      await engine.storeMany(items)

      expect(existsSync(testStorePath)).toBe(true)

      // Verify header was written
      const header = await readHeader(testStorePath)
      expect(header.version).toBe(1)
      expect(header.dimension).toBe(384)
    })

    it('should generate embeddings for all items', async () => {
      const items = [
        { key: 'doc1', text: 'First document' },
        { key: 'doc2', text: 'Second document' }
      ]

      await engine.storeMany(items)

      const entry1 = await engine.get('doc1')
      const entry2 = await engine.get('doc2')

      expect(entry1?.embedding.length).toBe(384)
      expect(entry2?.embedding.length).toBe(384)

      // Different texts should have different embeddings
      expect(entry1?.embedding[0]).not.toBe(entry2?.embedding[0])
    })

    it('should handle single item in array', async () => {
      const items = [{ key: 'single', text: 'Single item' }]

      await engine.storeMany(items)

      const entry = await engine.get('single')
      expect(entry?.key).toBe('single')
    })

    it('should handle UTF-8 keys in batch', async () => {
      const items = [
        { key: 'café☕', text: 'Coffee' },
        { key: '日本語', text: 'Japanese text' }
      ]

      await engine.storeMany(items)

      const entry1 = await engine.get('café☕')
      const entry2 = await engine.get('日本語')

      expect(entry1?.key).toBe('café☕')
      expect(entry2?.key).toBe('日本語')
    })

    it('should work with search after storeMany', async () => {
      const items = [
        { key: 'doc1', text: 'Machine learning is powerful' },
        { key: 'doc2', text: 'Artificial intelligence applications' },
        { key: 'doc3', text: 'Cooking recipes and food' }
      ]

      await engine.storeMany(items)

      // Small delay to ensure file is flushed
      await new Promise((resolve) => setTimeout(resolve, 50))

      const results = await engine.search('AI and ML', 3)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].similarity).toBeGreaterThanOrEqual(0)
    })
  })

  describe('get', () => {
    it('should retrieve stored entry by key', async () => {
      await engine.store('doc1', 'Test content')

      const entry = await engine.get('doc1')

      expect(entry).not.toBeNull()
      expect(entry?.key).toBe('doc1')
      expect(entry?.embedding).toBeInstanceOf(Array)
      expect(entry?.embedding.length).toBe(384)
    })

    it('should return null for non-existent key', async () => {
      const entry = await engine.get('nonexistent')
      expect(entry).toBeNull()
    })

    it('should return most recent entry for duplicate keys', async () => {
      const text1 = 'First version content here'
      const text2 = 'Second version completely different text'

      await engine.store('doc1', text1)
      await engine.store('doc1', text2)

      const entry = await engine.get('doc1')

      expect(entry).not.toBeNull()
      expect(entry?.key).toBe('doc1')

      // Verify it's the second version by checking the embedding
      // (embeddings for different text should be different)
      const secondEmbedding = await engine.generateEmbedding(text2)

      // Check that retrieved embedding matches the second one
      expect(entry?.embedding[0]).toBeCloseTo(secondEmbedding[0])
    })

    it('should handle empty file gracefully', async () => {
      const newEngine = new EmbeddingEngine({
        storePath: './test-data/empty.raptor'
      })

      const entry = await newEngine.get('anykey')
      expect(entry).toBeNull()
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await engine.store('doc1', 'The quick brown fox jumps over the lazy dog')
      await engine.store(
        'doc2',
        'Machine learning is a subset of artificial intelligence'
      )
      await engine.store('doc3', 'Bun is a fast JavaScript runtime')
      // Small delay to ensure file is flushed
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should find similar entries', async () => {
      const results = await engine.search('machine learning')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].key).toBeDefined()
      expect(results[0].similarity).toBeTypeOf('number')
      expect(results[0].similarity).toBeGreaterThanOrEqual(-1)
      expect(results[0].similarity).toBeLessThanOrEqual(1)
    })

    it('should sort results by similarity', async () => {
      const results = await engine.search('machine learning AI', 3)

      // Verify results are sorted in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
          results[i].similarity
        )
      }
    })

    it('should respect limit parameter', async () => {
      const results = await engine.search('test query', 2)

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should respect minSimilarity threshold', async () => {
      const results = await engine.search('test', 10, 0.7)

      for (const result of results) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.7)
      }
    })

    it('should return empty array when no file exists', async () => {
      const newEngine = new EmbeddingEngine({
        storePath: './test-data/nonexistent.raptor'
      })

      const results = await newEngine.search('test', 5, 0.1)

      expect(results).toEqual([])
    })

    it('should only return latest version of duplicate keys', async () => {
      await engine.store('dup', 'artificial intelligence AI ML')
      await engine.store('dup', 'cooking recipes food kitchen')

      const results = await engine.search('machine learning', 10, 0)

      // Should only have one result for 'dup' (the latest version)
      const dupResults = results.filter((r) => r.key === 'dup')
      expect(dupResults.length).toBeLessThanOrEqual(1)
    })
  })
})
