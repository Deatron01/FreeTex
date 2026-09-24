import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { SYMBOLS, SYMBOL_GLYPHS } from '../lib/latexData.js';
import { t } from '../lib/i18n.js';

export default function SymbolPalette({ onInsert, onClose }) {
  const categories = Object.keys(SYMBOLS);
  const [cat, setCat] = useState(categories[0]);
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYMBOLS[cat];
    return [...new Set(Object.values(SYMBOLS).flat())].filter((s) => s.toLowerCase().includes(q));
  }, [cat, query]);

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 px-2 py-1 dark:border-slate-700">
        {categories.map((c) => (
          <button key={c} type="button" className={`btn px-2 py-0.5 text-xs ${c === cat && !query ? 'btn-active' : ''}`} onClick={() => { setCat(c); setQuery(''); }}>{t(c)}</button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2 top-1.5 text-slate-400" />
          <input className="input h-6 w-36 py-0 pl-6 text-xs" placeholder={t('Search symbols')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="button" className="btn-icon" onClick={onClose} title={t('Close')}><X size={14} /></button>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1 overflow-auto p-2">
        {list.map((s) => (
          <button
            key={s}
            type="button"
            className="flex h-10 items-center justify-center rounded border border-slate-200 text-lg hover:border-brand-500 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-slate-800"
            title={s}
            onClick={() => onInsert(s)}
          >
            {SYMBOL_GLYPHS[s] || s.replace(/^\\/, '')}
          </button>
        ))}
      </div>
    </div>
  );
}
