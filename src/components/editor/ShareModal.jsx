'use client';

import { useCallback, useEffect, useState } from 'react';

export default function ShareModal({ documentId, authHeaders, onClose, onMessage }) {
  const [email, setEmail] = useState('');
  const [perm, setPerm] = useState('view');
  const [loading, setLoading] = useState(false);
  const [perms, setPerms] = useState([]);

  const loadPermissions = useCallback(async () => {
    try {
      const r = await fetch(`/api/documents/${documentId}/permissions`, { headers: authHeaders });
      const data = await r.json();
      setPerms(data.permissions || []);
    } catch {}
  }, [documentId, authHeaders]);

  useEffect(() => {
    if (documentId) loadPermissions();
  }, [documentId, loadPermissions]);

  async function addShare() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/permissions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission: perm }),
      });
      const data = await r.json();
      if (!r.ok) {
        onMessage({ type: 'error', text: data.error || 'Share failed' });
        return;
      }
      setEmail('');
      onMessage({ type: 'success', text: 'Shared!' });
      loadPermissions();
    } catch {
      onMessage({ type: 'error', text: 'Share failed' });
    } finally {
      setLoading(false);
    }
  }

  async function removeShare(remEmail) {
    try {
      await fetch(`/api/documents/${documentId}/permissions?email=${encodeURIComponent(remEmail)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      loadPermissions();
    } catch {}
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
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
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@email.com"
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={perm}
              onChange={(e) => setPerm(e.target.value)}
              className="px-2 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
              <option value="manage">Manage</option>
            </select>
            <button
              type="button"
              onClick={addShare}
              disabled={loading || !email.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-all shadow-sm"
            >
              {loading ? '...' : 'Add'}
            </button>
          </div>
          {perms.length > 0 && (
            <div className="space-y-2">
              {perms.map((p) => (
                <div key={p.id || p.email} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-neutral-900 rounded-lg">
                  <div>
                    <span className="text-xs text-gray-700 dark:text-neutral-300">{p.email}</span>
                    <span className="text-[10px] text-gray-400 ml-2 uppercase">{p.permission}</span>
                  </div>
                  <button type="button" onClick={() => removeShare(p.email)} className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}