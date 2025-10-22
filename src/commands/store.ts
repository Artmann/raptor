import { command } from 'cleye'
import { EmbeddingEngine } from '../engine'

export const store = command(
  {
    name: 'store',
    description: 'Store a text embedding with a key',
    parameters: ['<key>', '<text>'],
    flags: {
      storePath: {
        type: String,
        description: 'Path to the embeddings store file',
        default: './data/embeddings.jsonl',
        alias: 's'
      }
    }
  },
  async (argv) => {
    const engine = new EmbeddingEngine({
      storePath: argv.flags.storePath
    })

    const [key, text] = argv._
    await engine.store(key, text)
    console.log(`✓ Stored embedding for key: ${key}`)
  }
)
