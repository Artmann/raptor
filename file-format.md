# Embedded Index Database File Format

## Overview

This document describes the binary file format for the embedded index database.
The format is designed for storing key-value pairs where values are
fixed-dimension embedding vectors.

## Design Goals

- Single file storage (similar to SQLite)
- Append-only writes for thread safety
- Memory-efficient (don't require loading all keys into memory)
- Support reverse parsing to find latest values for duplicate keys
- Compact binary representation

## File Structure

The file consists of a fixed-size header followed by variable-length records:

```
[Header]
[Record 1]
[Record 2]
...
[Record N]
```

## Header Format

**Size:** 16 bytes (fixed)

| Offset | Size | Type   | Description                              |
| ------ | ---- | ------ | ---------------------------------------- |
| 0      | 4    | char[] | Magic bytes: "EMBD"                      |
| 4      | 2    | uint16 | Version number (currently 1)             |
| 6      | 4    | uint32 | Embedding dimension (e.g., 1536)         |
| 10     | 6    | bytes  | Reserved for future use (write as zeros) |

**Endianness:** Little-endian for all multi-byte values

## Record Format

Each record has variable length based on the key size:

| Field         | Size                | Type    | Description                        |
| ------------- | ------------------- | ------- | ---------------------------------- |
| Key Length    | 2 bytes             | uint16  | Length of key in bytes (max 65535) |
| Key           | variable            | bytes   | UTF-8 encoded key string           |
| Embedding     | dimension × 4 bytes | float32 | Embedding vector values            |
| Record Length | 4 bytes             | uint32  | Total size of this record in bytes |

**Record Length Calculation:**

```
record_length = 2 + key_length + (dimension × 4) + 4
```

The record length footer enables reverse parsing through the file.

## Parsing Operations

### Forward Parsing

Start from byte 16 (after header) and read sequentially:

1. Read 2 bytes → key length
2. Read key_length bytes → key
3. Read dimension × 4 bytes → embedding
4. Read 4 bytes → record length (for validation)
5. Repeat from step 1

### Reverse Parsing

Start from end of file and read backwards:

1. Seek to current_position - 4
2. Read 4 bytes → record length
3. Seek backwards by record length bytes
4. Read the complete record (key length, key, embedding, record length)
5. Repeat from step 1

## Usage Patterns

### Lookup a Specific Key

To find the latest value for a key:

1. Start from end of file
2. Parse records in reverse order
3. For each record, check if key matches
4. Return first match (latest value)
5. If no match found, key doesn't exist

**Time Complexity:** O(n) worst case where n is number of records

### Load All Latest Values

To get the latest value for each unique key:

1. Parse from end of file backwards
2. Maintain a `Set<string>` of keys already seen
3. For each record:
   - If key already in Set: skip (older value)
   - If key not in Set: add key to Set and yield the record
4. Continue until reaching start of file

**Memory Complexity:** O(k) where k is number of unique keys

### Append New Record

1. Seek to end of file
2. Calculate record length
3. Write: key_length | key | embedding | record_length
4. Flush to disk

**Time Complexity:** O(1)

## Example

For a key "user123" (7 bytes) with 1536-dimension embedding:

```
Header: 16 bytes
  EMBD | 0x0001 | 0x00000600 | 0x000000000000

Record: 6,159 bytes total
  0x0007                    (2 bytes: key length = 7)
  "user123"                 (7 bytes: key)
  [float32 × 1536]          (6,144 bytes: embedding)
  0x0000180F                (4 bytes: record length = 6,159)
```

## Space Efficiency

Comparison with JSONL format for 1536-dimension embedding with 20-char key:

| Format | Size per Record | Notes                             |
| ------ | --------------- | --------------------------------- |
| JSONL  | ~12,000 bytes   | JSON encoding, formatting, quotes |
| Binary | 6,166 bytes     | 2 + 20 + 6,144 + 4                |

**Savings:** ~50% smaller, plus significantly faster to parse

## Deduplication Strategy

The append-only format means duplicate keys can exist in the file. The latest
value is always the one closest to the end of the file.

**Options for deduplication:**

1. **On-demand:** Find latest value during lookup (as described above)
2. **Periodic compaction:** Rebuild file with only latest values
3. **Hybrid:** Keep recent appends, compact older sections

## Future Considerations

The 6 reserved bytes in the header can be used for:

- Compression flags
- Encryption metadata
- Checksum algorithm identifier
- Index file offset (for external index)

The version field allows format evolution while maintaining backwards
compatibility.

## Implementation Notes

### Thread Safety

The append-only nature makes concurrent writes safe with a single mutex around
the append operation. Multiple readers can safely read without locks since
existing data never changes.

### File Locking

Consider using OS-level file locking to prevent multiple processes from opening
the file for writing simultaneously.

### Error Handling

- Always validate magic bytes on open
- Check version compatibility
- Verify record length matches calculated size
- Handle truncated files gracefully (partial last record)

### Performance

- Keep file handle open to avoid repeated open/close overhead
- Use buffered I/O for sequential scans
- Consider memory-mapped I/O for read-heavy workloads
- For write-heavy workloads, batch appends when possible
