import { cli } from 'cleye'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { store, get, search } from './commands'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main(): Promise<void> {
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
  )

  cli(
    {
      name: 'raptor',
      version: packageJson.version,
      description:
        'An embedding database CLI for storing and searching text indexes',
      commands: [store, get, search]
    },
    () => {
      // When using commands with handlers, this callback is only called when no command is matched
      // The help text will be shown automatically
    }
  )
}

main().catch((error) => {
  console.error('Error:', error)

  process.exit(1)
})
