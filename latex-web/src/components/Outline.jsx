import { useMemo } from 'react';
import { t } from '../lib/i18n.js';

export default function Outline({ entries, activePath, cursorLine, onJump }) {
  // The current section is the last entry at or before the cursor in the active file.
  const currentIndex = useMemo(() => {
    let idx = -1;
    entries.forEach((e, i) => {
      if (e.file === activePath && e.line <= cursorLine) idx = i;
    });
    return idx;
  }, [entries, activePath, cursorLine]);

  if (!entries.length) {
    return <p className="p-3 text-xs text-slate-400">{t('No sections found. Use \\section{...} to structure your document.')}</p>;
  }
  const minLevel = Math.min(...entries.map((e) => e.level));
  return (
    <ul className="p-1 text-sm">
      {entries.map((e, i) => (
        <li key={`${e.file}:${e.line}:${i}`}>
          <button
            type="button"
            className={`block w-full truncate rounded py-0.5 pr-2 text-left hover:bg-slate-200/70 dark:hover:bg-slate-800 ${i === currentIndex ? 'font-semibold text-brand-700 dark:text-brand-500' : 'text-slate-700 dark:text-slate-300'}`}
            style={{ paddingLeft: (e.level - minLevel) * 12 + 8 }}
            title={`${e.title} — ${e.file}:${e.line}`}
            onClick={() => onJump(e.file, e.line)}
          >
            {e.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
