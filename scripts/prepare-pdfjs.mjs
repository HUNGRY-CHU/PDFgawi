import { cp, mkdir } from 'node:fs/promises'

const assets = new URL('../public/pdfjs/', import.meta.url)
await mkdir(assets, { recursive: true })

for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(
    new URL('../node_modules/pdfjs-dist/' + directory, import.meta.url),
    new URL(directory, assets),
    { recursive: true },
  )
}
