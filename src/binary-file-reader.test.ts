import { describe, it, expect, afterEach } from 'vitest'
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { writeHeader, writeRecord } from './binary-format'
import { BinaryFileReader } from './binary-file-reader'
import type { EmbeddingEntry } from './types'

const testFile = './test-binary-reader.raptor'

describe('BinaryFileReader', () => {
  afterEach(async () => {
    if (existsSync(testFile)) {
      await unlink(testFile)
    }
  })

  it('should read a single record', async () => {
    const dimension = 3
    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'key1', new Float32Array([1.0, 2.0, 3.0]))

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('key1')
    expect(entries[0].embedding).toHaveLength(3)
    expect(entries[0].embedding[0]).toBeCloseTo(1.0)
  })

  it('should read multiple records in reverse order', async () => {
    const dimension = 2
    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'first', new Float32Array([1.0, 2.0]))
    await writeRecord(testFile, 'second', new Float32Array([3.0, 4.0]))
    await writeRecord(testFile, 'third', new Float32Array([5.0, 6.0]))

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(3)
    // Should be in reverse order (newest first)
    expect(entries[0].key).toBe('third')
    expect(entries[1].key).toBe('second')
    expect(entries[2].key).toBe('first')
  })

  it('should deduplicate keys (newest wins)', async () => {
    const dimension = 2
    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'doc1', new Float32Array([1.0, 2.0]))
    await writeRecord(testFile, 'doc2', new Float32Array([3.0, 4.0]))
    await writeRecord(testFile, 'doc1', new Float32Array([5.0, 6.0])) // Duplicate, newer

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(2)

    // Find doc1 in the results
    const doc1Entry = entries.find((e) => e.key === 'doc1')
    expect(doc1Entry).toBeDefined()
    // Should have the newer values
    expect(doc1Entry?.embedding[0]).toBeCloseTo(5.0)
    expect(doc1Entry?.embedding[1]).toBeCloseTo(6.0)

    // doc2 should also be present
    const doc2Entry = entries.find((e) => e.key === 'doc2')
    expect(doc2Entry).toBeDefined()
  })

  it('should handle multiple duplicates correctly', async () => {
    const dimension = 1
    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'x', new Float32Array([1.0]))
    await writeRecord(testFile, 'x', new Float32Array([2.0]))
    await writeRecord(testFile, 'x', new Float32Array([3.0]))
    await writeRecord(testFile, 'y', new Float32Array([4.0]))
    await writeRecord(testFile, 'x', new Float32Array([5.0])) // Final value for x

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(2) // Only x and y

    const xEntry = entries.find((e) => e.key === 'x')
    expect(xEntry?.embedding[0]).toBeCloseTo(5.0) // Latest value
  })

  it('should handle UTF-8 keys', async () => {
    const dimension = 2
    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'hello世界', new Float32Array([1.0, 2.0]))
    await writeRecord(testFile, 'café', new Float32Array([3.0, 4.0]))

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(2)
    const keys = entries.map((e) => e.key)
    expect(keys).toContain('hello世界')
    expect(keys).toContain('café')
  })

  it('should handle empty file (header only)', async () => {
    const dimension = 768
    await writeHeader(testFile, dimension)

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(0)
  })

  it('should include text and timestamp in entries', async () => {
    const dimension = 2
    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'test', new Float32Array([1.0, 2.0]))

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries[0]).toHaveProperty('key')
    expect(entries[0]).toHaveProperty('text')
    expect(entries[0]).toHaveProperty('embedding')
    expect(entries[0]).toHaveProperty('timestamp')
  })

  it('should handle large number of records efficiently', async () => {
    const dimension = 4
    await writeHeader(testFile, dimension)

    // Write 100 records
    for (let i = 0; i < 100; i++) {
      await writeRecord(
        testFile,
        `key${i}`,
        new Float32Array([i, i + 1, i + 2, i + 3])
      )
    }

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(100)
    // Check they're in reverse order
    expect(entries[0].key).toBe('key99')
    expect(entries[99].key).toBe('key0')
  })

  it('should handle large embeddings (768 dimensions)', async () => {
    const dimension = 768
    const embedding = new Float32Array(dimension)
    for (let i = 0; i < dimension; i++) {
      embedding[i] = i / 100
    }

    await writeHeader(testFile, dimension)
    await writeRecord(testFile, 'large', embedding)

    const reader = new BinaryFileReader(testFile)
    const entries: EmbeddingEntry[] = []

    for await (const entry of reader.entries()) {
      entries.push(entry)
    }

    expect(entries).toHaveLength(1)
    expect(entries[0].embedding).toHaveLength(768)
    expect(entries[0].embedding[767]).toBeCloseTo(7.67)
  })
})
