// Small path and file-type helpers. Project paths are always relative,
// use "/" as separator and never start with "/" or "./".

export function normalizePath(p) {
  const parts = [];
  for (const seg of String(p).replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

export const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
export const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
export const joinPath = (dir, name) => normalizePath(dir ? `${dir}/${name}` : name);

export function extname(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1).toLowerCase() : '';
}

export const stripExt = (p) => {
  const e = extname(p);
  return e ? p.slice(0, -(e.length + 1)) : p;
};

const TEXT_EXTS = new Set([
  'tex', 'latex', 'ltx', 'sty', 'cls', 'bib', 'bst', 'bbx', 'cbx', 'lbx', 'dtx', 'ins', 'def', 'cfg',
  'clo', 'fd', 'txt', 'md', 'markdown', 'csv', 'tsv', 'dat', 'json', 'yaml', 'yml', 'xml', 'svg',
  'eps', 'ps', 'lua', 'py', 'r', 'm', 'asy', 'mp', 'tikz', 'pgf', 'gnuplot', 'gp', 'ist', 'gst',
  'bbl', 'glo', 'nlo', 'latexmkrc', 'html', 'css', 'js', 'sh', 'makefile', 'rnw', 'rtex', 'mf',
]);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

export function isTextPath(p) {
  const e = extname(p);
  if (!e) return /^(makefile|latexmkrc|readme|license|\.latexmkrc)$/i.test(basename(p));
  return TEXT_EXTS.has(e);
}

export const isImagePath = (p) => IMAGE_EXTS.has(extname(p));
export const isPdfPath = (p) => extname(p) === 'pdf';
export const isTexPath = (p) => ['tex', 'latex', 'ltx', 'rnw', 'rtex'].includes(extname(p));
export const isBibPath = (p) => extname(p) === 'bib';

export function languageFor(p) {
  const e = extname(p);
  if (['tex', 'latex', 'ltx', 'sty', 'cls', 'dtx', 'ins', 'def', 'cfg', 'clo', 'fd', 'bbl', 'tikz', 'pgf', 'rnw', 'rtex', 'bbx', 'cbx', 'lbx'].includes(e)) return 'latex';
  if (['bib'].includes(e)) return 'bibtex';
  return 'plain';
}

export function mimeFor(p) {
  const e = extname(p);
  return {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', svg: 'image/svg+xml', pdf: 'application/pdf', zip: 'application/zip',
  }[e] || (isTextPath(p) ? 'text/plain' : 'application/octet-stream');
}

// A filename is valid if it has no slashes, is not empty and not "." / ".."
export function isValidName(name) {
  return !!name && !/[/\\]/.test(name) && name !== '.' && name !== '..' && name.trim() === name;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
