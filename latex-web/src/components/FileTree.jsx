import { useMemo, useState } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText, BookOpen, Image as ImageIcon, File, FileCode, FilePlus, FolderPlus, Upload,
  Pencil, Trash2, Star, Download, FileType,
} from 'lucide-react';
import { Menu, MenuItem, MenuSeparator } from './ui.jsx';
import { basename, dirname, extname, isBibPath, isImagePath, isPdfPath, isTexPath } from '../lib/paths.js';
import { allFolders } from '../lib/projects.js';
import { t } from '../lib/i18n.js';

function fileIcon(path) {
  if (isTexPath(path)) return FileText;
  if (isBibPath(path)) return BookOpen;
  if (isImagePath(path)) return ImageIcon;
  if (isPdfPath(path)) return FileType;
  if (['sty', 'cls', 'bst', 'lua', 'py', 'js', 'json'].includes(extname(path))) return FileCode;
  return File;
}

function buildTree(project) {
  const root = { name: '', path: '', folders: new Map(), files: [] };
  const ensure = (dir) => {
    if (!dir) return root;
    const parent = ensure(dirname(dir));
    const name = basename(dir);
    if (!parent.folders.has(name)) parent.folders.set(name, { name, path: dir, folders: new Map(), files: [] });
    return parent.folders.get(name);
  };
  for (const f of allFolders(project)) ensure(f);
  for (const p of Object.keys(project.files)) ensure(dirname(p)).files.push(p);
  return root;
}

const DRAG_TYPE = 'application/x-freetex-path';

export default function FileTree({
  project, activePath, onOpen, onCreateFile, onCreateFolder, onUpload, onRename, onDelete, onMove, onSetMain, onDownload,
}) {
  const tree = useMemo(() => buildTree(project), [project]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [menu, setMenu] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const toggle = (path) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  const openMenu = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, ...target });
  };

  const dropHandlers = (dir) => ({
    onDragOver: (e) => {
      const types = [...e.dataTransfer.types];
      if (types.includes(DRAG_TYPE) || types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = types.includes('Files') ? 'copy' : 'move';
        setDropTarget(dir);
      }
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget((d) => (d === dir ? null : d));
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const moving = e.dataTransfer.getData(DRAG_TYPE);
      if (moving) {
        const { path, isFolder } = JSON.parse(moving);
        if (dirname(path) !== dir && !(isFolder && (dir === path || dir.startsWith(`${path}/`)))) onMove(path, dir, isFolder);
      } else if (e.dataTransfer.files.length) {
        onUpload(dir, [...e.dataTransfer.files]);
      }
    },
  });

  const renderFolder = (node, depth) => {
    const folders = [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name));
    const files = [...node.files].sort((a, b) => basename(a).localeCompare(basename(b)));
    return (
      <>
        {folders.map((f) => {
          const open = !collapsed.has(f.path);
          return (
            <div key={f.path} {...dropHandlers(f.path)}>
              <div
                role="treeitem"
                aria-expanded={open}
                tabIndex={0}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ path: f.path, isFolder: true }))}
                className={`flex cursor-pointer items-center gap-1 rounded py-1 pr-2 text-sm hover:bg-slate-200/70 dark:hover:bg-slate-800 ${dropTarget === f.path ? 'bg-brand-100 dark:bg-brand-700/30' : ''}`}
                style={{ paddingLeft: depth * 14 + 4 }}
                onClick={() => toggle(f.path)}
                onKeyDown={(e) => e.key === 'Enter' && toggle(f.path)}
                onContextMenu={(e) => openMenu(e, { path: f.path, isFolder: true })}
              >
                {open ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                {open ? <FolderOpen size={15} className="shrink-0 text-amber-500" /> : <Folder size={15} className="shrink-0 text-amber-500" />}
                <span className="truncate">{f.name}</span>
              </div>
              {open && renderFolder(f, depth + 1)}
            </div>
          );
        })}
        {files.map((p) => {
          const Icon = fileIcon(p);
          const active = p === activePath;
          const isMain = p === project.mainFile;
          return (
            <div
              key={p}
              role="treeitem"
              aria-selected={active}
              tabIndex={0}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ path: p, isFolder: false }))}
              className={`group flex cursor-pointer items-center gap-1.5 rounded py-1 pr-2 text-sm ${active ? 'bg-brand-600 text-white' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
              style={{ paddingLeft: depth * 14 + 22 }}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(p)}
              onContextMenu={(e) => openMenu(e, { path: p, isFolder: false })}
              title={p}
            >
              <Icon size={15} className={`shrink-0 ${active ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span className="truncate">{basename(p)}</span>
              {isMain && <Star size={12} className={`ml-auto shrink-0 ${active ? 'text-white' : 'text-amber-500'}`} fill="currentColor" aria-label={t('Main document')} />}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div
      className={`min-h-full p-1 ${dropTarget === '' ? 'bg-brand-50 dark:bg-brand-700/20' : ''}`}
      role="tree"
      onContextMenu={(e) => openMenu(e, { path: '', isFolder: true, root: true })}
      {...dropHandlers('')}
    >
      {renderFolder(tree, 0)}
      {Object.keys(project.files).length === 0 && <p className="p-3 text-xs text-slate-400">{t('No files yet. Create or upload one.')}</p>}

      {menu && (
        <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <div onClick={() => setMenu(null)}>
            {menu.isFolder ? (
              <>
                <MenuItem icon={FilePlus} onClick={() => onCreateFile(menu.path)}>{t('New file')}</MenuItem>
                <MenuItem icon={FolderPlus} onClick={() => onCreateFolder(menu.path)}>{t('New folder')}</MenuItem>
                <MenuItem icon={Upload} onClick={() => onUpload(menu.path)}>{t('Upload files')}</MenuItem>
                {!menu.root && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={Pencil} onClick={() => onRename(menu.path, true)}>{t('Rename')}</MenuItem>
                    <MenuItem icon={Trash2} danger onClick={() => onDelete(menu.path, true)}>{t('Delete')}</MenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                {isTexPath(menu.path) && menu.path !== project.mainFile && <MenuItem icon={Star} onClick={() => onSetMain(menu.path)}>{t('Set as main document')}</MenuItem>}
                <MenuItem icon={Pencil} onClick={() => onRename(menu.path, false)}>{t('Rename')}</MenuItem>
                <MenuItem icon={Download} onClick={() => onDownload(menu.path)}>{t('Download')}</MenuItem>
                <MenuSeparator />
                <MenuItem icon={Trash2} danger onClick={() => onDelete(menu.path, false)}>{t('Delete')}</MenuItem>
              </>
            )}
          </div>
        </Menu>
      )}
    </div>
  );
}
