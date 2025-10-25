import { describe, it, expect, afterEach } from 'vitest'
import { unlink, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import {
  writeHeader,
  readHeader,
  writeRecord,
  calculateRecordLength,
  readRecordForward,
  magicBytes,
  currentVersion,
  headerSize
} from './binary-format'

const testFile = './test-binary-header.raptor'

describe('Binary Format - Header', () => {
  afterEach(async () => {
    if (existsSync(testFile)) {
      await unlink(testFile)
    }
  })

  describe('writeHeader', () => {
    it('should write a 16-byte header with correct structure', async () => {
      const dimension = 768
      await writeHeader(testFile, dimension)

      const buffer = await readFile(testFile)

      expect(buffer.byteLength).toBe(headerSize)
      expect(headerSize).toBe(16)

      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
      )

      // Check magic bytes "EMBD"
      const magic = new Uint8Array(buffer.buffer, buffer.byteOffset, 4)
      expect(String.fromCharCode(...magic)).toBe(magicBytes)

      // Check version (uint16 at offset 4)
      const version = view.getUint16(4, true) // little-endian
      expect(version).toBe(currentVersion)
      expect(currentVersion).toBe(1)

      // Check dimension (uint32 at offset 6)
      const dim = view.getUint32(6, true) // little-endian
      expect(dim).toBe(dimension)

      // Check reserved bytes are zeros (6 bytes at offset 10)
      for (let i = 10; i < 16; i++) {
        expect(view.getUint8(i)).toBe(0)
      }
    })

    it('should handle different embedding dimensions', async () => {
      const dimension = 1536
      await writeHeader(testFile, dimension)

      const buffer = await readFile(testFile)
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
      )

      const dim = view.getUint32(6, true)
      expect(dim).toBe(1536)
    })
  })

  describe('readHeader', () => {
    it('should read and parse header correctly', async () => {
      const dimension = 768
      await writeHeader(testFile, dimension)

      const header = await readHeader(testFile)

      expect(header.version).toBe(1)
      expect(header.dimension).toBe(768)
    })

    it('should throw error for invalid magic bytes', async () => {
      // Write invalid magic bytes
      const buffer = new ArrayBuffer(16)
      const view = new DataView(buffer)

      // Write "XXXX" instead of "EMBD"
      view.setUint8(0, 'X'.charCodeAt(0))
      view.setUint8(1, 'X'.charCodeAt(0))
      view.setUint8(2, 'X'.charCodeAt(0))
      view.setUint8(3, 'X'.charCodeAt(0))

      await writeFile(testFile, new Uint8Array(buffer))

      await expect(readHeader(testFile)).rejects.toThrow(
        'Invalid file format: magic bytes'
      )
    })

    it('should throw error for unsupported version', async () => {
      const buffer = new ArrayBuffer(16)
      const view = new DataView(buffer)

      // Write valid magic bytes
      const magic = magicBytes
      for (let i = 0; i < 4; i++) {
        view.setUint8(i, magic.charCodeAt(i))
      }

      // Write unsupported version (e.g., 99)
      view.setUint16(4, 99, true)

      // Write dimension
      view.setUint32(6, 768, true)

      await writeFile(testFile, new Uint8Array(buffer))

      await expect(readHeader(testFile)).rejects.toThrow(
        'Unsupported version: 99'
      )
    })

    it('should throw error for file too small to contain header', async () => {
      // Write only 10 bytes instead of 16
      const buffer = new ArrayBuffer(10)
      await writeFile(testFile, new Uint8Array(buffer))

      await expect(readHeader(testFile)).rejects.toThrow()
    })
  })
})

describe('Binary Format - Record', () => {
  afterEach(async () => {
    if (existsSync(testFile)) {
      await unlink(testFile)
    }
  })

  describe('calculateRecordLength', () => {
    it('should calculate correct record length for 768 dimension', () => {
      const keyLength = 7 // "user123"
      const dimension = 768

      const expectedLength = 2 + keyLength + dimension * 4 + 4
      // 2 (key length) + 7 (key) + 3072 (768 float32s) + 4 (record length) = 3085

      expect(calculateRecordLength(keyLength, dimension)).toBe(expectedLength)
      expect(calculateRecordLength(keyLength, dimension)).toBe(3085)
    })

    it('should calculate correct record length for 1536 dimension', () => {
      const keyLength = 10
      const dimension = 1536

      // 2 + 10 + 6144 + 4 = 6160
      expect(calculateRecordLength(keyLength, dimension)).toBe(6160)
    })

    it('should handle single character keys', () => {
      const keyLength = 1
      const dimension = 768

      // 2 + 1 + 768 * 4 + 4 = 3079
      expect(calculateRecordLength(keyLength, dimension)).toBe(3079)
    })
  })

  describe('writeRecord', () => {
    it('should write a record with correct structure', async () => {
      const key = 'doc1'
      const embedding = new Float32Array([0.1, 0.2, 0.3])
      const dimension = 3

      // First write header
      await writeHeader(testFile, dimension)

      // Then append record
      await writeRecord(testFile, key, embedding)

      const buffer = await readFile(testFile)

      // Total size should be header + record
      const keyBytes = new TextEncoder().encode(key)
      const recordLength = calculateRecordLength(keyBytes.length, dimension)
      expect(buffer.byteLength).toBe(headerSize + recordLength)

      // Read the record part (skip header)
      const recordView = new DataView(
        buffer.buffer,
        buffer.byteOffset + headerSize
      )

      // Check key length (uint16 at offset 0)
      const keyLength = recordView.getUint16(0, true)
      expect(keyLength).toBe(4) // "doc1" is 4 bytes

      // Check key (at offset 2)
      const keyArray = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset + headerSize + 2,
        keyLength
      )
      const decodedKey = new TextDecoder().decode(keyArray)
      expect(decodedKey).toBe('doc1')

      // Check embedding (at offset 2 + keyLength)
      const embeddingOffset = 2 + keyLength
      for (let i = 0; i < dimension; i++) {
        const value = recordView.getFloat32(embeddingOffset + i * 4, true)
        expect(value).toBeCloseTo(embedding[i])
      }

      // Check record length footer (at offset 2 + keyLength + dimension*4)
      const footerOffset = 2 + keyLength + dimension * 4
      const storedRecordLength = recordView.getUint32(footerOffset, true)
      expect(storedRecordLength).toBe(recordLength)
    })

    it('should handle UTF-8 keys correctly', async () => {
      const key = 'użytkownik' // Polish word with UTF-8 characters
      const embedding = new Float32Array([1.0, 2.0])
      const dimension = 2

      await writeHeader(testFile, dimension)
      await writeRecord(testFile, key, embedding)

      const buffer = await readFile(testFile)

      const recordView = new DataView(
        buffer.buffer,
        buffer.byteOffset + headerSize
      )
      const keyLength = recordView.getUint16(0, true)

      // UTF-8 encoding of "użytkownik" is more than 10 bytes
      const keyBytes = new TextEncoder().encode(key)
      expect(keyLength).toBe(keyBytes.length)

      // Read and decode key
      const keyArray = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset + headerSize + 2,
        keyLength
      )
      const decodedKey = new TextDecoder().decode(keyArray)
      expect(decodedKey).toBe(key)
    })

    it('should append multiple records', async () => {
      const dimension = 2
      await writeHeader(testFile, dimension)

      await writeRecord(testFile, 'key1', new Float32Array([1.0, 2.0]))
      await writeRecord(testFile, 'key2', new Float32Array([3.0, 4.0]))
      await writeRecord(testFile, 'key3', new Float32Array([5.0, 6.0]))

      const buffer = await readFile(testFile)

      const record1Length = calculateRecordLength(4, dimension) // "key1" = 4 bytes
      const record2Length = calculateRecordLength(4, dimension) // "key2" = 4 bytes
      const record3Length = calculateRecordLength(4, dimension) // "key3" = 4 bytes

      const expectedSize =
        headerSize + record1Length + record2Length + record3Length

      expect(buffer.byteLength).toBe(expectedSize)
    })

    it('should handle large embeddings (768 dimensions)', async () => {
      const dimension = 768
      const embedding = new Float32Array(dimension)
      for (let i = 0; i < dimension; i++) {
        embedding[i] = Math.random()
      }

      await writeHeader(testFile, dimension)
      await writeRecord(testFile, 'test', embedding)

      const buffer = await readFile(testFile)

      const expectedRecordLength = calculateRecordLength(4, dimension)
      expect(buffer.byteLength).toBe(headerSize + expectedRecordLength)

      // Verify we can read back the embedding
      const recordView = new DataView(
        buffer.buffer,
        buffer.byteOffset + headerSize
      )
      const keyLength = recordView.getUint16(0, true)
      const embeddingOffset = 2 + keyLength

      for (let i = 0; i < dimension; i++) {
        const value = recordView.getFloat32(embeddingOffset + i * 4, true)
        expect(value).toBeCloseTo(embedding[i])
      }
    })
  })

  describe('readRecordForward', () => {
    it('should read a single record correctly', async () => {
      const dimension = 3
      const key = 'test1'
      const embedding = new Float32Array([1.5, 2.5, 3.5])

      await writeHeader(testFile, dimension)
      await writeRecord(testFile, key, embedding)

      const record = await readRecordForward(testFile, dimension, headerSize)

      expect(record).not.toBeNull()
      expect(record?.key).toBe(key)
      expect(record?.embedding).toHaveLength(dimension)
      expect(record?.embedding[0]).toBeCloseTo(1.5)
      expect(record?.embedding[1]).toBeCloseTo(2.5)
      expect(record?.embedding[2]).toBeCloseTo(3.5)
    })

    it('should read multiple records in sequence', async () => {
      const dimension = 2
      await writeHeader(testFile, dimension)

      await writeRecord(testFile, 'key1', new Float32Array([1.0, 2.0]))
      await writeRecord(testFile, 'key2', new Float32Array([3.0, 4.0]))
      await writeRecord(testFile, 'key3', new Float32Array([5.0, 6.0]))

      // Read first record
      let offset = headerSize
      const record1 = await readRecordForward(testFile, dimension, offset)
      expect(record1?.key).toBe('key1')
      expect(record1?.embedding[0]).toBeCloseTo(1.0)

      // Read second record (offset moves forward)
      offset += record1?.recordLength ?? 0
      const record2 = await readRecordForward(testFile, dimension, offset)
      expect(record2?.key).toBe('key2')
      expect(record2?.embedding[0]).toBeCloseTo(3.0)

      // Read third record
      offset += record2?.recordLength ?? 0
      const record3 = await readRecordForward(testFile, dimension, offset)
      expect(record3?.key).toBe('key3')
      expect(record3?.embedding[0]).toBeCloseTo(5.0)
    })

    it('should return null when offset is beyond file size', async () => {
      const dimension = 2
      await writeHeader(testFile, dimension)
      await writeRecord(testFile, 'key1', new Float32Array([1.0, 2.0]))

      const buffer = await readFile(testFile)
      const size = buffer.length

      // Try to read past the end of file
      const record = await readRecordForward(testFile, dimension, size + 100)
      expect(record).toBeNull()
    })

    it('should handle UTF-8 keys in forward reading', async () => {
      const dimension = 2
      const key = 'café☕'
      const embedding = new Float32Array([1.0, 2.0])

      await writeHeader(testFile, dimension)
      await writeRecord(testFile, key, embedding)

      const record = await readRecordForward(testFile, dimension, headerSize)

      expect(record?.key).toBe(key)
    })

    it('should validate record length matches calculated length', async () => {
      const dimension = 3
      await writeHeader(testFile, dimension)
      await writeRecord(testFile, 'test', new Float32Array([1.0, 2.0, 3.0]))

      const record = await readRecordForward(testFile, dimension, headerSize)

      expect(record).not.toBeNull()
      const expectedLength = calculateRecordLength(4, dimension) // "test" = 4 bytes
      expect(record?.recordLength).toBe(expectedLength)
    })
  })
})
