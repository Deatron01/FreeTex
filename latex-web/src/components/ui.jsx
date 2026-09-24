/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { t } from '../lib/i18n.js';

export function Modal({ title, onClose, children, footer, width = 'max-w-lg', bodyClass = 'p-5' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold">{title}</h2>
          {onClose && (
            <button type="button" className="btn-icon" onClick={onClose} aria-label={t('Close')}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className={`min-h-0 flex-1 overflow-auto ${bodyClass}`}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Floating menu (dropdown and context menu) ----------

export function Menu({ x, y, anchor, onClose, children, align = 'left' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x ?? 0, top: y ?? 0, visibility: 'hidden' });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let left = x ?? 0;
    let top = y ?? 0;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      left = align === 'right' ? r.right - el.offsetWidth : r.left;
      top = r.bottom + 4;
    }
    left = Math.max(4, Math.min(left, window.innerWidth - el.offsetWidth - 4));
    if (top + el.offsetHeight > window.innerHeight - 4) top = Math.max(4, (anchor ? anchor.getBoundingClientRect().top - el.offsetHeight - 4 : window.innerHeight - el.offsetHeight - 4));
    setPos({ left, top, visibility: 'visible' });
  }, [x, y, anchor, align]);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !(anchor && anchor.contains(e.target))) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onBlur = () => onClose();
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
  }, [onClose, anchor]);

  return createPortal(
    <div ref={ref} className="menu fixed max-h-[80vh] overflow-y-auto" style={pos} onClick={(e) => e.stopPropagation()} role="menu">
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({ icon: Icon, children, onClick, shortcut, disabled, danger, checked }) {
  return (
    <button type="button" role="menuitem" className={`menu-item ${danger ? 'text-red-600 dark:text-red-400' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="flex w-4 justify-center">{checked !== undefined ? (checked ? '✓' : '') : Icon ? <Icon size={15} /> : null}</span>
      <span className="flex-1">{children}</span>
      {shortcut && <span className="ml-4 text-xs text-slate-400">{shortcut}</span>}
    </button>
  );
}

export const MenuSeparator = () => <div className="menu-sep" />;
export const MenuLabel = ({ children }) => <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</div>;

// A button that opens a dropdown menu.
export function Dropdown({ button, children, align = 'left', className = 'btn', title, disabled }) {
  const [anchor, setAnchor] = useState(null);
  const open = !!anchor;
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      <button type="button" className={`${className} ${open ? 'btn-active' : ''}`} onClick={(e) => { const el = e.currentTarget; setAnchor((a) => (a ? null : el)); }} title={title} disabled={disabled} aria-haspopup="menu" aria-expanded={open}>
        {button}
      </button>
      {open && (
        <Menu anchor={anchor} onClose={close} align={align}>
          <div onClick={close}>{typeof children === 'function' ? children(close) : children}</div>
        </Menu>
      )}
    </>
  );
}

// ---------- Dialog service: confirm / prompt ----------

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ type: 'confirm', ...opts, resolve })), []);
  const prompt = useCallback((opts) => new Promise((resolve) => {
    setValue(opts.value || '');
    setDialog({ type: 'prompt', ...opts, resolve });
  }), []);
  const alert = useCallback((opts) => new Promise((resolve) => setDialog({ type: 'alert', ...opts, resolve })), []);

  const finish = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => finish(dialog.type === 'prompt' ? null : false)}
          footer={(
            <>
              {dialog.type !== 'alert' && <button type="button" className="btn-outline" onClick={() => finish(dialog.type === 'prompt' ? null : false)}>{t('Cancel')}</button>}
              <button
                type="button"
                className={dialog.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => finish(dialog.type === 'prompt' ? value : true)}
                disabled={dialog.type === 'prompt' && dialog.validate && !!dialog.validate(value)}
              >
                {dialog.confirmLabel || t('OK')}
              </button>
            </>
          )}
        >
          {dialog.message && <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{dialog.message}</p>}
          {dialog.type === 'prompt' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!(dialog.validate && dialog.validate(value))) finish(value);
            }}
            >
              {dialog.label && <label className="label mt-2">{dialog.label}</label>}
              <input
                className="input"
                autoFocus
                value={value}
                placeholder={dialog.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onFocus={(e) => {
                  const v = e.target.value;
                  const dot = dialog.selectBeforeDot ? v.lastIndexOf('.') : -1;
                  e.target.setSelectionRange(0, dot > 0 ? dot : v.length);
                }}
              />
              {dialog.validate && value && dialog.validate(value) && <p className="mt-1 text-xs text-red-600">{dialog.validate(value)}</p>}
            </form>
          )}
        </Modal>
      )}
    </DialogContext.Provider>
  );
}

export const useDialogs = () => useContext(DialogContext);

// ---------- Toasts ----------

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'info', timeout = 4000) => {
    const id = Math.random();
    setToasts((ts) => [...ts, { id, message, type }]);
    if (timeout) setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), timeout);
  }, []);
  const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
  const colors = { success: 'text-emerald-500', error: 'text-red-500', warning: 'text-amber-500', info: 'text-sky-500' };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-80 flex-col gap-2">
          {toasts.map((ts) => {
            const Icon = icons[ts.type] || Info;
            return (
              <div key={ts.id} className="pointer-events-auto flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <Icon size={18} className={`mt-0.5 shrink-0 ${colors[ts.type]}`} />
                <div className="flex-1 whitespace-pre-line break-words">{ts.message}</div>
                <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setToasts((all) => all.filter((x) => x.id !== ts.id))}><X size={14} /></button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------- Resizable split handle ----------

export function Resizer({ onResize, direction = 'horizontal', onDoubleClick }) {
  const onPointerDown = (e) => {
    e.preventDefault();
    const start = direction === 'horizontal' ? e.clientX : e.clientY;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.classList.add('select-none');
    // Iframes swallow pointer events while dragging; disable them temporarily.
    document.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = 'none'; });
    let last = start;
    const move = (ev) => {
      const pos = direction === 'horizontal' ? ev.clientX : ev.clientY;
      onResize(pos - last, pos);
      last = pos;
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.classList.remove('select-none');
      document.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = ''; });
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={`group relative z-10 shrink-0 bg-slate-200 transition-colors hover:bg-brand-500 dark:bg-slate-700 ${direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}`}
    />
  );
}

export function Spinner({ size = 16, className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Select({ value, onChange, options, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <select className="input w-48 shrink-0" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
