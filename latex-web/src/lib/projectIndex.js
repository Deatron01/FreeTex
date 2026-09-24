// Extracts structural information from project sources: labels, citation keys,
// user-defined commands, the document outline and word counts.

import { dirname, extname, isBibPath, joinPath, normalizePath } from './paths.js';

const SECTION_LEVELS = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5, subparagraph: 6 };

// Remove comments while keeping line structure (escaped \% is kept).
export function stripComments(text) {
  return text.replace(/(^|[^\\])%.*$/gm, '$1');
}

// Reads a balanced {...} group starting at text[i] === '{'.
function readGroup(text, i) {
  if (text[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { value: text.slice(i + 1, j), end: j + 1 };
    }
  }
  return null;
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

export function parseLabels(text) {
  const out = [];
  const re = /\\label\{([^}]+)\}/g;
  const clean = stripComments(text);
  let m;
  while ((m = re.exec(clean))) out.push({ label: m[1], line: lineAt(clean, m.index) });
  return out;
}

export function parseBibKeys(text) {
  const out = [];
  const re = /@(\w+)\s*[{(]\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = re.exec(text))) {
    const type = m[1].toLowerCase();
    if (['comment', 'string', 'preamble'].includes(type)) continue;
    const body = text.slice(m.index, m.index + 1500);
    const title = /title\s*=\s*[{"]\s*\{?([^}"]*)/i.exec(body)?.[1] || '';
    const author = /author\s*=\s*[{"]([^}"]*)/i.exec(body)?.[1] || '';
    out.push({ key: m[2], type, title: title.trim(), author: author.trim(), line: lineAt(text, m.index) });
  }
  return out;
}

export function parseCommands(text) {
  const out = [];
  const clean = stripComments(text);
  const re = /\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator|NewDocumentCommand|DeclareRobustCommand)\*?\s*\{?\\([A-Za-z@]+)\}?(?:\s*\[(\d)\])?/g;
  let m;
  while ((m = re.exec(clean))) out.push({ name: m[1], args: Number(m[2] || 0) });
  const defRe = /\\(?:def|gdef|edef|let)\s*\\([A-Za-z@]+)/g;
  while ((m = defRe.exec(clean))) out.push({ name: m[1], args: 0 });
  const envRe = /\\(?:newenvironment|NewDocumentEnvironment|newtheorem)\*?\s*\{([^}]+)\}/g;
  while ((m = envRe.exec(clean))) out.push({ env: m[1] });
  return out;
}

// Resolve \input{x} relative to the project root (and the including file).
export function resolveInclude(files, fromPath, name) {
  const candidates = [];
  const n = normalizePath(name.trim());
  for (const base of ['', dirname(fromPath)]) {
    const p = joinPath(base, n);
    candidates.push(p, `${p}.tex`);
  }
  return candidates.find((c) => files[c] && files[c].kind === 'text') || null;
}

// Returns outline entries: { level, title, file, line, starred }
export function buildOutline(files, mainFile) {
  const result = [];
  const visited = new Set();
  const visit = (path, depth) => {
    if (!path || visited.has(path) || depth > 20) return;
    visited.add(path);
    const text = stripComments(files[path].text);
    const re = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)\s*(?:\[[^\]]*\])?\s*(?=\{)|\\(input|include|subfile|import|subimport)\s*(\{[^}]*\})?\s*\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(text))) {
      if (m[1]) {
        const g = readGroup(text, re.lastIndex);
        if (!g) continue;
        result.push({
          level: SECTION_LEVELS[m[1]],
          kind: m[1],
          title: g.value.replace(/\\label\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim() || '(untitled)',
          starred: m[2] === '*',
          file: path,
          line: lineAt(text, m.index),
        });
      } else {
        const dir = m[5] ? m[5].slice(1, -1) : '';
        const child = resolveInclude(files, path, dir ? `${dir}/${m[6]}` : m[6]);
        visit(child, depth + 1);
      }
    }
  };
  if (files[mainFile]?.kind === 'text') visit(mainFile, 0);
  // Include sections of tex files not reachable from main, so every file is navigable.
  for (const p of Object.keys(files)) {
    if (!visited.has(p) && files[p].kind === 'text' && ['tex', 'ltx'].includes(extname(p))) visit(p, 0);
  }
  return result;
}

export function buildIndex(project) {
  const labels = [];
  const bibKeys = [];
  const commands = new Map();
  const environments = new Set();
  for (const [path, f] of Object.entries(project.files)) {
    if (f.kind !== 'text') continue;
    if (isBibPath(path)) {
      for (const b of parseBibKeys(f.text)) bibKeys.push({ ...b, file: path });
      continue;
    }
    if (!/\.(tex|ltx|sty|cls|rnw|tikz)$/i.test(path)) continue;
    for (const l of parseLabels(f.text)) labels.push({ ...l, file: path });
    for (const c of parseCommands(f.text)) {
      if (c.env) environments.add(c.env);
      else commands.set(c.name, c.args);
    }
  }
  return { labels, bibKeys, commands, environments: [...environments] };
}

// ---------- Word count (texcount-like approximation) ----------

export function wordCount(files, mainFile) {
  const order = [];
  const visited = new Set();
  const visit = (path) => {
    if (!path || visited.has(path)) return;
    visited.add(path);
    order.push(path);
    const re = /\\(?:input|include|subfile)\s*\{([^}]+)\}/g;
    let m;
    const text = stripComments(files[path].text);
    while ((m = re.exec(text))) visit(resolveInclude(files, path, m[1]));
  };
  if (files[mainFile]?.kind === 'text') visit(mainFile);

  const total = { words: 0, headers: 0, captions: 0, mathInline: 0, mathDisplay: 0, figures: 0, tables: 0, characters: 0 };
  const perFile = [];
  for (const path of order) {
    let text = stripComments(files[path].text);
    if (path === mainFile) {
      const start = text.indexOf('\\begin{document}');
      if (start >= 0) text = text.slice(start + 16);
      const end = text.indexOf('\\end{document}');
      if (end >= 0) text = text.slice(0, end);
    }
    const stats = { words: 0, headers: 0, captions: 0, mathInline: 0, mathDisplay: 0, figures: 0, tables: 0, characters: 0 };
    stats.figures = (text.match(/\\begin\{figure\*?\}/g) || []).length;
    stats.tables = (text.match(/\\begin\{table\*?\}/g) || []).length;
    // Display math
    const displayRe = /\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\begin\{(equation|align|gather|multline|eqnarray|displaymath|math)\*?\}[\s\S]*?\\end\{\1\*?\}/g;
    stats.mathDisplay = (text.match(displayRe) || []).length;
    text = text.replace(displayRe, ' ');
    const inlineRe = /\$[^$]+\$|\\\([\s\S]*?\\\)/g;
    stats.mathInline = (text.match(inlineRe) || []).length;
    text = text.replace(inlineRe, ' ');
    // Headers and captions
    const count = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
    text = text.replace(/\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g, (m, t) => {
      stats.headers += count(t);
      return ' ';
    });
    text = text.replace(/\\caption\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g, (m, t) => {
      stats.captions += count(t);
      return ' ';
    });
    // Drop environments that are not prose.
    text = text.replace(/\\begin\{(verbatim|lstlisting|minted|tikzpicture|comment)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
    // Commands whose arguments are not text.
    text = text.replace(/\\(?:label|ref|eqref|cref|Cref|autoref|pageref|cite\w*|parencite|textcite|autocite|includegraphics|input|include|usepackage|bibliography\w*|addbibresource|begin|end|url|href|hspace|vspace|setlength|newcommand|renewcommand|documentclass)\*?\s*(?:\[[^\]]*\])?\s*(?:\{[^}]*\})?/g, ' ');
    text = text.replace(/\\[A-Za-z@]+\*?/g, ' ').replace(/[{}[\]&~\\]/g, ' ');
    stats.words = count(text);
    stats.characters = text.replace(/\s+/g, '').length;
    perFile.push({ path, ...stats });
    for (const k of Object.keys(total)) total[k] += stats[k];
  }
  return { total, perFile };
}
