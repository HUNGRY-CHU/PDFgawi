import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { parsePageGroups, parsePages, extractPages } from '../src/pdf.ts'

for (const separator of ['-', '~']) {
  test(`nine-page PDF splits into five documents using ${separator}`, async () => {
    const source = await PDFDocument.create()
    for (let index = 0; index < 9; index++) source.addPage([300 + index, 400])
    const groups = parsePageGroups(`1,2,3,4${separator}6,7${separator}9`, 9)
    assert.deepEqual(groups, [[0], [1], [2], [3, 4, 5], [6, 7, 8]])
    const outputs = await Promise.all(groups.map(async (pages) =>
      PDFDocument.load(await extractPages(source, pages))))
    assert.deepEqual(outputs.map((pdf) => pdf.getPageCount()), [1, 1, 1, 3, 3])
    assert.deepEqual(outputs.map((pdf) => pdf.getPages().map((page) => page.getWidth())),
      [[300], [301], [302], [303, 304, 305], [306, 307, 308]])
  })
}
test('blank range splits all pages individually; explicit ranges exclude other pages', () => {
  assert.deepEqual(parsePageGroups('', 3), [[0], [1], [2]])
  assert.deepEqual(parsePageGroups('2~3', 9), [[1, 2]])
  assert.deepEqual(parsePages('4~6, 1', 9), [3, 4, 5, 0])
  assert.throws(() => parsePageGroups('7~10', 9))
  assert.throws(() => parsePageGroups('6~4', 9))
})
