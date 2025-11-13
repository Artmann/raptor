import { EmbeddingEngine } from '../../src/engine'
import type { TestQuery } from '../queries'
import type { Article } from '../utils/data-loader'
import { formatPercentage } from '../utils/reporter'

export interface QualityBenchmarkResult {
  datasetSize: number
  numQueries: number
  precisionAt1: number
  precisionAt5: number
  precisionAt10: number
  meanReciprocalRank: number
  avgRelevantResults: number
}

/**
 * Check if an article is relevant to a query based on categories/topics
 */
function isRelevant(
  article: Article,
  query: TestQuery,
  articlesMap: Map<string, Article>
): boolean {
  const articleData = articlesMap.get(article.id)
  if (!articleData) return false

  // Check if article has any of the expected categories
  if (query.expectedCategories) {
    const hasCategory = query.expectedCategories.some((cat) =>
      articleData.categories.includes(cat)
    )
    if (hasCategory) return true
  }

  // Check if article has any of the expected topics
  if (query.expectedTopics) {
    const hasTopic = query.expectedTopics.some((topic) =>
      articleData.topics.some((t) => t.includes(topic))
    )
    if (hasTopic) return true
  }

  return false
}

/**
 * Calculate precision at K
 */
function precisionAtK(
  results: Array<{ key: string }>,
  query: TestQuery,
  k: number,
  articlesMap: Map<string, Article>
): number {
  const topK = results.slice(0, k)
  const relevant = topK.filter((r) => {
    const article: Article = { id: r.key } as Article
    return isRelevant(article, query, articlesMap)
  })

  return topK.length > 0 ? relevant.length / topK.length : 0
}

/**
 * Calculate reciprocal rank
 */
function reciprocalRank(
  results: Array<{ key: string }>,
  query: TestQuery,
  articlesMap: Map<string, Article>
): number {
  for (let i = 0; i < results.length; i++) {
    const article: Article = { id: results[i].key } as Article
    if (isRelevant(article, query, articlesMap)) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * Count relevant results
 */
function countRelevant(
  results: Array<{ key: string }>,
  query: TestQuery,
  articlesMap: Map<string, Article>
): number {
  return results.filter((r) => {
    const article: Article = { id: r.key } as Article
    return isRelevant(article, query, articlesMap)
  }).length
}

/**
 * Benchmark search quality
 */
export async function benchmarkQuality(
  storePath: string,
  queries: TestQuery[],
  articles: Article[],
  datasetSize: number
): Promise<QualityBenchmarkResult> {
  const engine = new EmbeddingEngine({ storePath })

  // Create a map for quick article lookup
  const articlesMap = new Map(articles.map((a) => [a.id, a]))

  let totalP1 = 0
  let totalP5 = 0
  let totalP10 = 0
  let totalRR = 0
  let totalRelevant = 0

  // Test each query
  for (const query of queries) {
    const results = await engine.search(query.query, 10, 0.3)

    totalP1 += precisionAtK(results, query, 1, articlesMap)
    totalP5 += precisionAtK(results, query, 5, articlesMap)
    totalP10 += precisionAtK(results, query, 10, articlesMap)
    totalRR += reciprocalRank(results, query, articlesMap)
    totalRelevant += countRelevant(results, query, articlesMap)
  }

  const numQueries = queries.length

  return {
    datasetSize,
    numQueries,
    precisionAt1: totalP1 / numQueries,
    precisionAt5: totalP5 / numQueries,
    precisionAt10: totalP10 / numQueries,
    meanReciprocalRank: totalRR / numQueries,
    avgRelevantResults: totalRelevant / numQueries
  }
}

/**
 * Run quality benchmarks for multiple dataset sizes
 */
export async function runQualityBenchmarks(
  baseStorePath: string,
  allArticles: Article[],
  sizes: number[],
  queries: TestQuery[]
): Promise<QualityBenchmarkResult[]> {
  const results: QualityBenchmarkResult[] = []

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const storePath = `${baseStorePath}-${size}.jsonl`
    const articles = allArticles.slice(0, size)

    console.log(
      `  Benchmarking search quality with ${size} documents (${queries.length} queries)... (${i + 1}/${sizes.length})`
    )

    const result = await benchmarkQuality(storePath, queries, articles, size)
    results.push(result)

    console.log(
      `    P@1: ${formatPercentage(result.precisionAt1)}, ` +
        `P@5: ${formatPercentage(result.precisionAt5)}, ` +
        `P@10: ${formatPercentage(result.precisionAt10)}, ` +
        `MRR: ${result.meanReciprocalRank.toFixed(3)}`
    )
  }

  return results
}
