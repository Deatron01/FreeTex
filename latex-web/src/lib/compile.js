// Compile backends:
//   * "server"     – the FreeTex compile server (server/index.js) running a local
//                    TeX Live via latexmk. Supports every file type, folders,
//                    SyncTeX and shell escape.
//   * "texlivenet" – the public https://texlive.net service. No installation
//                    needed, but it only accepts flat text files (max 1 MB), so
//                    folders are flattened and images are converted to ASCII PDFs.

import { basename, extname, isImagePath, isPdfPath, stripExt } from './paths.js';
import { imageToAsciiPdf, isAsciiBytes, pdfToAsciiPdf } from './imageToPdf.js';

export const ENGINES = [
  { id: 'pdflatex', name: 'pdfLaTeX' },
  { id: 'xelatex', name: 'XeLaTeX' },
  { id: 'lualatex', name: 'LuaLaTeX' },
  { id: 'latex', name: 'LaTeX (dvi → pdf)' },
  { id: 'platex', name: 'pLaTeX' },
  { id: 'uplatex', name: 'upLaTeX' },
  { id: 'context', name: 'ConTeXt' },
  { id: 'pdftex', name: 'pdfTeX (plain)' },
];

export const TEXLIVE_NET_URL = 'https://texlive.net/cgi-bin/latexcgi';
const TEXLIVE_NET_LIMIT = 1000000;

export class CompileError extends Error {
  constructor(message, { cors = false } = {}) {
    super(message);
    this.cors = cors;
  }
}

// "% !TeX program = xelatex" and "% !BIB program = biber" magic comments.
export function magicComments(text) {
  const out = {};
  for (const line of text.split('\n').slice(0, 30)) {
    const m = /^\s*%\s*!\s*(TeX|BIB)\s+(?:TS-)?(program|root|spellcheck)\s*=\s*(\S+)/i.exec(line);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    const key = m[2].toLowerCase();
    const value = m[3].trim();
    if (kind === 'tex' && key === 'program') out.engine = value.toLowerCase();
    if (kind === 'tex' && key === 'root') out.root = value;
    if (kind === 'bib' && key === 'program') out.bibTool = value.toLowerCase();
  }
  return out;
}

export function effectiveCompiler(project) {
  const main = project.files[project.mainFile];
  const magic = main?.kind === 'text' ? magicComments(main.text) : {};
  const engine = ENGINES.some((e) => e.id === magic.engine) ? magic.engine : project.compiler.engine;
  const bibTool = ['bibtex', 'biber', 'bibtex8', 'pbibtex'].includes(magic.bibTool) ? magic.bibTool : project.compiler.bibTool;
  return { ...project.compiler, engine, bibTool };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function withTimeout(promise, ms, controller) {
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Local compile server
// ---------------------------------------------------------------------------

const healthCache = new Map();

export async function checkServer(baseUrl = '') {
  const cached = healthCache.get(baseUrl);
  if (cached && Date.now() - cached.time < 20000) return cached.info;
  let info = null;
  try {
    const controller = new AbortController();
    const res = await withTimeout(fetch(`${baseUrl}/api/health`, { signal: controller.signal }), 2000, controller);
    if (res.ok) {
      const json = await res.json();
      if (json && json.freetex) info = json;
    }
  } catch {
    info = null;
  }
  healthCache.set(baseUrl, { time: Date.now(), info });
  return info;
}

export const clearHealthCache = () => healthCache.clear();

async function compileOnServer(project, compiler, { baseUrl = '', signal, stopOnFirstError, draft }) {
  const files = [];
  for (const [path, f] of Object.entries(project.files)) {
    if (f.kind === 'text') files.push({ path, encoding: 'utf8', content: f.text });
    else files.push({ path, encoding: 'base64', content: await blobToBase64(f.blob) });
  }
  let res;
  try {
    res = await fetch(`${baseUrl}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        main: project.mainFile,
        engine: compiler.engine,
        bibTool: compiler.bibTool,
        makeindex: compiler.makeindex,
        makeglossaries: compiler.makeglossaries,
        shellEscape: compiler.shellEscape,
        stopOnFirstError,
        draft,
        files,
      }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new CompileError(`Could not reach the compile server (${e.message}).`);
  }
  const json = await res.json().catch(() => null);
  if (!json) throw new CompileError(`Compile server returned HTTP ${res.status}.`);
  if (json.error) throw new CompileError(json.error);
  return {
    backend: 'server',
    status: json.pdf ? (json.status === 'success' ? 'success' : 'partial') : 'error',
    pdf: json.pdf ? base64ToBytes(json.pdf) : null,
    log: json.log || '',
    synctex: !!json.synctex,
    outputFiles: json.outputFiles || [],
    duration: json.duration,
    fileMap: null,
  };
}

export async function synctexView(baseUrl, projectId, file, line, column) {
  const res = await fetch(`${baseUrl}/api/synctex/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, file, line, column }),
  });
  const json = await res.json();
  return json.results || [];
}

export async function synctexEdit(baseUrl, projectId, page, x, y) {
  const res = await fetch(`${baseUrl}/api/synctex/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, page, x, y }),
  });
  const json = await res.json();
  return json.result || null;
}

export async function clearServerCache(baseUrl, projectId) {
  await fetch(`${baseUrl}/api/cache/${encodeURIComponent(projectId)}`, { method: 'DELETE' }).catch(() => {});
}

export async function fetchServerOutput(baseUrl, projectId, name) {
  const res = await fetch(`${baseUrl}/api/output/${encodeURIComponent(projectId)}/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// ---------------------------------------------------------------------------
// texlive.net
// ---------------------------------------------------------------------------

const conversionCache = new WeakMap();

async function convertBinary(path, blob) {
  if (conversionCache.has(blob)) return conversionCache.get(blob);
  let result = null;
  if (isPdfPath(path)) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    result = isAsciiBytes(bytes) ? new TextDecoder().decode(bytes) : await pdfToAsciiPdf(blob);
  } else if (isImagePath(path)) {
    result = await imageToAsciiPdf(blob);
  }
  conversionCache.set(blob, result);
  return result;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Prefer the plain basename (so \graphicspath lookups keep working); fall back
// to a flattened "dir__file" name when two files share a basename.
function flatName(path, used) {
  const clean = (s) => {
    const n = s.replace(/[\s]+/g, '_');
    return n.startsWith('.') ? `_${n}` : n;
  };
  const base = clean(basename(path));
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const name = clean(path.replace(/\//g, '__'));
  let candidate = name;
  let i = 1;
  while (used.has(candidate)) {
    const ext = extname(name);
    candidate = ext ? `${stripExt(name)}_${i}.${ext}` : `${name}_${i}`;
    i += 1;
  }
  used.add(candidate);
  return candidate;
}

// Builds the flat file list texlive.net accepts, rewriting references so that
// \input{chapters/intro}, \includegraphics{img/fig.png}, \graphicspath{{img/}}
// etc. keep working after flattening.
export async function prepareTexliveNetFiles(project, { onWarning = () => {} } = {}) {
  const main = project.mainFile;
  const used = new Set(['document.tex']);
  const nameMap = new Map([[main, 'document.tex']]);
  for (const path of Object.keys(project.files)) {
    if (path === main) continue;
    nameMap.set(path, /^[^./][^/\s]*$/.test(path) && path !== 'document.tex' ? (used.add(path), path) : flatName(path, used));
  }

  // Build the rewrite rules for renamed files and folders.
  const variants = new Map();
  for (const [path, flat] of nameMap) {
    if (path === flat || path === main) continue;
    variants.set(path, flat);
    const noExt = stripExt(path);
    if (noExt !== path && !variants.has(noExt)) variants.set(noExt, stripExt(flat));
  }
  const folders = new Set();
  for (const path of Object.keys(project.files)) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'));
  }
  const alts = [...variants.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  const folderAlts = [...folders].sort((a, b) => b.length - a.length).map(escapeRe);
  const refRe = alts.length ? new RegExp(`([{,]\\s*|\\\\input\\s+)(?:\\./)?(${alts.join('|')})(?=\\s*[},]|\\s|$)`, 'gm') : null;
  const dirRe = folderAlts.length ? new RegExp(`\\{(?:\\./)?(?:${folderAlts.join('|')})/\\}`, 'g') : null;
  const rewrite = (text) => {
    let out = text;
    if (refRe) out = out.replace(refRe, (m, pre, p) => pre + variants.get(p));
    if (dirRe) out = out.replace(dirRe, '{./}');
    return out;
  };

  const files = [];
  const graphicsExts = new Set();
  let total = 0;
  for (const [path, f] of Object.entries(project.files)) {
    const name = nameMap.get(path);
    let content;
    if (f.kind === 'text') {
      content = /\.(tex|ltx|sty|cls|cfg|def|tikz|pgf|bbx|cbx)$/i.test(path) ? rewrite(f.text) : f.text;
    } else {
      try {
        content = await convertBinary(path, f.blob);
      } catch (e) {
        onWarning(`Could not convert ${path}: ${e.message}`);
        content = null;
      }
      if (content === null) {
        onWarning(`${path} is a binary file and cannot be sent to texlive.net. Use the local compile server for fonts and other binary files.`);
        continue;
      }
      if (!isPdfPath(path)) graphicsExts.add(`.${extname(path)}`);
    }
    total += content.length + name.length + 200;
    files.push({ path, name, content });
  }

  // Tell graphicx to treat converted images (still named .png/.jpg/...) as PDFs.
  // Everything is kept on the first line so error line numbers stay correct.
  if (graphicsExts.size) {
    const mainFile = files.find((f) => f.path === main);
    if (mainFile) {
      const rules = [...graphicsExts].map((e) => `\\DeclareGraphicsRule{${e}}{pdf}{${e}}{}`).join('');
      mainFile.content = `\\ifdefined\\AddToHook\\AddToHook{package/graphics/after}{${rules}}\\fi ${mainFile.content}`;
    }
  }

  if (total > TEXLIVE_NET_LIMIT) {
    throw new CompileError(`The project is too large for texlive.net (${Math.round(total / 1024)} KB, limit 1000 KB). Reduce image sizes or use the local compile server.`);
  }

  const reverse = new Map([...nameMap].map(([p, n]) => [n, p]));
  reverse.set('document.tex', main);
  return { files, reverse };
}

function texliveNetForm(files, compiler, ret) {
  const form = new FormData();
  const engine = compiler.engine === 'pdftex' ? 'pdftex' : compiler.engine;
  form.append('engine', engine);
  if (['bibtex', 'biber', 'bibtex8', 'pbibtex'].includes(compiler.bibTool)) form.append('bibcmd', compiler.bibTool);
  if (compiler.makeglossaries) form.append('makeglossaries', 'makeglossaries');
  if (compiler.makeindex) form.append('makeindex[]', 'document.idx');
  form.append('return', ret);
  for (const f of files) {
    form.append('filename[]', f.name);
    form.append('filecontents[]', f.content);
  }
  return form;
}

async function postTexliveNet(form, url, signal) {
  let res;
  try {
    res = await fetch(url || TEXLIVE_NET_URL, { method: 'POST', body: form, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    // A TypeError here almost always means the browser blocked the response (CORS)
    // or the network is unavailable.
    throw new CompileError('texlive.net could not be reached from this page (network or CORS).', { cors: true });
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const isPdf = buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  return { res, buf, isPdf };
}

async function compileTexliveNet(project, compiler, { signal, onWarning, url }) {
  const { files, reverse } = await prepareTexliveNetFiles(project, { onWarning });
  const { res, buf, isPdf } = await postTexliveNet(texliveNetForm(files, compiler, 'pdf'), url, signal);
  if (isPdf) {
    return { backend: 'texlivenet', status: 'success', pdf: buf, log: '', logDeferred: true, synctex: false, outputFiles: [], fileMap: reverse, preparedFiles: files, texliveNetUrl: url };
  }
  const text = new TextDecoder().decode(buf);
  if (/^Bad form type/.test(text) || !res.ok) {
    throw new CompileError(`texlive.net rejected the request: ${text.slice(0, 300)}`);
  }
  return { backend: 'texlivenet', status: 'error', pdf: null, log: text, synctex: false, outputFiles: [], fileMap: reverse, preparedFiles: files, texliveNetUrl: url };
}

// texlive.net only returns the log for failed builds; fetch it on demand.
export async function fetchTexliveNetLog(preparedFiles, compiler, url) {
  const { buf } = await postTexliveNet(texliveNetForm(preparedFiles, compiler, 'log'), url);
  return new TextDecoder().decode(buf);
}

// Fallback when fetch() is blocked: submit a classic form into an iframe.
export async function submitTexliveNetForm(project, compiler, iframeName, onWarning, url) {
  const { files } = await prepareTexliveNetFiles(project, { onWarning });
  const form = document.createElement('form');
  form.action = url || TEXLIVE_NET_URL;
  form.method = 'POST';
  form.enctype = 'multipart/form-data';
  form.target = iframeName;
  form.style.display = 'none';
  const add = (name, value, multi = false) => {
    const el = document.createElement(multi ? 'textarea' : 'input');
    el.name = name;
    el.value = value;
    form.appendChild(el);
  };
  const fd = texliveNetForm(files, compiler, 'pdfjs');
  for (const [k, v] of fd.entries()) add(k, v, k === 'filecontents[]');
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

// ---------------------------------------------------------------------------

export async function resolveBackend(settings) {
  const base = (settings.serverUrl || '').replace(/\/$/, '');
  if (settings.compileBackend === 'texlivenet') return { backend: 'texlivenet', base };
  const info = await checkServer(base);
  if (info) return { backend: 'server', base, info };
  if (settings.compileBackend === 'server') {
    throw new CompileError(`The compile server at ${base || window.location.origin} is not reachable. Start it with "npm run server" or switch the compiler backend in Settings.`);
  }
  return { backend: 'texlivenet', base };
}

export async function compileProject(project, settings, { signal, onWarning = () => {} } = {}) {
  if (!project.mainFile || !project.files[project.mainFile]) {
    throw new CompileError('No main document is set. Right-click a .tex file and choose "Set as main document".');
  }
  const compiler = effectiveCompiler(project);
  const { backend, base } = await resolveBackend(settings);
  const started = performance.now();
  const result = backend === 'server'
    ? await compileOnServer(project, compiler, { baseUrl: base, signal, stopOnFirstError: settings.stopOnFirstError, draft: settings.draftMode })
    : await compileTexliveNet(project, compiler, { signal, onWarning, url: settings.texliveNetUrl || TEXLIVE_NET_URL });
  result.duration = result.duration || Math.round(performance.now() - started);
  result.compiler = compiler;
  result.baseUrl = base;
  result.pdfName = `${stripExt(basename(project.mainFile))}.pdf`;
  return result;
}
