import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = dirname(fileURLToPath(import.meta.resolve('pyodide')))
const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
const destination = resolve(root, 'public', 'pyodide', `v${pkg.version}`)
const files = ['pyodide.mjs', 'pyodide.mjs.map', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'package.json', 'README.md']
await mkdir(destination, { recursive: true })
for (const name of files) await copyFile(resolve(source, name), resolve(destination, name))
console.log(`Pyodide ${pkg.version}: ${files.length} local assets ready`)
