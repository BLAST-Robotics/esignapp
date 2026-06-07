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

function FieldOverlay({
  fieldKey,
  settings,
  scale,
  active,
  filled,
  value,
  onActivate,
  onFieldUpdate,
  onOpenSignature,
  onRemoveSignature,
  sigPreview,
  readOnly,
}) {
  const f = settings || {};
  const isSig = fieldKey === 'signature';
  const isText = fieldKey === 'childName' || fieldKey === 'parentName';
  const isDate = fieldKey === 'signedDate';
  const isFilled = isSig ? !!sigPreview : !!value;
  const w = f.width || 200;
  const h = isDate ? (f.fontSize || 10) * 1.5 : f.height || 40;
  const fs = f.fontSize || 11;

  if (!isSig && !isText && !isDate) return null;

  const containerStyle = {
    left: `${(f.x || 0) * scale}px`,
    top: `${(f.y || 0) * scale}px`,
    width: `${w * scale}px`,
    zIndex: active && !readOnly ? 50 : 10,
  };

  if (isDate) {
    return (
      <div
        className="absolute pointer-events-none flex items-center opacity-60"
        style={{
          ...containerStyle,
          top: `${(f.y || 0) * scale}px`,
          fontSize: `${fs * scale}px`,
          fontWeight: 500,
          color: '#000',
        }}
      >
        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="absolute transition-all duration-300 ease-out" style={containerStyle}>
        {isSig && sigPreview && (
          <div style={{ height: `${h * scale}px` }}>
            <img src={sigPreview} alt="Signature" className="w-full h-full object-contain" />
          </div>
        )}
        {isText && isFilled && (
          <div className="px-2 py-1 text-gray-800" style={{ fontSize: `${Math.max(12, fs * scale)}px` }}>
            {value}
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
            if (!sigPreview) onOpenSignature();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!sigPreview) onOpenSignature();
            }
          }}
          className={`relative rounded-lg overflow-hidden transition-all duration-300 ${
            sigPreview
              ? 'bg-transparent border-0'
              : 'bg-blue-50 border-2 border-dashed border-blue-300 hover:border-blue-500 cursor-pointer'
          }`}
          style={{ height: `${h * scale}px` }}
        >
          {sigPreview ? (
            <>
              <img src={sigPreview} alt="Signature" className="w-full h-full object-contain" />
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSignature();
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
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-blue-400 text-xs font-medium">Tap to sign</div>
          )}
        </button>
      )}

      {isText &&
        (active === fieldKey ? (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onFieldUpdate(fieldKey, e.target.value)}
            onBlur={() => onActivate(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onActivate(null);
            }}
            className="w-full px-2 py-1 border-2 border-blue-500 rounded-lg text-sm bg-white shadow-lg outline-none transition-all duration-200"
            style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
            placeholder={fieldKey === 'childName' ? "Child's name" : "Parent's name"}
          />
        ) : (
          <button
            type="button"
            onClick={() => onActivate(fieldKey)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onActivate(fieldKey);
            }}
            className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
              isFilled
                ? 'bg-green-50 border border-green-200 text-gray-800'
                : 'bg-yellow-50 border-2 border-dashed border-yellow-300 hover:border-yellow-500 text-gray-400'
            }`}
            style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
          >
            {isFilled ? value : fieldKey === 'childName' ? "Child's name" : "Parent's name"}
          </button>
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
    let W = window.innerWidth;
    let H = window.innerHeight;
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

export default function SignForm() {
  const [numPages, setNumPages] = useState(null);
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [settings, setSettings] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [signatureId, setSignatureId] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [sigDataUrl, setSigDataUrl] = useState(null);
  const [sigPickerOpen, setSigPickerOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const containerRef = useRef(null);
  const prevAllDone = useRef(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSettings(data.settings))
      .catch(() => {});
  }, []);

  const allDone = childName.trim() && parentName.trim() && !!sigDataUrl;

  useEffect(() => {
    if (allDone && !prevAllDone.current && !submitted) {
      setShowConfetti(true);
      setShowPreview(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
    prevAllDone.current = allDone;
  }, [allDone, submitted]);

  function onDocumentLoadSuccess({ numPages: n }) {
    setNumPages(n);
  }

  async function handleSubmit() {
    if (!allDone || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childName: childName.trim(), parentName: parentName.trim(), signature: sigDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
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
    a.download = `signed-handbook.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleMailTo() {
    if (!email.trim() || !signatureId) return;
    const base = window.location.origin;
    const downloadUrl = `${base}/api/public/download?id=${signatureId}&mode=download`;
    const viewUrl = `${base}/api/public/download?id=${signatureId}&mode=view`;
    const subject = encodeURIComponent('Congratulations!');
    const body = encodeURIComponent(
      `You have successfully signed the release. You can download it here:\n${downloadUrl}\n\nOr View It Here:\n${viewUrl}`,
    );
    window.open(`mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`, '_blank');
  }

  function handleContinue() {
    setRedirecting(true);
    const url = new URL('/thank-you', window.location.origin);
    window.location.href = url.toString();
  }

  function scrollToField(key) {
    if (!containerRef.current || !numPages || !settings) return;
    const f = settings[key];
    if (!f) return;
    const scale = pdfWidth / 612;
    const fieldY = (f.y || 0) * scale;
    const pageEl = document.getElementById(`page-${numPages}`);
    if (!pageEl) return;
    const container = containerRef.current;
    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const viewportCenter = containerRect.height / 2;
    const offset = pageRect.top - containerRect.top + container.scrollTop + fieldY - viewportCenter;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  }

  function scrollToNextField() {
    if (!settings) return;
    const next = STATUS.find((s) => !s.done);
    if (next) scrollToField(next.key);
  }

  function handleSignature(url) {
    setSigDataUrl(url);
    setSigPickerOpen(false);
  }

  const pdfWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 16, 900) : 700;

  const activeOverlayFields =
    settings && numPages
      ? [
          { key: 'childName', settings: settings.childName, value: childName },
          { key: 'parentName', settings: settings.parentName, value: parentName },
          { key: 'signature', settings: settings.signature },
          { key: 'signedDate', settings: settings.signedDate },
        ]
      : [];

  const lastPageNum = numPages || 1;

  const STATUS = [
    { key: 'childName', label: "Child's Name", done: !!childName.trim() },
    { key: 'parentName', label: "Parent's Name", done: !!parentName.trim() },
    { key: 'signature', label: 'Signature', done: !!sigDataUrl },
  ];

  const itemsLeft = STATUS.filter((s) => !s.done).length;

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
            file="/handbook.pdf"
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="py-24 text-center text-gray-400 text-sm">Loading document&hellip;</div>}
            error={<div className="py-24 text-center text-red-400 text-sm">Place handbook.pdf in public/</div>}
          >
            <div className="flex flex-col items-center">
              {numPages &&
                Array.from({ length: numPages }, (_, i) => (
                  <LazyPage key={i + 1} pageNumber={i + 1} width={pdfWidth}>
                    {i + 1 === lastPageNum && settings && !submitted && !showPreview && (
                      <div className="absolute inset-0 pointer-events-auto" style={{ width: pdfWidth }}>
                        {activeOverlayFields.map((f) => (
                          <FieldOverlay
                            key={f.key}
                            fieldKey={f.key}
                            settings={f.settings}
                            scale={pdfWidth / 612}
                            active={activeField}
                            filled={f.key === 'signature' ? !!sigDataUrl : !!f.value}
                            value={f.value}
                            onActivate={setActiveField}
                            onFieldUpdate={(k, v) => {
                              if (k === 'childName') setChildName(v);
                              else setParentName(v);
                            }}
                            onOpenSignature={() => setSigPickerOpen(true)}
                            onRemoveSignature={() => setSigDataUrl(null)}
                            sigPreview={sigDataUrl}
                          />
                        ))}
                      </div>
                    )}
                  </LazyPage>
                ))}
            </div>
          </Document>
        </div>
      </div>

      {/* Down arrow scroll button */}
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

      {/* Sticky bottom bar */}
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
                  key={s.key}
                  onClick={() => scrollToField(s.key)}
                  className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap px-2.5 py-1.5 rounded-lg transition-all ${
                    s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      s.done ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'
                    }`}
                  >
                    {s.done ? '\u2713' : STATUS.findIndex((x) => x.key === s.key) + 1}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap active:scale-[0.98] ${
                allDone
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 cursor-pointer'
                  : 'bg-blue-600/90 text-white hover:bg-blue-700 cursor-pointer'
              }`}
              onClick={() => {
                if (allDone) setShowPreview(true);
                else scrollToNextField();
              }}
            >
              {allDone ? 'Review & Submit' : `${itemsLeft} field${itemsLeft !== 1 ? 's' : ''} remaining`}
            </button>
          </div>
        </div>
      )}

      {/* Preview confirmation modal */}
      {showPreview && allDone && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 animate-in fade-in duration-200">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-black/5">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Review Your Signature</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Is this correct?</p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-neutral-800/50 p-4">
                  <div className="relative mx-auto" style={{ width: Math.min(500, pdfWidth - 32) }}>
                    <Document
                      file="/handbook.pdf"
                      loading={
                        <div className="py-24 text-center text-gray-400 text-sm animate-pulse">
                          Loading preview&hellip;
                        </div>
                      }
                    >
                      <Page
                        pageNumber={lastPageNum}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={Math.min(500, pdfWidth - 32)}
                      />
                    </Document>
                    {settings && (
                      <div className="absolute inset-0 pointer-events-none">
                        {activeOverlayFields.map((f) => (
                          <FieldOverlay
                            key={f.key}
                            fieldKey={f.key}
                            settings={f.settings}
                            scale={Math.min(500, pdfWidth - 32) / 612}
                            readOnly
                            filled={f.key === 'signature' ? !!sigDataUrl : !!f.value}
                            value={f.value}
                            sigPreview={sigDataUrl}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
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

      {/* Post-submit success card */}
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
                  className="w-3.5 h-3.5"
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
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
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

      {/* Signature picker modal */}
      {sigPickerOpen && (
        <SignaturePicker
          nameOptions={[{ id: 'parentName', label: "Parent's Name", value: parentName }].filter((n) => n.value)}
          onSignature={handleSignature}
          onClose={() => setSigPickerOpen(false)}
        />
      )}

      {message && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-in slide-in-from-top-2 duration-300 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
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
