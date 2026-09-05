'use client';

import { FIELD_COLORS } from './constants';

export default function FieldToolbar({ fields, selectedId, addField, openFieldEdit, removeField, canEdit }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-gray-200 dark:border-neutral-800 px-4 py-3 shadow-lg">
      <div className="flex items-center gap-2 max-w-7xl mx-auto">
        {canEdit && (
          <button
            type="button"
            onClick={() => addField()}
            className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-all flex items-center gap-1 shadow-sm"
          >
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Field
          </button>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
          {fields.length === 0 && (
            <span className="text-xs text-gray-400 italic px-2">
              No fields yet. Right-click the PDF or click Add Field.
            </span>
          )}
          {fields.map((f) => {
            const c = FIELD_COLORS[f.field_type] || FIELD_COLORS.other;
            const isSel = selectedId === f.id;
            return (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => openFieldEdit(f.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openFieldEdit(f.id);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${isSel ? 'text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                style={{ backgroundColor: isSel ? c.border : c.bg, border: `1px solid ${c.border}` }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/70' : ''}`}
                  style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.7)' : c.border }}
                />
                {f.label || f.field_type}
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(f.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        removeField(f.id);
                      }
                    }}
                    className={`p-0.5 rounded cursor-pointer ${isSel ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                  >
                    <svg
                      aria-hidden="true"
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}