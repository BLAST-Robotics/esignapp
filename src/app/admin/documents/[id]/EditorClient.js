'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureChart from '@/components/SignatureChart';
import ThemeToggle from '@/components/ThemeToggle';

function genId() {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(ta);
  }
}

function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getToken() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('ks_token') || '';
  } catch {
    return '';
  }
}

const FIELD_TYPES = [
  { value: 'name', label: 'Name', icon: 'Aa' },
  { value: 'signature', label: 'Signature', icon: '\u270D' },
  { value: 'date', label: 'Date', icon: '\uD83D\uDCC5' },
  { value: 'email', label: 'Email', icon: '@' },
  { value: 'phone', label: 'Phone', icon: '\u260E' },
  { value: 'other', label: 'Other', icon: '\u2699' },
];

const FIELD_COLORS = {
  name: { bg: 'rgba(16,185,129,0.12)', border: '#10b981' },
  signature: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' },
  date: { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6' },
  email: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' },
  phone: { bg: 'rgba(236,72,153,0.12)', border: '#ec4899' },
  other: { bg: 'rgba(107,114,128,0.12)', border: '#6b7280' },
};

const VALIDATION_OPTIONS = [
  { value: 'none', label: 'No validation' },
  { value: 'required', label: 'Required' },
  { value: 'email', label: 'Valid email' },
  { value: 'phone', label: 'Valid phone' },
  { value: 'min2', label: 'Min 2 characters' },
];

function DraggableField({ field, scale, selected, onSelect, onUpdate, onEdit }) {
  const elRef = useRef(null);
  const dragRef = useRef(null);
  const c = FIELD_COLORS[field.field_type] || FIELD_COLORS.other;

  if (!dragRef.current) dragRef.current = { ...field };
  Object.assign(dragRef.current, field);

  const commit = useCallback(() => {
    const d = dragRef.current;
    onUpdate({ ...field, x: Math.round(d.x), y: Math.round(d.y), width: Math.round(d.w), height: Math.round(d.h) });
  }, [field, onUpdate]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !selected) return;
    let startX, startY, startFX, startFY;
    function down(e) {
      if (e.button !== 0) return;
      if (e.target.dataset?.handle) return;
      e.preventDefault();
      const d = dragRef.current;
      startX = e.clientX;
      startY = e.clientY;
      startFX = d.x;
      startFY = d.y;
      el.style.cursor = 'grabbing';
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
    function move(e) {
      const d = dragRef.current;
      d.x = startFX + (e.clientX - startX) / scale;
      d.y = startFY + (e.clientY - startY) / scale;
      el.style.left = `${d.x * scale}px`;
      el.style.top = `${d.y * scale}px`;
    }
    function up() {
      el.style.cursor = 'grab';
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      commit();
    }
    el.addEventListener('pointerdown', down);
    return () => {
      el.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [selected, scale, commit]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !selected) return;
    let startX, startY, startRW, startRH, startRX, startRY;
    function down(e) {
      if (e.button !== 0) return;
      const h = e.target.dataset?.handle;
      if (!h) return;
      e.preventDefault();
      const d = dragRef.current;
      startX = e.clientX;
      startY = e.clientY;
      startRW = d.w;
      startRH = d.h;
      startRX = d.x;
      startRY = d.y;
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
    function move(e) {
      const d = dragRef.current;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      if (h.includes('e')) d.w = Math.max(50, startRW + dx);
      if (h.includes('w')) {
        d.w = Math.max(50, startRW - dx);
        d.x = startRX + dx;
      }
      if (h.includes('s')) d.h = Math.max(30, startRH + dy);
      if (h.includes('n')) {
        d.h = Math.max(30, startRH - dy);
        d.y = startRY + dy;
      }
      el.style.width = `${d.w * scale}px`;
      el.style.height = `${d.h * scale}px`;
      el.style.left = `${d.x * scale}px`;
      el.style.top = `${d.y * scale}px`;
    }
    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      commit();
    }
    el.addEventListener('pointerdown', down);
    return () => {
      el.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [selected, scale, commit]);

  const H = 8;
  return (
    <div
      ref={elRef}
      data-field-id={field.id}
      onPointerDown={() => onSelect(field.id)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onEdit?.(field.id);
      }}
      style={{
        position: 'absolute',
        left: `${(field.x || 0) * scale}px`,
        top: `${(field.y || 0) * scale}px`,
        width: `${(field.width || 200) * scale}px`,
        height: `${(field.height || 40) * scale}px`,
        backgroundColor: selected ? c.border : c.bg,
        border: `2px ${selected ? 'solid' : 'dashed'} ${selected ? '#000' : c.border}`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(8, (field.font_size || 12) * scale)}px`,
        fontWeight: selected ? 600 : 400,
        color: selected ? '#fff' : '#000',
        cursor: 'grab',
        zIndex: selected ? 10 : 1,
        overflow: 'visible',
        padding: '2px',
        boxSizing: 'border-box',
        touchAction: 'none',
        userSelect: 'none',
        boxShadow: selected ? '0 4px 16px rgba(0,0,0,0.18)' : 'none',
      }}
    >
      <span style={{ pointerEvents: 'none', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
        {field.label || field.field_type}
      </span>
      {selected && (
        <>
          <span
            data-handle="nw"
            style={{
              position: 'absolute',
              top: `-${H / 2}px`,
              left: `-${H / 2}px`,
              width: `${H}px`,
              height: `${H}px`,
              backgroundColor: '#fff',
              border: '2px solid #000',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              zIndex: 20,
            }}
          />
          <span
            data-handle="ne"
            style={{
              position: 'absolute',
              top: `-${H / 2}px`,
              right: `-${H / 2}px`,
              width: `${H}px`,
              height: `${H}px`,
              backgroundColor: '#fff',
              border: '2px solid #000',
              borderRadius: '50%',
              cursor: 'nesw-resize',
              zIndex: 20,
            }}
          />
          <span
            data-handle="sw"
            style={{
              position: 'absolute',
              bottom: `-${H / 2}px`,
              left: `-${H / 2}px`,
              width: `${H}px`,
              height: `${H}px`,
              backgroundColor: '#fff',
              border: '2px solid #000',
              borderRadius: '50%',
              cursor: 'nesw-resize',
              zIndex: 20,
            }}
          />
          <span
            data-handle="se"
            style={{
              position: 'absolute',
              bottom: `-${H / 2}px`,
              right: `-${H / 2}px`,
              width: `${H}px`,
              height: `${H}px`,
              backgroundColor: '#fff',
              border: '2px solid #000',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              zIndex: 20,
            }}
          />
        </>
      )}
    </div>
  );
}

function CtxFieldEditor({
  ctxFieldId,
  ctxNewPos,
  ctxPos,
  ctxRef,
  fields,
  numPages,
  selectedId,
  setCtxPos,
  setCtxFieldId,
  setCtxNewPos,
  updateField,
  addField,
  removeField,
  canEdit,
}) {
  const f = fields.find((x) => x.id === ctxFieldId);
  const isNew = ctxNewPos && !ctxFieldId;
  const posRef = useRef({ x: ctxPos.x, y: ctxPos.y });
  const sizeRef = useRef({ w: 320, h: 400 });

  useEffect(() => {
    const el = ctxRef.current;
    if (!el) return;
    let startX, startY, startPX, startPY;
    function down(e) {
      if (e.target.dataset?.ctxclose) return;
      if (e.target.dataset?.resize) return;
      const h = e.target.closest('[data-ctxheader]');
      if (!h) return;
      startX = e.clientX;
      startY = e.clientY;
      startPX = posRef.current.x;
      startPY = posRef.current.y;
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
    function move(e) {
      posRef.current.x = startPX + (e.clientX - startX);
      posRef.current.y = startPY + (e.clientY - startY);
      el.style.left = `${posRef.current.x}px`;
      el.style.top = `${posRef.current.y}px`;
    }
    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    }
    el.addEventListener('pointerdown', down);
    return () => {
      el.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [ctxRef.current]);

  useEffect(() => {
    const el = ctxRef.current;
    if (!el) return;
    let startX, startY, startSW, startSH;
    function rdown(e) {
      if (!e.target.dataset?.resize) return;
      startX = e.clientX;
      startY = e.clientY;
      startSW = sizeRef.current.w;
      startSH = sizeRef.current.h;
      document.addEventListener('pointermove', rmove);
      document.addEventListener('pointerup', rup);
    }
    function rmove(e) {
      const d = sizeRef.current;
      d.w = Math.max(280, startSW + (e.clientX - startX));
      d.h = Math.max(200, startSH + (e.clientY - startY));
      el.style.width = `${d.w}px`;
      el.style.height = `${d.h}px`;
    }
    function rup() {
      document.removeEventListener('pointermove', rmove);
      document.removeEventListener('pointerup', rup);
    }
    el.addEventListener('pointerdown', rdown);
    return () => {
      el.removeEventListener('pointerdown', rdown);
      document.removeEventListener('pointermove', rmove);
      document.removeEventListener('pointerup', rup);
    };
  }, [ctxRef.current]);

  function close() {
    setCtxPos(null);
    setCtxFieldId(null);
    setCtxNewPos(null);
  }

  return (
    <div
      ref={ctxRef}
      style={{ position: 'fixed', left: ctxPos.x, top: ctxPos.y, zIndex: 1000, width: 320 }}
      className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden"
    >
      <div
        data-ctxheader
        className="px-4 py-2.5 bg-neutral-800 flex items-center justify-between cursor-grab select-none"
        style={{ touchAction: 'none' }}
      >
        <span className="text-xs font-medium text-neutral-300 flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="w-3 h-3 text-neutral-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          {isNew ? 'New Field' : f?.label || 'Edit Field'}
        </span>
        <button
          type="button"
          data-ctxclose
          onClick={close}
          className="p-0.5 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {isNew ? (
        <div className="p-5 text-center space-y-3">
          <p className="text-xs text-neutral-400">Create a new field at this position?</p>
          <button
            type="button"
            onClick={() => {
              addField(ctxNewPos);
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-all"
          >
            Create Field
          </button>
          <button
            type="button"
            onClick={close}
            className="w-full px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-all"
          >
            Cancel
          </button>
        </div>
      ) : f ? (
        <>
          <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="field-label" className="block text-[10px] text-neutral-500 mb-0.5 font-medium">
                  Label
                </label>
                <input
                  id="field-label"
                  type="text"
                  value={f.label}
                  onChange={(e) => updateField({ ...f, label: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label htmlFor="field-type" className="block text-[10px] text-neutral-500 mb-0.5 font-medium">
                  Type
                </label>
                <select
                  id="field-type"
                  value={f.field_type}
                  onChange={(e) => updateField({ ...f, field_type: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canEdit}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['x', 'y', 'width', 'height'].map((prop) => (
                <div key={prop}>
                  <label
                    htmlFor={`field-${prop}`}
                    className="block text-[10px] text-neutral-500 mb-0.5 font-medium uppercase"
                  >
                    {prop}
                  </label>
                  <input
                    id={`field-${prop}`}
                    type="number"
                    value={f[prop] ?? 0}
                    onChange={(e) => updateField({ ...f, [prop]: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="field-font-size" className="block text-[10px] text-neutral-500 mb-0.5 font-medium">
                  Font Size
                </label>
                <input
                  id="field-font-size"
                  type="number"
                  value={f.font_size || 14}
                  onChange={(e) => updateField({ ...f, font_size: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label htmlFor="field-page" className="block text-[10px] text-neutral-500 mb-0.5 font-medium">
                  Page
                </label>
                <select
                  id="field-page"
                  value={f.page_number || 0}
                  onChange={(e) => updateField({ ...f, page_number: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canEdit}
                >
                  {Array.from({ length: numPages || 1 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Page {i + 1}
                      {numPages && i + 1 === numPages ? ' (last)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {f.field_type === 'signature' && (
                <>
                  <div>
                    <label
                      htmlFor="field-default-method"
                      className="block text-[10px] text-neutral-500 mb-0.5 font-medium"
                    >
                      Default Method
                    </label>
                    <select
                      id="field-default-method"
                      value={f.default_method || 'draw'}
                      onChange={(e) => updateField({ ...f, default_method: e.target.value })}
                      className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={!canEdit}
                    >
                      <option value="draw">Draw on canvas</option>
                      <option value="auto">Use full name (auto)</option>
                      <option value="type">Type custom text</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="field-signature-name"
                      className="block text-[10px] text-neutral-500 mb-0.5 font-medium"
                    >
                      Auto-sign name
                    </label>
                    <input
                      id="field-signature-name"
                      type="text"
                      value={f.signature_name || ''}
                      onChange={(e) => updateField({ ...f, signature_name: e.target.value })}
                      placeholder="Leave blank to use signer's name"
                      className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-500"
                      disabled={!canEdit}
                    />
                  </div>
                </>
              )}
              {f.field_type === 'date' && (
                <div>
                  <label htmlFor="field-date-format" className="block text-[10px] text-neutral-500 mb-0.5 font-medium">
                    Date Format
                  </label>
                  <select
                    id="field-date-format"
                    value={f.date_format || 'signing'}
                    onChange={(e) => updateField({ ...f, date_format: e.target.value })}
                    className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canEdit}
                  >
                    <option value="signing">Date of signing</option>
                    <option value="MMMM D, YYYY">January 5, 2026</option>
                    <option value="MM/DD/YYYY">01/05/2026</option>
                    <option value="DD/MM/YYYY">05/01/2026</option>
                    <option value="YYYY-MM-DD">2026-01-05</option>
                  </select>
                </div>
              )}
            </div>
            {/* Field validation */}
            <div>
              <label htmlFor="field-validation" className="block text-[10px] text-neutral-500 mb-0.5 font-medium">
                Validation
              </label>
              <select
                id="field-validation"
                value={f.validation || 'required'}
                onChange={(e) => updateField({ ...f, validation: e.target.value })}
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={!canEdit}
              >
                {VALIDATION_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                removeField(f.id);
                close();
              }}
              className="w-full mt-1 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-all"
            >
              Delete Field
            </button>
          </div>
          <div className="px-4 py-3 border-t border-neutral-700 flex items-center justify-between">
            <button
              type="button"
              onClick={close}
              className="px-4 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={close}
              className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-all shadow-sm"
            >
              Done
            </button>
          </div>
          <div
            data-resize
            style={{
              position: 'absolute',
              right: '-3px',
              bottom: '-3px',
              width: '12px',
              height: '12px',
              cursor: 'nwse-resize',
              zIndex: 10,
            }}
          >
            <svg aria-hidden="true" className="w-3 h-3 text-neutral-500" viewBox="0 0 12 12" fill="currentColor">
              <path d="M12 0v12H0l12-12z" />
            </svg>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function DocumentEditor({ documentId }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [doc, setDoc] = useState(null);
  const [fields, setFields] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pdfDims, setPdfDims] = useState({ width: 612, height: 792 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [title, setTitle] = useState('');
  const [tab, setTab] = useState('fields');
  const [signatures, setSignatures] = useState([]);
  const [loadingSigs, setLoadingSigs] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [editSig, setEditSig] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [slug, setSlug] = useState('');
  const [collectEmail, setCollectEmail] = useState(false);
  const [ctxFieldId, setCtxFieldId] = useState(null);
  const [ctxPos, setCtxPos] = useState(null);
  const [ctxNewPos, setCtxNewPos] = useState(null);
  const ctxRef = useRef(null);
  const pdfRef = useRef(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [permission, setPermission] = useState(null);

  // Sharing panel state
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePerm, setSharePerm] = useState('view');
  const [shareLoading, setShareLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);

  // Auth
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/admin');
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.push('/admin');
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push('/admin'));
  }, [router]);

  const token = getToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!documentId || !user) return;
    fetch(`/api/documents/${documentId}`, { headers: authHeaders })
      .then((r) => {
        if (r.status === 401) {
          router.push('/admin');
          throw new Error('Unauthorized');
        }
        return r.json();
      })
      .then((data) => {
        setDoc(data.document);
        setTitle(data.document.title || '');
        setSlug(data.document.slug || '');
        setFields(data.document.fields || []);
        setCollectEmail(data.document.collect_email || false);
        const perm = data.document.permission || null;
        setPermission(perm);
        const owner = user.role === 'admin' || data.document.user_id === user.userId;
        setCanEdit(owner || perm === 'edit' || perm === 'manage');
        setCanManage(owner || perm === 'manage');
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load document' }));
  }, [documentId, user, router.push, authHeaders]);

  const fetchSignatures = useCallback(async () => {
    if (!documentId) return;
    setLoadingSigs(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/signatures`, { headers: authHeaders });
      const data = await r.json();
      setSignatures(data.signatures || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSigs(false);
    }
  }, [documentId, authHeaders]);

  useEffect(() => {
    if (tab === 'signatures') fetchSignatures();
  }, [tab, fetchSignatures]);

  useEffect(() => {
    if (!ctxPos) return;
    function dismiss(e) {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) {
        setCtxPos(null);
        setCtxFieldId(null);
        setCtxNewPos(null);
      }
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [ctxPos]);

  const updateField = useCallback((updated) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updated.id ? { ...f, ...updated, width: updated.width, height: updated.height } : f)),
    );
    setSelectedId(updated.id);
  }, []);

  function handlePageContext(e, pn) {
    e.preventDefault();
    const modalW = 320,
      modalH = 400;
    const maxX = window.innerWidth - modalW - 16;
    const maxY = window.innerHeight - modalH - 16;
    const cx = Math.min(e.clientX, maxX);
    const cy = Math.min(e.clientY, maxY);
    const fieldEl = e.target.closest('[data-field-id]');
    if (fieldEl) {
      const fid = fieldEl.dataset.fieldId;
      setSelectedId(fid);
      setCtxFieldId(fid);
      setCtxNewPos(null);
      setCtxPos({ x: Math.max(16, cx), y: Math.max(16, cy) });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const pdfX = (e.clientX - rect.left) / scale;
    const pdfY = (e.clientY - rect.top) / scale;
    setCtxFieldId(null);
    setCtxNewPos({ x: Math.round(pdfX), y: Math.round(pdfY), page: pn });
    setCtxPos({ x: Math.max(16, cx), y: Math.max(16, cy) });
  }

  function getVisiblePage() {
    if (!pdfRef.current) return numPages || 1;
    const pages = pdfRef.current.querySelectorAll('[data-page]');
    if (pages.length === 0) return numPages || 1;
    const viewportCenter = window.scrollY + window.innerHeight / 2;
    let closest = pages[0];
    let minDist = Infinity;
    pages.forEach((page) => {
      const rect = page.getBoundingClientRect();
      const pageCenter = rect.top + rect.height / 2 + window.scrollY;
      const dist = Math.abs(pageCenter - viewportCenter);
      if (dist < minDist) { minDist = dist; closest = page; }
    });
    return parseInt(closest.dataset.page, 10) || numPages || 1;
  }

  function addField(pos) {
    const id = genId();
    const pageNum = pos?.page || getVisiblePage();
    const x = pos?.x ?? 50;
    const y = pos?.y ?? 50 + fields.length * 60;
    setFields((prev) => [
      ...prev,
      {
        id,
        x,
        y,
        width: 250,
        height: 40,
        font_size: 14,
        label: 'New Field',
        field_type: 'name',
        required: true,
        validation: 'required',
        page_number: pageNum,
      },
    ]);
    setSelectedId(id);
    setCtxFieldId(id);
    setCtxNewPos(null);
    setCtxPos({ x: typeof window !== 'undefined' ? window.innerWidth - 360 : 300, y: 120 });
  }

  function openFieldEdit(fid) {
    setSelectedId(fid);
    setCtxFieldId(fid);
    setCtxNewPos(null);
    setCtxPos({ x: typeof window !== 'undefined' ? window.innerWidth - 360 : 300, y: 120 });
    const f = fields.find((x) => x.id === fid);
    if (!f) return;
    const pageNum = (f.page_number || 0) === 0 ? numPages : f.page_number || 1;
    const pageEl = pdfRef.current?.querySelector(`[data-page="${pageNum}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function removeField(id) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function saveFields() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/fields`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error('Failed to save fields');
      await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, collect_email: collectEmail }),
      });
      setMessage({ type: 'success', text: 'Saved!' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function downloadSig(id) {
    setDownloadingId(id);
    try {
      const r = await fetch(`/api/admin/download?id=${id}`, { headers: authHeaders });
      if (!r.ok) throw new Error('Failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'signed-document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'Download failed' });
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteSig(id) {
    if (!confirm('Delete this signature submission?')) return;
    try {
      const r = await fetch(`/api/admin/signatures/${id}`, { method: 'DELETE', headers: authHeaders });
      if (!r.ok) throw new Error('Failed');
      setMessage({ type: 'success', text: 'Signature deleted' });
      fetchSignatures();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  }

  function startEdit(sig) {
    setEditSig(sig);
    setEditValues({ ...(sig.field_values || {}) });
  }

  function updateEditValue(fieldId, value) {
    setEditValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function saveEdit() {
    if (!editSig) return;
    try {
      const r = await fetch(`/api/admin/signatures/${editSig.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_values: editValues }),
      });
      if (!r.ok) throw new Error('Failed');
      setMessage({ type: 'success', text: 'Signature updated' });
      setEditSig(null);
      fetchSignatures();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update' });
    }
  }

  async function downloadAll() {
    setDownloadingAll(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/download-all`, { headers: authHeaders });
      if (!r.ok) throw new Error('Failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed-${doc?.slug || documentId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'Failed to download all' });
    } finally {
      setDownloadingAll(false);
    }
  }

  // Sharing functions
  async function loadPermissions() {
    try {
      const r = await fetch(`/api/documents/${documentId}/permissions`, { headers: authHeaders });
      const data = await r.json();
      setPermissions(data.permissions || []);
    } catch {}
  }

  async function addShare() {
    if (!shareEmail.trim()) return;
    setShareLoading(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/permissions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim(), permission: sharePerm }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessage({ type: 'error', text: data.error || 'Share failed' });
        return;
      }
      setShareEmail('');
      setMessage({ type: 'success', text: 'Shared!' });
      loadPermissions();
    } catch {
      setMessage({ type: 'error', text: 'Share failed' });
    } finally {
      setShareLoading(false);
    }
  }

  async function removeShare(email) {
    try {
      await fetch(`/api/documents/${documentId}/permissions?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      loadPermissions();
    } catch {}
  }

  useEffect(() => {
    if (showShare && documentId) loadPermissions();
    // biome-ignore lint/correctness/useExhaustiveDependencies: loadPermissions is stable
  }, [showShare, documentId, loadPermissions]);

  const pdfWidth = Math.min(700, typeof window !== 'undefined' ? window.innerWidth - 48 : 700);
  const scale = pdfDims.width > 0 ? pdfWidth / pdfDims.width : 1;
  const signLink = typeof window !== 'undefined' ? `${window.location.origin}/sign/${documentId}` : '';
  const friendlyLink = slug && typeof window !== 'undefined' ? `${window.location.origin}/s/${slug}` : signLink;

  if (!user || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <svg aria-hidden="true" className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading&hellip;
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 transition-colors duration-300">
      <header className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-neutral-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none focus:ring-0"
                disabled={!canEdit}
              />
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
            </div>
            {permission && (
              <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                {permission}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-neutral-700 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-1.5"
              >
                <svg
                  aria-hidden="true"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                  />
                </svg>
                Share
              </button>
            )}
            <ThemeToggle />
            {canManage && (
              <label className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-neutral-700 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all cursor-pointer">
                Replace PDF
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    try {
                      const r = await fetch(`/api/documents/${documentId}`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}` },
                        body: fd,
                      });
                      if (r.ok) {
                        setMessage({ type: 'success', text: 'PDF replaced!' });
                        setNumPages(null);
                      } else throw new Error('Failed');
                    } catch {
                      setMessage({ type: 'error', text: 'Failed to replace PDF' });
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={saveFields}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center gap-2 shadow-sm"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="sticky top-14 z-10 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-gray-200/80 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div
            className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-1 flex shadow-sm"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'fields'}
              onClick={() => setTab('fields')}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'fields' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Fields
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signatures'}
              onClick={() => setTab('signatures')}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'signatures' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Signatures {signatures.length > 0 && `(${signatures.length})`}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-2 flex items-center gap-1.5 shadow-sm">
              <span className="text-[10px] text-gray-400 font-medium uppercase">s/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-24 text-[11px] text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none focus:ring-0 p-0"
                placeholder="friendly-url"
                disabled={!canEdit}
              />
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-2 flex items-center gap-1.5 shadow-sm max-w-[180px]">
              <svg
                aria-hidden="true"
                className="w-3 h-3 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.57a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L5.1 12"
                />
              </svg>
              <input
                readOnly
                value={friendlyLink}
                onClick={(e) => e.target.select()}
                className="flex-1 text-[11px] text-gray-500 bg-gray-50 dark:bg-neutral-800 px-1.5 py-1 rounded border border-gray-200 dark:border-neutral-700 focus:outline-none select-all min-w-0"
              />
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(friendlyLink);
                  setMessage({ type: 'success', text: 'Copied!' });
                }}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 font-medium whitespace-nowrap shrink-0"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-16">
        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-sm border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
          >
            {message.text}
          </div>
        )}

        {tab === 'fields' && (
          <div>
            <div ref={pdfRef} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-800/50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Right-click fields or empty area &mdash; drag to reposition
                </span>
                <span className="text-[10px] text-gray-400 font-mono">{scale.toFixed(2)}x</span>
              </div>
              <Document
                file={`/api/public/document/${documentId}/pdf`}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setPdfDims({ width: 612, height: 792 });
                }}
                loading={<div className="py-24 text-center text-gray-400 text-sm">Loading&hellip;</div>}
                error={<div className="py-24 text-center text-red-400 text-sm">Could not load PDF</div>}
              >
                <div className="flex flex-col items-center p-2" style={{ backgroundColor: '#262626' }}>
                  {numPages &&
                    Array.from({ length: numPages }, (_, i) => {
                      const pn = i + 1;
                      const pageFields = fields.filter((f) =>
                        (f.page_number || 0) === 0 ? pn === numPages : (f.page_number || 0) === pn,
                      );
                      return (
                        <div
                          key={pn}
                          data-page={pn}
                          className="relative mb-4 last:mb-0 rounded-lg overflow-hidden"
                          style={{ width: pdfWidth, backgroundColor: '#404040' }}
                        >
                          <Page
                            pageNumber={pn}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            width={pdfWidth}
                          />
                          <section
                            aria-label="PDF document area"
                            className="absolute inset-0 pointer-events-auto"
                            style={{ width: pdfWidth }}
                            onContextMenu={(e) => handlePageContext(e, pn)}
                          >
                            {pageFields.map((f) => (
                              <DraggableField
                                key={`${f.id}-${f.page_number || 0}`}
                                field={f}
                                scale={scale}
                                selected={selectedId === f.id}
                                onSelect={setSelectedId}
                                onUpdate={updateField}
                                onEdit={openFieldEdit}
                              />
                            ))}
                          </section>
                        </div>
                      );
                    })}
                </div>
              </Document>
            </div>

            {/* Collect email toggle */}
            {canEdit && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectEmail}
                    onChange={(e) => setCollectEmail(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600" />
                </label>
                <span className="text-xs text-gray-700 dark:text-neutral-300">Collect email before signing</span>
              </div>
            )}

          </div>
        )}

        {tab === 'signatures' && (
          <div className="space-y-4">
            {signatures.length > 0 && (
              <div className="flex items-center justify-between">
                <SignatureChart signatures={signatures} title={`Signed: ${signatures.length} total`} />
                <button
                  type="button"
                  onClick={downloadAll}
                  disabled={downloadingAll}
                  className="self-start px-3 py-1.5 bg-neutral-800 text-gray-300 rounded-lg text-xs font-medium hover:bg-neutral-700 disabled:opacity-40 transition-all flex items-center gap-1.5 border border-neutral-700"
                >
                  <svg
                    aria-hidden="true"
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  {downloadingAll ? '...' : 'Download All'}
                </button>
              </div>
            )}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 overflow-hidden shadow-sm">
              {loadingSigs ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                  <svg aria-hidden="true" className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading&hellip;
                </div>
              ) : signatures.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <svg
                    aria-hidden="true"
                    className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-neutral-700"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <p className="text-sm">No signatures yet.</p>
                  <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">
                    Share the sign link to collect signatures.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                        {fields.map((f) => (
                          <th
                            key={f.id}
                            className="text-left px-3 py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs"
                          >
                            {f.label}
                          </th>
                        ))}
                        <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs hidden sm:table-cell">
                          Signed At
                        </th>
                        <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs hidden lg:table-cell">
                          IP
                        </th>
                        <th className="text-right px-3 py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {signatures.map((sig) => (
                        <tr
                          key={sig.id}
                          className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800"
                        >
                          {fields.map((f) => {
                            const val = sig.field_values?.[f.id] || '';
                            return (
                              <td key={f.id} className="px-3 py-3">
                                {f.field_type === 'signature' && val ? (
                                  <img
                                    src={val}
                                    alt="sig"
                                    className="h-8 max-w-16 object-contain rounded border border-gray-100 dark:border-neutral-700 bg-white"
                                  />
                                ) : f.field_type === 'date' ? (
                                  <span className="text-gray-700 dark:text-neutral-300 text-xs">{val}</span>
                                ) : (
                                  <span className="text-gray-700 dark:text-neutral-300 text-xs truncate block max-w-[120px]">
                                    {val || '-'}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-gray-500 text-xs hidden sm:table-cell">
                            {toLocalISO(new Date(sig.created_at))}
                          </td>
                          <td className="px-3 py-3 text-gray-400 text-[10px] hidden lg:table-cell font-mono">
                            {sig.ipv4 || sig.ip_address || '-'}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => startEdit(sig)}
                                className="px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSig(sig.id)}
                                className="px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSig(sig.id)}
                                disabled={downloadingId === sig.id}
                                className="px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                {downloadingId === sig.id ? '...' : 'PDF'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'fields' && (
          <div className="fixed bottom-0 left-0 right-0 z-10 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-gray-200 dark:border-neutral-800 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2 max-w-7xl mx-auto">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => addField()}
                  className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-all flex items-center gap-1 shadow-sm"
                >
                  <svg
                    aria-hidden="true"
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Field
                </button>
              )}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
                {fields.length === 0 && (
                  <span className="text-xs text-gray-400 italic px-2">No fields yet. Right-click the PDF or click Add Field.</span>
                )}
                {fields.map((f) => {
                  const c = FIELD_COLORS[f.field_type] || FIELD_COLORS.other;
                  const isSel = selectedId === f.id;
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openFieldEdit(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') openFieldEdit(f.id);
                      }}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${isSel ? 'text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                      style={{ backgroundColor: isSel ? c.border : c.bg, border: `1px solid ${c.border}` }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/70' : ''}`}
                        style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.7)' : c.border }}
                      />
                      {f.label || f.field_type}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeField(f.id); } }}
                          className={`p-0.5 rounded cursor-pointer ${isSel ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                        >
                          <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Edit signature modal */}
        {editSig && (
          <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
            onClick={() => setEditSig(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditSig(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onKeyDown={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-black/5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Edit Signature</h3>
                <button
                  type="button"
                  onClick={() => setEditSig(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
                {fields.map((f) => {
                  const val = editValues[f.id] || '';
                  return (
                    <div key={f.id}>
                      <label
                        htmlFor={`sig-field-${f.id}`}
                        className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1"
                      >
                        {f.label}
                      </label>
                      {f.field_type === 'signature' ? (
                        <div className="flex items-center gap-3">
                          {val ? (
                            <img
                              src={val}
                              alt="sig"
                              className="h-10 w-auto object-contain rounded border border-gray-200 dark:border-neutral-700 bg-white"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">No signature</span>
                          )}
                          <label className="text-xs text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer">
                            Replace
                            <input
                              type="file"
                              accept="image/png,image/jpeg"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => updateEditValue(f.id, ev.target.result);
                                reader.readAsDataURL(file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <input
                          id={`sig-field-${f.id}`}
                          type="text"
                          value={val}
                          onChange={(e) => updateEditValue(f.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditSig(null)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all active:scale-[0.98] shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Context field modal */}
        {ctxPos && (
          <CtxFieldEditor
            ctxFieldId={ctxFieldId}
            ctxNewPos={ctxNewPos}
            ctxPos={ctxPos}
            ctxRef={ctxRef}
            fields={fields}
            numPages={numPages}
            selectedId={selectedId}
            setCtxPos={setCtxPos}
            setCtxFieldId={setCtxFieldId}
            setCtxNewPos={setCtxNewPos}
            updateField={updateField}
            addField={addField}
            removeField={removeField}
            canEdit={canEdit}
          />
        )}

        {/* Share modal */}
        {showShare && canManage && (
          <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowShare(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowShare(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onKeyDown={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Share Document</h3>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="user@email.com"
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={sharePerm}
                    onChange={(e) => setSharePerm(e.target.value)}
                    className="px-2 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                    <option value="manage">Manage</option>
                  </select>
                  <button
                    type="button"
                    onClick={addShare}
                    disabled={shareLoading || !shareEmail.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-all shadow-sm"
                  >
                    {shareLoading ? '...' : 'Add'}
                  </button>
                </div>
                {permissions.length > 0 && (
                  <div className="space-y-2">
                    {permissions.map((p) => (
                      <div
                        key={p.id || p.email}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-neutral-900 rounded-lg"
                      >
                        <div>
                          <span className="text-xs text-gray-700 dark:text-neutral-300">{p.email}</span>
                          <span className="text-[10px] text-gray-400 ml-2 uppercase">{p.permission}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeShare(p.email)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 dark:border-neutral-900 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-gray-400 dark:text-neutral-600">
          &copy; 2026 Keystone STEM Alliance Inc. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
