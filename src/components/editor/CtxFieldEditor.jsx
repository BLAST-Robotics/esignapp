'use client';

import { useEffect, useRef } from 'react';
import { FIELD_TYPES, VALIDATION_OPTIONS } from './constants';

export default function CtxFieldEditor({
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
                    value={Number.isFinite(f[prop]) ? f[prop] : 0}
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
                    <select
                      id="field-signature-name"
                      value={f.signature_name || ''}
                      onChange={(e) => updateField({ ...f, signature_name: e.target.value })}
                      className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={!canEdit}
                    >
                      <option value="">Signer's own name</option>
                      {fields
                        .filter((sf) => sf.id !== f.id)
                        .map((sf) => (
                          <option key={sf.id} value={sf.id}>
                            {sf.label || sf.field_type} ({sf.field_type})
                          </option>
                        ))}
                      <option value="__custom__">Custom text...</option>
                    </select>
                    {f.signature_name === '__custom__' && (
                      <input
                        type="text"
                        value={f.signature_custom_text || ''}
                        onChange={(e) => updateField({ ...f, signature_custom_text: e.target.value })}
                        placeholder="Type a name"
                        className="w-full mt-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-500"
                        disabled={!canEdit}
                      />
                    )}
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