import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EmbeddingEngine } from './engine'
import { readFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

describe('EmbeddingEngine', () => {
  const testStorePath = './test-data/test-embeddings.jsonl'
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
    it('should store a single text entry', async () => {
      await engine.store('doc1', 'Hello world')

      const content = await readFile(testStorePath, 'utf-8')
      const lines = content.trim().split('\n')

      expect(lines.length).toBe(1)

      const entry = JSON.parse(lines[0])
      expect(entry.key).toBe('doc1')
      expect(entry.text).toBe('Hello world')
      expect(entry.embedding).toBeInstanceOf(Array)
      expect(entry.embedding.length).toBe(768)
      expect(entry.timestamp).toBeTypeOf('number')
    })

    it('should store multiple text entries in append-only format', async () => {
      await engine.store('doc1', 'The quick brown fox')
      await engine.store('doc2', 'Machine learning is powerful')
      await engine.store('doc3', 'Bun is fast')

      const content = await readFile(testStorePath, 'utf-8')

      // Verify file format with inline snapshot
      // Remove timestamps and embeddings for stable snapshot
      const lines = content.trim().split('\n')
      const sanitized = lines.map((line) => {
        const entry = JSON.parse(line)
        return {
          key: entry.key,
          text: entry.text,
          embeddingLength: entry.embedding.length,
          hasTimestamp: typeof entry.timestamp === 'number'
        }
      })

      expect(sanitized).toMatchInlineSnapshot(`
        [
          {
            "embeddingLength": 768,
            "hasTimestamp": true,
            "key": "doc1",
            "text": "The quick brown fox",
          },
          {
            "embeddingLength": 768,
            "hasTimestamp": true,
            "key": "doc2",
            "text": "Machine learning is powerful",
          },
          {
            "embeddingLength": 768,
            "hasTimestamp": true,
            "key": "doc3",
            "text": "Bun is fast",
          },
        ]
      `)
    })

    it('should verify actual file content structure', async () => {
      await engine.store('test1', 'First document')
      await engine.store('test2', 'Second document')

      const content = await readFile(testStorePath, 'utf-8')
      const lines = content.trim().split('\n')

      // Parse each line to verify it's valid JSON
      const entries = lines.map((line) => JSON.parse(line))

      // Create a snapshot-friendly version
      const snapshot = entries.map((entry) => ({
        key: entry.key,
        text: entry.text,
        embeddingFirstThree: entry.embedding
          .slice(0, 3)
          .map((n: number) => n.toFixed(4)),
        embeddingLength: entry.embedding.length
      }))

      expect(snapshot).toMatchInlineSnapshot(`
        [
          {
            "embeddingFirstThree": [
              "-0.0288",
              "0.0249",
              "0.0017",
            ],
            "embeddingLength": 768,
            "key": "test1",
            "text": "First document",
          },
          {
            "embeddingFirstThree": [
              "-0.0151",
              "0.0165",
              "-0.0090",
            ],
            "embeddingLength": 768,
            "key": "test2",
            "text": "Second document",
          },
        ]
      `)
    })

    it('should append entries with same key', async () => {
      await engine.store('doc1', 'Original text')
      await engine.store('doc1', 'Updated text')

      const content = await readFile(testStorePath, 'utf-8')
      const lines = content.trim().split('\n')

      expect(lines.length).toBe(2)

      const entries = lines.map((line) => JSON.parse(line))
      expect(entries[0].text).toBe('Original text')
      expect(entries[1].text).toBe('Updated text')
      expect(entries[0].key).toBe('doc1')
      expect(entries[1].key).toBe('doc1')
    })
  })

  describe('get', () => {
    it('should retrieve stored entry by key', async () => {
      await engine.store('doc1', 'Test content')

      const entry = await engine.get('doc1')

      expect(entry).not.toBeNull()
      expect(entry?.key).toBe('doc1')
      expect(entry?.text).toBe('Test content')
    })

    it('should return null for non-existent key', async () => {
      const entry = await engine.get('nonexistent')
      expect(entry).toBeNull()
    })

    it('should return most recent entry for duplicate keys', async () => {
      await engine.store('doc1', 'First version')
      await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure different timestamps
      await engine.store('doc1', 'Second version')

      const entry = await engine.get('doc1')

      expect(entry?.text).toBe('Second version')
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
        storePath: './test-data/nonexistent.jsonl'
      })

      const results = await newEngine.search('test', 5, 0.1)

      expect(results).toEqual([])
    })
  })
})
