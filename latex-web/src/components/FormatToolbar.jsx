import { useState } from 'react';
import {
  Undo2, Redo2, Bold, Italic, Underline, Code, Sigma, SquareFunction, List, ListOrdered, Link2, Quote, Image as ImageIcon, Table,
  MessageSquareCode, Omega, Search, Heading, Hash, BookMarked, Superscript,
} from 'lucide-react';
import { undo, redo } from '@codemirror/commands';
import { Dropdown, MenuItem, Modal } from './ui.jsx';
import { isImagePath, isPdfPath } from '../lib/paths.js';
import { t } from '../lib/i18n.js';

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

const SECTION_COMMANDS = [
  ['part', 'Part'], ['chapter', 'Chapter'], ['section', 'Section'], ['subsection', 'Subsection'],
  ['subsubsection', 'Subsubsection'], ['paragraph', 'Paragraph'],
];

function TableDialog({ onInsert, onClose }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [style, setStyle] = useState('booktabs');
  const [caption, setCaption] = useState('');
  const [float, setFloat] = useState(true);
  const insert = () => {
    const r = Math.max(1, Math.min(50, rows));
    const c = Math.max(1, Math.min(20, cols));
    const spec = style === 'grid' ? `|${'c|'.repeat(c)}` : 'l'.repeat(c);
    const line = (cells) => `\t\t${cells.join(' & ')} \\\\`;
    const body = [];
    body.push(style === 'booktabs' ? '\t\t\\toprule' : style === 'grid' ? '\t\t\\hline' : null);
    for (let i = 0; i < r; i++) {
      body.push(line(Array.from({ length: c }, (_, j) => (i === 0 ? `Header ${j + 1}` : `Cell ${i},${j + 1}`))));
      if (i === 0 && style === 'booktabs') body.push('\t\t\\midrule');
      else if (style === 'grid') body.push('\t\t\\hline');
    }
    if (style === 'booktabs') body.push('\t\t\\bottomrule');
    const tabular = `\t\\begin{tabular}{${spec}}\n${body.filter(Boolean).join('\n')}\n\t\\end{tabular}`;
    const code = float
      ? `\\begin{table}[htbp]\n\t\\centering\n${tabular}\n\t\\caption{${caption || 'Caption'}}\n\t\\label{tab:${(caption || 'table').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}}\n\\end{table}\n`
      : `${tabular.replace(/^\t/gm, '')}\n`;
    onInsert(code, style === 'booktabs' ? 'booktabs' : null);
    onClose();
  };
  return (
    <Modal title={t('Insert table')} onClose={onClose} footer={<><button type="button" className="btn-outline" onClick={onClose}>{t('Cancel')}</button><button type="button" className="btn-primary" onClick={insert}>{t('Insert')}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">{t('Rows')}</span><input type="number" min="1" max="50" className="input" value={rows} onChange={(e) => setRows(Number(e.target.value))} /></label>
        <label><span className="label">{t('Columns')}</span><input type="number" min="1" max="20" className="input" value={cols} onChange={(e) => setCols(Number(e.target.value))} /></label>
        <label className="col-span-2"><span className="label">{t('Style')}</span>
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="booktabs">{t('Professional (booktabs)')}</option>
            <option value="grid">{t('Grid lines')}</option>
            <option value="plain">{t('No lines')}</option>
          </select>
        </label>
        <label className="col-span-2"><span className="label">{t('Caption')}</span><input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={float} onChange={(e) => setFloat(e.target.checked)} />{t('Wrap in a floating table environment')}</label>
      </div>
      <div className="mt-4 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 20)}, 1fr)` }}>
        {Array.from({ length: Math.min(rows, 12) * Math.min(cols, 20) }).map((_, i) => <div key={i} className="h-4 rounded-sm bg-brand-100 dark:bg-brand-700/40" />)}
      </div>
    </Modal>
  );
}

function FigureDialog({ files, onInsert, onUpload, onClose }) {
  const images = files.filter((p) => isImagePath(p) || isPdfPath(p) || /\.eps$/i.test(p));
  const [file, setFile] = useState(images[0] || '');
  const [caption, setCaption] = useState('');
  const [width, setWidth] = useState('0.8');
  const [placement, setPlacement] = useState('htbp');
  const insert = () => {
    const label = (caption || file.replace(/^.*\//, '').replace(/\.[^.]+$/, '') || 'figure').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    onInsert(`\\begin{figure}[${placement}]\n\t\\centering\n\t\\includegraphics[width=${width}\\linewidth]{${file || 'example-image'}}\n\t\\caption{${caption || 'Caption'}}\n\t\\label{fig:${label}}\n\\end{figure}\n`, 'graphicx');
    onClose();
  };
  return (
    <Modal title={t('Insert figure')} onClose={onClose} footer={<><button type="button" className="btn-outline" onClick={onClose}>{t('Cancel')}</button><button type="button" className="btn-primary" onClick={insert}>{t('Insert')}</button></>}>
      <div className="space-y-3">
        <label className="block"><span className="label">{t('Image file')}</span>
          <div className="flex gap-2">
            <select className="input" value={file} onChange={(e) => setFile(e.target.value)}>
              {images.length === 0 && <option value="">{t('No images in project (uses example-image)')}</option>}
              {images.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="button" className="btn-outline" onClick={async () => { const added = await onUpload(); if (added?.[0]) setFile(added[0]); }}>{t('Upload')}</button>
          </div>
        </label>
        <label className="block"><span className="label">{t('Caption')}</span><input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">{t('Width (fraction of line)')}</span>
            <select className="input" value={width} onChange={(e) => setWidth(e.target.value)}>
              {['0.25', '0.4', '0.5', '0.6', '0.8', '1'].map((w) => <option key={w} value={w}>{Math.round(Number(w) * 100)}%</option>)}
            </select>
          </label>
          <label><span className="label">{t('Placement')}</span>
            <select className="input" value={placement} onChange={(e) => setPlacement(e.target.value)}>
              <option value="htbp">{t('Automatic')} (htbp)</option>
              <option value="h">{t('Here')} (h)</option>
              <option value="t">{t('Top of page')} (t)</option>
              <option value="b">{t('Bottom of page')} (b)</option>
              <option value="p">{t('Separate page')} (p)</option>
              <option value="H">{t('Exactly here')} (H, float)</option>
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}

export default function FormatToolbar({ editor, files, onToggleSymbols, symbolsOpen, onEnsurePackage, onUploadImages, onProjectSearch }) {
  const [dialog, setDialog] = useState(null);
  const api = () => editor.current;
  const run = (fn) => () => {
    if (api()) fn(api());
  };
  const btn = (Icon, title, onClick, active) => (
    <button type="button" className={`btn-icon ${active ? 'btn-active' : ''}`} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      <Icon size={16} />
    </button>
  );
  const sep = <div className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;

  const insertBlock = (code, pkg) => {
    const ed = api();
    if (!ed) return;
    const { view } = ed;
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const prefix = line.text.trim() ? '\n' : '';
    ed.insert(prefix + code);
    if (pkg) onEnsurePackage(pkg);
  };

  const toggleComment = run((ed) => {
    const { view } = ed;
    const { state } = view;
    const changes = [];
    const lines = new Set();
    for (const r of state.selection.ranges) {
      for (let pos = r.from; pos <= r.to;) {
        const line = state.doc.lineAt(pos);
        lines.add(line.number);
        pos = line.to + 1;
      }
    }
    const all = [...lines].map((n) => state.doc.line(n));
    const commented = all.every((l) => /^\s*%/.test(l.text) || !l.text.trim());
    for (const l of all) {
      if (commented) {
        const m = /^(\s*)% ?/.exec(l.text);
        if (m) changes.push({ from: l.from + m[1].length, to: l.from + m[0].length });
      } else if (l.text.trim()) changes.push({ from: l.from, insert: '% ' });
    }
    view.dispatch({ changes });
    view.focus();
  });

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-900">
      {btn(Undo2, `${t('Undo')} (${mod}Z)`, run((ed) => { undo(ed.view); ed.focus(); }))}
      {btn(Redo2, `${t('Redo')} (${mod}Shift+Z)`, run((ed) => { redo(ed.view); ed.focus(); }))}
      {sep}
      <Dropdown className="btn-icon gap-0.5" title={t('Section heading')} button={<Heading size={16} />}>
        {SECTION_COMMANDS.map(([cmd, label]) => (
          <MenuItem key={cmd} onClick={run((ed) => ed.snippet(`\\${cmd}{\${sel}}`))}>{t(label)}</MenuItem>
        ))}
      </Dropdown>
      {btn(Bold, `${t('Bold')} (${mod}B)`, run((ed) => ed.wrap('\\textbf{', '}')))}
      {btn(Italic, `${t('Italic')} (${mod}I)`, run((ed) => ed.wrap('\\textit{', '}')))}
      {btn(Underline, t('Underline'), run((ed) => ed.wrap('\\underline{', '}')))}
      {btn(Code, t('Monospace'), run((ed) => ed.wrap('\\texttt{', '}')))}
      {sep}
      {btn(Sigma, t('Inline math'), run((ed) => ed.wrap('$', '$')))}
      {btn(SquareFunction, t('Display math'), run((ed) => ed.snippet('\\[\n\t${sel}\n\\]')))}
      {btn(Omega, t('Symbol palette'), onToggleSymbols, symbolsOpen)}
      {sep}
      {btn(List, t('Bulleted list'), run((ed) => ed.snippet('\\begin{itemize}\n\t\\item ${sel}\n\\end{itemize}')))}
      {btn(ListOrdered, t('Numbered list'), run((ed) => ed.snippet('\\begin{enumerate}\n\t\\item ${sel}\n\\end{enumerate}')))}
      {sep}
      {btn(Link2, t('Insert link'), run((ed) => { ed.snippet('\\href{${url}}{${sel}}'); onEnsurePackage('hyperref'); }))}
      {btn(Hash, t('Insert reference'), run((ed) => ed.snippet('\\ref{${}}')))}
      {btn(Quote, t('Insert citation'), run((ed) => ed.snippet('\\cite{${}}')))}
      {btn(Superscript, t('Footnote'), run((ed) => ed.snippet('\\footnote{${sel}}')))}
      {btn(BookMarked, t('Label'), run((ed) => ed.snippet('\\label{${}}')))}
      {sep}
      {btn(ImageIcon, t('Insert figure'), () => setDialog('figure'))}
      {btn(Table, t('Insert table'), () => setDialog('table'))}
      {sep}
      {btn(MessageSquareCode, `${t('Toggle comment')} (${mod}/)`, toggleComment)}
      {btn(Search, `${t('Find and replace')} (${mod}F)`, run((ed) => ed.openSearch()))}
      <button type="button" className="btn px-2 py-1 text-xs" onClick={onProjectSearch} title={`${t('Search in project')} (${mod}Shift+F)`}>{t('Search project')}</button>

      {dialog === 'table' && <TableDialog onClose={() => setDialog(null)} onInsert={insertBlock} />}
      {dialog === 'figure' && <FigureDialog files={files} onClose={() => setDialog(null)} onInsert={insertBlock} onUpload={onUploadImages} />}
    </div>
  );
}
