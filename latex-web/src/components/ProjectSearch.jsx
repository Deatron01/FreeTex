import { useMemo, useState } from 'react';
import { Replace, X, CaseSensitive, Regex, WholeWord } from 'lucide-react';
import { t } from '../lib/i18n.js';

function buildRegex(query, { regex, caseSensitive, wholeWord }) {
  if (!query) return null;
  try {
    let src = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) src = `\\b${src}\\b`;
    return new RegExp(src, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

export default function ProjectSearch({ project, onOpenMatch, onReplaceAll, onClose }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [opts, setOpts] = useState({ regex: false, caseSensitive: false, wholeWord: false });
  const re = useMemo(() => buildRegex(query, opts), [query, opts]);

  const results = useMemo(() => {
    if (!re) return [];
    const rx = new RegExp(re.source, re.flags);
    const out = [];
    for (const [path, f] of Object.entries(project.files)) {
      if (f.kind !== 'text') continue;
      const lines = f.text.split('\n');
      const matches = [];
      let offset = 0;
      lines.forEach((line, i) => {
        rx.lastIndex = 0;
        let m;
        while ((m = rx.exec(line)) && matches.length < 500) {
          matches.push({ line: i + 1, column: m.index, from: offset + m.index, to: offset + m.index + m[0].length, text: line, length: m[0].length });
          if (m[0].length === 0) rx.lastIndex++;
        }
        offset += line.length + 1;
      });
      if (matches.length) out.push({ path, matches });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }, [project, re]);

  const total = results.reduce((n, r) => n + r.matches.length, 0);
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const optBtn = (k, Icon, title) => (
    <button type="button" className={`btn-icon p-1 ${opts[k] ? 'btn-active text-brand-700' : ''}`} title={title} onClick={() => toggle(k)}><Icon size={15} /></button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="panel-header justify-between">
        <span>{t('Search in project')}</span>
        <button type="button" className="btn-icon p-0.5" onClick={onClose} title={t('Close')}><X size={14} /></button>
      </div>
      <div className="space-y-1.5 border-b border-slate-200 p-2 dark:border-slate-700">
        <div className="flex items-center gap-0.5">
          <input className="input h-8 py-0 text-sm" autoFocus placeholder={t('Search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          {optBtn('caseSensitive', CaseSensitive, t('Match case'))}
          {optBtn('wholeWord', WholeWord, t('Whole word'))}
          {optBtn('regex', Regex, t('Regular expression'))}
          <button type="button" className={`btn-icon p-1 ${showReplace ? 'btn-active' : ''}`} title={t('Replace')} onClick={() => setShowReplace((s) => !s)}><Replace size={15} /></button>
        </div>
        {showReplace && (
          <div className="flex gap-1">
            <input className="input h-8 py-0 text-sm" placeholder={t('Replace with')} value={replacement} onChange={(e) => setReplacement(e.target.value)} />
            <button type="button" className="btn-outline px-2 py-1 text-xs" disabled={!total} onClick={() => onReplaceAll(re, replacement)}>{t('Replace all')}</button>
          </div>
        )}
        {query && <div className="text-xs text-slate-500">{re ? t('{n} results in {f} files', { n: total, f: results.length }) : t('Invalid regular expression')}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto text-sm">
        {results.map((r) => (
          <div key={r.path}>
            <div className="sticky top-0 bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{r.path} <span className="font-normal text-slate-500">({r.matches.length})</span></div>
            {r.matches.slice(0, 200).map((m, i) => (
              <button key={i} type="button" className="block w-full truncate px-2 py-0.5 text-left font-mono text-xs hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onOpenMatch(r.path, m)}>
                <span className="mr-2 text-slate-400">{m.line}</span>
                {m.text.slice(Math.max(0, m.column - 30), m.column)}
                <mark className="rounded bg-amber-200 dark:bg-amber-600/60 dark:text-white">{m.text.slice(m.column, m.column + m.length)}</mark>
                {m.text.slice(m.column + m.length, m.column + m.length + 60)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
