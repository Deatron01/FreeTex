#!/usr/bin/env node
// FreeTex compile server.
//
// A small, dependency-free HTTP server that compiles FreeTex projects with a
// local TeX Live installation (latexmk) and answers SyncTeX queries. It can
// also serve the built web app (latex-web/dist), so one command runs everything.
//
// Environment variables:
//   PORT                         port to listen on (default 3001)
//   HOST                         interface to bind (default 127.0.0.1)
//   FREETEX_WORKDIR              where project build directories live (default: OS temp dir)
//   FREETEX_TIMEOUT              compile timeout in seconds (default 240)
//   FREETEX_ALLOW_SHELL_ESCAPE   set to 1 to allow projects to enable \write18
//   FREETEX_CORS_ORIGIN          value of Access-Control-Allow-Origin (default *)
//   FREETEX_STATIC_DIR           directory of the built web app (default ../latex-web/dist)

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const WORKDIR = path.resolve(process.env.FREETEX_WORKDIR || path.join(os.tmpdir(), 'freetex-builds'));
const TIMEOUT = Number(process.env.FREETEX_TIMEOUT || 240) * 1000;
const ALLOW_SHELL_ESCAPE = process.env.FREETEX_ALLOW_SHELL_ESCAPE === '1';
const CORS_ORIGIN = process.env.FREETEX_CORS_ORIGIN || '*';
const STATIC_DIR = path.resolve(process.env.FREETEX_STATIC_DIR || path.join(__dirname, '..', 'latex-web', 'dist'));
const MAX_BODY = 200 * 1024 * 1024;
const MANIFEST = '.freetex-manifest.json';
const VERSION = '1.0.0';

const OUTPUT_EXTS = new Set(['aux', 'bbl', 'blg', 'log', 'toc', 'lof', 'lot', 'out', 'idx', 'ind', 'ilg', 'glo', 'gls', 'glg', 'nav', 'snm', 'fls', 'bcf', 'run.xml', 'synctex.gz', 'pdf', 'xdv', 'dvi', 'ps']);

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n')[0].trim() : null;
}

const TOOLS = Object.fromEntries(
  ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'latex', 'platex', 'uplatex', 'context', 'pdftex', 'bibtex', 'biber', 'makeindex', 'makeglossaries', 'synctex', 'dvipdfmx']
    .map((t) => [t, !!which(t)]),
);

// ---------------------------------------------------------------------------
// helpers

function send(res, status, body, headers = {}) {
  const isBuffer = Buffer.isBuffer(body);
  const payload = isBuffer || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': isBuffer ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  return JSON.parse(buf.toString('utf8') || '{}');
}

const safeId = (id) => String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

// Resolve a project-relative path inside dir; refuse anything escaping it.
function resolveInside(dir, rel) {
  const clean = String(rel).replace(/\\/g, '/');
  if (!clean || clean.startsWith('/') || /^[A-Za-z]:/.test(clean)) throw new Error(`Invalid path: ${rel}`);
  const full = path.resolve(dir, clean);
  if (full !== dir && !full.startsWith(dir + path.sep)) throw new Error(`Invalid path: ${rel}`);
  return full;
}

function projectDir(projectId) {
  const id = safeId(projectId);
  if (!id) throw new Error('Missing projectId');
  return path.join(WORKDIR, id);
}

// Serialise compiles per project.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next.finally(() => {
    if (locks.get(key) === next) locks.delete(key);
  }));
  return next;
}

function run(cmd, args, cwd, timeout = TIMEOUT) {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(cmd, args, {
      cwd,
      detached: process.platform !== 'win32',
      env: { ...process.env, max_print_line: '10000', error_line: '254', half_error_line: '238' },
    });
    const timer = setTimeout(() => {
      out += `\n[FreeTex] Compile timed out after ${timeout / 1000}s and was stopped.\n`;
      try {
        if (child.pid) process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
      } catch { /* already exited */ }
    }, timeout);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out: `${out}\n${e.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

// ---------------------------------------------------------------------------
// compile

async function syncFiles(dir, files) {
  await fsp.mkdir(dir, { recursive: true });
  let previous = [];
  try {
    previous = JSON.parse(await fsp.readFile(path.join(dir, MANIFEST), 'utf8'));
  } catch { /* first compile */ }
  const current = new Set();
  for (const f of files) {
    const full = resolveInside(dir, f.path);
    const data = f.encoding === 'base64' ? Buffer.from(f.content || '', 'base64') : Buffer.from(f.content || '', 'utf8');
    current.add(path.relative(dir, full));
    await fsp.mkdir(path.dirname(full), { recursive: true });
    // Only write changed files so latexmk can skip unnecessary work.
    let same = false;
    try {
      same = (await fsp.readFile(full)).equals(data);
    } catch { /* new file */ }
    if (!same) await fsp.writeFile(full, data);
  }
  for (const rel of previous) {
    if (!current.has(rel)) await fsp.rm(path.join(dir, rel), { force: true }).catch(() => {});
  }
  await fsp.writeFile(path.join(dir, MANIFEST), JSON.stringify([...current]));
}

function latexmkArgs(opts) {
  const { engine, bibTool, makeglossaries, shellEscape, stopOnFirstError, main } = opts;
  const args = ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', '-norc'];
  if (!stopOnFirstError) args.push('-f');
  else args.push('-halt-on-error');
  args.push(shellEscape ? '-shell-escape' : '-no-shell-escape');
  switch (engine) {
    case 'xelatex': args.push('-xelatex'); break;
    case 'lualatex': args.push('-lualatex'); break;
    case 'latex': args.push('-pdfdvi'); break;
    case 'platex':
    case 'uplatex':
      args.push('-pdfdvi', `-latex=${engine} %O %S`, '-e', "$dvipdf='dvipdfmx %O -o %D %S';");
      break;
    default: args.push('-pdf');
  }
  if (bibTool === 'none') args.push('-bibtex-');
  else if (bibTool === 'bibtex8' || bibTool === 'pbibtex') args.push('-e', `$bibtex='${bibTool} %O %S';`);
  if (makeglossaries) {
    args.push('-e', "add_cus_dep('glo','gls',0,'run_makeglossaries'); add_cus_dep('acn','acr',0,'run_makeglossaries'); sub run_makeglossaries { return system('makeglossaries', $_[0]); }");
  }
  args.push(main);
  return args;
}

async function manualCompile(dir, opts) {
  // Used when latexmk is not installed: engine, bib tool, engine, engine.
  const { engine, main, shellEscape, stopOnFirstError } = opts;
  const base = path.basename(main).replace(/\.[^.]+$/, '');
  const bin = TOOLS[engine] ? engine : 'pdflatex';
  const args = ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', shellEscape ? '-shell-escape' : '-no-shell-escape'];
  if (stopOnFirstError) args.push('-halt-on-error');
  let out = '';
  let r = await run(bin, [...args, main], dir);
  out += r.out;
  const log = await fsp.readFile(path.join(dir, `${base}.log`), 'utf8').catch(() => '');
  let needsRerun = /Rerun to get|No file .*\.(aux|toc|bbl)/.test(log);
  if (opts.bibTool !== 'none') {
    const aux = await fsp.readFile(path.join(dir, `${base}.aux`), 'utf8').catch(() => '');
    const useBiber = opts.bibTool === 'biber' || (opts.bibTool === 'auto' && fs.existsSync(path.join(dir, `${base}.bcf`)));
    if (useBiber && TOOLS.biber) {
      out += (await run('biber', [base], dir)).out;
      needsRerun = true;
    } else if (/\\bibdata/.test(aux) && TOOLS.bibtex) {
      out += (await run(opts.bibTool === 'auto' ? 'bibtex' : opts.bibTool, [base], dir)).out;
      needsRerun = true;
    }
  }
  if (fs.existsSync(path.join(dir, `${base}.idx`)) && TOOLS.makeindex) {
    out += (await run('makeindex', [base], dir)).out;
    needsRerun = true;
  }
  if (needsRerun) {
    r = await run(bin, [...args, main], dir);
    out += r.out;
    r = await run(bin, [...args, main], dir);
    out += r.out;
  }
  return { code: r.code, out };
}

async function compile(body) {
  const dir = projectDir(body.projectId);
  const main = String(body.main || '');
  if (!main) throw new Error('No main document specified');
  resolveInside(dir, main);
  if (!Array.isArray(body.files)) throw new Error('Missing files');

  const opts = {
    main,
    engine: String(body.engine || 'pdflatex'),
    bibTool: String(body.bibTool || 'auto'),
    makeglossaries: !!body.makeglossaries,
    shellEscape: ALLOW_SHELL_ESCAPE && !!body.shellEscape,
    stopOnFirstError: !!body.stopOnFirstError,
  };

  return withLock(dir, async () => {
    const started = Date.now();
    await syncFiles(dir, body.files);
    const base = main.replace(/\.[^./]+$/, '').split('/').pop();
    const pdfPath = path.join(dir, `${base}.pdf`);
    await fsp.rm(pdfPath, { force: true });

    let result;
    if (opts.engine === 'context' || opts.engine === 'pdftex') {
      const args = opts.engine === 'context'
        ? ['--nonstopmode', '--synctex', main]
        : ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', main];
      result = await run(opts.engine, args, dir);
    } else if (TOOLS.latexmk) {
      result = await run('latexmk', latexmkArgs(opts), dir);
    } else {
      result = await manualCompile(dir, opts);
    }

    const log = await fsp.readFile(path.join(dir, `${base}.log`), 'utf8').catch(() => '');
    const pdf = await fsp.readFile(pdfPath).catch(() => null);
    const synctex = fs.existsSync(path.join(dir, `${base}.synctex.gz`)) || fs.existsSync(path.join(dir, `${base}.synctex`));
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const outputFiles = [];
    for (const e of entries) {
      if (!e.isFile() || e.name === MANIFEST) continue;
      const ext = e.name.slice(e.name.indexOf('.') + 1).toLowerCase();
      if (e.name.startsWith(`${base}.`) && OUTPUT_EXTS.has(ext)) {
        outputFiles.push({ name: e.name, size: (await fsp.stat(path.join(dir, e.name))).size });
      }
    }
    return {
      status: result.code === 0 && pdf ? 'success' : 'failure',
      exitCode: result.code,
      log: log || result.out,
      runLog: result.out.slice(-20000),
      pdf: pdf ? pdf.toString('base64') : null,
      synctex,
      outputFiles,
      duration: Date.now() - started,
    };
  });
}

// ---------------------------------------------------------------------------
// SyncTeX

function parseSynctex(out) {
  const records = [];
  let cur = null;
  for (const line of out.split('\n')) {
    const m = /^(\w+):(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'Output' || key === 'Input' && cur && cur.Input) {
      cur = {};
      records.push(cur);
    }
    if (!cur) {
      cur = {};
      records.push(cur);
    }
    cur[key] = value;
  }
  return records;
}

async function synctexView(body) {
  const dir = projectDir(body.projectId);
  const file = resolveInside(dir, String(body.file || ''));
  const pdf = await findPdf(dir);
  if (!pdf) return { results: [] };
  const r = await run('synctex', ['view', '-i', `${Number(body.line) || 1}:${Number(body.column) || 0}:${file}`, '-o', pdf], dir, 15000);
  const results = parseSynctex(r.out)
    .filter((rec) => rec.Page)
    .map((rec) => ({ page: Number(rec.Page), x: Number(rec.x), y: Number(rec.y), h: Number(rec.h), v: Number(rec.v), width: Number(rec.W), height: Number(rec.H) }));
  return { results };
}

async function synctexEdit(body) {
  const dir = projectDir(body.projectId);
  const pdf = await findPdf(dir);
  if (!pdf) return { result: null };
  const r = await run('synctex', ['edit', '-o', `${Number(body.page) || 1}:${Number(body.x) || 0}:${Number(body.y) || 0}:${pdf}`], dir, 15000);
  const rec = parseSynctex(r.out).find((x) => x.Input);
  if (!rec) return { result: null };
  let file = path.resolve(dir, rec.Input);
  file = path.relative(dir, file).split(path.sep).join('/');
  if (file.startsWith('..')) return { result: null };
  return { result: { file, line: Number(rec.Line) || 1, column: Math.max(0, Number(rec.Column) || 0) } };
}

async function findPdf(dir) {
  try {
    const manifest = JSON.parse(await fsp.readFile(path.join(dir, MANIFEST), 'utf8'));
    const bases = new Set(manifest.filter((f) => /\.tex$/i.test(f)).map((f) => path.basename(f).replace(/\.tex$/i, '')));
    for (const b of bases) {
      if (fs.existsSync(path.join(dir, `${b}.synctex.gz`)) && fs.existsSync(path.join(dir, `${b}.pdf`))) return path.join(dir, `${b}.pdf`);
    }
  } catch { /* no manifest */ }
  return null;
}

// ---------------------------------------------------------------------------
// static files

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.map': 'application/json', '.wasm': 'application/wasm', '.txt': 'text/plain',
};

async function serveStatic(req, res, pathname) {
  if (!fs.existsSync(STATIC_DIR)) {
    send(res, 404, 'FreeTex compile server is running. Build the web app (npm run build) to serve it from here, or use the Vite dev server.');
    return;
  }
  let file;
  try {
    file = resolveInside(STATIC_DIR, decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html');
  } catch {
    file = path.join(STATIC_DIR, 'index.html');
  }
  let stat = await fsp.stat(file).catch(() => null);
  if (!stat || stat.isDirectory()) {
    file = path.join(STATIC_DIR, 'index.html');
    stat = await fsp.stat(file).catch(() => null);
  }
  if (!stat) {
    send(res, 404, 'Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------------------
// router

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (pathname === '/api/health' && req.method === 'GET') {
      return send(res, 200, {
        freetex: true,
        version: VERSION,
        tools: TOOLS,
        latexmk: TOOLS.latexmk,
        synctex: TOOLS.synctex,
        shellEscapeAllowed: ALLOW_SHELL_ESCAPE,
      });
    }
    if (pathname === '/api/compile' && req.method === 'POST') {
      return send(res, 200, await compile(await readJson(req)));
    }
    if (pathname === '/api/synctex/view' && req.method === 'POST') {
      return send(res, 200, await synctexView(await readJson(req)));
    }
    if (pathname === '/api/synctex/edit' && req.method === 'POST') {
      return send(res, 200, await synctexEdit(await readJson(req)));
    }
    let m = /^\/api\/cache\/([^/]+)$/.exec(pathname);
    if (m && req.method === 'DELETE') {
      const dir = projectDir(decodeURIComponent(m[1]));
      await withLock(dir, () => fsp.rm(dir, { recursive: true, force: true }));
      return send(res, 200, { ok: true });
    }
    m = /^\/api\/output\/([^/]+)\/([^/]+)$/.exec(pathname);
    if (m && req.method === 'GET') {
      const dir = projectDir(decodeURIComponent(m[1]));
      const name = path.basename(decodeURIComponent(m[2]));
      const data = await fsp.readFile(path.join(dir, name)).catch(() => null);
      if (!data || name === MANIFEST) return send(res, 404, { error: 'Not found' });
      return send(res, 200, data, { 'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"` });
    }
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'Unknown endpoint' });
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
});

fs.mkdirSync(WORKDIR, { recursive: true });
server.listen(PORT, HOST, () => {
  const missing = !TOOLS.latexmk && !TOOLS.pdflatex;
  console.log(`FreeTex server listening on http://${HOST}:${PORT}`);
  console.log(`  build directory: ${WORKDIR}`);
  console.log(`  latexmk: ${TOOLS.latexmk ? 'yes' : 'no'}, synctex: ${TOOLS.synctex ? 'yes' : 'no'}, shell escape: ${ALLOW_SHELL_ESCAPE ? 'allowed' : 'disabled'}`);
  if (missing) console.warn('  WARNING: no TeX installation found on PATH. Install TeX Live or use the Docker image.');
  if (fs.existsSync(STATIC_DIR)) console.log(`  serving web app from ${STATIC_DIR}`);
});
