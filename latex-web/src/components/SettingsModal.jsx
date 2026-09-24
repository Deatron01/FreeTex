import { useEffect, useState } from 'react';
import { Code2, Cog, FileText, Palette, FolderCog, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Modal, Select, Toggle, Spinner } from './ui.jsx';
import { useSettings } from '../lib/settings.jsx';
import { LANGUAGES, t } from '../lib/i18n.js';
import { ENGINES, checkServer, clearHealthCache } from '../lib/compile.js';
import { isTexPath } from '../lib/paths.js';

function ServerStatus({ url }) {
  const [state, setState] = useState({ loading: true, info: null });
  const test = async () => {
    setState({ loading: true, info: null });
    clearHealthCache();
    const info = await checkServer((url || '').replace(/\/$/, ''));
    setState({ loading: false, info });
  };
  useEffect(() => {
    let alive = true;
    checkServer((url || '').replace(/\/$/, '')).then((info) => alive && setState({ loading: false, info }));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900">
      {state.loading ? <Spinner className="mt-0.5" /> : state.info ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-500" /> : <XCircle size={18} className="mt-0.5 text-slate-400" />}
      <div className="flex-1">
        {state.loading && t('Checking compile server…')}
        {!state.loading && state.info && !(state.info.tex ?? true) && (
          <>
            <div className="font-medium">{t('Compile server connected, but no TeX installation found')}</div>
            <div className="text-xs text-slate-500">{t('Projects are compiled on texlive.net through the server. Install TeX Live or MiKTeX and restart for offline compiling, SyncTeX and binary files.')}</div>
          </>
        )}
        {!state.loading && state.info && (state.info.tex ?? true) && (
          <>
            <div className="font-medium">{t('Local compile server connected')}</div>
            <div className="text-xs text-slate-500">
              {t('Available')}: {Object.entries(state.info.tools || {}).filter(([, v]) => v).map(([k]) => k).join(', ')}
            </div>
          </>
        )}
        {!state.loading && !state.info && (
          <>
            <div className="font-medium">{t('No local compile server found')}</div>
            <div className="text-xs text-slate-500">{t('Projects are compiled on texlive.net. Run "npm run server" (requires TeX Live) for faster builds, SyncTeX, binary files and folders.')}</div>
          </>
        )}
      </div>
      <button type="button" className="btn-icon" title={t('Test connection')} onClick={test}><RefreshCw size={15} /></button>
    </div>
  );
}

export default function SettingsModal({ onClose, project, onProjectChange, initialTab }) {
  const { settings, update, reset } = useSettings();
  const [tab, setTab] = useState(initialTab || (project ? 'project' : 'editor'));
  const tabs = [
    ...(project ? [{ id: 'project', label: t('Project'), icon: FolderCog }] : []),
    { id: 'editor', label: t('Editor'), icon: Code2 },
    { id: 'compiler', label: t('Compiler'), icon: Cog },
    { id: 'pdf', label: t('PDF viewer'), icon: FileText },
    { id: 'appearance', label: t('Appearance'), icon: Palette },
  ];
  const s = settings;
  const setCompiler = (patch) => onProjectChange({ compiler: { ...project.compiler, ...patch } });

  return (
    <Modal title={t('Settings')} onClose={onClose} width="max-w-3xl" bodyClass="p-0">
      <div className="flex min-h-[460px] flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r dark:border-slate-700">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`btn justify-start ${tab === id ? 'btn-active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 divide-y divide-slate-100 px-5 py-3 dark:divide-slate-700/60">
          {tab === 'project' && project && (
            <>
              <label className="block py-2">
                <span className="mb-1 block text-sm font-medium">{t('Project name')}</span>
                <input className="input" value={project.name} onChange={(e) => onProjectChange({ name: e.target.value })} />
              </label>
              <Select
                label={t('Main document')}
                description={t('The file that is compiled.')}
                value={project.mainFile}
                onChange={(v) => onProjectChange({ mainFile: v })}
                options={[{ value: '', label: '—' }, ...Object.keys(project.files).filter(isTexPath).sort().map((p) => ({ value: p, label: p }))]}
              />
              <Select
                label={t('Compiler')}
                description={t('Can be overridden with a "% !TeX program = xelatex" comment.')}
                value={project.compiler.engine}
                onChange={(v) => setCompiler({ engine: v })}
                options={ENGINES.map((e) => ({ value: e.id, label: e.name }))}
              />
              <Select
                label={t('Bibliography tool')}
                value={project.compiler.bibTool}
                onChange={(v) => setCompiler({ bibTool: v })}
                options={[
                  { value: 'auto', label: t('Automatic') },
                  { value: 'bibtex', label: 'BibTeX' },
                  { value: 'biber', label: 'Biber' },
                  { value: 'bibtex8', label: 'BibTeX8' },
                  { value: 'none', label: t('None') },
                ]}
              />
              <Toggle label={t('Run makeindex')} description={t('Needed for \\makeindex / \\printindex.')} checked={project.compiler.makeindex} onChange={(v) => setCompiler({ makeindex: v })} />
              <Toggle label={t('Run makeglossaries')} description={t('Needed for the glossaries package.')} checked={project.compiler.makeglossaries} onChange={(v) => setCompiler({ makeglossaries: v })} />
              <Toggle label={t('Enable shell escape')} description={t('Allows packages like minted. Only on a local compile server started with FREETEX_ALLOW_SHELL_ESCAPE=1.')} checked={project.compiler.shellEscape} onChange={(v) => setCompiler({ shellEscape: v })} />
            </>
          )}

          {tab === 'editor' && (
            <>
              <Select label={t('Editor theme')} value={s.editorTheme} onChange={(v) => update({ editorTheme: v })} options={[
                { value: 'auto', label: t('Follow app theme') }, { value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark (One Dark)') },
              ]} />
              <Select label={t('Font size')} value={String(s.fontSize)} onChange={(v) => update({ fontSize: Number(v) })} options={[10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map((n) => ({ value: String(n), label: `${n}px` }))} />
              <Select label={t('Font family')} value={s.fontFamily} onChange={(v) => update({ fontFamily: v })} options={[
                { value: 'default', label: t('System monospace') }, { value: 'jetbrains', label: 'JetBrains Mono' }, { value: 'fira', label: 'Fira Code' },
                { value: 'source', label: 'Source Code Pro' }, { value: 'courier', label: 'Courier New' }, { value: 'sans', label: t('Sans-serif') },
              ]} />
              <Select label={t('Line height')} value={s.lineHeight} onChange={(v) => update({ lineHeight: v })} options={[
                { value: 'compact', label: t('Compact') }, { value: 'normal', label: t('Normal') }, { value: 'wide', label: t('Wide') },
              ]} />
              <Select label={t('Keybindings')} value={s.keybindings} onChange={(v) => update({ keybindings: v })} options={[
                { value: 'default', label: t('Default') }, { value: 'vim', label: 'Vim' }, { value: 'emacs', label: 'Emacs' },
              ]} />
              <Select label={t('Indentation')} value={s.indentWithTabs ? 'tab' : String(s.tabSize)} onChange={(v) => update(v === 'tab' ? { indentWithTabs: true } : { indentWithTabs: false, tabSize: Number(v) })} options={[
                { value: '2', label: t('2 spaces') }, { value: '4', label: t('4 spaces') }, { value: 'tab', label: t('Tabs') },
              ]} />
              <Toggle label={t('Auto-complete')} description={t('Suggest commands, environments, labels, citations and files.')} checked={s.autoComplete} onChange={(v) => update({ autoComplete: v })} />
              <Toggle label={t('Auto-close brackets')} checked={s.autoCloseBrackets} onChange={(v) => update({ autoCloseBrackets: v })} />
              <Toggle label={t('Highlight matching brackets')} checked={s.matchBrackets} onChange={(v) => update({ matchBrackets: v })} />
              <Toggle label={t('Line wrapping')} checked={s.lineWrapping} onChange={(v) => update({ lineWrapping: v })} />
              <Toggle label={t('Line numbers')} checked={s.lineNumbers} onChange={(v) => update({ lineNumbers: v })} />
              <Toggle label={t('Highlight active line')} checked={s.highlightActiveLine} onChange={(v) => update({ highlightActiveLine: v })} />
              <Toggle label={t('Code folding')} checked={s.foldGutter} onChange={(v) => update({ foldGutter: v })} />
              <Toggle label={t('Spell check')} description={t('Uses the spell checker of your browser.')} checked={s.spellCheck} onChange={(v) => update({ spellCheck: v })} />
            </>
          )}

          {tab === 'compiler' && (
            <>
              <Select label={t('Compile backend')} value={s.compileBackend} onChange={(v) => update({ compileBackend: v })} options={[
                { value: 'auto', label: t('Automatic') }, { value: 'server', label: t('Local compile server') }, { value: 'texlivenet', label: 'texlive.net' },
              ]} description={t('Automatic uses the local server when it is running, otherwise texlive.net.')} />
              <label className="block py-2">
                <span className="block text-sm font-medium">{t('Compile server URL')}</span>
                <span className="mb-1 block text-xs text-slate-500">{t('Leave empty to use the server this page is served from (or the Vite dev proxy).')}</span>
                <input className="input" placeholder="http://localhost:3001" value={s.serverUrl} onChange={(e) => update({ serverUrl: e.target.value.trim() })} />
                <ServerStatus url={s.serverUrl} />
              </label>
              <label className="block py-2">
                <span className="block text-sm font-medium">{t('texlive.net compatible URL')}</span>
                <span className="mb-1 block text-xs text-slate-500">{t('Used when compiling without a local server. Any latexcgi server works.')}</span>
                <input className="input" placeholder="https://texlive.net/cgi-bin/latexcgi" value={s.texliveNetUrl} onChange={(e) => update({ texliveNetUrl: e.target.value.trim() })} />
              </label>
              <Toggle label={t('Auto compile')} description={t('Recompile automatically after you stop typing.')} checked={s.autoCompile} onChange={(v) => update({ autoCompile: v })} />
              <Select label={t('Auto compile delay')} value={String(s.autoCompileDelay)} onChange={(v) => update({ autoCompileDelay: Number(v) })} options={[1000, 1500, 2500, 4000, 6000].map((n) => ({ value: String(n), label: `${n / 1000} s` }))} />
              <Toggle label={t('Compile on save (Ctrl+S)')} checked={s.compileOnSave} onChange={(v) => update({ compileOnSave: v })} />
              <Toggle label={t('Stop on first error')} description={t('Local server only. Otherwise LaTeX tries to produce a PDF despite errors.')} checked={s.stopOnFirstError} onChange={(v) => update({ stopOnFirstError: v })} />
            </>
          )}

          {tab === 'pdf' && (
            <>
              <Select label={t('PDF viewer')} value={s.pdfViewer} onChange={(v) => update({ pdfViewer: v })} options={[
                { value: 'builtin', label: t('Built-in (PDF.js)') }, { value: 'native', label: t('Browser') },
              ]} description={t('The built-in viewer supports SyncTeX, zoom memory and dark mode.')} />
              <Toggle label={t('Dark mode PDF')} description={t('Invert PDF colours in the built-in viewer.')} checked={s.pdfDarkMode} onChange={(v) => update({ pdfDarkMode: v })} />
            </>
          )}

          {tab === 'appearance' && (
            <>
              <Select label={t('Theme')} value={s.uiTheme} onChange={(v) => update({ uiTheme: v })} options={[
                { value: 'system', label: t('System') }, { value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') },
              ]} />
              <Select label={t('Language')} value={s.language} onChange={(v) => update({ language: v })} options={[
                { value: 'auto', label: t('Automatic') }, ...LANGUAGES.map((l) => ({ value: l.id, label: l.name })),
              ]} />
              <Toggle label={t('Show symbol palette')} checked={s.showSymbolPalette} onChange={(v) => update({ showSymbolPalette: v })} />
              <div className="py-3">
                <button type="button" className="btn-outline" onClick={reset}>{t('Reset all settings')}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
