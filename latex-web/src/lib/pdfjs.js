// Lazily loads pdf.js with its worker so it is not part of the initial bundle.
// The "legacy" build includes polyfills for the newest JS features pdf.js uses,
// so the viewer works in all current browsers, not only the very latest ones.
let promise;

export function loadPdfjs() {
  if (!promise) {
    promise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return promise;
}

// pdf.js v6 moved destroy() from the document to its loading task.
export function closeDocument(doc) {
  if (!doc) return;
  const target = doc.loadingTask && typeof doc.loadingTask.destroy === 'function' ? doc.loadingTask : doc;
  if (typeof target.destroy === 'function') target.destroy().catch?.(() => {});
}
