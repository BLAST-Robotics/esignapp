'use client';

import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import SignaturePicker from './SignaturePicker';
import ThemeToggle from './ThemeToggle';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function useIntersection(threshold = 0) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function LazyPage({ pageNumber, width, children }) {
  const [ref, visible] = useIntersection(0);
  const computedHeight = typeof width === 'number' ? width * 1.294 : 800;
  return (
    <div
      ref={ref}
      className="mb-4 last:mb-0 relative shadow-lg rounded-lg overflow-hidden border border-black/5"
      id={`page-${pageNumber}`}
    >
      {visible ? (
        <Page
          pageNumber={pageNumber}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          width={width}
          loading={<div className="bg-gray-50 animate-pulse" style={{ height: computedHeight }} />}
        />
      ) : (
        <div className="bg-gray-50 rounded-lg" style={{ height: computedHeight }} />
      )}
      {children}
    </div>
  );
}

const FIELD_RENDERERS = {
  name: { icon: 'Aa', placeholder: 'Enter name' },
  signature: { icon: '\u270D', placeholder: 'Tap to sign' },
  date: { icon: '\uD83D\uDCC5', placeholder: 'Date' },
  email: { icon: '@', placeholder: 'email@example.com' },
  phone: { icon: '\u260E', placeholder: 'Phone number' },
  other: { icon: '\u2699', placeholder: 'Enter value' },
};

function FieldOverlay({
  field,
  scale,
  activeField,
  fieldValues,
  fieldErrors,
  onActivate,
  onUpdate,
  onOpenSignature,
  onRemoveSignature,
  readOnly,
}) {
  const f = field || {};
  const isSig = f.field_type === 'signature';
  const val = fieldValues[f.id] || '';
  const isFilled = isSig ? !!val : !!val;
  const w = f.width || 200;
  const h = f.field_type === 'date' ? (f.font_size || 16) * 1.5 : f.height || 40;
  const fs = f.font_size || 12;
  const renderer = FIELD_RENDERERS[f.field_type] || FIELD_RENDERERS.other;

  const containerStyle = {
    left: `${(f.x || 0) * scale}px`,
    top: `${(f.y || 0) * scale}px`,
    width: `${w * scale}px`,
    zIndex: activeField === f.id && !readOnly ? 50 : 10,
  };

  if (f.field_type === 'date' && !readOnly && f.date_format?.startsWith('signing')) {
    const autoDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div
        className="absolute pointer-events-none flex items-center opacity-60"
        style={{
          ...containerStyle,
          fontSize: `${fs * scale}px`,
          fontWeight: 500,
          color: '#000',
        }}
      >
        {autoDate}
      </div>
    );
  }

  if (readOnly) {
    if (f.field_type === 'date' && f.date_format?.startsWith('signing')) {
      const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return (
        <div
          className="absolute flex items-center opacity-60"
          style={{ ...containerStyle, fontSize: `${fs * scale}px`, fontWeight: 500, color: '#000' }}
        >
          {d}
        </div>
      );
    }
    if (!isFilled) return null;
    return (
      <div className="absolute transition-all duration-300 ease-out" style={containerStyle}>
        {isSig && (
          <div style={{ height: `${h * scale}px` }}>
            <img src={val} alt="Signature" className="w-full h-full object-contain" />
          </div>
        )}
        {!isSig && (
          <div className="px-2 py-1 dark:text-neutral-200" style={{ fontSize: `${Math.max(12, fs * scale)}px` }}>
            {val}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute transition-all duration-300 ease-out" style={containerStyle}>
      {isSig && (
        <button
          type="button"
          onClick={() => {
            if (!val) onOpenSignature(f.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!val) onOpenSignature(f.id);
            }
          }}
          className={`relative rounded-lg overflow-hidden transition-all duration-300 ${val ? 'bg-transparent border-0' : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 cursor-pointer'}`}
          style={{ height: `${h * scale}px` }}
        >
          {val ? (
            <>
              <img src={val} alt="Signature" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSignature(f.id);
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm z-10"
                title="Remove signature"
              >
                <svg
                  aria-hidden="true"
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-blue-400 dark:text-blue-300 text-xs font-medium">
              {renderer.placeholder}
            </div>
          )}
        </button>
      )}

      {!isSig &&
        (activeField === f.id ? (
          <div>
            <input
              type={f.field_type === 'email' ? 'email' : f.field_type === 'phone' ? 'tel' : 'text'}
              value={val}
              onChange={(e) => onUpdate(f.id, e.target.value)}
              onBlur={() => onActivate(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onActivate(null);
              }}
              className={`w-full px-2 py-1 border-2 rounded-lg text-sm bg-white text-gray-900 shadow-lg outline-none transition-all duration-200 ${fieldErrors?.[f.id] ? 'border-red-500' : 'border-blue-500'}`}
              style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
              placeholder={renderer.placeholder}
            />
            {fieldErrors?.[f.id] && (
              <div className="text-red-500 text-xs mt-0.5" style={{ fontSize: `${Math.max(10, fs * scale * 0.8)}px` }}>
                {fieldErrors[f.id]}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => onActivate(f.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onActivate(f.id);
              }}
              className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer ${fieldErrors?.[f.id] ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200' : isFilled ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-gray-800 dark:text-neutral-200' : 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-dashed border-yellow-300 dark:border-yellow-700 hover:border-yellow-500 text-gray-400 dark:text-neutral-400'}`}
              style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
            >
              {isFilled ? val : f.label || renderer.placeholder}
            </button>
            {fieldErrors?.[f.id] && (
              <div className="text-red-500 text-xs mt-0.5" style={{ fontSize: `${Math.max(10, fs * scale * 0.8)}px` }}>
                {fieldErrors[f.id]}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth,
      H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H - H,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotSpeed: Math.random() * 12 - 6,
      vx: Math.random() * 6 - 3,
      vy: Math.random() * 3 + 2.5,
      opacity: 1,
    }));
    let anim;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (p.y > H + 30) p.opacity -= 0.025;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) anim = requestAnimationFrame(frame);
    }
    anim = requestAnimationFrame(frame);
    function onResize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    }
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />;
}

export default function DocumentSigner({ documentId }) {
  const [docInfo, setDocInfo] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [email, setEmail] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [signatureId, setSignatureId] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [sigPickerOpen, setSigPickerOpen] = useState(false);
  const [sigPickerFieldId, setSigPickerFieldId] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);
  const containerRef = useRef(null);
  const prevAllDone = useRef(null);

  useEffect(() => {
    if (!documentId) return;
    fetch(`/api/public/document/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        setDocInfo(data.document);
        const initial = {};
        const fields = data.document.fields || [];
        for (const f of fields) {
          if (f.field_type === 'date' && f.date_format?.startsWith('signing')) {
            initial[f.id] = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          }
        }
        setFieldValues(initial);
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load document' }));
  }, [documentId]);

  const fields = docInfo?.fields || [];

  // Same-label sharing
  const sharedLabels = {};
  for (const f of fields) {
    if (!sharedLabels[f.label]) sharedLabels[f.label] = [];
    sharedLabels[f.label].push(f.id);
  }

  function validateField(field, value) {
    if (field.field_type === 'date' && field.date_format?.startsWith('signing')) return null;
    const rule = field.validation || 'required';
    const val = (value || '').trim();
    if (rule === 'none') return null;
    if (rule === 'required' && !val) return 'This field is required';
    if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email address';
    if (rule === 'phone' && !/^[\d\s\-()]{7,}$/.test(val)) return 'Please enter a valid phone number';
    if (rule === 'min2' && val.length < 2) return 'Must be at least 2 characters';
    return null;
  }

  function runValidation() {
    const errors = {};
    for (const f of fields) {
      const msg = validateField(f, fieldValues[f.id]);
      if (msg) errors[f.id] = msg;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function updateField(fieldId, value) {
    setFieldValues((prev) => {
      const next = { ...prev, [fieldId]: value };
      const f = fields.find((x) => x.id === fieldId);
      if (f && sharedLabels[f.label]?.length > 1) {
        for (const sid of sharedLabels[f.label]) {
          next[sid] = value;
        }
      }
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  const allDone = fields
    .filter((f) => f.field_type !== 'date' || !f.date_format?.startsWith('signing'))
    .every((f) => !!fieldValues[f.id]);

  useEffect(() => {
    if (allDone && !prevAllDone.current && !submitted && fields.length > 0) {
      const valid = runValidation();
      if (valid) {
        setShowConfetti(true);
        setShowPreview(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    }
    prevAllDone.current = allDone;
    // biome-ignore lint/correctness/useExhaustiveDependencies: runValidation is stable
  }, [allDone, submitted, fields.length, runValidation]);

  function onDocumentLoadSuccess({ numPages: n }) {
    setNumPages(n);
  }

  async function handleSubmit() {
    if (!allDone || submitting) return;
    if (!runValidation()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, fieldValues, signerEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.error || 'Submission failed');
      }
      setSignatureId(data.id);
      setShowConfetti(false);
      setShowPreview(false);
      setSubmitted(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownload() {
    if (!signatureId) return;
    const a = document.createElement('a');
    a.href = `/api/public/download?id=${signatureId}&mode=download`;
    a.download = `signed-document.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleMailTo() {
    if (!email.trim() || !signatureId) return;
    const base = window.location.origin;
    const dl = `${base}/api/public/download?id=${signatureId}&mode=download`;
    const vw = `${base}/api/public/download?id=${signatureId}&mode=view`;
    const subj = encodeURIComponent('Your signed document');
    const body = encodeURIComponent(`Your signed document is ready.\nDownload: ${dl}\nView: ${vw}`);
    window.open(`mailto:${encodeURIComponent(email.trim())}?subject=${subj}&body=${body}`, '_blank');
  }

  function handleContinue() {
    setRedirecting(true);
    window.location.href = '/thank-you';
  }

  function scrollToField(fieldId) {
    if (!containerRef.current || !numPages) return;
    const f = fields.find((x) => x.id === fieldId);
    if (!f) return;
    const scaleVal = pdfWidth / 612;
    const fieldY = (f.y || 0) * scaleVal;
    const pageEl = document.getElementById(`page-${numPages}`);
    if (!pageEl) return;
    const container = containerRef.current;
    const pr = pageEl.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const offset = pr.top - cr.top + container.scrollTop + fieldY - cr.height / 2;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  }

  function scrollToNextField() {
    const first = fields.find((f) => {
      if (f.field_type === 'date' && f.date_format?.startsWith('signing')) return false;
      return !fieldValues[f.id];
    });
    if (first) scrollToField(first.id);
  }

  function handleSignature(url) {
    if (sigPickerFieldId) {
      updateField(sigPickerFieldId, url);
    }
    setSigPickerOpen(false);
    setSigPickerFieldId(null);
  }

  if (!docInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <svg aria-hidden="true" className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading document&hellip;
        </div>
      </div>
    );
  }

  // Email collection step
  if (docInfo?.collect_email && !signerEmail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 p-4">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto">
            <svg
              aria-hidden="true"
              className="w-7 h-7 text-blue-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Enter your email</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400">We'll use this to send your signed document.</p>
          <input
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-neutral-200"
          />
          <button
            type="button"
            onClick={() => {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
                setMessage({ type: 'error', text: 'Please enter a valid email address' });
                return;
              }
              setMessage(null);
            }}
            disabled={!signerEmail.trim()}
            className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
          >
            Start Signing
          </button>
        </div>
      </div>
    );
  }

  const pdfWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 16, 900) : 700;
  const lastPageNum = numPages || 1;
  const itemsLeft = fields
    .filter((f) => f.field_type !== 'date' || !f.date_format?.startsWith('signing'))
    .filter((f) => !fieldValues[f.id]).length;

  const STATUS = fields
    .filter((f) => f.field_type !== 'date' || !f.date_format?.startsWith('signing'))
    .map((f) => ({ id: f.id, label: f.label, done: !!fieldValues[f.id] }));
  const _renderer = FIELD_RENDERERS;

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 dark:bg-neutral-900 transition-colors duration-300">
      {showConfetti && <Confetti />}
      <div className="absolute top-3 right-3 z-50">
        <ThemeToggle />
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto smooth-scroll px-2 py-4"
        style={{ paddingBottom: '88px' }}
      >
        <div className="max-w-4xl mx-auto">
          <Document
            file={`/api/public/document/${documentId}/pdf`}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="py-24 text-center text-gray-400 text-sm">Loading document&hellip;</div>}
            error={<div className="py-24 text-center text-red-400 text-sm">Could not load document.</div>}
          >
            <div className="flex flex-col items-center" style={{ backgroundColor: '#262626' }}>
              {numPages &&
                Array.from({ length: numPages }, (_, i) => {
                  const pageNum = i + 1;
                  const pageFields = fields.filter((f) =>
                    (f.page_number || 0) === 0 ? pageNum === lastPageNum : (f.page_number || 0) === pageNum,
                  );
                  return (
                    <div
                      key={pageNum}
                      className="rounded-lg overflow-hidden mb-4 last:mb-0"
                      style={{ width: pdfWidth, backgroundColor: '#404040' }}
                    >
                      <LazyPage pageNumber={pageNum} width={pdfWidth}>
                        {pageFields.length > 0 && !submitted && !showPreview && (
                          <div className="absolute inset-0 pointer-events-auto" style={{ width: pdfWidth }}>
                            {pageFields.map((f) => (
                              <FieldOverlay
                                key={f.id}
                                field={f}
                                scale={pdfWidth / 612}
                                activeField={activeField}
                                fieldValues={fieldValues}
                                fieldErrors={fieldErrors}
                                onActivate={setActiveField}
                                onUpdate={updateField}
                                onOpenSignature={(fid) => {
                                  setSigPickerFieldId(fid);
                                  setSigPickerOpen(true);
                                }}
                                onRemoveSignature={(fid) => updateField(fid, '')}
                              />
                            ))}
                          </div>
                        )}
                      </LazyPage>
                    </div>
                  );
                })}
            </div>
          </Document>
        </div>
      </div>

      {/* Down arrow */}
      {!submitted && !showPreview && itemsLeft > 0 && (
        <button
          type="button"
          onClick={scrollToNextField}
          className="fixed left-1/2 -translate-x-1/2 bottom-28 z-30 w-10 h-10 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all duration-200"
        >
          <svg
            aria-hidden="true"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}

      {/* Sticky bar */}
      {!submitted && !showPreview && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 safe-area-bottom transition-all duration-300"
          style={{ colorScheme: 'light' }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
              {STATUS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => scrollToField(s.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap px-2.5 py-1.5 rounded-lg transition-all ${s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'}`}
                  >
                    {s.done ? '\u2713' : STATUS.findIndex((x) => x.id === s.id) + 1}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap active:scale-[0.98] ${allDone ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 cursor-pointer' : 'bg-blue-600/90 text-white hover:bg-blue-700 cursor-pointer'}`}
              onClick={() => {
                if (allDone) {
                  if (runValidation()) setShowPreview(true);
                  else scrollToNextField();
                } else scrollToNextField();
              }}
            >
              {allDone ? 'Review & Submit' : `${itemsLeft} field${itemsLeft !== 1 ? 's' : ''} remaining`}
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 animate-in fade-in duration-200">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-neutral-900 rounded-2xl shadow-xl overflow-hidden border border-neutral-800">
                <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-neutral-100">Review Your Signature</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">Is this correct?</p>
                  </div>
                </div>
                <div className="bg-neutral-800/50 p-4">
                  <Document
                    file={`/api/public/document/${documentId}/pdf`}
                    loading={
                      <div className="py-24 text-center text-gray-400 text-sm animate-pulse">
                        Loading preview&hellip;
                      </div>
                    }
                  >
                    <div className="flex flex-col items-center" style={{ backgroundColor: '#262626' }}>
                      {numPages &&
                        Array.from({ length: numPages }, (_, i) => {
                          const pn = i + 1;
                          const pf = fields.filter((f) =>
                            (f.page_number || 0) === 0 ? pn === lastPageNum : (f.page_number || 0) === pn,
                          );
                          if (pf.length === 0) return null;
                          return (
                            <div
                              key={pn}
                              className="relative mb-4 last:mb-0 rounded-lg overflow-hidden"
                              style={{ width: Math.min(500, pdfWidth - 32), backgroundColor: '#404040' }}
                            >
                              <Page
                                pageNumber={pn}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                width={Math.min(500, pdfWidth - 32)}
                              />
                              {pf.length > 0 && (
                                <div className="absolute inset-0 pointer-events-none">
                                  {pf.map((f) => (
                                    <FieldOverlay
                                      key={f.id}
                                      field={f}
                                      scale={Math.min(500, pdfWidth - 32) / 612}
                                      fieldValues={fieldValues}
                                      fieldErrors={fieldErrors}
                                      readOnly
                                      onOpenSignature={() => {}}
                                      onRemoveSignature={() => {}}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </Document>
                </div>
                {Object.keys(fieldErrors).length > 0 && (
                  <div className="px-5 py-3 border-b border-neutral-800 bg-red-900/20">
                    <p className="text-sm font-medium text-red-400 mb-1">Please fix the following errors:</p>
                    <ul className="text-xs text-red-300 space-y-0.5 list-disc list-inside">
                      {Object.entries(fieldErrors).map(([fid, msg]) => {
                        const label = fields.find((f) => f.id === fid)?.label || fid;
                        return (
                          <li key={fid}>
                            {label}: {msg}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || Object.keys(fieldErrors).length > 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-all duration-200 flex items-center gap-2 active:scale-[0.98] shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <svg aria-hidden="true" className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Submitting
                      </>
                    ) : (
                      'Looks good, Submit!'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-submit card */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 max-h-[90vh] overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                aria-hidden="true"
                className="w-7 h-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Signed Successfully!</h2>
            <p className="text-sm text-gray-500">Email yourself a copy or download it now.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleMailTo}
                disabled={!email.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-sm"
              >
                <svg
                  aria-hidden="true"
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Email Yourself
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 py-2.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
              >
                <svg
                  aria-hidden="true"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={redirecting}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all duration-200 active:scale-[0.98]"
              >
                {redirecting ? 'Redirecting...' : 'Continue'}
              </button>
            </div>
            <p className="text-xs text-gray-400">A download and view link will be included in the email.</p>
          </div>
        </div>
      )}

      {/* Signature picker */}
      {sigPickerOpen && (
        <SignaturePicker
          nameOptions={fields
            .filter((f) => f.field_type === 'name')
            .map((f) => ({ id: f.id, label: f.label, value: fieldValues[f.id] || '' }))
            .filter((n) => n.value)}
          defaultMethod={fields.find((f) => f.id === sigPickerFieldId)?.default_method}
          onSignature={handleSignature}
          onClose={() => {
            setSigPickerOpen(false);
            setSigPickerFieldId(null);
          }}
        />
      )}

      {message && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
        >
          {message.text}
        </div>
      )}

      <style jsx>{`
        .smooth-scroll { scroll-behavior: smooth; }
        .smooth-scroll::-webkit-scrollbar { width: 4px; }
        .smooth-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}</style>
    </div>
  );
}
