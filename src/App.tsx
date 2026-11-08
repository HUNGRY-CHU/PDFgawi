import { useEffect, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { zipSync } from 'fflate'
import { Preview } from './Preview'
import { download, extractPages, mergePdfs, parsePages } from './pdf'

GlobalWorkerOptions.workerSrc = workerUrl

type Source = {
  id: string
  file: File
  pdf: PDFDocument
}

type Mode = 'merge' | 'extract' | 'split'

export function App() {
  const input = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [files, setFiles] = useState<Source[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState<Mode>('merge')
  const [range, setRange] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ id: string; pdf: PDFDocumentProxy | null }>()

  const selected = files.find(({ id }) => id === selectedId)
  const pageCount = selected?.pdf.getPageCount() ?? 0
  const currentPreview = preview?.id === selectedId ? preview : undefined

  useEffect(() => {
    if (!selected) return
    let active = true
    let loading: ReturnType<typeof getDocument> | undefined

    async function load(source: Source) {
      try {
        const data = await source.file.arrayBuffer()
        if (!active) return
        const assetRoot = new URL(import.meta.env.BASE_URL + 'pdfjs/', location.href)
        loading = getDocument({
          data,
          cMapUrl: new URL('cmaps/', assetRoot).href,
          cMapPacked: true,
          standardFontDataUrl: new URL('standard_fonts/', assetRoot).href,
          wasmUrl: new URL('wasm/', assetRoot).href,
        })
        const pdf = await loading.promise
        if (active) setPreview({ id: source.id, pdf })
      } catch {
        if (active) setPreview({ id: source.id, pdf: null })
      }
    }

    void load(selected)
    return () => {
      active = false
      void loading?.destroy().catch(() => {})
    }
  }, [selected])

  function select(id: string) {
    if (id === selectedId) return
    setSelectedId(id)
    setPage(1)
    setRange('')
    setPreview(undefined)
  }

  async function addFiles(incoming: File[]) {
    if (busy || incoming.length === 0) return
    setBusy(true)
    setMessage('')
    const added: Source[] = []
    const failures: string[] = []
    try {
      for (const file of incoming) {
        try {
          const pdf = await PDFDocument.load(await file.arrayBuffer())
          if (pdf.getPageCount() === 0) throw new Error('Empty PDF')
          added.push({ id: crypto.randomUUID(), file, pdf })
        } catch {
          failures.push(file.name + ' 파일을 열 수 없습니다. 손상되었거나 암호가 걸린 PDF인지 확인하세요.')
        }
      }
      setFiles((current) => [...current, ...added])
      if (!selected && added.length) select(added[0].id)
      setErrors(failures)
    } finally {
      setBusy(false)
    }
  }

  function remove(index: number) {
    const remaining = files.filter((_, position) => position !== index)
    if (files[index].id === selectedId) select(remaining[index]?.id ?? remaining[index - 1]?.id ?? '')
    setFiles(remaining)
  }

  function move(index: number, offset: number) {
    const next = [...files]
    const [file] = next.splice(index, 1)
    next.splice(index + offset, 0, file)
    setFiles(next)
  }

  async function exportPdf() {
    if (busy || !selected) return
    setBusy(true)
    setErrors([])
    setMessage('')
    try {
      if (mode === 'merge') {
        download(await mergePdfs(files.map(({ pdf }) => pdf)), 'pdfgawi-merged.pdf', 'application/pdf')
      } else {
        const name = selected.file.name.replace(/\.pdf$/i, '')
        if (mode === 'extract') {
          const pages = parsePages(range, pageCount)
          download(await extractPages(selected.pdf, pages), name + '-extracted.pdf', 'application/pdf')
        } else {
          const pages = range.trim() ? parsePages(range, pageCount) : selected.pdf.getPageIndices()
          const entries = Object.create(null) as Record<string, Uint8Array>
          for (const index of pages) {
            const pageLabel = String(index + 1).padStart(String(pageCount).length, '0')
            entries['page-' + pageLabel + '.pdf'] = await extractPages(selected.pdf, [index])
          }
          download(zipSync(entries, { level: 0 }), name + '-split.zip', 'application/zip')
        }
      }
      setMessage('다운로드를 시작했습니다.')
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '파일을 만드는 중 오류가 발생했습니다.'])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand"><span aria-hidden="true">✂</span> PDFgawi</span>
          <span className="privacy"><i /> 브라우저에서 처리</span>
        </div>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">PDF WORKSPACE</p>
          <h1>PDF 합치기와 분할</h1>
          <p>여러 PDF를 하나로 합치거나 필요한 페이지를 골라 저장하세요.</p>
          <p>파일은 이 브라우저 안에서만 처리됩니다.</p>
        </section>
        <div className="workspace">
          <section className="panel files-panel" aria-labelledby="files-title">
            <h2 id="files-title"><span>01</span> 파일 추가</h2>
            <input
              ref={input}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(event) => {
                void addFiles(Array.from(event.currentTarget.files ?? []))
                event.currentTarget.value = ''
              }}
            />
            <button
              type="button"
              className={'dropzone' + (dragging ? ' dragging' : '')}
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                dragDepth.current++
                setDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => {
                dragDepth.current--
                if (dragDepth.current <= 0) setDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                dragDepth.current = 0
                setDragging(false)
                void addFiles(Array.from(event.dataTransfer.files))
              }}
            >
              <span className="drop-icon" aria-hidden="true">＋</span>
              <strong>PDF 파일 선택</strong>
              <span>또는 이곳에 파일을 끌어다 놓으세요</span>
            </button>
            {files.length > 0 && (
              <>
                <p className="list-caption">파일 {files.length}개 · 위에서부터 순서대로 병합</p>
                <ol className="files">
                  {files.map(({ id, file, pdf }, index) => (
                    <li key={id} className={id === selectedId ? 'selected' : ''}>
                      <button className="file-label" title={file.name} disabled={busy}
                        aria-pressed={id === selectedId} onClick={() => select(id)}>
                        <strong>{file.name}</strong>
                        <small>{pdf.getPageCount()}페이지</small>
                      </button>
                      <div className="file-actions">
                        <button disabled={busy || index === 0} aria-label={file.name + ' 위로 이동'} onClick={() => move(index, -1)}>↑</button>
                        <button disabled={busy || index === files.length - 1} aria-label={file.name + ' 아래로 이동'} onClick={() => move(index, 1)}>↓</button>
                        <button disabled={busy} aria-label={file.name + ' 제거'} onClick={() => remove(index)}>×</button>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
          <section className="panel preview-panel" aria-labelledby="preview-title">
            <h2 id="preview-title"><span>02</span> 페이지 미리보기</h2>
            {selected ? (
              <>
                <div className="preview-toolbar">
                  <strong title={selected.file.name}>{selected.file.name}</strong>
                  <div className="pager">
                    <button aria-label="이전 페이지" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                    <span>{page} / {pageCount}</span>
                    <button aria-label="다음 페이지" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>›</button>
                  </div>
                </div>
                {currentPreview?.pdf ? <Preview pdf={currentPreview.pdf} pageNumber={page} /> : (
                  <div className="preview-sheet">
                    <p role={currentPreview ? 'alert' : 'status'}>
                      {currentPreview ? '미리보기를 열 수 없습니다.' : '미리보기를 불러오는 중…'}
                    </p>
                  </div>
                )}
              </>
            ) : <div className="preview-sheet empty"><span aria-hidden="true">▤</span><p>PDF를 추가하면 여기에 표시됩니다.</p></div>}
          </section>
          <section className="panel export-panel" aria-labelledby="export-title">
            <h2 id="export-title"><span>03</span> 파일 내보내기</h2>
            <fieldset disabled={busy}>
              <legend className="sr-only">내보내기 방식</legend>
              <div className="modes">
                {([['merge', '병합'], ['extract', '페이지 추출'], ['split', '페이지별 분할']] as const).map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {mode === 'merge' ? <p className="mode-description">목록에 있는 PDF를 현재 순서대로 하나의 파일로 합칩니다.</p> : (
                <div className="range">
                  <label htmlFor="range">{mode === 'extract' ? '추출할 페이지' : '분할할 페이지'}</label>
                  <input id="range" type="text" value={range} onChange={(event) => setRange(event.target.value)}
                    aria-describedby="range-help" placeholder="예시  1, 3-5" autoComplete="off" />
                  <p id="range-help">{mode === 'extract'
                    ? '선택한 PDF에서 지정한 페이지를 입력 순서대로 하나의 PDF에 담습니다.'
                    : '페이지마다 PDF를 만들어 ZIP에 담습니다. 비워 두면 전체 페이지를 분할합니다.'}</p>
                </div>
              )}
              <button className="download" disabled={!selected || (mode === 'merge' && files.length < 2) || (mode === 'extract' && !range.trim())}
                onClick={() => void exportPdf()}>
                {busy ? '처리 중…' : mode === 'split' ? 'ZIP 다운로드 ↓' : 'PDF 다운로드 ↓'}
              </button>
            </fieldset>
            {errors.length > 0 && <ul className="errors" role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
            <p className="message" role="status">{message}</p>
          </section>
        </div>
      </main>
    </>
  )
}
