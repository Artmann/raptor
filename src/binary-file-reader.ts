import { open, stat } from 'node:fs/promises'
import { readHeader } from './binary-format'
import type { EmbeddingEntry } from './types'

const chunkSize = 64 * 1024 // 64KB chunks

export class BinaryFileReader {
  constructor(private storePath: string) {}

  async *entries(): AsyncGenerator<EmbeddingEntry> {
    // Read header to get dimension
    const header = await readHeader(this.storePath)
    const dimension = header.dimension

    // Get file size
    const stats = await stat(this.storePath)
    const fileSize = stats.size

    // If file only contains header, return early
    if (fileSize <= 16) {
      return
    }

    // Track seen keys for deduplication (newest wins)
    const seenKeys = new Set<string>()

    // Read file in reverse using chunks
    const file = await open(this.storePath, 'r')
    try {
      let currentPosition = fileSize

      while (currentPosition > 16) {
        // Calculate chunk to read
        const chunkStart = Math.max(16, currentPosition - chunkSize)
        const bytesToRead = currentPosition - chunkStart

        // Read chunk
        const buffer = new ArrayBuffer(bytesToRead)
        const uint8View = new Uint8Array(buffer)
        await file.read(uint8View, 0, bytesToRead, chunkStart)

        // Parse records in reverse within this chunk
        let chunkPosition = bytesToRead

        while (chunkPosition > 0) {
          // Check if we have at least 4 bytes to read record length footer
          if (chunkPosition < 4) {
            break
          }

          // Read record length from footer (last 4 bytes of record)
          const view = new DataView(buffer)
          const recordLength = view.getUint32(chunkPosition - 4, true)

          // Check if the entire record is within this chunk
          if (recordLength > chunkPosition) {
            // Record spans multiple chunks, we need to read it directly from file
            const recordStart = chunkStart + chunkPosition - recordLength
            const recordBuffer = new ArrayBuffer(recordLength)
            const recordUint8View = new Uint8Array(recordBuffer)
            await file.read(recordUint8View, 0, recordLength, recordStart)

            const record = this.parseRecord(recordBuffer, dimension)
            if (record && !seenKeys.has(record.key)) {
              seenKeys.add(record.key)
              yield record
            }

            chunkPosition -= recordLength
          } else {
            // Record is entirely within the chunk
            const recordStart = chunkPosition - recordLength
            const recordView = new DataView(buffer, recordStart, recordLength)

            const record = this.parseRecordFromView(
              recordView,
              dimension,
              recordLength
            )
            if (record && !seenKeys.has(record.key)) {
              seenKeys.add(record.key)
              yield record
            }

            chunkPosition -= recordLength
          }
        }

        // Move to next chunk
        currentPosition = chunkStart + chunkPosition
      }
    } finally {
      await file.close()
    }
  }

  private parseRecord(
    buffer: ArrayBuffer,
    dimension: number
  ): EmbeddingEntry | null {
    const view = new DataView(buffer)
    return this.parseRecordFromView(view, dimension, buffer.byteLength)
  }

  private parseRecordFromView(
    view: DataView,
    dimension: number,
    _recordLength: number
  ): EmbeddingEntry | null {
    try {
      let offset = 0

      // Read key length (uint16)
      const keyLength = view.getUint16(offset, true)
      offset += 2

      // Read key
      const keyBytes = new Uint8Array(
        view.buffer,
        view.byteOffset + offset,
        keyLength
      )
      const key = new TextDecoder().decode(keyBytes)
      offset += keyLength

      // Read embedding
      const embedding = new Float32Array(dimension)
      for (let i = 0; i < dimension; i++) {
        embedding[i] = view.getFloat32(offset, true)
        offset += 4
      }

      // Note: We don't store original text in binary format
      return {
        key,
        text: '', // Binary format doesn't store text
        embedding: Array.from(embedding),
        timestamp: 0 // Binary format doesn't store timestamp
      }
    } catch {
      return null
    }
  }
}
