import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { EmbeddingFileReader } from './embedding-file-reader'
import type { EmbeddingEntry } from './types'

describe('EmbeddingFileReader', () => {
  const testDir = '/tmp/raptor-test'
  const testFile = join(testDir, 'test-embeddings.jsonl')
  let reader: EmbeddingFileReader

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
    reader = new EmbeddingFileReader(testFile)
  })

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // File might not exist
    }
  })

  describe('iterateEmbeddings', () => {
    it('should yield entries in reverse order', async () => {
      const entries: EmbeddingEntry[] = [
        {
          key: 'first',
          text: 'First entry',
          embedding: [1, 2, 3],
          timestamp: 1000
        },
        {
          key: 'second',
          text: 'Second entry',
          embedding: [4, 5, 6],
          timestamp: 2000
        },
        {
          key: 'third',
          text: 'Third entry',
          embedding: [7, 8, 9],
          timestamp: 3000
        }
      ]

      const fileContent =
        entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'

      await writeFile(testFile, fileContent, 'utf-8')

      const results: EmbeddingEntry[] = []

      for await (const entry of reader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(3)
      expect(results[0].key).toBe('third')
      expect(results[1].key).toBe('second')
      expect(results[2].key).toBe('first')
    })

    it('should handle empty file', async () => {
      await writeFile(testFile, '', 'utf-8')

      const results: EmbeddingEntry[] = []

      for await (const entry of reader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(0)
    })

    it('should handle non-existent file', async () => {
      const nonExistentReader = new EmbeddingFileReader(
        '/tmp/non-existent-file.jsonl'
      )
      const results: EmbeddingEntry[] = []

      for await (const entry of nonExistentReader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(0)
    })

    it('should skip malformed JSON lines', async () => {
      const validEntry: EmbeddingEntry = {
        key: 'valid',
        text: 'Valid entry',
        embedding: [1, 2, 3],
        timestamp: 1000
      }

      const fileContent =
        [
          '{"invalid": json}',
          JSON.stringify(validEntry),
          'not json at all',
          ''
        ].join('\n') + '\n'

      await writeFile(testFile, fileContent, 'utf-8')

      const results: EmbeddingEntry[] = []

      for await (const entry of reader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(1)
      expect(results[0].key).toBe('valid')
    })

    it('should handle large files with custom chunk size', async () => {
      const entries: EmbeddingEntry[] = []

      for (let i = 0; i < 100; i++) {
        entries.push({
          key: `entry-${i}`,
          text: `Entry number ${i}`,
          embedding: new Array(10).fill(i),
          timestamp: 1000 + i
        })
      }

      const fileContent =
        entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'

      await writeFile(testFile, fileContent, 'utf-8')

      const results: EmbeddingEntry[] = []
      const smallChunkSize = 1024

      for await (const entry of reader.iterateEmbeddings(smallChunkSize)) {
        results.push(entry)
      }

      expect(results).toHaveLength(100)
      expect(results[0].key).toBe('entry-99')
      expect(results[99].key).toBe('entry-0')
    })

    it('should handle entries with different embedding formats', async () => {
      const entries = [
        {
          key: 'array-embedding',
          text: 'Array format',
          embedding: [1, 2, 3],
          timestamp: 1000
        },
        {
          key: 'object-embedding',
          text: 'Object format',
          embedding: { 0: 4, 1: 5, 2: 6 },
          timestamp: 2000
        }
      ]

      const fileContent =
        entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'

      await writeFile(testFile, fileContent, 'utf-8')

      const results: EmbeddingEntry[] = []

      for await (const entry of reader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(2)
      expect(results[0].key).toBe('object-embedding')
      expect(results[1].key).toBe('array-embedding')
    })

    it('should handle single line file', async () => {
      const entry: EmbeddingEntry = {
        key: 'single',
        text: 'Single entry',
        embedding: [1, 2, 3],
        timestamp: 1000
      }

      await writeFile(testFile, JSON.stringify(entry), 'utf-8')

      const results: EmbeddingEntry[] = []

      for await (const entry of reader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(1)
      expect(results[0].key).toBe('single')
    })

    it('should only yield the most recent entry for duplicate keys', async () => {
      const entries: EmbeddingEntry[] = [
        {
          key: 'duplicate',
          text: 'First entry',
          embedding: [1, 2, 3],
          timestamp: 1000
        },
        {
          key: 'unique',
          text: 'Unique entry',
          embedding: [4, 5, 6],
          timestamp: 2000
        },
        {
          key: 'duplicate',
          text: 'Second entry (newer)',
          embedding: [7, 8, 9],
          timestamp: 3000
        },
        {
          key: 'duplicate',
          text: 'Third entry (newest)',
          embedding: [10, 11, 12],
          timestamp: 4000
        }
      ]

      const fileContent =
        entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'

      await writeFile(testFile, fileContent, 'utf-8')

      const results: EmbeddingEntry[] = []

      for await (const entry of reader.iterateEmbeddings()) {
        results.push(entry)
      }

      expect(results).toHaveLength(2)

      // Should only get the newest entry for 'duplicate' key and the unique entry
      expect(results[0].key).toBe('duplicate')
      expect(results[0].text).toBe('Third entry (newest)')
      expect(results[0].timestamp).toBe(4000)

      expect(results[1].key).toBe('unique')
      expect(results[1].text).toBe('Unique entry')
      expect(results[1].timestamp).toBe(2000)
    })
  })
})
