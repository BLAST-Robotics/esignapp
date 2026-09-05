'use client';

import SignatureChart from '../SignatureChart';
import { toLocalISO } from './constants';

export default function SignaturesPanel({
  fields,
  signatures,
  loadingSigs,
  downloadingId,
  downloadingAll,
  onEdit,
  onDelete,
  onDownload,
  downloadAll,
}) {
  return (
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
            <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">Share the sign link to collect signatures.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                  {fields.map((f) => (
                    <th key={f.id} className="text-left px-3 py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs">
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
                          onClick={() => onEdit(sig)}
                          className="px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(sig.id)}
                          className="px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => onDownload(sig.id)}
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
  );
}