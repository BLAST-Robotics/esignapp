'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const SignaturePicker = dynamic(() => import('./SignaturePicker'), { ssr: false });
import Confetti from './signer/Confetti';
import EmailGate from './signer/EmailGate';
import FieldOverlay from './signer/FieldOverlay';
import LazyPage from './signer/LazyPage';
import PdfDocument from './signer/PdfDocument';
import PostSubmitCard from './signer/PostSubmitCard';
import PreviewModal from './signer/PreviewModal';
import SignerStatusBar from './signer/SignerStatusBar';
import ThemeToggle from './ThemeToggle';

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

  useEffect(() => {
    let el = document.getElementById('datepicker-portal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'datepicker-portal';
      document.body.appendChild(el);
    }
    return () => el.remove();
  }, []);

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
        // restore draft from localStorage (autosave) — draft wins over initial
        try {
          const raw = localStorage.getItem(`ks_draft_${documentId}`);
          if (raw) {
            const draft = JSON.parse(raw);
            Object.assign(initial, draft);
          }
        } catch {}
        setFieldValues(initial);
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load document' }));
  }, [documentId]);

  // autosave draft to localStorage (debounced 400ms) — item 6
  const autosaveTimer = useRef(null);
  useEffect(() => {
    if (!documentId || !docInfo) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(`ks_draft_${documentId}`, JSON.stringify(fieldValues));
      } catch {}
    }, 400);
    return () => clearTimeout(autosaveTimer.current);
  }, [documentId, docInfo, fieldValues]);

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
      try {
        localStorage.removeItem(`ks_draft_${documentId}`);
      } catch {}
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

  if (docInfo?.collect_email && !signerEmail) {
    return <EmailGate signerEmail={signerEmail} setSignerEmail={setSignerEmail} setMessage={setMessage} />;
  }

  const pdfWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 16, 900) : 700;
  const lastPageNum = numPages || 1;
  const itemsLeft = fields
    .filter((f) => f.field_type !== 'date' || !f.date_format?.startsWith('signing'))
    .filter((f) => !fieldValues[f.id]).length;

  const status = fields
    .filter((f) => f.field_type !== 'date' || !f.date_format?.startsWith('signing'))
    .map((f) => ({ id: f.id, label: f.label, done: !!fieldValues[f.id] }));

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
          <PdfDocument
            file={`/api/public/document/${documentId}/pdf`}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="py-24 text-center text-gray-400 text-sm">Loading document…</div>}
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
          </PdfDocument>
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
        <SignerStatusBar
          status={status}
          itemsLeft={itemsLeft}
          allDone={allDone}
          onSelectField={scrollToField}
          onPrimary={() => {
            if (allDone) {
              if (runValidation()) setShowPreview(true);
              else scrollToNextField();
            } else scrollToNextField();
          }}
        />
      )}

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          documentId={documentId}
          fields={fields}
          fieldValues={fieldValues}
          fieldErrors={fieldErrors}
          numPages={numPages}
          lastPageNum={lastPageNum}
          pdfWidth={pdfWidth}
          submitting={submitting}
          onClose={() => setShowPreview(false)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Post-submit card */}
      {submitted && (
        <PostSubmitCard
          email={email}
          setEmail={setEmail}
          handleMailTo={handleMailTo}
          handleDownload={handleDownload}
          handleContinue={handleContinue}
          redirecting={redirecting}
        />
      )}

      {/* Signature picker */}
      {sigPickerOpen && (
        <SignaturePicker
          nameOptions={fields
            .filter((f) => f.field_type === 'name')
            .map((f) => ({ id: f.id, label: f.label, value: fieldValues[f.id] || '' }))
            .filter((n) => n.value)}
          defaultMethod={fields.find((f) => f.id === sigPickerFieldId)?.default_method}
          signatureName={(() => {
            const sf = fields.find((f) => f.id === sigPickerFieldId);
            if (!sf?.signature_name) return '';
            if (sf.signature_name === '__custom__') return sf.signature_custom_text || '';
            return fieldValues[sf.signature_name] || '';
          })()}
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
