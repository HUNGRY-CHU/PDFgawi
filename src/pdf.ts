import { PDFDocument } from 'pdf-lib'

export function parsePages(input: string, pageCount: number): number[] {
  const pages = new Set<number>()
  for (const part of input.split(',')) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim())
    if (!match) throw new Error('페이지를 1, 3-5 같은 형식으로 입력하세요.')

    const first = Number(match[1])
    const last = Number(match[2] ?? match[1])
    if (first < 1 || last < first || last > pageCount) {
      throw new Error('1부터 ' + pageCount + '까지의 페이지 번호를 입력하세요.')
    }
    for (let page = first; page <= last; page++) pages.add(page - 1)
  }
  return [...pages]
}

export async function mergePdfs(sources: PDFDocument[]) {
  const output = await PDFDocument.create()
  for (const source of sources) {
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach((page) => output.addPage(page))
  }
  return output.save()
}

export async function extractPages(source: PDFDocument, indices: number[]) {
  const output = await PDFDocument.create()
  const pages = await output.copyPages(source, indices)
  pages.forEach((page) => output.addPage(page))
  return output.save()
}

export function download(bytes: Uint8Array<ArrayBufferLike>, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
