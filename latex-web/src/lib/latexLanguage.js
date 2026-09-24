// CodeMirror 6 LaTeX support: syntax highlighting (legacy stex mode), rich
// autocompletion, environment folding and auto-closing of \begin{...}.

import { StreamLanguage, foldService, HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { snippetCompletion, autocompletion, completionKeymap, acceptCompletion } from '@codemirror/autocomplete';
import { EditorSelection, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { COMMANDS, DOCUMENT_CLASSES, ENV_ARGS, ENV_BODIES, ENVIRONMENTS, PACKAGES } from './latexData.js';
import { isBibPath, isImagePath, isPdfPath, isTexPath, stripExt } from './paths.js';

const stexLanguage = StreamLanguage.define({
  ...stex,
  languageData: {
    commentTokens: { line: '%' },
    closeBrackets: { brackets: ['(', '[', '{', '$'] },
    wordChars: '\\@',
  },
});

// BibTeX: a tiny stream mode.
const bibLanguage = StreamLanguage.define({
  name: 'bibtex',
  startState: () => ({ inEntry: false }),
  token(stream) {
    if (stream.match(/^%.*/)) return 'comment';
    if (stream.match(/^@\w+/)) return 'keyword';
    if (stream.match(/^\w[\w-]*(?=\s*=)/)) return 'propertyName';
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^\d+/)) return 'number';
    if (stream.match(/^\\[A-Za-z]+/)) return 'tag';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '%' }, closeBrackets: { brackets: ['(', '{', '"'] } },
});

export const latexHighlightLight = HighlightStyle.define([
  { tag: tags.tagName, color: '#1d4ed8' },
  { tag: tags.keyword, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.atom, color: '#b45309' },
  { tag: tags.comment, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.bracket, color: '#475569' },
  { tag: tags.number, color: '#047857' },
  { tag: tags.string, color: '#047857' },
  { tag: [tags.special(tags.variableName), tags.variableName], color: '#be123c' },
  { tag: tags.propertyName, color: '#0369a1' },
  { tag: tags.invalid, color: '#dc2626' },
]);

export function languageExtension(lang) {
  if (lang === 'latex') return [stexLanguage, syntaxHighlighting(latexHighlightLight, { fallback: true })];
  if (lang === 'bibtex') return [bibLanguage, syntaxHighlighting(latexHighlightLight, { fallback: true })];
  return [];
}

// ---------- Folding \begin{env} ... \end{env} and sectioning ----------

const SECTION_ORDER = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph'];

export const latexFolding = foldService.of((state, lineStart, lineEnd) => {
  const line = state.doc.sliceString(lineStart, lineEnd);
  const begin = /\\begin\{([^}]+)\}/.exec(line);
  if (begin && !line.includes(`\\end{${begin[1]}}`)) {
    const name = begin[1];
    let depth = 1;
    const re = new RegExp(`\\\\(begin|end)\\{${name.replace(/[*]/g, '\\*')}\\}`, 'g');
    for (let n = state.doc.lineAt(lineStart).number + 1; n <= state.doc.lines; n++) {
      const l = state.doc.line(n);
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(l.text))) {
        depth += m[1] === 'begin' ? 1 : -1;
        if (depth === 0) {
          if (n === state.doc.lineAt(lineStart).number + 1 && l.from + m.index <= lineEnd + 1) return null;
          return { from: lineEnd, to: state.doc.line(n - 1).to };
        }
      }
    }
    return null;
  }
  const sec = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?[[{]/.exec(line);
  if (sec) {
    const level = SECTION_ORDER.indexOf(sec[1]);
    const startNo = state.doc.lineAt(lineStart).number;
    let endNo = state.doc.lines;
    for (let n = startNo + 1; n <= state.doc.lines; n++) {
      const text = state.doc.line(n).text;
      const m = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?[[{]/.exec(text);
      if ((m && SECTION_ORDER.indexOf(m[1]) <= level) || /^\s*\\(end\{document\}|bibliography|printbibliography|appendix)/.test(text)) {
        endNo = n - 1;
        break;
      }
    }
    while (endNo > startNo && !state.doc.line(endNo).text.trim()) endNo--;
    if (endNo > startNo) return { from: lineEnd, to: state.doc.line(endNo).to };
  }
  return null;
});

// ---------- Auto-close environments on Enter ----------

function autoCloseEnvironment(view) {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  const before = line.text.slice(0, sel.head - line.from);
  const after = line.text.slice(sel.head - line.from);
  const m = /\\begin\{([^}]+)\}(?:\[[^\]]*\]|\{[^}]*\})*\s*$/.exec(before);
  if (!m || after.trim()) return false;
  const name = m[1];
  // Already closed? Compare begin/end counts after the cursor.
  const rest = state.doc.sliceString(sel.head, Math.min(state.doc.length, sel.head + 50000));
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const begins = (rest.match(new RegExp(`\\\\begin\\{${esc}\\}`, 'g')) || []).length;
  const ends = (rest.match(new RegExp(`\\\\end\\{${esc}\\}`, 'g')) || []).length;
  if (ends > begins) return false;
  const indent = /^\s*/.exec(line.text)[0];
  const unit = state.facet(indentUnit);
  const item = ['itemize', 'enumerate'].includes(name) ? '\\item ' : '';
  const insert = `\n${indent}${unit}${item}\n${indent}\\end{${name}}`;
  const cursor = sel.head + 1 + indent.length + unit.length + item.length;
  view.dispatch({ changes: { from: sel.head, insert }, selection: EditorSelection.cursor(cursor), scrollIntoView: true, userEvent: 'input' });
  return true;
}

// Continue \item lists on Enter.
function continueItem(view) {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  const m = /^(\s*)\\item(\[[^\]]*\])?\s*(.*)$/.exec(line.text);
  if (!m || sel.head !== line.to) return false;
  if (!m[3].trim() && !m[2]) {
    // Empty item: remove it and leave the list.
    view.dispatch({ changes: { from: line.from, to: line.to, insert: m[1] }, selection: EditorSelection.cursor(line.from + m[1].length) });
    return true;
  }
  const insert = `\n${m[1]}\\item `;
  view.dispatch({ changes: { from: sel.head, insert }, selection: EditorSelection.cursor(sel.head + insert.length), scrollIntoView: true, userEvent: 'input' });
  return true;
}

export const latexKeymap = Prec.high(keymap.of([
  { key: 'Enter', run: (v) => autoCloseEnvironment(v) || continueItem(v) },
  { key: 'Tab', run: acceptCompletion },
]));

// ---------- Autocompletion ----------

const REF_CMDS = /^(ref|eqref|pageref|autoref|cref|Cref|vref|nameref|labelcref|cpageref|hyperref)$/;
const CITE_CMDS = /^(cite\w*|Cite\w*|parencite\w*|Parencite|textcite\w*|Textcite|autocite\w*|Autocite|footcite\w*|nocite|citep|citet|citeauthor|citeyear|smartcite|fullcite|supercite)$/;
const FILE_CMDS = /^(input|include|subfile|includeonly|import|subimport|lstinputlisting|inputminted|verbatiminput)$/;

// Number the placeholders of a snippet and add a final ${0} stop, so Tab jumps
// out of the braces after the last field (like Overleaf).
function withExit(template) {
  if (/[#$]\{\d/.test(template)) return template;
  const numbers = new Map();
  let next = 1;
  const out = template.replace(/[#$]\{((?:\\[{}]|[^{}])*)\}/g, (m, name) => {
    if (name && numbers.has(name)) return `\${${numbers.get(name)}:${name}}`;
    const n = next++;
    if (name) numbers.set(name, n);
    return name ? `\${${n}:${name}}` : `\${${n}}`;
  });
  return next > 1 ? `${out}\${0}` : out;
}

function envSnippet(name) {
  const args = ENV_ARGS[name] ?? '';
  const body = ENV_BODIES[name] ?? '\t${}';
  return withExit(`\\begin{${name}}${args}\n${body}\n\\end{${name}}`);
}

const commandCompletions = COMMANDS.map(([label, snippet, detail]) => (
  snippet
    ? snippetCompletion(withExit(snippet), { label, detail, type: 'function', boost: 1 })
    : { label, detail, type: 'keyword' }
));

const beginCompletions = ENVIRONMENTS.map((env) => snippetCompletion(envSnippet(env), { label: `\\begin{${env}}`, type: 'class', detail: 'environment', boost: -1 }));

export function latexCompletionSource(getIndex) {
  return (context) => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);

    // Inside an argument: \cmd[opt]{partial
    const arg = /\\([A-Za-z]+)\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?\{([^{}]*)$/.exec(before);
    if (arg) {
      const cmd = arg[1];
      const partial = arg[2];
      const afterComma = partial.slice(partial.lastIndexOf(',') + 1).replace(/^\s+/, '');
      const from = context.pos - afterComma.length;
      const index = getIndex();
      const nextChar = context.state.doc.sliceString(context.pos, context.pos + 1);
      if (cmd === 'begin') {
        const envs = [...new Set([...ENVIRONMENTS, ...(index?.environments || [])])];
        return {
          from,
          options: envs.map((env) => ({
            label: env,
            type: 'class',
            apply: (view, completion, f) => {
              const start = f - '\\begin{'.length;
              const to = context.pos + (nextChar === '}' ? 1 : 0);
              const snippet = snippetCompletion(envSnippet(env), { label: env });
              snippet.apply(view, completion, start, to);
            },
          })),
          validFor: /^[\w*]*$/,
        };
      }
      if (cmd === 'end') {
        const envs = [...new Set([...ENVIRONMENTS, ...(index?.environments || [])])];
        return { from, options: envs.map((e) => ({ label: e, type: 'class' })), validFor: /^[\w*]*$/ };
      }
      if (REF_CMDS.test(cmd)) {
        return {
          from,
          options: (index?.labels || []).map((l) => ({ label: l.label, type: 'variable', detail: `${l.file}:${l.line}` })),
          validFor: /^[^,}\s]*$/,
        };
      }
      if (CITE_CMDS.test(cmd)) {
        return {
          from,
          options: (index?.bibKeys || []).map((b) => ({
            label: b.key,
            type: 'text',
            detail: b.type,
            info: [b.author, b.title].filter(Boolean).join(' — '),
          })),
          validFor: /^[^,}\s]*$/,
        };
      }
      const files = index?.files || [];
      if (FILE_CMDS.test(cmd)) {
        return { from, options: files.filter(isTexPath).map((p) => ({ label: stripExt(p), type: 'text', detail: p })), validFor: /^[^}]*$/ };
      }
      if (cmd === 'includegraphics') {
        return { from, options: files.filter((p) => isImagePath(p) || isPdfPath(p) || /\.eps$/i.test(p)).map((p) => ({ label: p, type: 'text' })), validFor: /^[^}]*$/ };
      }
      if (cmd === 'bibliography') {
        return { from, options: files.filter(isBibPath).map((p) => ({ label: stripExt(p), type: 'text' })), validFor: /^[^,}]*$/ };
      }
      if (cmd === 'addbibresource') {
        return { from, options: files.filter(isBibPath).map((p) => ({ label: p, type: 'text' })), validFor: /^[^}]*$/ };
      }
      if (cmd === 'usepackage' || cmd === 'RequirePackage') {
        return { from, options: PACKAGES.map((p) => ({ label: p, type: 'namespace' })), validFor: /^[\w-]*$/ };
      }
      if (cmd === 'documentclass') {
        return { from, options: DOCUMENT_CLASSES.map((p) => ({ label: p, type: 'namespace' })), validFor: /^[\w-]*$/ };
      }
      return null;
    }

    const word = context.matchBefore(/\\[A-Za-z@]*\*?/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    const index = getIndex();
    const custom = [...(index?.commands || new Map()).entries()].map(([name, args]) => (
      args > 0
        ? snippetCompletion(withExit(`\\${name}${'{${}}'.repeat(args)}`), { label: `\\${name}`, type: 'function', detail: 'custom' })
        : { label: `\\${name}`, type: 'function', detail: 'custom' }
    ));
    return {
      from: word.from,
      options: [
        snippetCompletion('\\begin{${1:env}}\n\t${2}\n\\end{${1:env}}', { label: '\\begin', type: 'keyword', detail: 'environment', boost: 2 }),
        ...commandCompletions,
        ...beginCompletions,
        ...custom,
      ],
      validFor: /^\\[A-Za-z@]*\*?$/,
    };
  };
}

export function latexAutocomplete(getIndex) {
  return [
    autocompletion({ override: [latexCompletionSource(getIndex)], activateOnTyping: true, icons: true, maxRenderedOptions: 80 }),
    keymap.of(completionKeymap),
  ];
}
