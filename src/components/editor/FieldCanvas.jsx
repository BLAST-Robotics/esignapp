'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import DraggableField from './DraggableField';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function FieldCanvas({
  documentId,
  pdfRef,
  fields,
  numPages,
  setNumPages,
  setPdfDims,
  selectedId,
  setSelectedId,
  updateField,
  openFieldEdit,
  handlePageContext,
  pdfWidth,
  scale,
  canEdit,
  collectEmail,
  setCollectEmail,
}) {
  return (
    <div>
      <div ref={pdfRef} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-800/50 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Right-click fields or empty area &mdash; drag to reposition
          </span>
          <span className="text-[10px] text-gray-400 font-mono">{scale.toFixed(2)}x</span>
        </div>
        <Document
          file={`/api/public/document/${documentId}/pdf`}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            setPdfDims({ width: 612, height: 792 });
          }}
          loading={<div className="py-24 text-center text-gray-400 text-sm">Loading&hellip;</div>}
          error={<div className="py-24 text-center text-red-400 text-sm">Could not load PDF</div>}
        >
          <div className="flex flex-col items-center p-2" style={{ backgroundColor: '#262626' }}>
            {numPages &&
              Array.from({ length: numPages }, (_, i) => {
                const pn = i + 1;
                const pageFields = fields.filter((f) =>
                  (f.page_number || 0) === 0 ? pn === numPages : (f.page_number || 0) === pn,
                );
                return (
                  <div
                    key={pn}
                    data-page={pn}
                    className="relative mb-4 last:mb-0 rounded-lg overflow-hidden"
                    style={{ width: pdfWidth, backgroundColor: '#404040' }}
                  >
                    <Page pageNumber={pn} renderTextLayer={false} renderAnnotationLayer={false} width={pdfWidth} />
                    <section
                      aria-label="PDF document area"
                      className="absolute inset-0 pointer-events-auto"
                      style={{ width: pdfWidth }}
                      onContextMenu={(e) => handlePageContext(e, pn)}
                    >
                      {pageFields.map((f) => (
                        <DraggableField
                          key={`${f.id}-${f.page_number || 0}`}
                          field={f}
                          scale={scale}
                          selected={selectedId === f.id}
                          onSelect={setSelectedId}
                          onUpdate={updateField}
                          onEdit={openFieldEdit}
                        />
                      ))}
                    </section>
                  </div>
                );
              })}
          </div>
        </Document>
      </div>

      {canEdit && (
        <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={collectEmail}
              onChange={(e) => setCollectEmail(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600" />
          </label>
          <span className="text-xs text-gray-700 dark:text-neutral-300">Collect email before signing</span>
        </div>
      )}
    </div>
  );
}