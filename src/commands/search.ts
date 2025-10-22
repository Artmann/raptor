import { command } from 'cleye'
import { EmbeddingEngine } from '../engine'

export const search = command(
  {
    name: 'search',
    description: 'Search for similar embeddings using a query',
    parameters: ['<query>'],
    flags: {
      storePath: {
        type: String,
        description: 'Path to the embeddings store file',
        default: './data/embeddings.jsonl',
        alias: 's'
      },
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
    }
  },
  async (argv) => {
    const engine = new EmbeddingEngine({
      storePath: argv.flags.storePath
    })

    const [query] = argv._
    const results = await engine.search(
      query,
      argv.flags.limit,
      argv.flags.minSimilarity
    )

    if (results.length === 0) {
      console.log('No results found')
    } else {
      console.log(`Found ${results.length} result(s):\n`)
      for (const result of results) {
        console.log(
          `[${result.similarity.toFixed(4)}] ${result.entry.key}: ${result.entry.text}`
        )
      }
    }
  }
)
