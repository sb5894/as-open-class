import './pdf-compat';
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from './pdf-worker.ts?worker&url';
import { el, link } from './ui';

GlobalWorkerOptions.workerSrc = workerUrl;
/** Continuous pages use document scrolling; only zoomed pages scroll horizontally. */
export function mountPdfViewer(slot: HTMLElement, url: string): () => void {
  let disposed = false;
  let task: PDFDocumentLoadingTask | undefined;
  let doc: PDFDocumentProxy | undefined;
  let renderTask: RenderTask | undefined;
  let generation = 0, zoom = 1, pageNumber = 1, lastWidth = 0;
  let rendering = false, failed = false;
  let pending = new Set<number>();
  let nearObserver: IntersectionObserver | undefined;
  let pages: { wrapper: HTMLDivElement; canvas: HTMLCanvasElement; width: number; height: number; rendered: number }[] = [];
  const previous = el('button', '<'); previous.setAttribute('aria-label', '이전 페이지');
  const next = el('button', '>'); next.setAttribute('aria-label', '다음 페이지');
  const smaller = el('button', '−'); smaller.setAttribute('aria-label', '축소');
  const larger = el('button', '+'); larger.setAttribute('aria-label', '확대');
  const label = el('span'); label.setAttribute('aria-live', 'polite');
  const original = link('PDF 새 탭에서 열기', url, 'button secondary pdf-original'); original.target = '_blank'; original.rel = 'noopener';
  const toolbar = el('div', undefined, 'pdf-toolbar'); toolbar.setAttribute('aria-label', 'PDF 조작');
  toolbar.append(original, previous, label, next, smaller, larger);
  const scroll = el('div', undefined, 'pdf-scroll');
  function controls() {
    previous.disabled = !doc || pageNumber <= 1;
    next.disabled = !doc || pageNumber >= doc.numPages;
    smaller.disabled = !doc || zoom <= 1; larger.disabled = !doc || zoom >= 2.5;
    label.textContent = `${pageNumber} / ${doc?.numPages ?? '…'} · ${Math.round(zoom * 100)}%`;
  }
  function failure() {
    if (disposed || failed) return;
    failed = true; generation++; pending.clear(); nearObserver?.disconnect(); renderTask?.cancel();
    slot.className = 'pdf-viewer-slot pdf-loading';
    const retry = el('button', '다시 시도'); retry.onclick = () => { void load(); };
    slot.replaceChildren(el('p', '지도안을 불러오지 못했습니다. 다시 시도하거나 PDF를 새 탭에서 열어 주세요.', 'error'), retry, original);
  }
  async function drain() {
    if (rendering || !doc || disposed || failed) return;
    rendering = true;
    try {
      while (pending.size && !disposed && !failed) {
        const index = pending.values().next().value!; pending.delete(index);
        const entry = pages[index], version = generation;
        if (!entry || entry.rendered === version) continue;
        try {
          const page = await doc.getPage(index + 1);
          if (disposed || version !== generation) continue;
          const viewport = page.getViewport({ scale: Math.max(100, scroll.clientWidth - 16) / entry.width * zoom });
          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          entry.canvas.width = Math.floor(viewport.width * ratio); entry.canvas.height = Math.floor(viewport.height * ratio);
          renderTask = page.render({ canvas: entry.canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
          await renderTask.promise;
          if (!disposed && version === generation) { entry.rendered = version; entry.canvas.dataset.rendered = 'true'; }
        } catch {
          if (!disposed && version === generation) failure();
        }
      }
    } finally { rendering = false; }
  }
  function queueNearby() {
    if (disposed || failed) return;
    pages.forEach((entry, index) => {
      const bounds = entry.wrapper.getBoundingClientRect();
      if (bounds.bottom >= -800 && bounds.top <= innerHeight + 800 && entry.rendered !== generation) pending.add(index);
    });
    void drain();
  }
  function layout() {
    if (!doc || disposed || failed || !pages.length) return;
    lastWidth = scroll.clientWidth; generation++; pending.clear(); renderTask?.cancel();
    const available = Math.max(100, lastWidth - 16);
    controls();
    for (const entry of pages) {
      const width = available * zoom, height = width * entry.height / entry.width;
      entry.canvas.style.width = `${width}px`; entry.canvas.style.height = `${height}px`;
      entry.wrapper.style.scrollMarginTop = `${toolbar.getBoundingClientRect().height + 16}px`;
      entry.canvas.removeAttribute('data-rendered');
    }
    queueNearby();
  }
  let scrollFrame = 0;
  function onScroll() {
    if (scrollFrame || !pages.length || failed) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const target = toolbar.getBoundingClientRect().bottom + 24;
      let nearest = 0, distance = Infinity;
      pages.forEach((entry, index) => {
        const bounds = entry.wrapper.getBoundingClientRect();
        const current = bounds.top <= target && bounds.bottom > target ? 0 : Math.abs(bounds.top - target);
        if (current < distance) { distance = current; nearest = index; }
      });
      pageNumber = nearest + 1; controls(); queueNearby();
    });
  }
  async function load() {
    failed = false; generation++; pending.clear(); nearObserver?.disconnect(); renderTask?.cancel();
    pages = []; scroll.replaceChildren();
    slot.className = 'pdf-viewer-slot pdf-loading'; slot.replaceChildren(el('p', '지도안을 불러오고 있습니다…'));
    try {
      if (task) await task.destroy();
      if (disposed) return;
      task = getDocument({ url }); doc = await task.promise;
      if (disposed) return;
      pageNumber = 1; zoom = 1;
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number);
        if (disposed) return;
        const normal = page.getViewport({ scale: 1 });
        const wrapper = el('div', undefined, 'pdf-page'); wrapper.tabIndex = 0;
        wrapper.setAttribute('aria-label', `지도안 ${number}페이지, 확대 시 가로로 이동`);
        const canvas = el('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `수업 지도안 ${number}페이지`);
        wrapper.append(canvas); scroll.append(wrapper);
        pages.push({ wrapper, canvas, width: normal.width, height: normal.height, rendered: -1 });
      }
      slot.className = 'pdf-viewer-slot pdf-viewer'; slot.replaceChildren(toolbar, scroll); layout();
      nearObserver = new IntersectionObserver(() => queueNearby(), { rootMargin: '800px 0px' });
      pages.forEach(entry => nearObserver!.observe(entry.wrapper));
    } catch { failure(); }
  }
  function movePage(offset: number) {
    pageNumber = Math.max(1, Math.min(pages.length, pageNumber + offset)); controls();
    pages[pageNumber - 1]?.wrapper.scrollIntoView({ block: 'start' }); queueNearby();
  }
  previous.onclick = () => movePage(-1); next.onclick = () => movePage(1);
  smaller.onclick = () => { zoom = Math.max(1, zoom - .25); layout(); };
  larger.onclick = () => { zoom = Math.min(2.5, zoom + .25); layout(); };
  let resizeTimer: ReturnType<typeof setTimeout>;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (scroll.clientWidth !== lastWidth) layout(); }, 100);
  });
  observer.observe(slot); window.addEventListener('scroll', onScroll, { passive: true });
  void load();
  return () => {
    disposed = true; generation++; pending.clear(); nearObserver?.disconnect(); observer.disconnect();
    window.removeEventListener('scroll', onScroll); cancelAnimationFrame(scrollFrame); clearTimeout(resizeTimer);
    renderTask?.cancel(); void task?.destroy().catch(() => {});
  };
}
