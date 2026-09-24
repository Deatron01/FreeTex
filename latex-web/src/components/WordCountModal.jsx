import { useMemo } from 'react';
import { Modal } from './ui.jsx';
import { wordCount } from '../lib/projectIndex.js';
import { t } from '../lib/i18n.js';

export default function WordCountModal({ project, onClose }) {
  const { total, perFile } = useMemo(() => wordCount(project.files, project.mainFile), [project]);
  const rows = [
    ['Words in text', total.words],
    ['Words in headers', total.headers],
    ['Words in captions', total.captions],
    ['Characters (no spaces)', total.characters],
    ['Inline math', total.mathInline],
    ['Displayed math', total.mathDisplay],
    ['Figures', total.figures],
    ['Tables', total.tables],
  ];
  return (
    <Modal title={t('Word count')} onClose={onClose}>
      {!project.mainFile ? <p className="text-sm text-slate-500">{t('Set a main document first.')}</p> : (
        <>
          <div className="mb-4 rounded-lg bg-brand-50 p-4 text-center dark:bg-brand-700/20">
            <div className="text-3xl font-bold text-brand-700 dark:text-brand-500">{(total.words + total.headers + total.captions).toLocaleString()}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{t('Total words')}</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, n]) => (
                <tr key={label} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-1.5">{t(label)}</td>
                  <td className="py-1.5 text-right tabular-nums">{n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {perFile.length > 1 && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-semibold">{t('Per file')}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {perFile.map((f) => (
                    <tr key={f.path} className="border-b border-slate-100 dark:border-slate-700/60">
                      <td className="py-1 font-mono text-xs">{f.path}</td>
                      <td className="py-1 text-right tabular-nums">{(f.words + f.headers + f.captions).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className="mt-3 text-xs text-slate-400">{t('Counted from the source, following \\input and \\include from the main document. Comments, commands and math are excluded.')}</p>
        </>
      )}
    </Modal>
  );
}
