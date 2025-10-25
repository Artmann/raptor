import { type FileHandle, open } from 'node:fs/promises'

import type { EmbeddingEntry } from './types'

export class EmbeddingFileReader {
  private storePath: string

  constructor(storePath: string) {
    this.storePath = storePath
  }

  /**
   * Generator that yields embedding entries from the file in reverse order
   * Always reads in reverse to get most recent entries first for efficiency
   * @param chunkSize - Size of chunks to read in bytes (default: 64KB)
   */
  async *iterateEmbeddings(
    chunkSize: number = 64 * 1024
  ): AsyncGenerator<EmbeddingEntry, void, unknown> {
    let fileHandle: FileHandle | undefined
    const seenKeys = new Set<string>()

    try {
      fileHandle = await open(this.storePath, 'r')
      const stats = await fileHandle.stat()
      const fileSize = stats.size

      if (fileSize === 0) {
        return
      }

      let position = fileSize
      let remainingBuffer = ''

      while (position > 0) {
        const currentChunkSize = Math.min(chunkSize, position)

        if (currentChunkSize <= 0) {
          break
        }

        position -= currentChunkSize

        const buffer = Buffer.allocUnsafe(currentChunkSize)

        await fileHandle.read(buffer, 0, currentChunkSize, position)

        const chunk = buffer.toString('utf-8')
        const combined = chunk + remainingBuffer
        const lines = combined.split('\n')

        remainingBuffer = lines.shift() ?? ''

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim()

          if (!line) {
            continue
          }

          try {
            const entry = JSON.parse(line) as EmbeddingEntry

            if (!seenKeys.has(entry.key)) {
              seenKeys.add(entry.key)
              yield entry
            }
          } catch {
            continue
          }
        }
      }

      if (remainingBuffer.trim()) {
        try {
          const entry = JSON.parse(remainingBuffer.trim()) as EmbeddingEntry

          if (!seenKeys.has(entry.key)) {
            seenKeys.add(entry.key)
            yield entry
          }
        } catch {
          // Skip malformed line
        }
      }
    } catch {
      // File doesn't exist or other error, yield nothing
      return
    } finally {
      if (fileHandle) {
        await fileHandle.close()
      }
    }
  }
}
