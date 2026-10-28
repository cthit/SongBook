// Starts the production build the way the Docker image does (`node server.js` from the standalone
// output), after copying the static assets and public/ next to it like the Dockerfile does.
// `next start` doesn't work with `output: 'standalone'`. Run `pnpm build` first.
import { cpSync, existsSync, rmSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const standalone = path.join(root, '.next', 'standalone')
const server = path.join(standalone, 'server.js')
if (!existsSync(server)) {
  console.error('No standalone build found, run `pnpm build` first')
  process.exit(1)
}

for (const [from, to] of [
  [path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static')],
  [path.join(root, 'public'), path.join(standalone, 'public')],
]) {
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true })
}

await import(server)
