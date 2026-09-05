'use client';

import { Document, Page } from 'react-pdf';
import FieldOverlay from './FieldOverlay';

export default function PreviewModal({
  documentId,
  fields,
  fieldValues,
  fieldErrors,
  numPages,
  lastPageNum,
  pdfWidth,
  submitting,
  onClose,
  onSubmit,
}) {
  return (
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
                onClick={onClose}
                className="px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onSubmit}
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
  );
}