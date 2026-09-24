import { useEffect, useMemo, useState } from 'react';
import { Download, FileQuestion } from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import { formatBytes, isImagePath, isPdfPath, mimeFor } from '../lib/paths.js';
import { t } from '../lib/i18n.js';

// Preview for binary files (images, PDFs, anything else).
export default function FileViewer({ path, file, onDownload }) {
  const [pdfData, setPdfData] = useState(null);
  const url = useMemo(() => (isImagePath(path) ? URL.createObjectURL(new Blob([file.blob], { type: mimeFor(path) })) : null), [path, file]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    let alive = true;
    if (isPdfPath(path)) file.blob.arrayBuffer().then((b) => alive && setPdfData(new Uint8Array(b)));
    return () => {
      alive = false;
    };
  }, [path, file]);

  if (isPdfPath(path)) {
    return pdfData ? <PdfViewer data={pdfData} fileName={path} onDownload={onDownload} onToggleDark={() => {}} /> : null;
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto bg-slate-100 p-6 dark:bg-slate-950">
      {url ? (
        <img src={url} alt={path} className="max-h-[70%] max-w-full rounded bg-[repeating-conic-gradient(#e2e8f0_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] shadow" />
      ) : (
        <FileQuestion size={64} className="text-slate-300" />
      )}
      <div className="text-center text-sm">
        <div className="font-medium">{path}</div>
        <div className="text-slate-500">{formatBytes(file.blob.size)} · {t('Binary file (not editable)')}</div>
      </div>
      <button type="button" className="btn-outline" onClick={onDownload}><Download size={15} />{t('Download')}</button>
    </div>
  );
}
