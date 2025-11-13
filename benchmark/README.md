# Raptor Benchmark Suite

Comprehensive performance and quality benchmarks for the Raptor embedding
database.

## Quick Start

```bash
# Quick benchmark (smaller dataset sizes)
bun run benchmark:quick

# Full benchmark (includes 5k and 10k documents if available)
bun run benchmark
```

## What It Tests

### 1. **Store Operations**

- Bulk insert performance using `storeMany()`
- Throughput (documents/second)
- Memory consumption
- Per-document processing time

**Dataset sizes:** 100, 500, 1K, 2K documents

### 2. **Search Operations**

- Cold start latency (first query)
- Warm query latency
- Percentile distribution (P50, P95, P99)
- Memory usage

**Dataset sizes:** 100, 500, 1K, 2K, 5K, 10K documents

### 3. **Get Operations**

- Sequential access patterns
- Random access patterns
- Latency comparison

**Dataset sizes:** 100, 500, 1K, 2K, 5K, 10K documents

### 4. **Search Quality**

- Precision@1, @5, @10
- Mean Reciprocal Rank (MRR)
- Relevance scoring using article categories/topics

**Dataset sizes:** 100, 500, 1K, 2K, 5K, 10K documents

### 5. **Scalability Analysis**

- Performance degradation with dataset size
- Efficiency ratios
- Scaling characteristics

## Sample Data

The benchmark uses JSON article data with the following structure:

```json
{
  "title": "Article title",
  "text": "Article content...",
  "categories": ["Category1", "Category2"],
  "topics": ["topic1", "topic2"],
  "sentiment": "positive"
}
```

Currently loaded: **2,000 articles** from `benchmark/data`

### Adding More Data for 5K/10K Benchmarks

To test with 5,000 or 10,000 documents:

1. Download additional article JSON files
2. Place them in subdirectories under `benchmark/data/`
3. Each subdirectory should contain article JSON files named `article_*.json`

Example structure:

```
benchmark/data/
├── dataset_1/
│   ├── article_1.json
│   ├── article_2.json
│   └── ...
├── dataset_2/
│   ├── article_1.json
│   └── ...
└── dataset_3/
    └── ...
```

The benchmark automatically loads from all subdirectories until it reaches the
required number of documents.

## Custom Options

```bash
# Specify custom data directory
bun run benchmark/index.ts --data-dir=/path/to/data

# Quick mode
bun run benchmark/index.ts --quick
```

## Output

The benchmark produces detailed console tables showing:

- **Store Operations**: Duration, throughput, avg/doc, memory
- **Search Operations**: Cold/warm latency, percentiles, memory
- **Get Operations**: Sequential vs random access times
- **Search Quality**: Precision scores, MRR
- **Scalability Analysis**: Efficiency ratios across sizes
- **Summary**: Key insights and metrics

## Test Queries

The benchmark uses 20 predefined queries covering different topics:

- Cinema and awards
- Sports and athletics
- Technology and software
- Politics and government
- Business and finance
- Health and medicine
- Environment and climate
- Education and learning
- Travel and tourism
- Food and cooking
- Celebrity and entertainment
- Crime and law
- Science and research
- Fashion and style
- Music and concerts
- Real estate and housing
- Automotive and vehicles
- Social media and trends
- Weather and disasters
- Books and literature

## Implementation

The benchmark suite consists of:

- `benchmark/index.ts` - Main orchestrator
- `benchmark/suites/` - Individual benchmark implementations
- `benchmark/utils/` - Helpers for memory tracking, data loading, reporting
- `benchmark/queries.ts` - Test query definitions

## Performance Tips

1. **Store operations** are slower due to embedding generation - keep dataset
   sizes reasonable (≤2K)
2. **Search and Get** operations can handle much larger datasets (5K-10K)
3. The benchmark uses `storeMany()` for efficient bulk inserts
4. Databases are created once and reused for read benchmarks
5. Temporary files are cleaned up automatically after completion
