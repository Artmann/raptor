#!/usr/bin/env node

import { cli } from 'cleye'
import { EmbeddingEngine } from './engine'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
)

const argv = cli(
  {
    name: 'raptor',
    version: packageJson.version,
    description:
      'An embedding database CLI for storing and searching text indexes',
    flags: {
      storePath: {
        type: String,
        description: 'Path to the embeddings store file',
        default: './data/embeddings.jsonl',
        alias: 's'
      }
    },
    commands: [
      {
        name: 'store',
        description: 'Store a text embedding with a key',
        parameters: ['<key>', '<text>'],
        flags: {}
      },
      {
        name: 'get',
        description: 'Retrieve an embedding entry by key',
        parameters: ['<key>'],
        flags: {}
      },
      {
        name: 'search',
        description: 'Search for similar embeddings using a query',
        parameters: ['<query>'],
        flags: {
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
      }
    ]
  },
  async (parsed) => {
    // Create engine instance
    const engine = new EmbeddingEngine({
      storePath: parsed.flags.storePath
    })

    // Handle commands
    if (parsed.command === 'store') {
      const [key, text] = parsed._
      await engine.store(key, text)
      console.log(`✓ Stored embedding for key: ${key}`)
    } else if (parsed.command === 'get') {
      const [key] = parsed._
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
    } else if (parsed.command === 'search') {
      const [query] = parsed._
      const results = await engine.search(
        query,
        parsed.flags.limit,
        parsed.flags.minSimilarity
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
    } else {
      // No command specified, show help
      console.log(parsed.help)
    }
  }
)
