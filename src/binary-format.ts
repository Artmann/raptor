import { open, writeFile, appendFile } from 'node:fs/promises'

export const magicBytes = 'EMBD'
export const currentVersion = 1
export const headerSize = 16

export interface Header {
  version: number
  dimension: number
}

export interface BinaryRecord {
  key: string
  embedding: Float32Array
  recordLength: number
}

export function calculateRecordLength(
  keyLength: number,
  dimension: number
): number {
  // Record format: key_length (2) + key (variable) + embedding (dimension * 4) + record_length (4)
  return 2 + keyLength + dimension * 4 + 4
}

export async function writeHeader(
  filePath: string,
  dimension: number
): Promise<void> {
  const buffer = new ArrayBuffer(headerSize)
  const view = new DataView(buffer)

  // Write magic bytes "EMBD" (4 bytes)
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, magicBytes.charCodeAt(i))
  }

  // Write version (uint16 at offset 4, little-endian)
  view.setUint16(4, currentVersion, true)

  // Write dimension (uint32 at offset 6, little-endian)
  view.setUint32(6, dimension, true)

  // Reserved bytes (6 bytes at offset 10) are already zeros in new ArrayBuffer

  await writeFile(filePath, new Uint8Array(buffer))
}

export async function readHeader(filePath: string): Promise<Header> {
  const file = await open(filePath, 'r')
  try {
    const buffer = new ArrayBuffer(headerSize)
    const uint8View = new Uint8Array(buffer)

    const { bytesRead } = await file.read(uint8View, 0, headerSize, 0)

    if (bytesRead < headerSize) {
      throw new Error(
        `File too small: expected at least ${headerSize} bytes, got ${bytesRead}`
      )
    }

    const view = new DataView(buffer)

    // Read and validate magic bytes
    const magic = new Uint8Array(buffer, 0, 4)
    const magicString = String.fromCharCode(...magic)

    if (magicString !== magicBytes) {
      throw new Error(
        `Invalid file format: magic bytes expected "${magicBytes}", got "${magicString}"`
      )
    }

    // Read version (uint16 at offset 4, little-endian)
    const version = view.getUint16(4, true)

    if (version !== currentVersion) {
      throw new Error(
        `Unsupported version: ${version}. Current version is ${currentVersion}`
      )
    }

    // Read dimension (uint32 at offset 6, little-endian)
    const dimension = view.getUint32(6, true)

    return { version, dimension }
  } finally {
    await file.close()
  }
}

export async function writeRecord(
  filePath: string,
  key: string,
  embedding: Float32Array
): Promise<void> {
  const keyBytes = new TextEncoder().encode(key)
  const keyLength = keyBytes.length
  const dimension = embedding.length
  const recordLength = calculateRecordLength(keyLength, dimension)

  // Create buffer for the record
  const buffer = new ArrayBuffer(recordLength)
  const view = new DataView(buffer)
  const uint8View = new Uint8Array(buffer)

  let offset = 0

  // Write key length (uint16, little-endian)
  view.setUint16(offset, keyLength, true)
  offset += 2

  // Write key bytes
  uint8View.set(keyBytes, offset)
  offset += keyLength

  // Write embedding (float32 array, little-endian)
  for (let i = 0; i < dimension; i++) {
    view.setFloat32(offset, embedding[i], true)
    offset += 4
  }

  // Write record length footer (uint32, little-endian)
  view.setUint32(offset, recordLength, true)

  // Append to file
  await appendFile(filePath, uint8View)
}

export async function writeRecords(
  filePath: string,
  records: Array<{ key: string; embedding: Float32Array }>
): Promise<void> {
  if (records.length === 0) {
    return
  }

  // Calculate total buffer size needed
  let totalSize = 0
  const recordBuffers: Uint8Array[] = []

  for (const record of records) {
    const keyBytes = new TextEncoder().encode(record.key)
    const keyLength = keyBytes.length
    const dimension = record.embedding.length
    const recordLength = calculateRecordLength(keyLength, dimension)

    // Create buffer for this record
    const buffer = new ArrayBuffer(recordLength)
    const view = new DataView(buffer)
    const uint8View = new Uint8Array(buffer)

    let offset = 0

    // Write key length (uint16, little-endian)
    view.setUint16(offset, keyLength, true)
    offset += 2

    // Write key bytes
    uint8View.set(keyBytes, offset)
    offset += keyLength

    // Write embedding (float32 array, little-endian)
    for (let i = 0; i < dimension; i++) {
      view.setFloat32(offset, record.embedding[i], true)
      offset += 4
    }

    // Write record length footer (uint32, little-endian)
    view.setUint32(offset, recordLength, true)

    recordBuffers.push(uint8View)
    totalSize += recordLength
  }

  // Concatenate all buffers into one
  const combinedBuffer = new Uint8Array(totalSize)
  let position = 0
  for (const buffer of recordBuffers) {
    combinedBuffer.set(buffer, position)
    position += buffer.length
  }

  // Single append operation
  await appendFile(filePath, combinedBuffer)
}

export async function readRecordForward(
  filePath: string,
  dimension: number,
  offset: number
): Promise<BinaryRecord | null> {
  const file = await open(filePath, 'r')
  try {
    // First, read the key length (2 bytes)
    const keyLengthBuffer = new ArrayBuffer(2)
    const keyLengthView = new Uint8Array(keyLengthBuffer)

    const { bytesRead: keyLengthBytesRead } = await file.read(
      keyLengthView,
      0,
      2,
      offset
    )

    if (keyLengthBytesRead < 2) {
      // End of file or not enough data
      return null
    }

    const keyLength = new DataView(keyLengthBuffer).getUint16(0, true)

    // Calculate total record length
    const recordLength = calculateRecordLength(keyLength, dimension)

    // Now read the entire record
    const recordBuffer = new ArrayBuffer(recordLength)
    const recordView = new DataView(recordBuffer)
    const recordUint8View = new Uint8Array(recordBuffer)

    const { bytesRead } = await file.read(
      recordUint8View,
      0,
      recordLength,
      offset
    )

    if (bytesRead < recordLength) {
      // Incomplete record
      return null
    }

    // Parse the record
    let readOffset = 0

    // Read key length (already read, but skip it in buffer)
    readOffset += 2

    // Read key
    const keyBytes = new Uint8Array(recordBuffer, readOffset, keyLength)
    const key = new TextDecoder().decode(keyBytes)
    readOffset += keyLength

    // Read embedding
    const embedding = new Float32Array(dimension)
    for (let i = 0; i < dimension; i++) {
      embedding[i] = recordView.getFloat32(readOffset, true)
      readOffset += 4
    }

    // Read and validate record length footer
    const storedRecordLength = recordView.getUint32(readOffset, true)

    if (storedRecordLength !== recordLength) {
      throw new Error(
        `Record length mismatch: expected ${recordLength}, got ${storedRecordLength}`
      )
    }

    return {
      key,
      embedding,
      recordLength
    }
  } finally {
    await file.close()
  }
}
