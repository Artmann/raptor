import { command } from 'cleye'
import { EmbeddingEngine } from '../engine'
import { sharedFlags } from './flags'

export const get = command(
  {
    name: 'get',
    description: 'Retrieve an embedding entry by key',
    parameters: ['<key>'],
    flags: {
      ...sharedFlags
    }
  },
  async (argv) => {
    const engine = new EmbeddingEngine({
      storePath: argv.flags.storePath
    })

    const [key] = argv._
    const entry = await engine.get(key)

    if (entry) {
      console.log(
        JSON.stringify(
          {
            key: entry.key,
            text: entry.text,
            embeddingDimensions: entry.embedding.length,
            timestamp: new Date(entry.timestamp).toISOString()
          },
          null,
          2
        )
      )
    } else {
      console.log(`Key "${key}" not found`)
      process.exit(1)
    }
  }
)
