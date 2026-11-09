import { useEffect, useRef, useState } from 'react'
import { imagesToPdf } from './image-conversion'
import { download } from './pdf'

type ImageSource = { id: string; file: File; url: string }
export function ImagesToPdf() {
  const [images, setImages] = useState<ImageSource[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const dragged = useRef<string | null>(null)
  const urls = useRef(new Set<string>())
  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  async function add(files: File[]) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    const added: ImageSource[] = []
    const failed: string[] = []
    for (const file of files) {
      try {
        const bitmap = await createImageBitmap(file)
        bitmap.close()
        const url = URL.createObjectURL(file)
        urls.current.add(url)
        added.push({ id: crypto.randomUUID(), file, url })
      } catch { failed.push(file.name) }
    }
    setImages((current) => [...current, ...added])
    if (failed.length) setError('이미지를 열 수 없습니다: ' + failed.join(', '))
    setBusy(false)
  }
  function move(id: string, target: number) {
    if (busy) return
    setImages((current) => {
      const next = [...current]
      const index = next.findIndex((image) => image.id === id)
      if (index < 0) return current
      const [image] = next.splice(index, 1)
      next.splice(target, 0, image)
      return next
    })
    setMessage('')
  }
  async function save() {
    if (busy || !images.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      download(await imagesToPdf(images.map(({ file }) => file)), 'pdfgawi-images.pdf', 'application/pdf')
      setMessage('PDF 다운로드를 시작했습니다.')
    } catch { setError('PDF 변환 중 오류가 발생했습니다. 이미지 크기와 형식을 확인하세요.') }
    finally { setBusy(false) }
  }
  return <section className="panel image-tool" aria-labelledby="images-title">
    <h2 id="images-title">이미지를 PDF로 통합</h2>
    <p className="mode-description">JPG, PNG, WebP 등의 이미지를 추가하세요. 이미지 한 장이 PDF 한 페이지가 됩니다.</p>
    <input ref={input} type="file" accept="image/*" multiple hidden onChange={(event) => {
      void add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''
    }} />
    <button className="dropzone" disabled={busy} onClick={() => input.current?.click()}
      onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault(); void add(Array.from(event.dataTransfer.files))
      }}>이미지 파일 선택 또는 여기에 끌어다 놓기</button>
    <p className="list-caption">위에서부터 PDF 페이지 순서입니다. 항목을 드래그하거나 화살표로 순서를 바꾸세요.</p>
    <ol className="files image-list">{images.map((image, index) => <li key={image.id} draggable={!busy}
      onDragStart={(event) => { dragged.current = image.id; event.dataTransfer.setData('text/plain', image.id); event.dataTransfer.effectAllowed = 'move' }}
      onDragEnd={() => { dragged.current = null }}
      onDragOver={(event) => { if (dragged.current) event.preventDefault() }}
      onDrop={(event) => { event.preventDefault(); if (dragged.current) move(dragged.current, index); dragged.current = null }}>
      <span>{index + 1}</span><img src={image.url} alt={image.file.name} draggable={false} />
      <strong className="image-name">{image.file.name}</strong>
      <div className="file-actions">
        <button disabled={busy || index === 0} aria-label={image.file.name + ' 위로 이동'} onClick={() => move(image.id, index - 1)}>↑</button>
        <button disabled={busy || index === images.length - 1} aria-label={image.file.name + ' 아래로 이동'} onClick={() => move(image.id, index + 1)}>↓</button>
        <button disabled={busy} aria-label={image.file.name + ' 제거'} onClick={() => {
          URL.revokeObjectURL(image.url); urls.current.delete(image.url)
          setImages((current) => current.filter(({ id }) => id !== image.id)); setMessage('')
        }}>×</button>
      </div>
    </li>)}</ol>
    <button className="download" disabled={busy || !images.length} onClick={() => void save()}>{busy ? '처리 중…' : '이미지를 PDF로 다운로드 ↓'}</button>
    {error && <p className="errors" role="alert">{error}</p>}
    <p className="message" role="status">{message}</p>
  </section>
}
