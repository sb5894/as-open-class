import './pdf-compat';
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from './pdf-worker.ts?worker&url';
import { el, link } from './ui';

GlobalWorkerOptions.workerSrc = workerUrl;
/** Mounted only for provided PDFs. Dispose cancels pending work on navigation. */
export function mountPdfViewer(slot: HTMLElement, url: string): () => void {
  let disposed = false;
  let task: PDFDocumentLoadingTask | undefined;
  let doc: PDFDocumentProxy | undefined;
  let renderTask: RenderTask | undefined;
  let pageNumber = 1;
  let zoom = 1;
  let busy = false;
  const previous = el('button', '<'); previous.setAttribute('aria-label', '이전 페이지');
  const next = el('button', '>'); next.setAttribute('aria-label', '다음 페이지');
  const smaller = el('button', '−'); smaller.setAttribute('aria-label', '축소');
  const larger = el('button', '+'); larger.setAttribute('aria-label', '확대');
  const label = el('span'); label.setAttribute('aria-live', 'polite');
  const toolbar = el('div', undefined, 'pdf-toolbar'); toolbar.setAttribute('aria-label', 'PDF 조작');
  toolbar.append(previous, label, next, smaller, larger);
  const scroll = el('div', undefined, 'pdf-scroll'); scroll.tabIndex = 0; scroll.setAttribute('aria-label', '지도안 페이지, 확대 시 가로로 이동');
  const canvas = el('canvas'); canvas.setAttribute('role', 'img'); scroll.append(canvas);
  const original = link('원본 PDF 새 탭에서 열기', url, 'text-link'); original.target = '_blank'; original.rel = 'noopener';
  function controls() {
    previous.disabled = busy || pageNumber <= 1;
    next.disabled = busy || pageNumber >= (doc?.numPages ?? 1);
    smaller.disabled = busy || zoom <= 1; larger.disabled = busy || zoom >= 2.5;
    label.textContent = `${pageNumber} / ${doc?.numPages ?? '…'} · ${Math.round(zoom * 100)}%`;
  }
  function failure() {
    if (disposed) return;
    slot.className = 'pdf-viewer-slot pdf-loading';
    const retry = el('button', '다시 시도'); retry.onclick = () => { void load(); };
    slot.replaceChildren(el('p', '지도안을 불러오지 못했습니다. 다시 시도하거나 원본 PDF를 열어 주세요.', 'error'), retry, original);
  }
  async function draw() {
    if (!doc || disposed || busy) return;
    busy = true; controls();
    try {
      const page = await doc.getPage(pageNumber);
      if (disposed) return;
      const normal = page.getViewport({ scale: 1 });
      const available = Math.max(100, scroll.clientWidth - 16);
      const viewport = page.getViewport({ scale: available / normal.width * zoom });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('aria-label', `수업 지도안 ${pageNumber}페이지`);
      renderTask = page.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await renderTask.promise;
      if (!disposed) scroll.scrollTo(0, 0);
    } catch { failure(); }
    finally { busy = false; if (!disposed) controls(); }
  }
  async function load() {
    slot.className = 'pdf-viewer-slot pdf-loading'; slot.replaceChildren(el('p', '지도안을 불러오고 있습니다…'));
    try {
      if (task) await task.destroy();
      if (disposed) return;
      task = getDocument({ url }); doc = await task.promise;
      if (disposed) return;
      pageNumber = 1; zoom = 1;
      slot.className = 'pdf-viewer-slot pdf-viewer'; slot.replaceChildren(toolbar, scroll);
      await draw();
    } catch { failure(); }
  }
  previous.onclick = () => { pageNumber--; void draw(); };
  next.onclick = () => { pageNumber++; void draw(); };
  smaller.onclick = () => { zoom = Math.max(1, zoom - .25); void draw(); };
  larger.onclick = () => { zoom = Math.min(2.5, zoom + .25); void draw(); };
  let resizeTimer: ReturnType<typeof setTimeout>;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { void draw(); }, 100);
  });
  observer.observe(slot);
  void load();
  return () => { disposed = true; observer.disconnect(); clearTimeout(resizeTimer); renderTask?.cancel(); void task?.destroy().catch(() => {}); };
}
