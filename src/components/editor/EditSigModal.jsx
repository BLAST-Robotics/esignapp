'use client';

import { useEffect, useState } from 'react';

export default function EditSigModal({ sig, fields, authHeaders, onClose, onSaved }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues({ ...(sig?.field_values || {}) });
    setError(null);
  }, [sig]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/signatures/${sig.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_values: values }),
      });
      if (!r.ok) throw new Error('Failed');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
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
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
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
            const val = values[f.id] || '';
            return (
              <div key={f.id}>
                <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">
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
                          reader.onload = (ev) => setValues((prev) => ({ ...prev, [f.id]: ev.target.result }));
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all active:scale-[0.98] shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}