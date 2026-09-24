import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Compartment, EditorSelection, EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration, EditorView, crosshairCursor, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, keymap, lineNumbers, rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, snippet } from '@codemirror/autocomplete';
import { highlightSelectionMatches, search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { lintGutter, lintKeymap, setDiagnostics } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { vim, Vim } from '@replit/codemirror-vim';
import { emacs } from '@replit/codemirror-emacs';
import { languageExtension, latexAutocomplete, latexFolding, latexKeymap } from '../lib/latexLanguage.js';

const FONTS = {
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  jetbrains: '"JetBrains Mono", ui-monospace, monospace',
  fira: '"Fira Code", ui-monospace, monospace',
  source: '"Source Code Pro", ui-monospace, monospace',
  courier: '"Courier New", Courier, monospace',
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
};
const LINE_HEIGHTS = { compact: 1.3, normal: 1.55, wide: 1.9 };

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1e293b' },
  '.cm-content': { caretColor: '#0f172a' },
  '.cm-gutters': { backgroundColor: '#f8fafc', color: '#94a3b8', borderRight: '1px solid #e2e8f0' },
  '.cm-activeLine': { backgroundColor: '#f1f5f980' },
  '.cm-activeLineGutter': { backgroundColor: '#e2e8f0', color: '#334155' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#bfdbfe' },
  '.cm-matchingBracket': { backgroundColor: '#bbf7d0', outline: 'none' },
  '.cm-searchMatch': { backgroundColor: '#fde68a' },
}, { dark: false });

// Briefly highlight a line after jumping to it.
const flashEffect = StateEffect.define();
const flashField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(flashEffect)) {
        deco = e.value === null ? Decoration.none : Decoration.set([Decoration.line({ class: 'cm-flash-line' }).range(e.value)]);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const C = {
  keys: new Compartment(),
  language: new Compartment(),
  theme: new Compartment(),
  font: new Compartment(),
  wrap: new Compartment(),
  lineNumbers: new Compartment(),
  activeLine: new Compartment(),
  fold: new Compartment(),
  brackets: new Compartment(),
  closeBrackets: new Compartment(),
  complete: new Compartment(),
  spell: new Compartment(),
  indent: new Compartment(),
  readOnly: new Compartment(),
};

function compartmentValues(opts) {
  const { settings: s, dark, language, getIndex, readOnly } = opts;
  const isDark = s.editorTheme === 'dark' || (s.editorTheme === 'auto' && dark);
  const unit = s.indentWithTabs ? '\t' : ' '.repeat(s.tabSize || 2);
  return {
    keys: s.keybindings === 'vim' ? vim() : s.keybindings === 'emacs' ? emacs() : [],
    language: [
      languageExtension(language),
      language === 'latex' ? [latexKeymap, latexFolding] : [],
    ],
    theme: isDark ? oneDark : lightTheme,
    font: EditorView.theme({
      '&': { fontSize: `${s.fontSize}px` },
      '.cm-scroller': { fontFamily: FONTS[s.fontFamily] || FONTS.default, lineHeight: String(LINE_HEIGHTS[s.lineHeight] || 1.55) },
    }),
    wrap: s.lineWrapping ? EditorView.lineWrapping : [],
    lineNumbers: s.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : [],
    activeLine: s.highlightActiveLine ? highlightActiveLine() : [],
    fold: s.foldGutter ? foldGutter() : [],
    brackets: s.matchBrackets ? bracketMatching() : [],
    closeBrackets: s.autoCloseBrackets ? [closeBrackets(), keymap.of(closeBracketsKeymap)] : [],
    complete: s.autoComplete && language === 'latex' ? latexAutocomplete(getIndex) : [],
    spell: EditorView.contentAttributes.of({ spellcheck: s.spellCheck ? 'true' : 'false', autocorrect: 'off', autocapitalize: 'off' }),
    indent: [indentUnit.of(unit), EditorState.tabSize.of(s.tabSize || 2)],
    readOnly: [EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)],
  };
}

function reconfigureEffects(opts) {
  const values = compartmentValues(opts);
  return Object.entries(values).map(([k, v]) => C[k].reconfigure(v));
}

export default function CodeEditor({
  ref, path, text, externalVersion, language, settings, dark, getIndex, diagnostics, readOnly,
  onChange, onCursor, onCommand,
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const statesRef = useRef(new Map());
  const scrollRef = useRef(new Map());
  const pathRef = useRef(path);
  const optsRef = useRef({ settings, dark, language, getIndex, readOnly });
  const cbRef = useRef({});
  // Keep the latest props available to CodeMirror callbacks.
  useLayoutEffect(() => {
    optsRef.current = { settings, dark, language, getIndex, readOnly };
    cbRef.current = { onChange, onCursor, onCommand };
  });

  const makeState = (doc) => {
    const values = compartmentValues(optsRef.current);
    const cmd = (name) => () => {
      cbRef.current.onCommand?.(name);
      return true;
    };
    return EditorState.create({
      doc,
      extensions: [
        C.keys.of(values.keys),
        Prec.high(keymap.of([
          { key: 'Mod-s', run: cmd('save'), preventDefault: true },
          { key: 'Mod-Enter', run: cmd('compile'), preventDefault: true },
          { key: 'Mod-b', run: cmd('bold'), preventDefault: true },
          { key: 'Mod-i', run: cmd('italic'), preventDefault: true },
          { key: 'Mod-Shift-f', run: cmd('projectSearch'), preventDefault: true },
          { key: 'Mod-.', run: cmd('syncToPdf'), preventDefault: true },
          { key: 'Mod-/', run: toggleComment },
          { key: 'Mod-h', run: openSearchPanel },
        ])),
        C.lineNumbers.of(values.lineNumbers),
        C.fold.of(values.fold),
        lintGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        C.brackets.of(values.brackets),
        C.closeBrackets.of(values.closeBrackets),
        C.complete.of(values.complete),
        rectangularSelection(),
        crosshairCursor(),
        C.activeLine.of(values.activeLine),
        highlightSelectionMatches(),
        search({ top: true }),
        keymap.of([...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...lintKeymap, indentWithTab]),
        C.language.of(values.language),
        C.theme.of(values.theme),
        C.font.of(values.font),
        C.wrap.of(values.wrap),
        C.spell.of(values.spell),
        C.indent.of(values.indent),
        C.readOnly.of(values.readOnly),
        flashField,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cbRef.current.onChange?.(pathRef.current, u.state.doc.toString());
          if (u.selectionSet || u.docChanged) {
            const head = u.state.selection.main.head;
            const line = u.state.doc.lineAt(head);
            cbRef.current.onCursor?.({ line: line.number, column: head - line.from });
          }
        }),
      ],
    });
  };

  // Create the view once.
  useEffect(() => {
    const view = new EditorView({ state: makeState(text ?? ''), parent: hostRef.current });
    viewRef.current = view;
    statesRef.current.set(path, view.state);
    Vim.defineEx('write', 'w', () => cbRef.current.onCommand?.('save'));
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch files (keeping per-file undo history, selection and scroll position).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const prev = pathRef.current;
    if (prev !== path) {
      statesRef.current.set(prev, view.state);
      scrollRef.current.set(prev, view.scrollDOM.scrollTop);
      pathRef.current = path;
      let state = statesRef.current.get(path);
      if (!state || state.doc.toString() !== (text ?? '')) state = makeState(text ?? '');
      view.setState(state);
      view.dispatch({ effects: reconfigureEffects(optsRef.current) });
      const top = scrollRef.current.get(path) || 0;
      requestAnimationFrame(() => { view.scrollDOM.scrollTop = top; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // External changes to the current file (history restore, upload, ...).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || externalVersion === undefined) return;
    const current = view.state.doc.toString();
    if (text !== undefined && current !== text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalVersion]);

  // Settings changed.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: reconfigureEffects(optsRef.current) });
  }, [settings, dark, language, readOnly]);

  // Compile diagnostics for this file.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const list = (diagnostics || []).filter((d) => d.line).map((d) => {
      const ln = doc.line(Math.min(Math.max(1, d.line), doc.lines));
      return {
        from: ln.from,
        to: ln.to,
        severity: d.level === 'error' ? 'error' : d.level === 'warning' ? 'warning' : 'info',
        message: d.message + (d.hint ? `\n\n${d.hint}` : ''),
        source: 'LaTeX',
      };
    });
    view.dispatch(setDiagnostics(view.state, list));
  }, [diagnostics, path]);

  useImperativeHandle(ref, () => ({
    get view() {
      return viewRef.current;
    },
    focus: () => viewRef.current?.focus(),
    getCursor() {
      const st = viewRef.current.state;
      const head = st.selection.main.head;
      const line = st.doc.lineAt(head);
      return { line: line.number, column: head - line.from };
    },
    getSelection() {
      const st = viewRef.current.state;
      return st.sliceDoc(st.selection.main.from, st.selection.main.to);
    },
    insert(textToInsert) {
      const view = viewRef.current;
      view.dispatch(view.state.replaceSelection(textToInsert), { scrollIntoView: true, userEvent: 'input' });
      view.focus();
    },
    // Wrap every selection with before/after; with an empty selection the cursor lands inside.
    wrap(before, after) {
      const view = viewRef.current;
      const tr = view.state.changeByRange((range) => {
        const sel = view.state.sliceDoc(range.from, range.to);
        // Toggle off if already wrapped.
        const outerFrom = range.from - before.length;
        if (sel && view.state.sliceDoc(outerFrom, range.from) === before && view.state.sliceDoc(range.to, range.to + after.length) === after) {
          return {
            changes: [{ from: outerFrom, to: range.from }, { from: range.to, to: range.to + after.length }],
            range: EditorSelection.range(outerFrom, range.to - before.length),
          };
        }
        return {
          changes: [{ from: range.from, insert: before }, { from: range.to, insert: after }],
          range: EditorSelection.range(range.from + before.length, range.to + before.length),
        };
      });
      view.dispatch(tr, { scrollIntoView: true, userEvent: 'input' });
      view.focus();
    },
    // Insert a CodeMirror snippet template (${} placeholders); ${sel} is replaced by the selection.
    snippet(template) {
      const view = viewRef.current;
      const { from, to } = view.state.selection.main;
      const sel = view.state.sliceDoc(from, to).replace(/[{}]/g, (c) => `\\${c}`);
      // Placeholders are line based, so multi-line selections are inserted verbatim.
      const replacement = !sel ? '${}' : sel.includes('\n') ? sel : `\${${sel}}`;
      snippet(template.replace(/\$\{sel\}/g, () => replacement))(view, null, from, to);
      view.focus();
    },
    jumpTo(line, column = 0, { flash = true, focus = true } = {}) {
      const view = viewRef.current;
      const doc = view.state.doc;
      const ln = doc.line(Math.min(Math.max(1, line || 1), doc.lines));
      const pos = Math.min(ln.from + Math.max(0, column), ln.to);
      view.dispatch({
        selection: EditorSelection.cursor(pos),
        effects: [EditorView.scrollIntoView(pos, { y: 'center' }), ...(flash ? [flashEffect.of(ln.from)] : [])],
      });
      if (flash) setTimeout(() => view.dispatch({ effects: flashEffect.of(null) }), 1600);
      if (focus) view.focus();
    },
    selectRange(from, to) {
      const view = viewRef.current;
      view.dispatch({ selection: EditorSelection.range(from, to), effects: EditorView.scrollIntoView(from, { y: 'center' }) });
      view.focus();
    },
    openSearch: () => openSearchPanel(viewRef.current),
    dropCache(p) {
      statesRef.current.delete(p);
      scrollRef.current.delete(p);
    },
    renameCache(from, to) {
      if (statesRef.current.has(from)) {
        statesRef.current.set(to, statesRef.current.get(from));
        statesRef.current.delete(from);
      }
      if (pathRef.current === from) pathRef.current = to;
    },
  }));

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
}
