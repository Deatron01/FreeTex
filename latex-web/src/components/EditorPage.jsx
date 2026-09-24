import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, Play, Square, ChevronDown, Menu as MenuIcon, Download, FileArchive, History, Settings, HelpCircle, BarChart3, FilePlus, FolderPlus,
  Upload, PanelLeftClose, PanelLeftOpen, Columns2, FileCode2, FileText, AlertCircle, ScrollText, Check, Loader2, ArrowRightLeft, Copy,
  ListTree, ChevronRight, Keyboard,
} from 'lucide-react';
import CodeEditor from './CodeEditor.jsx';
import FileTree from './FileTree.jsx';
import Outline from './Outline.jsx';
import PdfViewer from './PdfViewer.jsx';
import LogPanel from './LogPanel.jsx';
import FormatToolbar from './FormatToolbar.jsx';
import SymbolPalette from './SymbolPalette.jsx';
import SettingsModal from './SettingsModal.jsx';
import HistoryModal from './HistoryModal.jsx';
import WordCountModal from './WordCountModal.jsx';
import HelpModal from './HelpModal.jsx';
import ProjectSearch from './ProjectSearch.jsx';
import FileViewer from './FileViewer.jsx';
import Logo from './Logo.jsx';
import { Dropdown, MenuItem, MenuLabel, MenuSeparator, Resizer, Spinner, useDialogs, useToast } from './ui.jsx';
import { useSettings } from '../lib/settings.jsx';
import {
  addSnapshot, allFolders, downloadBlob, duplicateProject, getProject, listHistory, projectToZip, safeName, sameSnapshot, saveProject, snapshotFiles,
} from '../lib/projects.js';
import {
  CompileError, ENGINES, clearServerCache, compileProject, effectiveCompiler, fetchServerOutput, fetchTexliveNetLog, resolveBackend,
  submitTexliveNetForm, synctexEdit, synctexView,
} from '../lib/compile.js';
import { parseLog, summarize } from '../lib/logParser.js';
import { buildIndex, buildOutline } from '../lib/projectIndex.js';
import { findPdfTextInSources, findSourceInPdf } from '../lib/textSync.js';
import {
  basename, dirname, isImagePath, isTextPath, isValidName, joinPath, languageFor, mimeFor, normalizePath, stripExt,
} from '../lib/paths.js';
import { navigate } from '../lib/router.js';
import { t } from '../lib/i18n.js';

const LAYOUT_KEY = 'freetex.layout.v1';
const IFRAME_NAME = 'freetex-texlivenet-frame';

function loadLayout() {
  const narrow = window.innerWidth < 768;
  const defaults = { sidebar: !narrow, sidebarWidth: 230, split: 0.5, view: 'split', outlineHeight: 220, outlineOpen: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'), ...(narrow ? { sidebar: false } : {}) };
  } catch {
    return defaults;
  }
}

export default function EditorPage({ projectId }) {
  const { settings, update: updateSettings, dark } = useSettings();
  const { prompt, confirm } = useDialogs();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const projectRef = useRef(null);
  const [activePath, setActivePath] = useState(null);
  const [externalVersions, setExternalVersions] = useState({});
  const [contentVersion, setContentVersion] = useState(0);
  const [cursor, setCursor] = useState({ line: 1, column: 0 });
  const [saveState, setSaveState] = useState('saved');
  const [layout, setLayout] = useState(loadLayout);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 768);
  const [modal, setModal] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState('pdf');

  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [iframeMode, setIframeMode] = useState(() => sessionStorage.getItem('freetex.iframeMode') === '1');
  const [iframeUsed, setIframeUsed] = useState(false);
  const [syncTarget, setSyncTarget] = useState(null);
  const [fetchingLog, setFetchingLog] = useState(false);

  const editorRef = useRef(null);
  const uploadRef = useRef(null);
  const uploadDirRef = useRef('');
  const uploadResolveRef = useRef(null);
  const saveTimer = useRef(null);
  const bumpTimer = useRef(null);
  const autoTimer = useRef(null);
  const abortRef = useRef(null);
  const pendingJump = useRef(null);
  const compilingRef = useRef(false);
  const cursorTimer = useRef(null);
  const onCursor = useCallback((c) => {
    clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(c), 120);
  }, []);
  const queuedCompile = useRef(false);

  // ---------- load ----------
  useEffect(() => {
    let alive = true;
    getProject(projectId).then((p) => {
      if (!alive) return;
      if (!p) {
        setNotFound(true);
        return;
      }
      projectRef.current = p;
      setProject(p);
      let last = null;
      try {
        last = localStorage.getItem(`freetex.open.${p.id}`);
      } catch { /* ignore */ }
      setActivePath(last && p.files[last] ? last : p.mainFile && p.files[p.mainFile] ? p.mainFile : Object.keys(p.files).find(isTextPath) || null);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (project) document.title = `${project.name} – FreeTex`;
  }, [project]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch { /* ignore */ }
  }, [layout]);

  useEffect(() => {
    if (activePath && project) {
      try {
        localStorage.setItem(`freetex.open.${project.id}`, activePath);
      } catch { /* ignore */ }
    }
  }, [activePath, project]);

  // ---------- saving ----------
  const saveNow = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const p = projectRef.current;
    if (!p) return;
    setSaveState('saving');
    try {
      p.updated = Date.now();
      await saveProject(p);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      toast(t('Could not save: {msg}', { msg: e.message }), 'error');
    }
  }, [toast]);

  const scheduleSave = useCallback(() => {
    setSaveState('dirty');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 700);
  }, [saveNow]);

  useEffect(() => {
    const flush = () => {
      if (projectRef.current) saveProject(projectRef.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      clearTimeout(saveTimer.current);
      clearTimeout(bumpTimer.current);
      clearTimeout(autoTimer.current);
      flush();
    };
  }, []);

  // Replace the project object (structure/meta changes) and persist.
  const commit = useCallback((patch) => {
    const next = { ...projectRef.current, ...patch };
    projectRef.current = next;
    setProject(next);
    scheduleSave();
    setContentVersion((v) => v + 1);
    return next;
  }, [scheduleSave]);

  // ---------- derived data ----------
  // Text edits mutate project.files in place, so contentVersion signals content changes.
  const index = useMemo(() => {
    if (!project) return null;
    const idx = buildIndex(project);
    idx.files = Object.keys(project.files);
    return idx;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, contentVersion]);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  const getIndex = useCallback(() => indexRef.current, []);

  const outline = useMemo(() => (project ? buildOutline(project.files, project.mainFile) : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, contentVersion]);

  // ---------- compile ----------
  const applyResult = useCallback((res) => {
    const p = projectRef.current;
    const fileMap = res.fileMap;
    const mapFile = (f) => {
      const clean = f.replace(/^\.\//, '');
      if (fileMap && fileMap.has(clean)) return fileMap.get(clean);
      return clean;
    };
    const entries = parseLog(res.log, {
      isProjectFile: (f) => !!(p.files[f] || (fileMap && fileMap.has(f))),
      mapFile,
    }).map((e) => ({ ...e, projectFile: !!(e.file && p.files[e.file]) }));
    setLogEntries(entries);
    setResult(res);
    if (res.pdf) setPdfData(res.pdf);
    return entries;
  }, []);

  const compile = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return;
    if (compilingRef.current) {
      queuedCompile.current = true;
      return;
    }
    clearTimeout(autoTimer.current);
    compilingRef.current = true;
    setCompiling(true);
    const controller = new AbortController();
    abortRef.current = controller;
    await saveNow();
    const warnings = [];
    // Fallback: post a classic form into an iframe (the response cannot be read by scripts).
    const submitToIframe = async () => {
      setIframeUsed(true);
      setRightPanel('pdf');
      setLayout((l) => (l.view === 'editor' ? { ...l, view: 'split' } : l));
      setResult({ backend: 'texlivenet', status: 'iframe', log: '', compiler: effectiveCompiler(p) });
      await new Promise((r) => setTimeout(r, 80)); // let the iframe mount
      await submitTexliveNetForm(p, effectiveCompiler(p), IFRAME_NAME, (w) => warnings.push(w), settings.texliveNetUrl);
      // The iframe's load event ends the "compiling" state; this is a safety net.
      setTimeout(() => {
        compilingRef.current = false;
        setCompiling(false);
      }, 60000);
    };
    let usedIframe = false;
    try {
      if (iframeMode && settings.compileBackend !== 'server') {
        const { backend, info } = await resolveBackend(settings);
        if (backend === 'texlivenet' && !info?.texliveNetProxy) {
          usedIframe = true;
          await submitToIframe();
          return;
        }
      }
      const res = await compileProject(p, settings, { signal: controller.signal, onWarning: (w) => warnings.push(w) });
      setIframeUsed(false);
      const entries = applyResult(res);
      const s = summarize(entries);
      if (!res.pdf) {
        setRightPanel('logs');
        toast(s.errors ? t('Compilation failed with {n} errors.', { n: s.errors }) : t('Compilation failed. See the logs.'), 'error');
      } else if (s.errors) {
        toast(t('PDF produced with {n} errors.', { n: s.errors }), 'warning', 3000);
      }
      // Automatic history snapshot (at most every 5 minutes, only when something changed).
      listHistory(p.id).then(async (versions) => {
        const last = versions[0];
        const files = snapshotFiles(p);
        if (!last || (Date.now() - last.time > 5 * 60 * 1000 && !sameSnapshot(last.files, files))) await addSnapshot(p, { auto: true });
      }).catch(() => {});
    } catch (e) {
      if (e.name === 'AbortError') {
        toast(t('Compilation stopped.'), 'info', 2000);
      } else if (e instanceof CompileError && e.cors) {
        // The browser blocked the texlive.net response: fall back to a form post into an iframe.
        sessionStorage.setItem('freetex.iframeMode', '1');
        setIframeMode(true);
        usedIframe = true;
        await submitToIframe();
      } else {
        toast(e.message, 'error', 8000);
        setResult((r) => r || null);
      }
    } finally {
      if (warnings.length) toast([...new Set(warnings)].join('\n'), 'warning', 8000);
      if (!usedIframe) {
        compilingRef.current = false;
        setCompiling(false);
      }
      abortRef.current = null;
      if (queuedCompile.current) {
        queuedCompile.current = false;
        setTimeout(() => compileRef.current(), 50);
      }
    }
  }, [settings, saveNow, applyResult, toast, iframeMode]);
  const compileRef = useRef(compile);
  useEffect(() => {
    compileRef.current = compile;
  }, [compile]);

  const stopCompile = () => abortRef.current?.abort();

  // Compile once when the project is opened.
  const openedRef = useRef(false);
  useEffect(() => {
    if (project && !openedRef.current) {
      openedRef.current = true;
      if (project.mainFile) setTimeout(() => compileRef.current(), 300);
    }
  }, [project]);

  // PDF blob URL for the browser's native viewer.
  const pdfUrl = useMemo(
    () => (pdfData && settings.pdfViewer === 'native' ? URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' })) : null),
    [pdfData, settings.pdfViewer],
  );
  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

  // ---------- editing ----------
  const onChange = useCallback((path, text) => {
    const p = projectRef.current;
    if (!p || !p.files[path]) return;
    p.files[path] = { kind: 'text', text };
    scheduleSave();
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => setContentVersion((v) => v + 1), 400);
    if (settings.autoCompile) {
      clearTimeout(autoTimer.current);
      autoTimer.current = setTimeout(() => compileRef.current(), settings.autoCompileDelay || 2500);
    }
  }, [scheduleSave, settings.autoCompile, settings.autoCompileDelay]);

  // Change a file's text from outside the editor.
  const setFileText = useCallback((path, text) => {
    const p = projectRef.current;
    p.files[path] = { kind: 'text', text };
    if (path !== activePath) editorRef.current?.dropCache(path);
    setExternalVersions((v) => ({ ...v, [path]: (v[path] || 0) + 1 }));
    scheduleSave();
    setContentVersion((v) => v + 1);
  }, [activePath, scheduleSave]);

  const openFile = useCallback((path, line, column) => {
    if (!projectRef.current?.files[path]) return;
    if (line) pendingJump.current = { path, line, column };
    setActivePath(path);
    if (path === activePath && line) {
      editorRef.current?.jumpTo(line, column || 0);
      pendingJump.current = null;
    }
    if (narrow) setLayout((l) => ({ ...l, sidebar: false, view: 'editor' }));
  }, [activePath, narrow]);

  useEffect(() => {
    const j = pendingJump.current;
    if (j && j.path === activePath && editorRef.current) {
      pendingJump.current = null;
      requestAnimationFrame(() => editorRef.current?.jumpTo(j.line, j.column || 0));
    }
  }, [activePath]);

  // Add \usepackage{pkg} to the main document if missing.
  const ensurePackage = useCallback((pkg) => {
    const p = projectRef.current;
    const main = p.files[p.mainFile];
    if (!main || main.kind !== 'text') return;
    const text = main.text;
    const re = new RegExp(`\\\\(usepackage|RequirePackage)(\\[[^\\]]*\\])?\\{[^}]*\\b${pkg}\\b[^}]*\\}`);
    if (re.test(text)) return;
    const lines = text.split('\n');
    let at = -1;
    lines.forEach((l, i) => {
      if (/^\s*\\(usepackage|documentclass)/.test(l) && !lines.slice(0, i).some((x) => /\\begin\{document\}/.test(x))) at = i;
    });
    if (at < 0) return;
    const pos = lines.slice(0, at + 1).join('\n').length;
    const insert = `\n\\usepackage{${pkg}}`;
    if (activePath === p.mainFile && editorRef.current) {
      editorRef.current.view.dispatch({ changes: { from: pos, insert } });
    } else {
      setFileText(p.mainFile, text.slice(0, pos) + insert + text.slice(pos));
    }
    toast(t('Added \\usepackage{{pkg}} to {file}', { pkg, file: p.mainFile }), 'info', 3000);
  }, [activePath, setFileText, toast]);

  // ---------- file operations ----------
  const validateName = (dir, current) => (name) => {
    if (!isValidName(name)) return t('Invalid name');
    const path = joinPath(dir, name);
    if (path !== current && (projectRef.current.files[path] || allFolders(projectRef.current).includes(path))) return t('A file or folder with this name already exists');
    return '';
  };

  const createFile = async (dir = '') => {
    const name = await prompt({ title: t('New file'), label: t('File name'), value: 'untitled.tex', validate: validateName(dir), selectBeforeDot: true });
    if (!name) return;
    const path = joinPath(dir, name);
    const files = { ...projectRef.current.files, [path]: { kind: 'text', text: '' } };
    commit({ files });
    setActivePath(path);
  };

  const createFolder = async (dir = '') => {
    const name = await prompt({ title: t('New folder'), label: t('Folder name'), value: '', validate: validateName(dir) });
    if (!name) return;
    const path = joinPath(dir, name);
    commit({ folders: [...new Set([...(projectRef.current.folders || []), path])] });
  };

  const addFiles = async (dir, fileList) => {
    const p = projectRef.current;
    const files = { ...p.files };
    const added = [];
    for (const f of fileList) {
      const path = normalizePath(joinPath(dir, f.webkitRelativePath || f.name));
      if (files[path] && !await confirm({ title: t('Replace file?'), message: t('"{path}" already exists. Replace it?', { path }), confirmLabel: t('Replace') })) continue;
      files[path] = isTextPath(path) ? { kind: 'text', text: await f.text() } : { kind: 'binary', blob: new Blob([await f.arrayBuffer()], { type: f.type || mimeFor(path) }) };
      editorRef.current?.dropCache(path);
      added.push(path);
    }
    if (!added.length) return [];
    const patch = { files };
    if (!p.mainFile) {
      const main = added.find((a) => /\.tex$/i.test(a) && /\\documentclass/.test(files[a].text || ''));
      if (main) patch.mainFile = main;
    }
    commit(patch);
    for (const a of added) if (a === activePath) setExternalVersions((v) => ({ ...v, [a]: (v[a] || 0) + 1 }));
    toast(t('Uploaded {n} files', { n: added.length }), 'success', 2500);
    return added;
  };

  const upload = (dir = '', fileList) => {
    if (fileList) return addFiles(dir, fileList);
    uploadDirRef.current = dir;
    uploadRef.current.click();
    return new Promise((resolve) => { uploadResolveRef.current = resolve; });
  };

  const movePaths = (mapping) => {
    // mapping: old path -> new path for files; folders are recomputed.
    const p = projectRef.current;
    const files = {};
    for (const [path, f] of Object.entries(p.files)) files[mapping[path] || path] = f;
    for (const [from, to] of Object.entries(mapping)) editorRef.current?.renameCache(from, to);
    const patch = { files };
    if (mapping[p.mainFile]) patch.mainFile = mapping[p.mainFile];
    if (mapping[activePath]) setActivePath(mapping[activePath]);
    return patch;
  };

  const rename = async (path, isFolder) => {
    const dir = dirname(path);
    const name = await prompt({ title: isFolder ? t('Rename folder') : t('Rename file'), label: t('New name'), value: basename(path), validate: validateName(dir, path), selectBeforeDot: !isFolder });
    if (!name || name === basename(path)) return;
    const target = joinPath(dir, name);
    const p = projectRef.current;
    if (isFolder) {
      const mapping = {};
      for (const f of Object.keys(p.files)) if (f.startsWith(`${path}/`)) mapping[f] = target + f.slice(path.length);
      const patch = movePaths(mapping);
      patch.folders = (p.folders || []).map((f) => (f === path || f.startsWith(`${path}/`) ? target + f.slice(path.length) : f));
      commit(patch);
    } else {
      commit(movePaths({ [path]: target }));
    }
  };

  const move = (path, dir, isFolder) => {
    const p = projectRef.current;
    const target = joinPath(dir, basename(path));
    if (p.files[target] || (isFolder && allFolders(p).includes(target))) {
      toast(t('A file or folder with this name already exists'), 'error');
      return;
    }
    if (isFolder) {
      const mapping = {};
      for (const f of Object.keys(p.files)) if (f.startsWith(`${path}/`)) mapping[f] = target + f.slice(path.length);
      const patch = movePaths(mapping);
      patch.folders = (p.folders || []).map((f) => (f === path || f.startsWith(`${path}/`) ? target + f.slice(path.length) : f));
      commit(patch);
    } else {
      commit(movePaths({ [path]: target }));
    }
  };

  const remove = async (path, isFolder) => {
    const p = projectRef.current;
    const affected = isFolder ? Object.keys(p.files).filter((f) => f.startsWith(`${path}/`)) : [path];
    if (!await confirm({
      title: isFolder ? t('Delete folder?') : t('Delete file?'),
      message: isFolder ? t('"{path}" and {n} files inside it will be deleted.', { path, n: affected.length }) : t('"{path}" will be deleted.', { path }),
      danger: true,
      confirmLabel: t('Delete'),
    })) return;
    const files = { ...p.files };
    for (const f of affected) {
      delete files[f];
      editorRef.current?.dropCache(f);
    }
    const patch = { files };
    if (isFolder) patch.folders = (p.folders || []).filter((f) => f !== path && !f.startsWith(`${path}/`));
    if (affected.includes(p.mainFile)) patch.mainFile = '';
    if (affected.includes(activePath)) {
      const main = patch.mainFile !== undefined ? patch.mainFile : p.mainFile;
      setActivePath(main || Object.keys(files).find(isTextPath) || null);
    }
    commit(patch);
  };

  const downloadFile = (path) => {
    const f = projectRef.current.files[path];
    downloadBlob(f.kind === 'text' ? new Blob([f.text], { type: 'text/plain;charset=utf-8' }) : f.blob, basename(path));
  };

  // ---------- project level ----------
  const downloadZip = async () => {
    await saveNow();
    downloadBlob(await projectToZip(projectRef.current), `${safeName(projectRef.current.name)}.zip`);
  };

  const downloadPdf = () => {
    if (!pdfData) {
      toast(t('Compile the project first.'), 'info');
      return;
    }
    downloadBlob(new Blob([pdfData], { type: 'application/pdf' }), `${safeName(stripExt(basename(projectRef.current.mainFile || projectRef.current.name)))}.pdf`);
  };

  const copyProject = async () => {
    const name = await prompt({ title: t('Copy project'), label: t('Project name'), value: t('{name} (copy)', { name: projectRef.current.name }) });
    if (!name) return;
    await saveNow();
    const copy = await duplicateProject(projectRef.current.id, name.trim());
    navigate(`#/project/${copy.id}`);
  };

  const onProjectChange = (patch) => {
    const next = commit(patch);
    if (patch.mainFile !== undefined && !next.files[activePath]) setActivePath(patch.mainFile);
  };

  const restoreFiles = (files, all) => {
    const p = projectRef.current;
    const nextFiles = { ...p.files };
    if (all) {
      for (const [path, f] of Object.entries(nextFiles)) if (f.kind === 'text' && !(path in files)) delete nextFiles[path];
    }
    for (const [path, text] of Object.entries(files)) {
      nextFiles[path] = { kind: 'text', text };
      if (path !== activePath) editorRef.current?.dropCache(path);
    }
    commit({ files: nextFiles });
    setExternalVersions((v) => {
      const n = { ...v };
      for (const path of Object.keys(files)) n[path] = (n[path] || 0) + 1;
      return n;
    });
  };

  const replaceAll = (re, replacement) => {
    const p = projectRef.current;
    let count = 0;
    for (const [path, f] of Object.entries(p.files)) {
      if (f.kind !== 'text') continue;
      re.lastIndex = 0;
      const matches = f.text.match(re);
      if (!matches) continue;
      count += matches.length;
      const text = f.text.replace(re, replacement);
      if (path === activePath && editorRef.current) {
        const { view } = editorRef.current;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      } else setFileText(path, text);
    }
    toast(t('Replaced {n} occurrences', { n: count }), 'success');
  };

  // ---------- SyncTeX ----------
  const syncToPdf = useCallback(async () => {
    if (!activePath || !pdfData) return;
    const { line, column } = editorRef.current.getCursor();
    if (narrow) setLayout((l) => ({ ...l, view: 'pdf' }));
    else if (layout.view === 'editor') setLayout((l) => ({ ...l, view: 'split' }));
    setRightPanel('pdf');
    if (result?.backend === 'server' && result.synctex) {
      try {
        const results = await synctexView(result.baseUrl, projectRef.current.id, activePath, line, column);
        if (results[0]) {
          const r = results[0];
          setSyncTarget({ page: r.page, x: r.h, y: r.v - r.height, width: r.width || 50, height: r.height || 12, stamp: Date.now() });
          return;
        }
      } catch { /* fall through to text search */ }
    }
    const lines = projectRef.current.files[activePath].text.split('\n');
    for (let l = line - 1; l < Math.min(lines.length, line + 5); l++) {
      const target = await findSourceInPdf(pdfData, lines[l]);
      if (target) {
        setSyncTarget({ ...target, stamp: Date.now() });
        return;
      }
    }
    toast(t('Could not find this line in the PDF.'), 'info', 2500);
  }, [activePath, pdfData, result, layout.view, narrow, toast]);

  const syncFromPdf = useCallback(async ({ page, x, y, text, context }) => {
    if (result?.backend === 'server' && result.synctex) {
      try {
        const r = await synctexEdit(result.baseUrl, projectRef.current.id, page, x, y);
        if (r && projectRef.current.files[r.file]) {
          openFile(r.file, r.line, r.column);
          return;
        }
      } catch { /* fall back */ }
    }
    const r = findPdfTextInSources(projectRef.current.files, text, context);
    if (r) openFile(r.file, r.line, r.column);
    else toast(t('Could not find this text in the source.'), 'info', 2500);
  }, [result, openFile, toast]);

  // ---------- commands & shortcuts ----------
  const onCommand = useCallback((name) => {
    switch (name) {
      case 'save':
        saveNow();
        if (settings.compileOnSave) compileRef.current();
        break;
      case 'compile': compileRef.current(); break;
      case 'bold': editorRef.current?.wrap('\\textbf{', '}'); break;
      case 'italic': editorRef.current?.wrap('\\textit{', '}'); break;
      case 'projectSearch':
        setSearchOpen(true);
        setLayout((l) => ({ ...l, sidebar: true }));
        break;
      case 'syncToPdf': syncToPdf(); break;
      default:
    }
  }, [saveNow, settings.compileOnSave, syncToPdf]);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onCommand('save');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onCommand('compile');
      } else if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        onCommand('projectSearch');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCommand]);

  // ---------- log actions ----------
  const fetchLog = async () => {
    if (!result?.preparedFiles) return;
    setFetchingLog(true);
    try {
      const log = await fetchTexliveNetLog(result.preparedFiles, result.compiler, result.texliveNetUrl);
      applyResult({ ...result, log, pdf: null, logDeferred: false });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setFetchingLog(false);
    }
  };

  const downloadOutput = async (name) => {
    if (name === 'log') {
      downloadBlob(new Blob([result.log], { type: 'text/plain' }), `${stripExt(basename(projectRef.current.mainFile))}.log`);
      return;
    }
    try {
      downloadBlob(await fetchServerOutput(result.baseUrl, projectRef.current.id, name), name);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const clearCache = async () => {
    await clearServerCache(result?.baseUrl || '', projectRef.current.id);
    toast(t('Cached files cleared.'), 'success', 2000);
  };

  const diagnostics = useMemo(() => logEntries.filter((e) => e.file === activePath), [logEntries, activePath]);

  // ---------- render ----------
  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-lg">{t('Project not found.')}</p>
        <a className="btn-primary" href="#/">{t('Back to projects')}</a>
      </div>
    );
  }
  if (!project) return <div className="flex h-full items-center justify-center"><Spinner size={28} /></div>;

  const activeFile = activePath ? project.files[activePath] : null;
  const counts = summarize(logEntries);
  const compiler = effectiveCompiler(project);
  // Small screens show one pane at a time; the file tree becomes an overlay.
  const view = narrow && layout.view === 'split' ? 'editor' : layout.view;
  const showEditor = view !== 'pdf';
  const showPdf = view !== 'editor';
  const setView = (view) => setLayout((l) => ({ ...l, view }));

  const saveIndicator = {
    saved: <span className="flex items-center gap-1 text-xs text-slate-400"><Check size={13} />{t('Saved')}</span>,
    dirty: <span className="text-xs text-slate-400">{t('Unsaved changes')}</span>,
    saving: <span className="flex items-center gap-1 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" />{t('Saving…')}</span>,
    error: <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle size={13} />{t('Save failed')}</span>,
  }[saveState];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 dark:border-slate-800 dark:bg-slate-950">
        <a href="#/" className="btn-icon" title={t('Back to projects')}><Home size={18} /></a>
        <Dropdown className="btn" button={<><MenuIcon size={16} /><span className="hidden sm:inline">{t('Menu')}</span></>}>
          <MenuLabel>{t('Download')}</MenuLabel>
          <MenuItem icon={FileArchive} onClick={downloadZip}>{t('Source (.zip)')}</MenuItem>
          <MenuItem icon={Download} onClick={downloadPdf} disabled={!pdfData}>{t('PDF')}</MenuItem>
          <MenuSeparator />
          <MenuLabel>{t('Project')}</MenuLabel>
          <MenuItem icon={FilePlus} onClick={() => createFile('')}>{t('New file')}</MenuItem>
          <MenuItem icon={FolderPlus} onClick={() => createFolder('')}>{t('New folder')}</MenuItem>
          <MenuItem icon={Upload} onClick={() => upload('')}>{t('Upload files')}</MenuItem>
          <MenuItem icon={Copy} onClick={copyProject}>{t('Make a copy')}</MenuItem>
          <MenuItem icon={BarChart3} onClick={() => setModal('wordcount')}>{t('Word count')}</MenuItem>
          <MenuItem icon={History} onClick={() => setModal('history')}>{t('History')}</MenuItem>
          <MenuSeparator />
          <MenuItem icon={Settings} onClick={() => setModal('settings')}>{t('Settings')}</MenuItem>
          <MenuItem icon={Keyboard} onClick={() => setModal('help')}>{t('Keyboard shortcuts')}</MenuItem>
        </Dropdown>
        <button type="button" className="btn-icon" title={layout.sidebar ? t('Hide file tree') : t('Show file tree')} onClick={() => setLayout((l) => ({ ...l, sidebar: !l.sidebar }))}>
          {layout.sidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <button
          type="button"
          className="mx-1 min-w-0 max-w-[40vw] truncate rounded px-2 py-1 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-800"
          title={t('Rename project')}
          onClick={async () => {
            const name = await prompt({ title: t('Rename project'), label: t('Project name'), value: project.name, validate: (v) => (!v.trim() ? t('Name is required') : '') });
            if (name) commit({ name: name.trim() });
          }}
        >
          {project.name}
        </button>
        <span className="hidden md:inline">{saveIndicator}</span>

        <div className="flex-1" />

        <div className="hidden items-center rounded-md border border-slate-200 p-0.5 lg:flex dark:border-slate-700">
          <button type="button" className={`btn-icon ${layout.view === 'editor' ? 'btn-active' : ''}`} title={t('Editor only')} onClick={() => setView('editor')}><FileCode2 size={16} /></button>
          <button type="button" className={`btn-icon ${layout.view === 'split' ? 'btn-active' : ''}`} title={t('Editor & PDF')} onClick={() => setView('split')}><Columns2 size={16} /></button>
          <button type="button" className={`btn-icon ${layout.view === 'pdf' ? 'btn-active' : ''}`} title={t('PDF only')} onClick={() => setView('pdf')}><FileText size={16} /></button>
        </div>
        <div className="flex lg:hidden">
          <button type="button" className="btn-icon" title={view === 'pdf' ? t('Show editor') : t('Show PDF')} onClick={() => setView(view === 'pdf' ? 'editor' : 'pdf')}>
            {view === 'pdf' ? <FileCode2 size={18} /> : <FileText size={18} />}
          </button>
        </div>

        <button type="button" className="btn-icon" title={`${t('Go to PDF location')} (Ctrl+.)`} onClick={syncToPdf} disabled={!pdfData || !activeFile || activeFile.kind !== 'text'}><ArrowRightLeft size={17} /></button>
        <button type="button" className="btn-icon" title={t('History')} onClick={() => setModal('history')}><History size={18} /></button>
        <button type="button" className="btn-icon" title={t('Settings')} onClick={() => setModal('settings')}><Settings size={18} /></button>
        <button type="button" className="btn-icon hidden sm:inline-flex" title={t('Help')} onClick={() => setModal('help')}><HelpCircle size={18} /></button>

        <div className="ml-1 flex items-stretch overflow-hidden rounded-md shadow-sm">
          {compiling && !iframeMode ? (
            <button type="button" className="btn-base gap-1.5 bg-brand-700 px-3 py-1.5 text-white" onClick={stopCompile} title={t('Stop compilation')}>
              <Loader2 size={16} className="animate-spin" /><span className="hidden sm:inline">{t('Compiling…')}</span><Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button type="button" className="btn-base gap-1.5 bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700" onClick={() => compile()} title={`${t('Recompile')} (Ctrl+S / Ctrl+Enter)`} disabled={compiling}>
              {compiling ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
              <span className="hidden sm:inline">{t('Recompile')}</span>
            </button>
          )}
          <Dropdown className="btn-base border-l border-brand-700 bg-brand-600 px-1.5 text-white hover:bg-brand-700" button={<ChevronDown size={16} />} align="right" title={t('Compile options')}>
            <MenuLabel>{t('Auto compile')}</MenuLabel>
            <MenuItem checked={settings.autoCompile} onClick={() => updateSettings({ autoCompile: true })}>{t('On')}</MenuItem>
            <MenuItem checked={!settings.autoCompile} onClick={() => updateSettings({ autoCompile: false })}>{t('Off')}</MenuItem>
            <MenuSeparator />
            <MenuLabel>{t('Compiler')}</MenuLabel>
            {ENGINES.slice(0, 4).map((e) => (
              <MenuItem key={e.id} checked={project.compiler.engine === e.id} onClick={() => onProjectChange({ compiler: { ...project.compiler, engine: e.id } })}>{e.name}</MenuItem>
            ))}
            <MenuSeparator />
            <MenuLabel>{t('Compile backend')}</MenuLabel>
            <MenuItem checked={settings.compileBackend === 'auto'} onClick={() => updateSettings({ compileBackend: 'auto' })}>{t('Automatic')}</MenuItem>
            <MenuItem checked={settings.compileBackend === 'server'} onClick={() => updateSettings({ compileBackend: 'server' })}>{t('Local compile server')}</MenuItem>
            <MenuItem checked={settings.compileBackend === 'texlivenet'} onClick={() => updateSettings({ compileBackend: 'texlivenet' })}>texlive.net</MenuItem>
            <MenuSeparator />
            <MenuItem checked={settings.stopOnFirstError} onClick={() => updateSettings({ stopOnFirstError: !settings.stopOnFirstError })}>{t('Stop on first error')}</MenuItem>
            {result?.backend === 'server' && <MenuItem onClick={clearCache}>{t('Clear cached files')}</MenuItem>}
            {iframeMode && (
              <MenuItem onClick={() => { sessionStorage.removeItem('freetex.iframeMode'); setIframeMode(false); setIframeUsed(false); }}>{t('Retry direct texlive.net connection')}</MenuItem>
            )}
          </Dropdown>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        {layout.sidebar && narrow && (
          <div className="absolute inset-0 z-20 bg-slate-900/40" onClick={() => setLayout((l) => ({ ...l, sidebar: false }))} />
        )}
        {layout.sidebar && (
          <>
            <aside
              className={`flex min-h-0 shrink-0 flex-col bg-slate-50 dark:bg-slate-950 ${narrow ? 'absolute inset-y-0 left-0 z-30 w-[82vw] max-w-sm shadow-2xl' : ''}`}
              style={narrow ? undefined : { width: layout.sidebarWidth }}
            >
              {searchOpen ? (
                <ProjectSearch project={project} onClose={() => setSearchOpen(false)} onOpenMatch={(path, m) => openFile(path, m.line, m.column)} onReplaceAll={replaceAll} />
              ) : (
                <>
                  <div className="panel-header">
                    <span className="mr-auto">{t('Files')}</span>
                    <button type="button" className="btn-icon p-1" title={t('New file')} onClick={() => createFile('')}><FilePlus size={15} /></button>
                    <button type="button" className="btn-icon p-1" title={t('New folder')} onClick={() => createFolder('')}><FolderPlus size={15} /></button>
                    <button type="button" className="btn-icon p-1" title={t('Upload files')} onClick={() => upload('')}><Upload size={15} /></button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <FileTree
                      project={project}
                      activePath={activePath}
                      onOpen={(p) => openFile(p)}
                      onCreateFile={createFile}
                      onCreateFolder={createFolder}
                      onUpload={upload}
                      onRename={rename}
                      onDelete={remove}
                      onMove={move}
                      onSetMain={(p) => onProjectChange({ mainFile: p })}
                      onDownload={downloadFile}
                    />
                  </div>
                  {layout.outlineOpen && <Resizer direction="vertical" onResize={(d) => setLayout((l) => ({ ...l, outlineHeight: Math.max(60, Math.min(600, l.outlineHeight - d)) }))} />}
                  <button type="button" className="panel-header w-full border-t" onClick={() => setLayout((l) => ({ ...l, outlineOpen: !l.outlineOpen }))}>
                    {layout.outlineOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <ListTree size={14} />
                    <span>{t('File outline')}</span>
                  </button>
                  {layout.outlineOpen && (
                    <div className="min-h-0 shrink-0 overflow-auto" style={{ height: layout.outlineHeight }}>
                      <Outline entries={outline} activePath={activePath} cursorLine={cursor.line} onJump={(f, l) => openFile(f, l)} />
                    </div>
                  )}
                </>
              )}
            </aside>
            {!narrow && <Resizer onResize={(d) => setLayout((l) => ({ ...l, sidebarWidth: Math.max(160, Math.min(520, l.sidebarWidth + d)) }))} />}
          </>
        )}

        <div className="flex min-h-0 min-w-0 flex-1" id="split-container">
          {showEditor && (
            <section className="flex min-h-0 min-w-0 flex-col" style={{ flex: showPdf ? `${layout.split} 1 0` : '1 1 0' }}>
              {activeFile?.kind === 'text' && (
                <FormatToolbar
                  editor={editorRef}
                  files={Object.keys(project.files)}
                  symbolsOpen={settings.showSymbolPalette}
                  onToggleSymbols={() => updateSettings({ showSymbolPalette: !settings.showSymbolPalette })}
                  onEnsurePackage={ensurePackage}
                  onUploadImages={() => upload('')}
                  onProjectSearch={() => onCommand('projectSearch')}
                />
              )}
              <div className="flex h-7 shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                <span className="truncate font-medium text-slate-700 dark:text-slate-300">{activePath || t('No file open')}</span>
                {activePath === project.mainFile && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{t('main')}</span>}
                <span className="ml-auto tabular-nums">{activeFile?.kind === 'text' ? `${t('Ln')} ${cursor.line}, ${t('Col')} ${cursor.column + 1}` : ''}</span>
              </div>
              <div className="relative min-h-0 flex-1">
                <div className={`absolute inset-0 ${activeFile?.kind === 'text' ? '' : 'invisible'}`}>
                  <CodeEditor
                    ref={editorRef}
                    path={activeFile?.kind === 'text' ? activePath : '__none__'}
                    text={activeFile?.kind === 'text' ? activeFile.text : ''}
                    externalVersion={externalVersions[activePath]}
                    language={activeFile?.kind === 'text' ? languageFor(activePath) : 'plain'}
                    settings={settings}
                    dark={dark}
                    getIndex={getIndex}
                    diagnostics={diagnostics}
                    onChange={onChange}
                    onCursor={onCursor}
                    onCommand={onCommand}
                  />
                </div>
                {activeFile?.kind === 'binary' && (
                  <div className="absolute inset-0"><FileViewer path={activePath} file={activeFile} onDownload={() => downloadFile(activePath)} /></div>
                )}
                {!activeFile && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
                    <Logo size={40} withText={false} />
                    <p>{t('Select a file from the file tree, or create a new one.')}</p>
                    <button type="button" className="btn-outline" onClick={() => createFile('')}><FilePlus size={15} />{t('New file')}</button>
                  </div>
                )}
              </div>
              {settings.showSymbolPalette && activeFile?.kind === 'text' && (
                <div className="h-44 shrink-0">
                  <SymbolPalette onInsert={(s) => editorRef.current?.insert(s)} onClose={() => updateSettings({ showSymbolPalette: false })} />
                </div>
              )}
            </section>
          )}

          {showEditor && showPdf && (
            <Resizer
              onResize={(d) => {
                const el = document.getElementById('split-container');
                if (!el) return;
                setLayout((l) => ({ ...l, split: Math.max(0.15, Math.min(0.85, l.split + d / el.clientWidth)) }));
              }}
              onDoubleClick={() => setLayout((l) => ({ ...l, split: 0.5 }))}
            />
          )}

          {showPdf && (
            <section className="flex min-h-0 min-w-0 flex-col border-l border-slate-200 dark:border-slate-800" style={{ flex: showEditor ? `${1 - layout.split} 1 0` : '1 1 0' }}>
              <div className="flex h-9 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-1 dark:border-slate-700 dark:bg-slate-900">
                <button type="button" className={`btn px-2 py-1 text-xs ${rightPanel === 'pdf' ? 'btn-active' : ''}`} onClick={() => setRightPanel('pdf')}><FileText size={14} />PDF</button>
                <button type="button" className={`btn px-2 py-1 text-xs ${rightPanel === 'logs' ? 'btn-active' : ''}`} onClick={() => setRightPanel('logs')}>
                  <ScrollText size={14} />{t('Logs')}
                  {counts.errors > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] text-white">{counts.errors}</span>}
                  {counts.warnings > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{counts.warnings}</span>}
                </button>
                <div className="ml-auto flex items-center gap-2 pr-2 text-xs text-slate-500">
                  {compiler.engine !== 'pdflatex' && <span className="rounded bg-slate-200 px-1.5 py-0.5 dark:bg-slate-800">{ENGINES.find((e) => e.id === compiler.engine)?.name || compiler.engine}</span>}
                  {result && result.status !== 'iframe' && (
                    <span className={result.pdf ? (counts.errors ? 'text-amber-600' : 'text-emerald-600') : 'text-red-600'}>
                      {result.pdf ? (counts.errors ? t('PDF with errors') : t('Compiled')) : t('Failed')}
                      {result.duration ? ` · ${(result.duration / 1000).toFixed(1)}s` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <div className={`absolute inset-0 ${rightPanel === 'pdf' ? '' : 'invisible'}`}>
                  {iframeUsed ? (
                    <iframe name={IFRAME_NAME} title="PDF" className="h-full w-full border-0 bg-white" onLoad={() => { compilingRef.current = false; setCompiling(false); }} />
                  ) : pdfData ? (
                    settings.pdfViewer === 'native' && pdfUrl ? (
                      <iframe src={pdfUrl} title="PDF" className="h-full w-full border-0" />
                    ) : (
                      <PdfViewer
                        data={pdfData}
                        fileName={result?.pdfName}
                        dark={settings.pdfDarkMode}
                        onToggleDark={() => updateSettings({ pdfDarkMode: !settings.pdfDarkMode })}
                        onSyncClick={syncFromPdf}
                        syncTarget={syncTarget}
                        onDownload={downloadPdf}
                      />
                    )
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center text-sm text-slate-500 dark:bg-slate-950">
                      {compiling ? <><Spinner size={28} /><p>{t('Compiling…')}</p></> : (
                        <>
                          <FileText size={48} className="text-slate-300" />
                          <p>{project.mainFile ? t('Press Recompile to generate the PDF.') : t('Set a main document: right-click a .tex file and choose "Set as main document".')}</p>
                          {project.mainFile && <button type="button" className="btn-primary" onClick={() => compile()}><Play size={15} />{t('Recompile')}</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {rightPanel === 'logs' && (
                  <div className="absolute inset-0 bg-white dark:bg-slate-900">
                    <LogPanel
                      result={result}
                      entries={logEntries}
                      onJump={(e) => e.projectFile && openFile(e.file, e.line || 1)}
                      onFetchLog={fetchLog}
                      fetchingLog={fetchingLog}
                      onDownloadOutput={downloadOutput}
                      onClearCache={clearCache}
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <input
        ref={uploadRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...e.target.files];
          e.target.value = '';
          const added = await addFiles(uploadDirRef.current, files);
          uploadResolveRef.current?.(added);
          uploadResolveRef.current = null;
          const img = added.find(isImagePath);
          if (img && !activePath) setActivePath(img);
        }}
      />

      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} project={project} onProjectChange={onProjectChange} />}
      {modal === 'history' && <HistoryModal project={project} onClose={() => setModal(null)} onRestoreFiles={restoreFiles} />}
      {modal === 'wordcount' && <WordCountModal project={project} onClose={() => setModal(null)} />}
      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
    </div>
  );
}
