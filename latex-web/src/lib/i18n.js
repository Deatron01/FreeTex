import hu from './i18n.hu.js';

// English strings are used as keys; other languages map them to translations.
const DICTS = { hu };
let current = 'en';

export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'hu', name: 'Magyar' },
];

export function resolveLanguage(setting) {
  if (setting && setting !== 'auto') return setting;
  const nav = (navigator.language || 'en').slice(0, 2);
  return DICTS[nav] ? nav : 'en';
}

export function setLanguage(lang) {
  current = lang;
  document.documentElement.lang = lang;
}

export function t(key, vars) {
  let s = (DICTS[current] && DICTS[current][key]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}
