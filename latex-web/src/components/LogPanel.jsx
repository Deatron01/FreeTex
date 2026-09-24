import { useMemo, useState } from 'react';
import { XCircle, AlertTriangle, Info, ChevronRight, ChevronDown, Download, FileDown, Lightbulb, Trash2 } from 'lucide-react';
import { t } from '../lib/i18n.js';
import { Spinner } from './ui.jsx';

const LEVELS = {
  error: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'border-l-red-500 bg-red-50 dark:bg-red-950/30' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  typesetting: { icon: Info, color: 'text-sky-600 dark:text-sky-400', bg: 'border-l-sky-500 bg-sky-50 dark:bg-sky-950/30' },
};

function Entry({ entry, onJump }) {
  const [open, setOpen] = useState(false);
  const L = LEVELS[entry.level];
  const Icon = L.icon;
  return (
    <div className={`mb-2 rounded border-l-4 ${L.bg} text-sm`}>
      <div className="flex items-start gap-2 p-2">
        <Icon size={16} className={`mt-0.5 shrink-0 ${L.color}`} />
        <div className="min-w-0 flex-1">
          <div className="break-words font-medium">{entry.message}</div>
          {entry.file && (
            <button type="button" className="mt-0.5 text-xs text-slate-500 underline-offset-2 hover:underline disabled:no-underline" onClick={() => onJump(entry)} disabled={!entry.projectFile}>
              {entry.file}{entry.line ? `, ${t('line')} ${entry.line}` : ''}
            </button>
          )}
          {entry.hint && (
            <div className="mt-1 flex gap-1 text-xs text-slate-600 dark:text-slate-300">
              <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{entry.hint}</span>
            </div>
          )}
        </div>
        {entry.raw && (
          <button type="button" className="btn-icon p-0.5" onClick={() => setOpen((o) => !o)} title={t('Show raw log')}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {open && <pre className="overflow-x-auto whitespace-pre-wrap border-t border-black/5 p-2 font-mono text-xs dark:border-white/10">{entry.raw}</pre>}
    </div>
  );
}

export default function LogPanel({ result, entries, onJump, onFetchLog, fetchingLog, onDownloadOutput, onClearCache }) {
  const [filter, setFilter] = useState('all');
  const [showRaw, setShowRaw] = useState(false);
  const counts = useMemo(() => ({
    error: entries.filter((e) => e.level === 'error').length,
    warning: entries.filter((e) => e.level === 'warning').length,
    typesetting: entries.filter((e) => e.level === 'typesetting').length,
  }), [entries]);
  const shown = filter === 'all' ? entries : entries.filter((e) => e.level === filter);

  if (!result) return <div className="p-6 text-center text-sm text-slate-500">{t('Compile the project to see logs.')}</div>;

  const tab = (id, label, count) => (
    <button type="button" className={`btn px-2 py-1 text-xs ${filter === id ? 'btn-active' : ''}`} onClick={() => setFilter(id)}>
      {label}{count !== undefined && <span className="rounded-full bg-slate-200 px-1.5 text-[10px] dark:bg-slate-700">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 p-1.5 dark:border-slate-700">
        {tab('all', t('All'), entries.length)}
        {tab('error', t('Errors'), counts.error)}
        {tab('warning', t('Warnings'), counts.warning)}
        {tab('typesetting', t('Typesetting'), counts.typesetting)}
        <div className="flex-1" />
        <button type="button" className={`btn px-2 py-1 text-xs ${showRaw ? 'btn-active' : ''}`} onClick={() => setShowRaw((r) => !r)} disabled={!result.log}>{t('Raw log')}</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {result.logDeferred && !result.log && (
          <div className="mb-3 rounded bg-slate-100 p-3 text-sm dark:bg-slate-800">
            <p className="mb-2 text-slate-600 dark:text-slate-300">{t('texlive.net only returns the log for failed builds. Fetch it to see warnings.')}</p>
            <button type="button" className="btn-outline text-xs" onClick={onFetchLog} disabled={fetchingLog}>
              {fetchingLog ? <Spinner size={14} /> : <FileDown size={14} />}{t('Fetch full log')}
            </button>
          </div>
        )}
        {showRaw ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{result.log}</pre>
        ) : (
          <>
            {shown.length === 0 && (result.log || !result.logDeferred) && (
              <div className="p-4 text-center text-sm text-slate-500">{filter === 'all' ? t('No errors or warnings. 🎉') : t('Nothing here.')}</div>
            )}
            {shown.map((e, i) => <Entry key={i} entry={e} onJump={onJump} />)}
          </>
        )}
        <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>{t('Backend')}: {result.backend === 'server' ? t('Local compile server') : 'texlive.net'}</span>
            <span>{t('Engine')}: {result.compiler?.engine}</span>
            {result.duration !== undefined && <span>{t('Time')}: {(result.duration / 1000).toFixed(1)} s</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {result.log && (
              <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={() => onDownloadOutput('log')}><Download size={13} />{t('Log file')}</button>
            )}
            {(result.outputFiles || []).filter((f) => !/\.(pdf|log|gz)$/.test(f.name)).map((f) => (
              <button key={f.name} type="button" className="btn-outline px-2 py-1 text-xs" onClick={() => onDownloadOutput(f.name)}><Download size={13} />{f.name}</button>
            ))}
            {result.backend === 'server' && (
              <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={onClearCache}><Trash2 size={13} />{t('Clear cached files')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
