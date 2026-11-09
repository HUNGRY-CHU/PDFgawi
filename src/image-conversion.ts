import { PDFDocument } from 'pdf-lib'

export async function imagesToPdf(files: File[]) {
  const pdf = await PDFDocument.create()
  for (const file of files) {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('이미지를 변환할 수 없습니다.')
      context.drawImage(bitmap, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('이미지를 저장할 수 없습니다.')), 'image/png'))
      const image = await pdf.embedPng(await blob.arrayBuffer())
      const page = pdf.addPage([image.width * 0.75, image.height * 0.75])
      page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
      canvas.width = canvas.height = 0
    } finally { bitmap.close() }
  }
  return pdf.save()
}
