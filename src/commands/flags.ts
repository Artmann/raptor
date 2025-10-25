export const sharedFlags = {
  storePath: {
    type: String,
    description: 'Path to the embeddings store file',
    default: './database.raptor',
    alias: 's'
  }
} as const

export const searchFlags = {
  limit: {
    type: Number,
    description: 'Maximum number of results to return',
    default: 10,
    alias: 'l'
  },
  minSimilarity: {
    type: Number,
    description: 'Minimum similarity threshold (0-1)',
    default: 0,
    alias: 'm'
  }
} as const
