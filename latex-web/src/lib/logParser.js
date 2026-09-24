// Parser for TeX/LaTeX log files. Produces a list of
// { level: 'error'|'warning'|'typesetting', message, file, line, raw, hint }.

const MAX_LINE = 79;

// TeX hard-wraps the log at max_print_line (79) characters. Re-join those lines.
function unwrap(log) {
  const lines = log.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let buf = '';
  for (const line of lines) {
    buf += line;
    if (line.length !== MAX_LINE) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

const FILE_RE = /^"?((?:[A-Za-z]:)?[^\s()"]*?[^\s()"]\.[A-Za-z0-9]{1,8})"?/;

// Track the file stack via parentheses: "(./file.tex" opens, ")" closes.
function updateFileStack(line, stack) {
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '(') {
      const m = FILE_RE.exec(line.slice(i + 1));
      if (m && (m[1].includes('/') || m[1].includes('.'))) {
        stack.push(m[1]);
        i += m[0].length + 1;
        continue;
      }
      stack.push(null);
    } else if (c === ')') {
      stack.pop();
    }
    i += 1;
  }
}

function currentFile(stack) {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) return stack[i];
  return null;
}

// Prefer the innermost *project* file (not a TeX Live system file).
function projectFile(stack, isProjectFile) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const f = stack[i] && cleanFile(stack[i]);
    if (f && isProjectFile(f)) return f;
  }
  const f = currentFile(stack);
  return f ? cleanFile(f) : null;
}

export function cleanFile(f) {
  return f.replace(/^"|"$/g, '').replace(/^\.\//, '');
}

const HINTS = [
  [/Undefined control sequence/, 'A command is misspelled or its package is not loaded. Check the command name and add the needed \\usepackage.'],
  [/Missing \$ inserted/, 'Math-only commands (like ^, _ or \\alpha) must be inside $...$ or a math environment.'],
  [/File `([^']+)' not found/, 'The file does not exist in the project (check the name and path) or the package is not installed on the compile server.'],
  [/Environment (\S+) undefined/, 'The environment is misspelled or its package is not loaded.'],
  [/Missing \\begin\{document\}/, 'Text was found in the preamble. Move it after \\begin{document} or check for a stray character.'],
  [/\\begin\{(\S+)\} on input line \d+ ended by \\end\{(\S+)\}/, 'Environments are not properly nested. Every \\begin needs a matching \\end in the right order.'],
  [/Extra \}, or forgotten/, 'There is an unmatched closing brace or a missing \\begin / $.'],
  [/Too many \}'s/, 'There is an extra closing brace.'],
  [/Runaway argument/, 'An argument is not closed, usually a missing }.'],
  [/Paragraph ended before/, 'An argument contains a blank line or is missing a closing brace.'],
  [/Misplaced alignment tab character &/, 'The & character is only allowed in tables and alignment environments. Use \\& for a literal ampersand.'],
  [/Extra alignment tab has been changed/, 'A table row has more cells than the column specification allows.'],
  [/There's no line here to end/, '\\\\ was used where no line is being built (e.g. after a blank line).'],
  [/Citation `([^']+)'.*undefined/, 'The citation key is not in any .bib file, or the bibliography has not been processed yet (recompile).'],
  [/Reference `([^']+)'.*undefined/, 'The label is not defined, or a recompile is needed to resolve references.'],
  [/Label `([^']+)' multiply defined/, 'The same \\label is used more than once.'],
  [/Unicode character .* not set up for use with LaTeX/, 'The character is not supported by pdfLaTeX with the current fonts. Use XeLaTeX/LuaLaTeX or a package that supports it.'],
  [/Font .* not found|cannot be found|not loadable/, 'The requested font is not available on the compile server.'],
  [/Emergency stop/, 'TeX stopped early. Fix the first error in the list.'],
  [/Float too large/, 'A figure or table is larger than the page. Scale it down.'],
  [/Overfull \\hbox/, 'A line is too wide for the text area. Rephrase, allow hyphenation or use \\sloppy.'],
  [/Underfull \\hbox/, 'A line is too loose, often caused by \\\\ or \\newline after a paragraph.'],
];

function hintFor(message) {
  for (const [re, hint] of HINTS) if (re.test(message)) return hint;
  return '';
}

const LINE_RE = /^l\.(\d+)\s?(.*)$/;
const FILE_LINE_ERROR_RE = /^((?:\.\/|\/|[A-Za-z]:)?[^:\s][^:]*?\.[A-Za-z0-9]+):(\d+): (.*)$/;
const WARNING_RE = /^((?:La|pdf|Xe|Lua)?TeX|Package\s+[\w\-.]+|Class\s+[\w\-.]+|LaTeX\s+[\w\-.]+)\s+Warning:\s*(.*)$/;
const BADBOX_RE = /^(Over|Under)full \\[hv]box .*?(?:at lines? (\d+)(?:--(\d+))?|detected at line (\d+)|while \\output is active)/;

export function parseLog(log, { isProjectFile = () => true, mapFile = (f) => f } = {}) {
  if (!log) return [];
  const lines = unwrap(log);
  const entries = [];
  const stack = [];
  const fileAt = () => {
    const f = projectFile(stack, isProjectFile);
    return f ? mapFile(f) : null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // "! LaTeX Error: ..." style error
    if (line.startsWith('! ')) {
      let message = line.slice(2).trim();
      const raw = [line];
      let lineNo = null;
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        raw.push(lines[j]);
        const m = LINE_RE.exec(lines[j]);
        if (m) {
          lineNo = Number(m[1]);
          if (lines[j + 1] !== undefined) raw.push(lines[j + 1]);
          break;
        }
        if (lines[j].startsWith('! ')) break;
        // "(inputenc)     not set up for use with LaTeX." continuation lines
        const cont = /^\([\w\-.]+\)\s+(.*)$/.exec(lines[j]);
        if (cont && j === i + raw.length - 1) message += ` ${cont[1].trim()}`;
      }
      entries.push({ level: 'error', message, file: fileAt(), line: lineNo, raw: raw.join('\n'), hint: hintFor(message) });
      continue;
    }

    // "./main.tex:12: Undefined control sequence." (-file-line-error)
    const fle = FILE_LINE_ERROR_RE.exec(line);
    if (fle && !/^\s/.test(line)) {
      const message = fle[3].trim();
      const raw = [line];
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        raw.push(lines[j]);
        if (LINE_RE.test(lines[j])) {
          if (lines[j + 1] !== undefined) raw.push(lines[j + 1]);
          break;
        }
      }
      entries.push({ level: 'error', message, file: mapFile(cleanFile(fle[1])), line: Number(fle[2]), raw: raw.join('\n'), hint: hintFor(message) });
      updateFileStack(line.slice(fle[0].length), stack);
      continue;
    }

    const w = WARNING_RE.exec(line);
    if (w) {
      const source = w[1];
      let message = w[2];
      const raw = [line];
      // Continuation lines: "(pkgname)   more text" or plain indented text until blank line.
      const pkg = /^(?:Package|Class)\s+(\S+)/.exec(source)?.[1];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '') {
        const l = lines[j];
        if (pkg && l.startsWith(`(${pkg})`)) {
          message += ` ${l.slice(pkg.length + 2).trim()}`;
        } else if (!pkg && /^\s{2,}\S/.test(l) === false && /^[a-z(`']/.test(l) && message.length < 400 && !/on input line \d+\.$/.test(message)) {
          message += ` ${l.trim()}`;
        } else break;
        raw.push(l);
        j++;
      }
      i = j - 1;
      const m = /on input line (\d+)/.exec(message);
      const level = /Font Warning/.test(source) ? 'typesetting' : 'warning';
      entries.push({
        level,
        message: `${source.startsWith('LaTeX') || /TeX$/.test(source) ? '' : `${source}: `}${message.trim()}`,
        file: fileAt(),
        line: m ? Number(m[1]) : null,
        raw: raw.join('\n'),
        hint: hintFor(message),
      });
      continue;
    }

    const b = BADBOX_RE.exec(line);
    if (b) {
      const lineNo = Number(b[2] || b[4]) || null;
      entries.push({ level: 'typesetting', message: line.trim(), file: fileAt(), line: lineNo, raw: line, hint: hintFor(line) });
      // Skip the box content dump that follows.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && !lines[j].startsWith('!')) j++;
      i = j - 1;
      continue;
    }

    if (/^No pages of output\./.test(line)) {
      entries.push({ level: 'warning', message: 'No pages of output.', file: null, line: null, raw: line, hint: 'The document body is empty.' });
    }
    if (/^Runaway argument\?/.test(line)) continue;

    updateFileStack(line, stack);
  }

  // De-duplicate identical entries (LaTeX sometimes repeats rerun warnings).
  const seen = new Set();
  return entries.filter((e) => {
    const key = `${e.level}|${e.file}|${e.line}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarize(entries) {
  return {
    errors: entries.filter((e) => e.level === 'error').length,
    warnings: entries.filter((e) => e.level === 'warning').length,
    typesetting: entries.filter((e) => e.level === 'typesetting').length,
  };
}
