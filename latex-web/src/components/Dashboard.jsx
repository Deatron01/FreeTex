import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Upload, Search, FileText, Copy, Download, Trash2, RotateCcw, Pencil, Settings, FolderOpen, ArrowUpDown, LayoutTemplate, Trash, HelpCircle,
} from 'lucide-react';
import Logo from './Logo.jsx';
import SettingsModal from './SettingsModal.jsx';
import HelpModal from './HelpModal.jsx';
import { Dropdown, MenuItem, MenuSeparator, Modal, useDialogs, useToast } from './ui.jsx';
import {
  createFromTemplate, deleteProject, downloadBlob, duplicateProject, getProject, importFiles, importZip, listProjects, projectToZip,
  renameProject, safeName, setTrashed,
} from '../lib/projects.js';
import { TEMPLATES } from '../lib/templates.js';
import { t } from '../lib/i18n.js';
import { navigate } from '../lib/router.js';

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  if (s < 86400 * 30) return t('{n} days ago', { n: Math.round(s / 86400) });
  return new Date(ts).toLocaleDateString();
}

export default function Dashboard() {
  const [projects, setProjects] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'updated', dir: -1 });
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const zipInput = useRef(null);
  const filesInput = useRef(null);
  const { prompt, confirm } = useDialogs();
  const toast = useToast();

  const refresh = useCallback(async () => setProjects(await listProjects()), []);
  useEffect(() => {
    listProjects().then(setProjects);
    document.title = 'FreeTex – Projects';
  }, []);

  const visible = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (filter === 'trash' ? p.trashed : !p.trashed))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => (sort.key === 'name' ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key]) * sort.dir);
  }, [projects, filter, query, sort]);

  const create = async (templateId) => {
    const tpl = TEMPLATES.find((x) => x.id === templateId);
    const name = await prompt({ title: t('New project'), label: t('Project name'), value: t(tpl?.name || 'Untitled'), validate: (v) => (!v.trim() ? t('Name is required') : '') });
    if (!name) return;
    const p = await createFromTemplate(templateId, name.trim());
    navigate(`#/project/${p.id}`);
  };

  const handleImport = async (fileList) => {
    const files = [...fileList];
    if (!files.length) return;
    try {
      let project;
      if (files.length === 1 && /\.zip$/i.test(files[0].name)) project = await importZip(files[0]);
      else project = await importFiles(files);
      toast(t('Imported "{name}"', { name: project.name }), 'success');
      navigate(`#/project/${project.id}`);
    } catch (e) {
      toast(t('Import failed: {msg}', { msg: e.message }), 'error');
    }
  };

  const rename = async (p) => {
    const name = await prompt({ title: t('Rename project'), label: t('Project name'), value: p.name, validate: (v) => (!v.trim() ? t('Name is required') : '') });
    if (!name) return;
    await renameProject(p.id, name.trim());
    refresh();
  };

  const duplicate = async (p) => {
    const name = await prompt({ title: t('Copy project'), label: t('Project name'), value: t('{name} (copy)', { name: p.name }) });
    if (!name) return;
    await duplicateProject(p.id, name.trim());
    refresh();
  };

  const download = async (p) => {
    const full = await getProject(p.id);
    downloadBlob(await projectToZip(full), `${safeName(p.name)}.zip`);
  };

  const remove = async (p) => {
    if (!await confirm({ title: t('Delete forever?'), message: t('"{name}" and its history will be permanently deleted. This cannot be undone.', { name: p.name }), danger: true, confirmLabel: t('Delete') })) return;
    await deleteProject(p.id);
    refresh();
  };

  const emptyTrash = async () => {
    const trashed = projects.filter((p) => p.trashed);
    if (!trashed.length || !await confirm({ title: t('Empty trash?'), message: t('{n} projects will be permanently deleted.', { n: trashed.length }), danger: true, confirmLabel: t('Delete') })) return;
    await Promise.all(trashed.map((p) => deleteProject(p.id)));
    refresh();
  };

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'name' ? 1 : -1 }));

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleImport(e.dataTransfer.files);
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <Logo />
        <div className="flex items-center gap-1">
          <button type="button" className="btn" onClick={() => setShowHelp(true)}><HelpCircle size={16} />{t('Help')}</button>
          <button type="button" className="btn" onClick={() => setShowSettings(true)}><Settings size={16} />{t('Settings')}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3 md:flex dark:border-slate-800 dark:bg-slate-900">
          <Dropdown className="btn-primary mb-3 w-full py-2" button={<><Plus size={16} />{t('New project')}</>}>
            <MenuItem icon={FileText} onClick={() => create('blank')}>{t('Blank project')}</MenuItem>
            <MenuItem icon={FileText} onClick={() => create('example')}>{t('Example project')}</MenuItem>
            <MenuItem icon={Upload} onClick={() => zipInput.current.click()}>{t('Upload project (.zip)')}</MenuItem>
            <MenuItem icon={FolderOpen} onClick={() => filesInput.current.click()}>{t('Upload files')}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={LayoutTemplate} onClick={() => setShowTemplates(true)}>{t('Templates…')}</MenuItem>
          </Dropdown>
          <button type="button" className={`btn justify-start ${filter === 'all' ? 'btn-active' : ''}`} onClick={() => setFilter('all')}><FolderOpen size={16} />{t('All projects')}</button>
          <button type="button" className={`btn justify-start ${filter === 'trash' ? 'btn-active' : ''}`} onClick={() => setFilter('trash')}><Trash2 size={16} />{t('Trashed projects')}</button>
          <div className="mt-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {t('Projects are stored in this browser. Download a .zip to back them up or move them to another computer.')}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h1 className="mr-auto text-2xl font-semibold">{filter === 'trash' ? t('Trashed projects') : t('All projects')}</h1>
              <div className="md:hidden">
                <Dropdown className="btn-primary" button={<><Plus size={16} />{t('New')}</>} align="right">
                  <MenuItem icon={FileText} onClick={() => create('blank')}>{t('Blank project')}</MenuItem>
                  <MenuItem icon={FileText} onClick={() => create('example')}>{t('Example project')}</MenuItem>
                  <MenuItem icon={Upload} onClick={() => zipInput.current.click()}>{t('Upload project (.zip)')}</MenuItem>
                  <MenuItem icon={LayoutTemplate} onClick={() => setShowTemplates(true)}>{t('Templates…')}</MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={Trash2} onClick={() => setFilter(filter === 'trash' ? 'all' : 'trash')}>{filter === 'trash' ? t('All projects') : t('Trashed projects')}</MenuItem>
                </Dropdown>
              </div>
              {filter === 'trash' && visible.length > 0 && <button type="button" className="btn-outline" onClick={emptyTrash}><Trash size={15} />{t('Empty trash')}</button>}
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input className="input pl-8" placeholder={t('Search projects…')} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[1fr_160px_auto] dark:border-slate-800">
                <button type="button" className="flex items-center gap-1 text-left" onClick={() => toggleSort('name')}>{t('Title')}<ArrowUpDown size={12} /></button>
                <button type="button" className="hidden items-center gap-1 text-left sm:flex" onClick={() => toggleSort('updated')}>{t('Last modified')}<ArrowUpDown size={12} /></button>
                <span className="w-40 text-right">{t('Actions')}</span>
              </div>
              {projects === null && <div className="p-8 text-center text-slate-400">{t('Loading…')}</div>}
              {projects && visible.length === 0 && (
                <div className="flex flex-col items-center gap-3 p-12 text-center text-slate-500">
                  <FileText size={40} className="text-slate-300" />
                  {filter === 'trash' ? t('The trash is empty.') : query ? t('No projects match your search.') : (
                    <>
                      <p>{t('You have no projects yet.')}</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <button type="button" className="btn-primary" onClick={() => create('example')}><Plus size={16} />{t('Create example project')}</button>
                        <button type="button" className="btn-outline" onClick={() => setShowTemplates(true)}><LayoutTemplate size={16} />{t('Browse templates')}</button>
                        <button type="button" className="btn-outline" onClick={() => zipInput.current.click()}><Upload size={16} />{t('Upload .zip')}</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {visible.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50 sm:grid-cols-[1fr_160px_auto] dark:border-slate-800 dark:hover:bg-slate-800/50">
                  {p.trashed ? (
                    <span className="truncate font-medium text-slate-500">{p.name}</span>
                  ) : (
                    <a href={`#/project/${p.id}`} className="truncate font-medium text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100">{p.name}</a>
                  )}
                  <span className="hidden text-sm text-slate-500 sm:block" title={new Date(p.updated).toLocaleString()}>{timeAgo(p.updated)}</span>
                  <div className="flex w-40 justify-end gap-0.5">
                    {p.trashed ? (
                      <>
                        <button type="button" className="btn-icon" title={t('Restore')} onClick={async () => { await setTrashed(p.id, false); refresh(); }}><RotateCcw size={16} /></button>
                        <button type="button" className="btn-icon text-red-600" title={t('Delete forever')} onClick={() => remove(p)}><Trash2 size={16} /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-icon" title={t('Rename')} onClick={() => rename(p)}><Pencil size={16} /></button>
                        <button type="button" className="btn-icon" title={t('Copy')} onClick={() => duplicate(p)}><Copy size={16} /></button>
                        <button type="button" className="btn-icon" title={t('Download .zip')} onClick={() => download(p)}><Download size={16} /></button>
                        <button type="button" className="btn-icon" title={t('Move to trash')} onClick={async () => { await setTrashed(p.id, true); refresh(); }}><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">{t('Tip: drop a .zip file or LaTeX files anywhere on this page to import them.')}</p>
          </div>
        </main>
      </div>

      <input ref={zipInput} type="file" accept=".zip" className="hidden" onChange={(e) => { handleImport(e.target.files); e.target.value = ''; }} />
      <input ref={filesInput} type="file" multiple className="hidden" onChange={(e) => { handleImport(e.target.files); e.target.value = ''; }} />

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand-600/20">
          <div className="rounded-xl bg-white px-8 py-6 text-lg font-semibold shadow-xl dark:bg-slate-800">{t('Drop to import project')}</div>
        </div>
      )}

      {showTemplates && (
        <Modal title={t('Templates')} onClose={() => setShowTemplates(false)} width="max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-brand-500 hover:shadow-md dark:border-slate-700"
                onClick={() => {
                  setShowTemplates(false);
                  create(tpl.id);
                }}
              >
                <div className="font-semibold">{t(tpl.name)}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(tpl.description)}</div>
                <div className="mt-2 text-xs text-slate-400">{Object.keys(tpl.files).join(', ')}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
