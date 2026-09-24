# FreeTex

FreeTex is a free, open source LaTeX editor that runs in the browser, in the style of Overleaf. You write on the left and see the compiled PDF on the right. It works without installing anything: it uses the public [texlive.net](https://texlive.net) service. If you have TeX Live installed, you can run the bundled compile server instead, which makes compiles faster and adds SyncTeX and full file support.

## Download (for friends: no setup needed)

Go to the [**Releases**](https://github.com/Deatron01/FreeTex/releases/latest) page and download the file for your system:

| System | File | How to start |
|---|---|---|
| Windows | `FreeTex-x.y.z-portable.exe` | Double-click it. Nothing to install. |
| Windows (installer) | `FreeTex-x.y.z-setup.exe` | Installs FreeTex with Start menu and desktop shortcuts |
| macOS | `FreeTex-x.y.z-mac-arm64.dmg` | Open it, drag FreeTex to Applications, then right-click → **Open** the first time (the app is not signed) |
| Linux | `FreeTex-x.y.z-linux-x86_64.AppImage` | `chmod +x` the file, then run it |

The desktop app has the whole editor and its own compile server built in. If [TeX Live](https://tug.org/texlive/) or [MiKTeX](https://miktex.org/) is installed, FreeTex uses it: compiling works offline and supports SyncTeX and every file type. Without TeX, projects are compiled online through texlive.net, so you need an internet connection. Projects are saved on your computer.

> Windows SmartScreen may warn about an unknown publisher because the app is not code-signed. Click **More info → Run anyway**.

## Features

**Projects**
- Project dashboard with search, sorting, rename, copy, trash/restore and permanent delete
- Templates: blank, example article, multi-file report, thesis/book with biblatex, Beamer slides, letter, CV and a Hungarian article
- Import a `.zip` or loose files (drag and drop anywhere); export any project as `.zip`
- Everything is stored locally in the browser (IndexedDB) and saved automatically

**Files**
- File tree with folders, drag-and-drop moves, rename, delete, download and uploads (including dropping files from your computer)
- Any `.tex` file can be set as the main document
- Built-in preview for images and PDFs

**Editor** (CodeMirror 6)
- LaTeX and BibTeX syntax highlighting, bracket matching, code folding for environments and sections
- Autocompletion for commands, environments (the snippet inserts the matching `\end`), `\ref`/`\eqref`/`\cref` labels, `\cite` keys from your `.bib` files, file names for `\input`/`\include`/`\includegraphics`, package and class names, and your own `\newcommand`s
- Press Enter after `\begin{…}` to close the environment automatically; `\item` lists continue on Enter
- Formatting toolbar: headings, bold/italic/underline/monospace, inline and display math, lists, links, references, citations, footnotes, a table generator and a figure inserter (it adds missing packages for you)
- Symbol palette (Greek letters, operators, relations, arrows, accents, delimiters, …)
- Find and replace (regex), project-wide search and replace, go to line, multiple cursors
- Vim and Emacs keybindings, themes, font, font size, line height, indentation, line wrapping, spell check

**Compiling**
- pdfLaTeX, XeLaTeX, LuaLaTeX, LaTeX (dvi→pdf), pLaTeX, upLaTeX, ConTeXt and plain pdfTeX
- BibTeX/Biber (automatic or forced), makeindex and makeglossaries
- Magic comments: `% !TeX program = xelatex`, `% !BIB program = biber`
- Recompile with a button, <kbd>Ctrl</kbd>+<kbd>S</kbd> or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, or automatically while you type; you can stop a running compile
- Log panel with errors, warnings and bad boxes. Each entry links to its file and line and has a hint for common errors. The raw log and other output files (`.bbl`, `.aux`, …) can be downloaded
- Errors and warnings are also marked in the editor gutter

**PDF viewer** (PDF.js)
- Continuous scrolling, zoom (fit width, fit page, presets, <kbd>Ctrl</kbd>+wheel), page navigation, selectable text, clickable links, full screen and download
- Keeps your scroll position when you recompile, and has an optional dark mode
- SyncTeX: double-click the PDF to jump to the source, or press <kbd>Ctrl</kbd>+<kbd>.</kbd> in the editor to jump to that spot in the PDF. With the texlive.net backend this falls back to matching the text

**More**
- History: a version is saved automatically when you compile. You can label versions, compare any version with the current state (diff), restore one file or the whole project, and download a version as `.zip`
- Word count (texcount-style: words in text, headers and captions, plus math, figure and table counts, per file)
- Resizable, collapsible panes: editor only, PDF only, or side by side. On phones one pane is shown at a time
- Light/dark/system theme; English and Hungarian interface

## Quick start

```bash
npm run setup     # install the web app's dependencies
npm run dev       # start the editor on http://localhost:5173
```

This setup compiles with texlive.net, so you don't need to install LaTeX.

### With the local compile server (recommended if you have TeX Live)

The compile server is in `server/`. It is a small Node.js program with no dependencies that runs `latexmk` on your own TeX Live installation.

```bash
npm run server    # starts the compile server on http://127.0.0.1:3001
npm run dev       # in another terminal; /api is proxied to the server
```

Or build the app once and let the server host it:

```bash
npm start         # builds latex-web and serves everything on http://127.0.0.1:3001
```

When the server is running, FreeTex uses it automatically. You can change this in **Settings → Compiler**.

### Desktop app

```bash
npm run desktop        # build the web app and start FreeTex in an Electron window
npm run dist:desktop   # build installers for the current OS into desktop/dist/
```

The **Desktop app** GitHub Actions workflow builds and tests the Windows, macOS and Linux versions on every push. To publish a release your friends can download:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow then creates a GitHub Release with the `.exe`, `.dmg` and `.AppImage` attached.

### Docker

```bash
docker build -t freetex .
docker run -p 3001:3001 freetex
```

The image contains the full TeX Live distribution, so it is large (several GB).

## Compile backends compared

| | Local compile server | texlive.net |
|---|---|---|
| Installation | TeX Live + Node.js | none |
| Folders, any file type (fonts, binary data) | ✅ | folders are flattened automatically; images and PDFs are converted; other binary files are not supported |
| SyncTeX | ✅ exact | approximate (text matching) |
| PDF despite errors | ✅ | ❌ (returns the log) |
| Shell escape (`minted`, …) | opt-in (`FREETEX_ALLOW_SHELL_ESCAPE=1`) | ❌ |
| Project size limit | 200 MB | 1 MB |

texlive.net accepts only flat text files. Before sending a project, FreeTex:
- moves files out of folders and rewrites `\input`, `\include`, `\includegraphics`, `\graphicspath`, `\bibliography` and similar paths to match
- converts PNG/JPEG/GIF/WebP/SVG images and binary PDFs into 7-bit ASCII PDFs, and adds a graphics rule so `\includegraphics{img.png}` keeps working
- maps error locations in the log back to your original files

You can also point FreeTex at any other server that runs [latexcgi](https://github.com/davidcarlisle/latexcgi), in **Settings → Compiler**.

## Compile server configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | Port to listen on |
| `HOST` | `127.0.0.1` | Interface to bind (`0.0.0.0` to expose it) |
| `FREETEX_WORKDIR` | OS temp dir | Where build directories are kept (they are reused between compiles, which makes recompiles faster) |
| `FREETEX_TIMEOUT` | `240` | Compile timeout in seconds |
| `FREETEX_ALLOW_SHELL_ESCAPE` | off | Set to `1` to let projects enable `\write18` |
| `FREETEX_CORS_ORIGIN` | `*` | `Access-Control-Allow-Origin` header |
| `FREETEX_STATIC_DIR` | `latex-web/dist` | Built web app to serve |

API: `GET /api/health`, `POST /api/compile`, `POST /api/texlivenet` (relay to texlive.net; used automatically when no TeX is installed), `POST /api/synctex/view`, `POST /api/synctex/edit`, `GET /api/output/:project/:file`, `DELETE /api/cache/:project`.

> **Security:** the server compiles whatever LaTeX it receives. It listens only on localhost by default and keeps shell escape off. If you expose it to other people, put it behind authentication and run it in a container (for example the Docker image, which runs as `nobody`).

## Project layout

```
latex-web/            React + Vite + Tailwind front end
  src/components/     UI: dashboard, editor page, file tree, PDF viewer, logs, history, …
  src/lib/            storage (IndexedDB), compile backends, log parser, LaTeX language support,
                      project index (labels, citations, outline, word count), image→PDF converter, i18n
server/index.js       compile server (latexmk + SyncTeX), also serves the built app
desktop/              Electron wrapper (main.cjs) that embeds the server; packaged with electron-builder
Dockerfile            web app + server + TeX Live in one image
```

## Differences from Overleaf

FreeTex is a single-user editor. Projects are stored in your browser, so there is no real-time collaboration, sharing, commenting or track changes. Use the `.zip` export (or a Git repository) to move or share projects.
