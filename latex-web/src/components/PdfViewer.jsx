import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronUp, ChevronDown, ZoomIn, ZoomOut, Download, ExternalLink, Maximize, Moon, Sun, MoveHorizontal, Square,
} from 'lucide-react';
import { closeDocument, loadPdfjs } from '../lib/pdfjs.js';
import { Dropdown, MenuItem, MenuSeparator, Spinner } from './ui.jsx';
import { t } from '../lib/i18n.js';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PAGE_GAP = 12;

// A single page: renders canvas, text layer and links when (nearly) visible.
const PdfPage = memo(function PdfPage({ doc, pageNumber, size, scale, visible, onLink, highlight }) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!visible || !doc) return undefined;
    let cancelled = false;
    let renderTask;
    let textLayer;
    (async () => {
      const pdfjs = await loadPdfjs();
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      // Relative sizing keeps stale canvases correct while re-rendering after a zoom.
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      const ctx = canvas.getContext('2d');
      renderTask = page.render({ canvasContext: ctx, canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null });
      try {
        await renderTask.promise;
      } catch {
        return;
      }
      if (cancelled || !canvasRef.current) return;
      canvasRef.current.replaceChildren(canvas);

      if (textRef.current) {
        textRef.current.replaceChildren();
        textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textRef.current, viewport });
        await textLayer.render().catch(() => {});
      }
      const annotations = await page.getAnnotations({ intent: 'display' }).catch(() => []);
      if (cancelled) return;
      setLinks(annotations.filter((a) => a.subtype === 'Link' && (a.url || a.dest)).map((a) => {
        const [x1, y1] = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
        const [x2, y2] = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
        return {
          id: a.id,
          url: a.url,
          dest: a.dest,
          style: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
        };
      }));
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, scale, visible]);

  return (
    <div
      className="pdf-page"
      data-page={pageNumber}
      style={{ width: Math.floor(size.width * scale), height: Math.floor(size.height * scale), '--total-scale-factor': scale, '--scale-round-x': '1px', '--scale-round-y': '1px' }}
    >
      <div ref={canvasRef} className="h-full w-full" />
      <div ref={textRef} className="textLayer" />
      <div className="linkLayer">
        {links.map((l) => (
          <a
            key={l.id}
            href={l.url || '#'}
            style={l.style}
            target={l.url ? '_blank' : undefined}
            rel="noreferrer noopener"
            title={l.url || ''}
            onClick={(e) => {
              if (!l.url) {
                e.preventDefault();
                onLink(l.dest);
              }
            }}
          />
        ))}
      </div>
      {highlight && (
        <div
          key={highlight.stamp}
          className="pdf-highlight"
          style={{ left: highlight.x * scale, top: highlight.y * scale, width: highlight.width * scale, height: highlight.height * scale }}
        />
      )}
    </div>
  );
});

export default function PdfViewer({ data, fileName, dark, onToggleDark, onSyncClick, syncTarget, onDownload }) {
  const containerRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [sizes, setSizes] = useState([]);
  const [zoom, setZoom] = useState(() => {
    try {
      return localStorage.getItem('freetex.pdfZoom') || 'page-width';
    } catch {
      return 'page-width';
    }
  });
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [visibleRange, setVisibleRange] = useState([1, 3]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [error, setError] = useState(null);
  const restoreRef = useRef(null);

  // Load the document whenever new PDF data arrives, remembering the scroll position.
  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    let loaded = null;
    const el = containerRef.current;
    if (el && el.scrollHeight > 0) {
      restoreRef.current = { top: el.scrollTop / el.scrollHeight, left: el.scrollLeft };
    }
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        loaded = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
        if (cancelled) {
          closeDocument(loaded);
          return;
        }
        const s = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const page = await loaded.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          s.push({ width: vp.width, height: vp.height });
        }
        if (cancelled) {
          closeDocument(loaded);
          return;
        }
        setError(null);
        setSizes(s);
        setDoc((old) => {
          if (old) setTimeout(() => closeDocument(old), 1000);
          return loaded;
        });
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => () => closeDocument(doc), [doc]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxWidth = useMemo(() => Math.max(1, ...sizes.map((s) => s.width)), [sizes]);
  const firstHeight = sizes[0]?.height || 842;
  const scale = useMemo(() => {
    if (!containerWidth) return 1;
    if (zoom === 'page-width') return Math.max(0.1, (containerWidth - 32) / maxWidth);
    if (zoom === 'page-fit') return Math.max(0.1, Math.min((containerWidth - 32) / maxWidth, (containerHeight - 24) / firstHeight));
    return Number(zoom) || 1;
  }, [zoom, containerWidth, containerHeight, maxWidth, firstHeight]);

  const setZoomPersist = (z) => {
    setZoom(String(z));
    try {
      localStorage.setItem('freetex.pdfZoom', String(z));
    } catch { /* ignore */ }
  };

  const pageTops = useMemo(() => {
    const tops = [];
    let y = 12;
    for (const s of sizes) {
      tops.push(y);
      y += Math.floor(s.height * scale) + PAGE_GAP;
    }
    return tops;
  }, [sizes, scale]);

  const updateVisible = useCallback(() => {
    const el = containerRef.current;
    if (!el || !sizes.length) return;
    const top = el.scrollTop;
    const bottom = top + el.clientHeight;
    let first = 1;
    let last = 1;
    let current = 1;
    const middle = top + el.clientHeight / 3;
    for (let i = 0; i < sizes.length; i++) {
      const pTop = pageTops[i];
      const pBottom = pTop + sizes[i].height * scale;
      if (pBottom < top - el.clientHeight) first = i + 2;
      if (pTop <= bottom + el.clientHeight) last = i + 1;
      if (pTop <= middle) current = i + 1;
    }
    setVisibleRange([Math.max(1, first), Math.max(first, last)]);
    setCurrentPage(current);
    setPageInput(String(current));
  }, [sizes, pageTops, scale]);

  // Restore the scroll position after a recompile, keep it on zoom.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !sizes.length) return;
    if (restoreRef.current) {
      el.scrollTop = restoreRef.current.top * el.scrollHeight;
      el.scrollLeft = restoreRef.current.left;
      restoreRef.current = null;
    }
    updateVisible();
  }, [doc, sizes, scale, updateVisible]);

  const prevScale = useRef(scale);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el && prevScale.current !== scale && prevScale.current) {
      const ratio = scale / prevScale.current;
      el.scrollTop *= ratio;
    }
    prevScale.current = scale;
  }, [scale]);

  const scrollToPage = useCallback((n, yOffset = 0, smooth = false) => {
    const el = containerRef.current;
    if (!el || !sizes.length) return;
    const i = Math.min(Math.max(1, n), sizes.length) - 1;
    el.scrollTo({ top: pageTops[i] + yOffset * scale - 12, behavior: smooth ? 'smooth' : 'auto' });
  }, [sizes, pageTops, scale]);

  // SyncTeX forward search target.
  useEffect(() => {
    if (!syncTarget || !sizes.length) return;
    const el = containerRef.current;
    const i = Math.min(Math.max(1, syncTarget.page), sizes.length) - 1;
    const y = pageTops[i] + syncTarget.y * scale - el.clientHeight / 3;
    el.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTarget]);

  const onLink = useCallback(async (dest) => {
    if (!doc) return;
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!explicit) return;
      const pageIndex = typeof explicit[0] === 'object' ? await doc.getPageIndex(explicit[0]) : explicit[0];
      let yOffset = 0;
      if (explicit[1]?.name === 'XYZ' && explicit[3] != null) yOffset = sizes[pageIndex].height - explicit[3];
      scrollToPage(pageIndex + 1, Math.max(0, yOffset - 20), true);
    } catch { /* bad destination */ }
  }, [doc, sizes, scrollToPage]);

  // Ctrl + wheel zooms.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoomPersist(Math.min(5, Math.max(0.25, +(scale * factor).toFixed(3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scale]);

  const onDoubleClick = (e) => {
    const pageEl = e.target.closest('.pdf-page');
    if (!pageEl || !onSyncClick) return;
    const rect = pageEl.getBoundingClientRect();
    const page = Number(pageEl.dataset.page);
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const span = e.target.closest('.textLayer span');
    const selection = window.getSelection()?.toString().trim();
    onSyncClick({ page, x, y, text: selection || span?.textContent || '', context: span?.textContent || '' });
  };

  const zoomStep = (dir) => {
    const next = dir > 0 ? ZOOMS.find((z) => z > scale + 0.01) : [...ZOOMS].reverse().find((z) => z < scale - 0.01);
    if (next) setZoomPersist(next);
  };

  const openInTab = () => {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const zoomLabel = zoom === 'page-width' ? t('Fit width') : zoom === 'page-fit' ? t('Fit page') : `${Math.round(scale * 100)}%`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1 text-sm dark:border-slate-700 dark:bg-slate-900">
        <button type="button" className="btn-icon" title={t('Previous page')} onClick={() => scrollToPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronUp size={16} /></button>
        <button type="button" className="btn-icon" title={t('Next page')} onClick={() => scrollToPage(currentPage + 1)} disabled={currentPage >= sizes.length}><ChevronDown size={16} /></button>
        <form className="flex items-center gap-1 text-xs text-slate-500" onSubmit={(e) => { e.preventDefault(); scrollToPage(Number(pageInput) || 1); }}>
          <input className="h-6 w-10 rounded border border-slate-300 bg-white px-1 text-center text-xs dark:border-slate-600 dark:bg-slate-800" value={pageInput} onChange={(e) => setPageInput(e.target.value)} aria-label={t('Page')} />
          <span>/ {sizes.length || '–'}</span>
        </form>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button type="button" className="btn-icon" title={t('Zoom out')} onClick={() => zoomStep(-1)}><ZoomOut size={16} /></button>
        <Dropdown className="btn px-1.5 py-1 text-xs tabular-nums" button={zoomLabel}>
          <MenuItem icon={MoveHorizontal} onClick={() => setZoomPersist('page-width')}>{t('Fit width')}</MenuItem>
          <MenuItem icon={Square} onClick={() => setZoomPersist('page-fit')}>{t('Fit page')}</MenuItem>
          <MenuSeparator />
          {ZOOMS.map((z) => <MenuItem key={z} onClick={() => setZoomPersist(z)} checked={Math.abs(scale - z) < 0.01}>{`${z * 100}%`}</MenuItem>)}
        </Dropdown>
        <button type="button" className="btn-icon" title={t('Zoom in')} onClick={() => zoomStep(1)}><ZoomIn size={16} /></button>
        <div className="flex-1" />
        <button type="button" className="btn-icon" title={dark ? t('Light PDF') : t('Dark PDF')} onClick={onToggleDark}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button type="button" className="btn-icon" title={t('Open in new tab')} onClick={openInTab} disabled={!data}><ExternalLink size={16} /></button>
        <button type="button" className="btn-icon" title={t('Full screen')} onClick={() => containerRef.current?.requestFullscreen?.()} disabled={!data}><Maximize size={16} /></button>
        <button type="button" className="btn-icon" title={t('Download PDF')} onClick={onDownload} disabled={!data}><Download size={16} /></button>
      </div>
      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 ${dark ? 'pdf-dark' : ''}`}
        onScroll={updateVisible}
        onDoubleClick={onDoubleClick}
        title={onSyncClick ? t('Double-click to jump to the source') : undefined}
        aria-label={fileName}
      >
        {error && <div className="p-6 text-center text-sm text-red-600">{t('Could not display the PDF: {msg}', { msg: error })}</div>}
        {!doc && !error && <div className="flex h-full items-center justify-center text-slate-500"><Spinner size={24} /></div>}
        {doc && (
          <div className="py-3" style={{ minWidth: Math.floor(maxWidth * scale) + 24 }}>
            {sizes.map((s, i) => (
              <PdfPage
                key={i}
                doc={doc}
                pageNumber={i + 1}
                size={s}
                scale={scale}
                visible={i + 1 >= visibleRange[0] && i + 1 <= visibleRange[1]}
                onLink={onLink}
                highlight={syncTarget && syncTarget.page === i + 1 ? syncTarget : null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
