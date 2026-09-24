// Copies the compile server and the built web app into desktop/app so that
// electron-builder can package them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '..');
const root = path.resolve(desktop, '..');
const out = path.join(desktop, 'app');
const web = path.join(root, 'latex-web', 'dist');

if (!fs.existsSync(path.join(web, 'index.html'))) {
  console.error('latex-web/dist is missing. Build the web app first: npm --prefix latex-web run build');
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'server'), { recursive: true });
for (const f of ['index.js', 'package.json']) fs.copyFileSync(path.join(root, 'server', f), path.join(out, 'server', f));
fs.cpSync(web, path.join(out, 'web'), { recursive: true });
console.log(`Staged server and web app into ${path.relative(root, out)}`);
