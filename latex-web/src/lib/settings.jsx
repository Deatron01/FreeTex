import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveLanguage, setLanguage } from './i18n.js';

const KEY = 'freetex.settings.v1';

const DEFAULT_SETTINGS = {
  // Appearance
  uiTheme: 'system', // system | light | dark
  language: 'auto',
  // Editor
  editorTheme: 'auto', // auto | light | dark | solarized
  fontSize: 14,
  fontFamily: 'default', // default | jetbrains | fira | source | courier
  lineHeight: 'normal', // compact | normal | wide
  keybindings: 'default', // default | vim | emacs
  lineWrapping: true,
  lineNumbers: true,
  highlightActiveLine: true,
  foldGutter: true,
  autoComplete: true,
  autoCloseBrackets: true,
  matchBrackets: true,
  spellCheck: false,
  tabSize: 2,
  indentWithTabs: false,
  // Compiler
  compileBackend: 'auto', // auto | server | texlivenet
  serverUrl: '',
  texliveNetUrl: 'https://texlive.net/cgi-bin/latexcgi',
  autoCompile: false,
  autoCompileDelay: 2500,
  stopOnFirstError: false,
  compileOnSave: true,
  // PDF viewer
  pdfViewer: 'builtin', // builtin | native
  pdfDarkMode: false,
  // Layout
  showSymbolPalette: false,
};

const SettingsContext = createContext(null);

function load() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function prefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const dark = settings.uiTheme === 'dark' || (settings.uiTheme === 'system' && systemDark);
  const lang = resolveLanguage(settings.language);
  setLanguage(lang);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch { /* storage unavailable */ }
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const value = useMemo(() => ({ settings, update, reset, dark, lang }), [settings, update, reset, dark, lang]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  return useContext(SettingsContext);
}
