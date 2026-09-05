'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EditorHeader from '@/components/editor/EditorHeader';
import FieldCanvas from '@/components/editor/FieldCanvas';
import FieldToolbar from '@/components/editor/FieldToolbar';
import SignaturesPanel from '@/components/editor/SignaturesPanel';
import EditSigModal from '@/components/editor/EditSigModal';
import ShareModal from '@/components/editor/ShareModal';
import CtxFieldEditor from '@/components/editor/CtxFieldEditor';
import { getToken, copyToClipboard, genId } from '@/components/editor/constants';

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
    const width = Number.isFinite(updated.width) ? updated.width : undefined;
    const height = Number.isFinite(updated.height) ? updated.height : undefined;
    setFields((prev) =>
      prev.map((f) =>
        f.id === updated.id
          ? {
              ...f,
              ...updated,
              ...(width !== undefined ? { width } : {}),
              ...(height !== undefined ? { height } : {}),
            }
          : f,
      ),
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
      if (dist < minDist) {
        minDist = dist;
        closest = page;
      }
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
      <EditorHeader
        router={router}
        canEdit={canEdit}
        canManage={canManage}
        saving={saving}
        title={title}
        setTitle={setTitle}
        permission={permission}
        onSave={saveFields}
        onShare={() => setShowShare(true)}
        token={token}
        documentId={documentId}
        setMessage={setMessage}
        setNumPages={setNumPages}
      />

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
          <FieldCanvas
            documentId={documentId}
            pdfRef={pdfRef}
            fields={fields}
            numPages={numPages}
            setNumPages={setNumPages}
            setPdfDims={setPdfDims}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            updateField={updateField}
            openFieldEdit={openFieldEdit}
            handlePageContext={handlePageContext}
            pdfWidth={pdfWidth}
            scale={scale}
            canEdit={canEdit}
            collectEmail={collectEmail}
            setCollectEmail={setCollectEmail}
          />
        )}

        {tab === 'signatures' && (
          <SignaturesPanel
            fields={fields}
            signatures={signatures}
            loadingSigs={loadingSigs}
            downloadingId={downloadingId}
            downloadingAll={downloadingAll}
            onEdit={startEdit}
            onDelete={deleteSig}
            onDownload={downloadSig}
            downloadAll={downloadAll}
          />
        )}

        {tab === 'fields' && (
          <FieldToolbar
            fields={fields}
            selectedId={selectedId}
            addField={addField}
            openFieldEdit={openFieldEdit}
            removeField={removeField}
            canEdit={canEdit}
          />
        )}

        {editSig && (
          <EditSigModal
            sig={editSig}
            fields={fields}
            authHeaders={authHeaders}
            onClose={() => setEditSig(null)}
            onSaved={() => {
              setMessage({ type: 'success', text: 'Signature updated' });
              setEditSig(null);
              fetchSignatures();
            }}
          />
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

        {showShare && canManage && (
          <ShareModal
            documentId={documentId}
            authHeaders={authHeaders}
            onClose={() => setShowShare(false)}
            onMessage={setMessage}
          />
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