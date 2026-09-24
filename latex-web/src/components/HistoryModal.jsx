import { useEffect, useMemo, useState } from 'react';
import { Tag, RotateCcw, Trash2, Download, Plus, Clock } from 'lucide-react';
import { Modal, useDialogs, useToast } from './ui.jsx';
import { addSnapshot, deleteSnapshot, downloadBlob, listHistory, safeName, snapshotFiles, updateSnapshot } from '../lib/projects.js';
import { diffLines, diffStats } from '../lib/diff.js';
import { t } from '../lib/i18n.js';
import JSZip from 'jszip';

export default function HistoryModal({ project, onClose, onRestoreFiles }) {
  const [versions, setVersions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [onlyLabels, setOnlyLabels] = useState(false);
  const { prompt, confirm } = useDialogs();
  const toast = useToast();
  const current = useMemo(() => snapshotFiles(project), [project]);

  const refresh = async () => {
    const list = await listHistory(project.id);
    setVersions(list);
    return list;
  };

  useEffect(() => {
    listHistory(project.id).then((list) => {
      setVersions(list);
      if (list[0]) setSelected(list[0].id);
    });
  }, [project.id]);

  const version = versions?.find((v) => v.id === selected);
  const changedFiles = useMemo(() => {
    if (!version) return [];
    const paths = new Set([...Object.keys(version.files), ...Object.keys(current)]);
    return [...paths].sort().map((p) => {
      const a = version.files[p];
      const b = current[p];
      const status = a === undefined ? 'added' : b === undefined ? 'deleted' : a === b ? 'same' : 'changed';
      return { path: p, status, stats: status === 'changed' ? diffStats(diffLines(a, b)) : null };
    });
  }, [version, current]);

  // Default to the first changed file of the selected version.
  const file = selectedFile && changedFiles.some((f) => f.path === selectedFile)
    ? selectedFile
    : (changedFiles.find((f) => f.status !== 'same') || changedFiles[0])?.path || null;
  const setFile = setSelectedFile;

  const ops = useMemo(() => {
    if (!version || !file) return [];
    return diffLines(version.files[file] ?? '', current[file] ?? '');
  }, [version, file, current]);

  const saveNow = async () => {
    const label = await prompt({ title: t('Label this version'), label: t('Label'), value: '' });
    if (label === null) return;
    const snap = await addSnapshot(project, { label: label.trim(), auto: false });
    await refresh();
    setSelected(snap.id);
  };

  const label = async () => {
    const value = await prompt({ title: t('Label this version'), label: t('Label'), value: version.label || '' });
    if (value === null) return;
    await updateSnapshot({ ...version, label: value.trim() });
    refresh();
  };

  const remove = async () => {
    if (!await confirm({ title: t('Delete version?'), message: t('This version will be removed from the history.'), danger: true, confirmLabel: t('Delete') })) return;
    await deleteSnapshot(version.id);
    const list = await refresh();
    setSelected(list[0]?.id || null);
  };

  const restoreAll = async () => {
    if (!await confirm({ title: t('Restore this version?'), message: t('All text files will be replaced with this version. The current state is saved in the history first.'), confirmLabel: t('Restore') })) return;
    await addSnapshot(project, { label: t('Before restore'), auto: true });
    onRestoreFiles(version.files, true);
    toast(t('Version restored'), 'success');
    onClose();
  };

  const restoreFile = async () => {
    await addSnapshot(project, { label: t('Before restore'), auto: true });
    onRestoreFiles({ [file]: version.files[file] }, false);
    toast(t('Restored {file}', { file }), 'success');
    refresh();
  };

  const download = async () => {
    const zip = new JSZip();
    for (const [p, text] of Object.entries(version.files)) zip.file(p, text);
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeName(project.name)}-${new Date(version.time).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.zip`);
  };

  const shown = (versions || []).filter((v) => !onlyLabels || v.label);

  return (
    <Modal title={t('History')} onClose={onClose} width="max-w-6xl" bodyClass="p-0">
      <div className="flex h-[75vh] min-h-0 flex-col md:flex-row">
        <div className="flex max-h-48 w-full shrink-0 flex-col border-b border-slate-200 md:max-h-none md:w-72 md:border-b-0 md:border-r dark:border-slate-700">
          <div className="flex items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-700">
            <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={saveNow}><Plus size={14} />{t('Label current version')}</button>
            <label className="ml-auto flex items-center gap-1 text-xs"><input type="checkbox" checked={onlyLabels} onChange={(e) => setOnlyLabels(e.target.checked)} />{t('Labelled only')}</label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {versions === null && <p className="p-4 text-sm text-slate-400">{t('Loading…')}</p>}
            {versions && shown.length === 0 && <p className="p-4 text-sm text-slate-400">{t('No versions yet. Versions are saved automatically when you compile.')}</p>}
            {shown.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelected(v.id)}
                className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm dark:border-slate-800 ${v.id === selected ? 'bg-brand-50 dark:bg-brand-700/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-400" />
                  <span className="font-medium">{new Date(v.time).toLocaleString()}</span>
                </div>
                {v.label && <div className="mt-1 inline-flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-700/40 dark:text-brand-100"><Tag size={11} />{v.label}</div>}
                <div className="text-xs text-slate-500">{t('{n} files', { n: Object.keys(v.files).length })}{v.auto ? ` · ${t('automatic')}` : ''}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {version ? (
            <>
              <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
                <select className="input h-8 w-auto max-w-xs py-0 text-xs" value={file || ''} onChange={(e) => setFile(e.target.value)}>
                  {changedFiles.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path} {f.status === 'same' ? '' : f.status === 'changed' ? `(+${f.stats.added} −${f.stats.removed})` : `(${t(f.status)})`}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">{t('Changes from this version to the current state')}</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={restoreFile} disabled={!version.files[file] && version.files[file] !== ''}><RotateCcw size={13} />{t('Restore file')}</button>
                  <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={restoreAll}><RotateCcw size={13} />{t('Restore version')}</button>
                  <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={label}><Tag size={13} />{t('Label')}</button>
                  <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={download}><Download size={13} />.zip</button>
                  <button type="button" className="btn-outline px-2 py-1 text-xs text-red-600" onClick={remove}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-5">
                {ops.every((o) => o.type === 'same') && <div className="p-3 font-sans text-sm text-slate-500">{t('No changes in this file.')}</div>}
                {ops.map((o, i) => (
                  <div key={i} className={`whitespace-pre-wrap break-all px-3 ${o.type === 'add' ? 'diff-add' : o.type === 'del' ? 'diff-del' : ''}`}>
                    <span className="mr-2 inline-block w-3 select-none text-slate-400">{o.type === 'add' ? '+' : o.type === 'del' ? '−' : ' '}</span>
                    {o.text || ' '}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">{t('Select a version')}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
