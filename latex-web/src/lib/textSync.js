// Approximate source <-> PDF synchronisation by text matching. Used when real
// SyncTeX data is unavailable (texlive.net backend).

import { closeDocument, loadPdfjs } from './pdfjs.js';

const cache = new WeakMap();

const norm = (s) => s.normalize('NFKC').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

async function pageTexts(data) {
  if (cache.has(data)) return cache.get(data);
  const promise = (async () => {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let text = '';
      const items = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        items.push({ start: text.length, y: vp.height - it.transform[5], x: it.transform[4], h: it.height || 10, w: it.width });
        text += `${it.str}${it.hasEOL ? ' ' : ''}`;
      }
      pages.push({ text, items });
    }
    closeDocument(doc);
    return pages;
  })();
  cache.set(data, promise);
  return promise;
}

// Plain words from a LaTeX source line (commands and math removed).
export function plainText(line) {
  return line
    .replace(/(^|[^\\])%.*$/, '$1')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\\(?:label|ref|cite\w*|eqref|includegraphics|begin|end|usepackage|input|include)\*?(?:\[[^\]]*\])?\{[^}]*\}/g, ' ')
    .replace(/\\[A-Za-z@]+\*?/g, ' ')
    .replace(/[{}[\]~\\&#^_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find where a source line appears in the PDF.
export async function findSourceInPdf(data, lineText) {
  const words = plainText(lineText).split(' ').filter((w) => w.length > 1);
  if (words.length === 0) return null;
  const pages = await pageTexts(data);
  // Try the longest phrase first, shrinking until something matches.
  for (let len = Math.min(8, words.length); len >= 1; len--) {
    for (let start = 0; start + len <= words.length; start++) {
      const phrase = norm(words.slice(start, start + len).join(' '));
      if (phrase.length < 4) continue;
      for (let p = 0; p < pages.length; p++) {
        const idx = norm(pages[p].text).indexOf(phrase);
        if (idx >= 0) {
          const item = [...pages[p].items].reverse().find((it) => it.start <= idx) || pages[p].items[0];
          return { page: p + 1, x: item?.x || 0, y: item ? item.y - item.h : 0, width: item?.w || 100, height: (item?.h || 10) + 2 };
        }
      }
    }
  }
  return null;
}

// Find where a piece of PDF text comes from in the sources.
export function findPdfTextInSources(files, text, context) {
  const candidates = [];
  const ctx = (context || '').replace(/\s+/g, ' ').trim();
  if (ctx) {
    const words = ctx.split(' ');
    for (let len = Math.min(8, words.length); len >= 2; len--) {
      for (let s = 0; s + len <= words.length; s++) candidates.push(words.slice(s, s + len).join(' '));
    }
  }
  if (text && text.trim().length > 2) candidates.push(text.trim());
  for (const c of candidates) {
    const needle = c.toLowerCase();
    for (const [path, f] of Object.entries(files)) {
      if (f.kind !== 'text' || !/\.(tex|ltx)$/i.test(path)) continue;
      const lines = f.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const plain = plainText(lines[i]).toLowerCase();
        const col = plain.indexOf(needle);
        if (col >= 0) return { file: path, line: i + 1, column: Math.max(0, lines[i].toLowerCase().indexOf(needle.split(' ')[0])) };
      }
    }
  }
  return null;
}
