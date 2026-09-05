'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

function renderCursiveToCanvas(text, width = 600, height = 160) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (!text?.trim()) return null;

  const maxWidth = width - 24;
  const maxHeight = height - 16;
  let fontSize = Math.min(72, maxHeight * 0.75);
  ctx.font = `${fontSize}px 'Dancing Script', 'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 12) {
    fontSize -= 2;
    ctx.font = `${fontSize}px 'Dancing Script', 'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive`;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(text, 12, height / 2);

  return canvas.toDataURL('image/png');
}

export default function SignaturePicker({ nameOptions, onSignature, onClose, defaultMethod, signatureName }) {
  const defaultName = nameOptions?.[0]?.value || '';
  const initialCursive = defaultMethod === 'type' ? '' : (defaultMethod === 'auto' ? (signatureName || defaultName) : '');
  const [mode, setMode] = useState(() => {
    if (defaultMethod === 'draw') return 'draw';
    if (defaultMethod === 'auto' || defaultMethod === 'type') return 'cursive';
    return 'draw';
  });
  const [cursiveText, setCursiveText] = useState(initialCursive);
  const [selectedNameId, setSelectedNameId] = useState(nameOptions?.[0]?.id || null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [_fontReady, setFontReady] = useState(false);
  const sigRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    link.onload = () => setFontReady(true);
    link.onerror = () => setFontReady(true);
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        setPreviewUrl(renderCursiveToCanvas(cursiveText));
      } catch (error) {
        console.error('Signature preview error:', error);
      }
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cursiveText]);

  const handleDrawSave = useCallback(() => {
    try {
      if (sigRef.current && !sigRef.current.isEmpty()) {
        const url = sigRef.current.toDataURL();
        if (url) onSignature(url);
      }
    } catch (error) {
      console.error('Signature draw save error:', error);
    }
  }, [onSignature]);

  const handleCursiveConfirm = useCallback(() => {
    try {
      const url = renderCursiveToCanvas(cursiveText);
      if (url) onSignature(url);
    } catch (error) {
      console.error('Signature cursive confirm error:', error);
    }
  }, [cursiveText, onSignature]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border border-black/5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode !== 'choose' && (
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
              {mode === 'choose' && 'Choose Signature Method'}
              {mode === 'draw' && 'Draw Your Signature'}
              {mode === 'cursive' && 'Type Your Signature'}
            </h3>
            {mode === 'draw' && (
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline underline-offset-2 transition-colors"
              >
                I can't draw
              </button>
            )}
            {mode === 'cursive' && (
              <button
                type="button"
                onClick={() => setMode('draw')}
                className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline underline-offset-2 transition-colors"
              >
                Switch to drawing
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Choose mode */}
        {mode === 'choose' && (
          <div className="p-5 space-y-3">
            <button
              type="button"
              onClick={() => setMode('draw')}
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 text-left flex items-center gap-4 group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">Draw Signature</div>
              <div className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                Use your finger, mouse, or stylus to draw your signature naturally
              </div>
              </div>
              <svg
                aria-hidden="true"
                className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                const selected = nameOptions?.find((n) => n.id === selectedNameId);
                setCursiveText(selected?.value || '');
                setMode('cursive');
              }}
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all duration-200 text-left flex items-center gap-4 group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">Use Full Name</div>
              <div className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                Auto-render your name in cursive handwriting — no drawing needed
              </div>
              </div>
              <svg
                aria-hidden="true"
                className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                setCursiveText('');
                setMode('cursive');
              }}
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-all duration-200 text-left flex items-center gap-4 group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">Type Your Signature</div>
              <div className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                Type any name or text and see it rendered in cursive style
              </div>
              </div>
              <svg
                aria-hidden="true"
                className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}

        {/* Draw mode */}
        {mode === 'draw' && (
          <div className="p-5">
            <div className="border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigRef}
                penColor="black"
                canvasProps={{ className: 'w-full h-40 sm:h-48 cursor-crosshair' }}
              />
            </div>
            <div className="flex justify-between mt-3">
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 font-medium transition-colors"
              >
                Clear
              </button>
              {sigRef.current && !sigRef.current.isEmpty() && (
                <span className="text-xs text-emerald-600">Signature detected</span>
              )}
            </div>
          </div>
        )}

        {/* Cursive mode */}
        {mode === 'cursive' && (
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 flex items-center justify-center min-h-[100px]">
              {cursiveText.trim() ? (
                <img src={previewUrl} alt="Signature preview" className="max-h-20 object-contain" />
              ) : (
                <span className="text-sm text-gray-300 dark:text-neutral-600">
                  Your signature preview will appear here
                </span>
              )}
            </div>
            {nameOptions?.length > 0 && (
              <div>
                <label
                  htmlFor="signature-field-select"
                  className="block text-xs text-gray-400 dark:text-neutral-500 mb-1.5 font-medium"
                >
                  Use field value
                </label>
                <select
                  id="signature-field-select"
                  value={selectedNameId || ''}
                  onChange={(e) => {
                    const selected = nameOptions.find((n) => n.id === e.target.value);
                    if (selected) {
                      setSelectedNameId(selected.id);
                      setCursiveText(selected.value);
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:text-neutral-200 transition-all appearance-none"
                >
                  {nameOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label || n.id}: {n.value}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                htmlFor="signature-custom-input"
                className="block text-xs text-gray-400 dark:text-neutral-500 mb-1.5 font-medium"
              >
                Or type your own
              </label>
              <input
                id="signature-custom-input"
                name="signature-custom-input"
                type="text"
                value={cursiveText}
                onChange={(e) => setCursiveText(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:text-neutral-200 transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-neutral-500">
              Text will be rendered in cursive font that matches your signature style.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-700 flex justify-end gap-3">
          {mode === 'choose' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
            >
              Cancel
            </button>
          ) : mode === 'draw' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleDrawSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                Use Signature
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCursiveConfirm}
                disabled={!cursiveText.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                Use Signature
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
