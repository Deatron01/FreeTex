import { Modal } from './ui.jsx';
import { t } from '../lib/i18n.js';

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  ['Compile', `${mod}+S`, `${mod}+Enter`],
  ['Bold', `${mod}+B`],
  ['Italic', `${mod}+I`],
  ['Toggle comment', `${mod}+/`],
  ['Find / replace', `${mod}+F`, `${mod}+H`],
  ['Search in project', `${mod}+Shift+F`],
  ['Go to line', `${mod}+Alt+G`],
  ['Autocomplete', `${mod}+Space`],
  ['Undo / redo', `${mod}+Z`, `${mod}+Shift+Z`],
  ['Go to PDF location (SyncTeX)', `${mod}+.`],
  ['Select next occurrence', `${mod}+D`],
  ['Indent / outdent', 'Tab', 'Shift+Tab'],
  ['Fold / unfold', `${mod}+Shift+[`, `${mod}+Shift+]`],
  ['Duplicate line', 'Shift+Alt+↓'],
  ['Move line', 'Alt+↑', 'Alt+↓'],
];

export default function HelpModal({ onClose }) {
  return (
    <Modal title={t('Help')} onClose={onClose} width="max-w-2xl">
      <h3 className="mb-2 font-semibold">{t('Keyboard shortcuts')}</h3>
      <table className="mb-6 w-full text-sm">
        <tbody>
          {SHORTCUTS.map(([label, ...keys]) => (
            <tr key={label} className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-1.5">{t(label)}</td>
              <td className="py-1.5 text-right">
                {keys.map((k) => <span key={k} className="kbd ml-1">{k}</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb-2 font-semibold">{t('Compiling')}</h3>
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>{t('FreeTex compiles with a local TeX Live through the FreeTex compile server when it is running (npm run server), and otherwise falls back to the free texlive.net service.')}</p>
        <p>{t('The local server supports every file type, folders, SyncTeX (double-click the PDF to jump to the source), shell escape and large projects.')}</p>
        <p>{t('texlive.net needs no installation. FreeTex flattens folders and converts images to PDF automatically before sending. Fonts and other binary files are not supported and the upload limit is 1 MB.')}</p>
        <p>{t('Magic comments are supported: "% !TeX program = xelatex" chooses the engine and "% !BIB program = biber" the bibliography tool.')}</p>
      </div>

      <h3 className="mb-2 mt-6 font-semibold">{t('Your data')}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t('Projects and their history are stored locally in your browser (IndexedDB). Nothing is uploaded except when you compile. Use "Download .zip" to back up your work.')}
      </p>
    </Modal>
  );
}
