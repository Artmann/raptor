import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export interface Article {
  id: string
  title: string
  text: string
  categories: string[]
  topics: string[]
  sentiment: string
  url: string
}

/**
 * Load article data from JSON files
 */
export function loadArticles(dataDir: string, limit?: number): Article[] {
  const articles: Article[] = []
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))

  const filesToLoad = limit ? files.slice(0, limit) : files

  for (const file of filesToLoad) {
    try {
      const filePath = join(dataDir, file)
      const content = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)

      // Extract the article ID from filename (e.g., "article_123.json" -> "article_123")
      const id = file.replace('.json', '')

      articles.push({
        id,
        title: data.title ?? '',
        text: data.text ?? '',
        categories: data.categories ?? [],
        topics: data.topics ?? [],
        sentiment: data.sentiment ?? '',
        url: data.url ?? ''
      })
    } catch (error) {
      console.error(`Failed to load ${file}:`, error)
    }
  }

  return articles
}

/**
 * Sample N random articles from the dataset
 */
export function sampleArticles(articles: Article[], count: number): Article[] {
  if (count >= articles.length) {
    return articles
  }

  const shuffled = [...articles].sort(() => Math.random() - 0.5)

  return shuffled.slice(0, count)
}

/**
 * Group articles by category
 */
export function groupByCategory(articles: Article[]): Map<string, Article[]> {
  const grouped = new Map<string, Article[]>()

  for (const article of articles) {
    for (const category of article.categories) {
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }

      grouped.get(category)!.push(article)
    }
  }

  return grouped
}

/**
 * Group articles by topic
 */
export function groupByTopic(articles: Article[]): Map<string, Article[]> {
  const grouped = new Map<string, Article[]>()

  for (const article of articles) {
    for (const topic of article.topics) {
      if (!grouped.has(topic)) {
        grouped.set(topic, [])
      }
      grouped.get(topic)!.push(article)
    }
  }

  return grouped
}

/**
 * Get unique categories from articles
 */
export function getUniqueCategories(articles: Article[]): string[] {
  const categories = new Set<string>()
  for (const article of articles) {
    for (const category of article.categories) {
      categories.add(category)
    }
  }
  return Array.from(categories).sort()
}

/**
 * Get unique topics from articles
 */
export function getUniqueTopics(articles: Article[]): string[] {
  const topics = new Set<string>()
  for (const article of articles) {
    for (const topic of article.topics) {
      topics.add(topic)
    }
  }
  return Array.from(topics).sort()
}

/**
 * Create a combined text for embedding (title + text)
 */
export function createEmbeddingText(article: Article): string {
  return `${article.title}\n\n${article.text}`
}
