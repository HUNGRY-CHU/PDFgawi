import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

export function Preview({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const container = host.current
    if (!container) return

    let cancelled = false
    let task: RenderTask | undefined
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', pageNumber + '페이지 미리보기')
    setStatus('loading')

    async function render() {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const natural = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({
          scale: Math.min(900 / natural.width, 1200 / natural.height),
        })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        task = page.render({ canvas, viewport })
        await task.promise
        if (!cancelled) {
          container?.append(canvas)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void render()
    return () => {
      cancelled = true
      task?.cancel()
      canvas.remove()
    }
  }, [pdf, pageNumber])

  return (
    <div className="preview-sheet" aria-busy={status === 'loading'}>
      {status === 'loading' && <p role="status">페이지를 불러오는 중…</p>}
      {status === 'error' && <p role="alert">이 페이지를 미리 볼 수 없습니다.</p>}
      <div ref={host} />
    </div>
  )
}
