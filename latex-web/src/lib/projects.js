import JSZip from 'jszip';
import { dbAll, dbAllByIndex, dbDelete, dbDeleteByIndex, dbGet, dbPut, uid } from './db.js';
import { TEMPLATES } from './templates.js';
import { basename, dirname, isTexPath, isTextPath, mimeFor, normalizePath } from './paths.js';

export const DEFAULT_COMPILER = {
  engine: 'pdflatex',
  bibTool: 'auto', // auto | bibtex | biber | none
  makeindex: false,
  makeglossaries: false,
  shellEscape: false,
};

export function newProjectRecord(name, files, mainFile) {
  const now = Date.now();
  return {
    id: uid(),
    name,
    created: now,
    updated: now,
    trashed: false,
    mainFile: mainFile || guessMainFile(files) || '',
    compiler: { ...DEFAULT_COMPILER },
    files,
    folders: [],
  };
}

export function textFiles(map) {
  const files = {};
  for (const [p, text] of Object.entries(map)) files[p] = { kind: 'text', text };
  return files;
}

export async function listProjects() {
  const all = await dbAll('projects');
  // Avoid keeping all file blobs around in dashboard state.
  return all.map(({ files, ...meta }) => ({ ...meta, fileCount: Object.keys(files || {}).length }));
}

export const getProject = (id) => dbGet('projects', id);

export async function saveProject(project) {
  await dbPut('projects', project);
}

export async function createFromTemplate(templateId, name) {
  const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  const project = newProjectRecord(name || tpl.name, textFiles(tpl.files), 'main.tex');
  await saveProject(project);
  return project;
}

export async function renameProject(id, name) {
  const p = await getProject(id);
  if (!p) return;
  p.name = name;
  p.updated = Date.now();
  await saveProject(p);
}

export async function setTrashed(id, trashed) {
  const p = await getProject(id);
  if (!p) return;
  p.trashed = trashed;
  await saveProject(p);
}

export async function deleteProject(id) {
  await dbDelete('projects', id);
  await dbDeleteByIndex('history', 'projectId', id);
}

export async function duplicateProject(id, name) {
  const p = await getProject(id);
  if (!p) return null;
  const copy = { ...structuredClone(p), id: uid(), name, created: Date.now(), updated: Date.now(), trashed: false };
  await saveProject(copy);
  return copy;
}

export function guessMainFile(files) {
  const texFiles = Object.keys(files).filter(isTexPath);
  const withDocClass = texFiles.filter((p) => {
    const f = files[p];
    return f.kind === 'text' && /^[^%\n]*\\documentclass/m.test(f.text);
  });
  const prefer = (list) => list.find((p) => /^(main|document|paper|thesis|report)\.tex$/i.test(p))
    || list.sort((a, b) => a.split('/').length - b.split('/').length)[0];
  return prefer(withDocClass) || prefer(texFiles) || '';
}

// ---------- ZIP import / export ----------

export async function importZip(fileOrBlob, name) {
  const zip = await JSZip.loadAsync(fileOrBlob);
  const entries = Object.values(zip.files).filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(e.name));
  // Strip a single common top-level folder (common when zipping a directory).
  const tops = new Set(entries.map((e) => e.name.split('/')[0]));
  const strip = tops.size === 1 && entries.every((e) => e.name.includes('/')) ? `${[...tops][0]}/` : '';
  const files = {};
  const folders = new Set();
  for (const e of Object.values(zip.files)) {
    if (e.dir) {
      const p = normalizePath(e.name.slice(strip.length));
      if (p && !p.startsWith('__MACOSX')) folders.add(p);
    }
  }
  for (const e of entries) {
    const p = normalizePath(e.name.slice(strip.length));
    if (!p) continue;
    if (isTextPath(p)) files[p] = { kind: 'text', text: await e.async('string') };
    else files[p] = { kind: 'binary', blob: new Blob([await e.async('arraybuffer')], { type: mimeFor(p) }) };
  }
  const project = newProjectRecord(name || (fileOrBlob.name || 'Imported project').replace(/\.zip$/i, ''), files);
  project.folders = [...folders];
  await saveProject(project);
  return project;
}

export async function importFiles(fileList, name) {
  const files = {};
  for (const f of fileList) {
    const p = normalizePath(f.webkitRelativePath || f.name);
    files[p] = isTextPath(p) ? { kind: 'text', text: await f.text() } : { kind: 'binary', blob: f };
  }
  const project = newProjectRecord(name || basename(Object.keys(files)[0] || 'Project').replace(/\.[^.]+$/, ''), files);
  await saveProject(project);
  return project;
}

export async function projectToZip(project, pdfBlob) {
  const zip = new JSZip();
  for (const folder of project.folders || []) zip.folder(folder);
  for (const [p, f] of Object.entries(project.files)) zip.file(p, f.kind === 'text' ? f.text : f.blob);
  if (pdfBlob) zip.file(`${safeName(project.name)}.pdf`, pdfBlob);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export const safeName = (name) => (name || 'project').replace(/[^\p{L}\p{N}\-. _]+/gu, '_').trim() || 'project';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// All folders implied by file paths plus explicit (possibly empty) folders.
export function allFolders(project) {
  const set = new Set(project.folders || []);
  for (const p of Object.keys(project.files)) {
    let d = dirname(p);
    while (d) {
      set.add(d);
      d = dirname(d);
    }
  }
  return [...set].sort();
}

// ---------- History ----------

export async function listHistory(projectId) {
  const all = await dbAllByIndex('history', 'projectId', projectId);
  return all.sort((a, b) => b.time - a.time);
}

export function snapshotFiles(project) {
  const files = {};
  for (const [p, f] of Object.entries(project.files)) if (f.kind === 'text') files[p] = f.text;
  return files;
}

export async function addSnapshot(project, { label = '', auto = false } = {}) {
  const snap = { id: uid(), projectId: project.id, time: Date.now(), label, auto, files: snapshotFiles(project) };
  await dbPut('history', snap);
  // Keep at most 200 automatic snapshots per project.
  const all = await listHistory(project.id);
  const autos = all.filter((s) => s.auto && !s.label);
  await Promise.all(autos.slice(200).map((s) => dbDelete('history', s.id)));
  return snap;
}

export const updateSnapshot = (snap) => dbPut('history', snap);
export const deleteSnapshot = (id) => dbDelete('history', id);

export function sameSnapshot(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}
