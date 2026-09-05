'use client';

import SignatureChart from '@/components/SignatureChart';
import { toLocalISO } from './constants';

export default function DocumentsTab({
  documents,
  allSignatures,
  loading,
  error,
  uploading,
  editingId,
  editValue,
  setEditingId,
  setEditValue,
  onUpload,
  fetchDocs,
  apiReq,
  setDeleteId,
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{documents.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Documents</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{documents.filter((d) => d.status === 'active').length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Active</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{allSignatures.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total Signatures</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">
          {error}
        </div>
      )}

      {allSignatures.length > 0 && (
        <div className="mb-6">
          <SignatureChart signatures={allSignatures} title="All Signatures Over Time" />
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Documents</h2>
          <label className={`px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer flex items-center gap-2 shadow-sm ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
            {uploading ? 'Uploading...' : (<><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Upload PDF</>)}
            <input type="file" accept=".pdf" onChange={onUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Loading&hellip;
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-neutral-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            <p className="text-sm">No documents yet.</p>
            <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">Upload a PDF to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden sm:table-cell">Signatures</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden md:table-cell">Created</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/30 cursor-pointer" onClick={() => { if (editingId !== doc.id) window.location.href = `/admin/documents/${doc.id}`; }} onKeyDown={(e) => { if (editingId !== doc.id && (e.key === 'Enter' || e.key === ' ')) window.location.href = `/admin/documents/${doc.id}`; }} role="button" tabIndex={0}>
                    <td className="px-5 py-4" onClick={(e) => { if (editingId === doc.id) e.stopPropagation(); }}>
                      {editingId === doc.id ? (
                        <input value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={async () => { if (editValue.trim()) { try { await apiReq(`/api/documents/${doc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editValue.trim() }) }); fetchDocs(); } catch {} } setEditingId(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingId(null); }} className="w-full text-sm font-medium text-gray-900 dark:text-neutral-100 bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      ) : (
                        <div className="text-gray-900 dark:text-neutral-100 font-medium group flex items-center gap-1.5" onDoubleClick={() => { setEditingId(doc.id); setEditValue(doc.title); }}>
                          {doc.title}
                          {doc.permission && (<span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${doc.permission === 'manage' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : doc.permission === 'edit' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{doc.permission}</span>)}
                          <svg aria-hidden="true" className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5 sm:hidden">{doc.status} &middot; {doc.signature_count || 0} sigs</div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${doc.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{doc.status}</span></td>
                    <td className="px-4 py-4 text-gray-700 dark:text-neutral-300 hidden sm:table-cell">{doc.signature_count || 0}</td>
                    <td className="px-4 py-4 text-gray-500 text-xs hidden md:table-cell">{toLocalISO(new Date(doc.created_at))}</td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><button type="button" onClick={() => setDeleteId(doc.id)} className="px-2.5 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors" title="Delete">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
