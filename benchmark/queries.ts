export interface TestQuery {
  query: string
  expectedCategories?: string[]
  expectedTopics?: string[]
  description: string
}

/**
 * Predefined test queries for benchmarking
 * These queries are designed to test semantic search quality
 * and are categorized based on the article data
 */
export const testQueries: TestQuery[] = [
  {
    query: 'movie awards and film critics',
    expectedCategories: [
      'Arts, Culture and Entertainment',
      'Lifestyle and Leisure'
    ],
    expectedTopics: ['Arts, Culture and Entertainment->cinema'],
    description: 'Cinema and awards'
  },
  {
    query: 'sports competition and athletic performance',
    expectedCategories: ['Sports'],
    description: 'Sports and athletics'
  },
  {
    query: 'technology innovation and software development',
    expectedCategories: ['Technology'],
    expectedTopics: ['Technology->software', 'Technology->innovation'],
    description: 'Technology and software'
  },
  {
    query: 'political elections and government policy',
    expectedCategories: ['Politics'],
    expectedTopics: ['Politics->election', 'Politics->government'],
    description: 'Politics and governance'
  },
  {
    query: 'business earnings and stock market',
    expectedCategories: ['Business', 'Finance'],
    expectedTopics: ['Business->earnings', 'Finance->stock market'],
    description: 'Business and finance'
  },
  {
    query: 'health medical research and treatment',
    expectedCategories: ['Health'],
    expectedTopics: ['Health->medical research'],
    description: 'Health and medicine'
  },
  {
    query: 'climate change and environmental protection',
    expectedCategories: ['Environment'],
    expectedTopics: ['Environment->climate'],
    description: 'Environment and climate'
  },
  {
    query: 'education schools and learning',
    expectedCategories: ['Education'],
    expectedTopics: ['Education->schools'],
    description: 'Education and learning'
  },
  {
    query: 'travel destinations and tourism',
    expectedCategories: ['Lifestyle and Leisure', 'Travel'],
    expectedTopics: ['Travel->tourism', 'Lifestyle and Leisure->travel'],
    description: 'Travel and tourism'
  },
  {
    query: 'food recipes and cooking',
    expectedCategories: ['Lifestyle and Leisure'],
    expectedTopics: ['Lifestyle and Leisure->food'],
    description: 'Food and cooking'
  },
  {
    query: 'celebrity news and entertainment gossip',
    expectedCategories: ['Arts, Culture and Entertainment', 'Human Interest'],
    expectedTopics: ['Human Interest->celebrity'],
    description: 'Celebrity and entertainment'
  },
  {
    query: 'crime investigation and law enforcement',
    expectedCategories: ['Crime'],
    expectedTopics: ['Crime->investigation'],
    description: 'Crime and law'
  },
  {
    query: 'scientific discovery and research',
    expectedCategories: ['Science'],
    expectedTopics: ['Science->research', 'Science->discovery'],
    description: 'Science and research'
  },
  {
    query: 'fashion trends and style',
    expectedCategories: ['Lifestyle and Leisure'],
    expectedTopics: [
      'Lifestyle and Leisure->fashion',
      'Lifestyle and Leisure->trend'
    ],
    description: 'Fashion and style'
  },
  {
    query: 'music concerts and albums',
    expectedCategories: ['Arts, Culture and Entertainment'],
    expectedTopics: ['Arts, Culture and Entertainment->music'],
    description: 'Music and concerts'
  },
  {
    query: 'real estate housing market',
    expectedCategories: ['Business', 'Real Estate'],
    expectedTopics: ['Real Estate->housing'],
    description: 'Real estate and housing'
  },
  {
    query: 'automotive cars and vehicles',
    expectedCategories: ['Technology', 'Lifestyle and Leisure'],
    expectedTopics: ['Technology->automotive'],
    description: 'Automotive and vehicles'
  },
  {
    query: 'social media and internet trends',
    expectedCategories: ['Technology', 'Lifestyle and Leisure'],
    expectedTopics: [
      'Technology->social media',
      'Lifestyle and Leisure->trend'
    ],
    description: 'Social media and trends'
  },
  {
    query: 'weather forecast and natural disasters',
    expectedCategories: ['Weather', 'Disaster'],
    expectedTopics: ['Weather->forecast'],
    description: 'Weather and disasters'
  },
  {
    query: 'books literature and authors',
    expectedCategories: ['Arts, Culture and Entertainment'],
    expectedTopics: ['Arts, Culture and Entertainment->literature'],
    description: 'Books and literature'
  }
]

/**
 * Get a subset of queries for quick benchmarking
 */
export function getQuickQueries(): TestQuery[] {
  return testQueries.slice(0, 5)
}

/**
 * Get all queries for comprehensive benchmarking
 */
export function getAllQueries(): TestQuery[] {
  return testQueries
}
