// FreeTex desktop app: runs the FreeTex compile server inside Electron and
// shows the editor in a window. Projects are stored in the app's own browser
// storage; compiled with the local TeX installation when one is found, and
// through texlive.net otherwise.

const { app, BrowserWindow, dialog, shell, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// A fixed port keeps the page origin (and therefore the stored projects) stable.
const PORT = Number(process.env.FREETEX_PORT || 47823);
const SMOKE = process.argv.includes('--smoke-test');
const ICON = path.join(__dirname, 'build', 'icon.png');

let mainWindow = null;

// GUI apps often start with a minimal PATH; add the usual TeX locations.
function extendPath() {
  const extra = [];
  const addVersioned = (root, suffixes) => {
    try {
      for (const year of fs.readdirSync(root).sort().reverse()) {
        for (const s of suffixes) extra.push(path.join(root, year, 'bin', s));
      }
    } catch { /* not installed */ }
  };
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    extra.push(path.join(local, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'), path.join(pf, 'MiKTeX', 'miktex', 'bin', 'x64'));
    addVersioned('C:\\texlive', ['windows', 'win64', 'win32']);
    extra.push('C:\\Strawberry\\perl\\bin');
  } else if (process.platform === 'darwin') {
    extra.push('/Library/TeX/texbin', '/opt/homebrew/bin', '/usr/local/bin');
    addVersioned('/usr/local/texlive', ['universal-darwin', 'x86_64-darwin', 'arm64-darwin']);
  } else {
    addVersioned('/usr/local/texlive', ['x86_64-linux', 'aarch64-linux']);
    extra.push('/usr/local/bin', '/usr/bin');
  }
  const current = (process.env.PATH || '').split(path.delimiter);
  const add = extra.filter((p) => p && !current.includes(p) && fs.existsSync(p));
  process.env.PATH = [...current, ...add].filter(Boolean).join(path.delimiter);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 360,
    minHeight: 480,
    title: 'FreeTex',
    icon: ICON,
    autoHideMenuBar: true,
    show: !SMOKE,
    backgroundColor: '#f8fafc',
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  // External links open in the default browser; PDF previews (blob:) open in a new window.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('blob:') || target.startsWith(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICON } };
    if (/^(https?|mailto):/i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      if (/^(https?|mailto):/i.test(target)) shell.openExternal(target);
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  return mainWindow.loadURL(`${url}/`);
}

// ---------------------------------------------------------------------------
// --smoke-test: used by CI to check a packaged build. Writes a JSON report to
// FREETEX_SMOKE_OUT (if set) and exits with 0 on success.

async function smokeTest(base) {
  const report = { platform: process.platform };
  try {
    report.ui = await mainWindow.webContents.executeJavaScript(`new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (document.body.innerText.includes('FreeTex')) resolve(true);
        else if (Date.now() - start > 20000) resolve(false);
        else setTimeout(check, 250);
      })();
    })`);
    const health = await (await fetch(`${base}/api/health`)).json();
    report.health = health.freetex === true;
    report.tex = !!health.tex;
    const doc = '\\documentclass{article}\\begin{document}Hello from FreeTex \\(e^{i\\pi}+1=0\\)\\end{document}\n';
    if (health.tex) {
      const res = await fetch(`${base}/api/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'smoke-test', main: 'main.tex', engine: 'pdflatex', bibTool: 'none', files: [{ path: 'main.tex', encoding: 'utf8', content: doc }] }),
      });
      report.localCompile = !!(await res.json()).pdf;
    }
    try {
      const form = new FormData();
      form.append('engine', 'pdflatex');
      form.append('return', 'pdf');
      form.append('filename[]', 'document.tex');
      form.append('filecontents[]', doc);
      const res = await fetch(`${base}/api/texlivenet`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
      const bytes = Buffer.from(await res.arrayBuffer());
      report.texliveNet = bytes.subarray(0, 4).toString() === '%PDF';
      if (!report.texliveNet) report.texliveNetResponse = bytes.subarray(0, 300).toString();
    } catch (e) {
      report.texliveNet = false;
      report.texliveNetError = e.message;
    }
  } catch (e) {
    report.error = e.message;
  }
  // texlive.net is an external service, so it is reported but not required.
  report.ok = !!(report.ui && report.health && (!report.tex || report.localCompile));
  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (process.env.FREETEX_SMOKE_OUT) fs.writeFileSync(process.env.FREETEX_SMOKE_OUT, text);
  app.exit(report.ok ? 0 : 1);
}

// ---------------------------------------------------------------------------

async function boot() {
  extendPath();
  const { startServer } = await import(pathToFileURL(path.join(__dirname, 'app', 'server', 'index.js')).href);
  let started;
  try {
    started = await startServer({
      port: PORT,
      host: '127.0.0.1',
      staticDir: path.join(__dirname, 'app', 'web'),
      workdir: path.join(app.getPath('userData'), 'builds'),
      // Chromium's network stack honours the system proxy settings.
      fetch: (url, options) => net.fetch(url, options),
    });
  } catch (e) {
    const busy = e.code === 'EADDRINUSE';
    dialog.showErrorBox('FreeTex could not start', busy
      ? `Port ${PORT} is already in use by another program. Close it, or set the FREETEX_PORT environment variable to a free port.`
      : e.message);
    app.exit(1);
    return;
  }
  await createWindow(started.url);
  if (SMOKE) await smokeTest(started.url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(boot).catch((e) => {
    dialog.showErrorBox('FreeTex could not start', String(e && e.stack ? e.stack : e));
    app.exit(1);
  });
  app.on('window-all-closed', () => app.quit());
}
