'use client';

import { memo, useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DATE_FORMAT_TO_PICKER, FIELD_RENDERERS, formatDateTo, isManualDate, parseDateValue, toISO } from './constants';

function FieldOverlayInner({
  field,
  scale,
  activeField,
  fieldValues,
  fieldErrors,
  onActivate,
  onUpdate,
  onOpenSignature,
  onRemoveSignature,
  readOnly,
}) {
  const f = field || {};
  const isSig = f.field_type === 'signature';
  const val = fieldValues[f.id] || '';
  const isFilled = !!val;
  const w = f.width || 200;
  const h = f.field_type === 'date' ? (f.font_size || 16) * 1.5 : f.height || 40;
  const fs = f.font_size || 12;
  const renderer = FIELD_RENDERERS[f.field_type] || FIELD_RENDERERS.other;

  const [dateOpen, setDateOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!dateOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDateOpen(false);
        onActivate?.(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dateOpen, onActivate]);

  const containerStyle = {
    left: `${(f.x || 0) * scale}px`,
    top: `${(f.y || 0) * scale}px`,
    width: `${w * scale}px`,
    zIndex: activeField === f.id && !readOnly ? 50 : 10,
  };

  if (f.field_type === 'date' && !readOnly && f.date_format?.startsWith('signing')) {
    const autoDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div
        className="absolute pointer-events-none flex items-center"
        style={{ ...containerStyle, fontSize: `${fs * scale}px`, fontWeight: 500, color: '#1a1a1a' }}
      >
        {autoDate}
      </div>
    );
  }

  if (readOnly) {
    if (f.field_type === 'date' && f.date_format?.startsWith('signing')) {
      const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return (
        <div
          className="absolute flex items-center"
          style={{ ...containerStyle, fontSize: `${fs * scale}px`, fontWeight: 500, color: '#1a1a1a' }}
        >
          {d}
        </div>
      );
    }
    if (!isFilled) return null;
    return (
      <div className="absolute transition-all duration-300 ease-out" style={containerStyle}>
        {isSig && (
          <div style={{ height: `${h * scale}px` }}>
            <img src={val} alt="Signature" className="w-full h-full object-contain" />
          </div>
        )}
        {!isSig && (
          <div className="px-2 py-1 text-gray-900" style={{ fontSize: `${Math.max(12, fs * scale)}px` }}>
            {val}
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
            if (!val) onOpenSignature(f.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!val) onOpenSignature(f.id);
            }
          }}
          className={`relative w-full rounded-lg transition-all duration-300 ${val ? 'bg-transparent border-0' : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 cursor-pointer'}`}
          style={{ height: `${h * scale}px` }}
        >
          {val ? (
            <div className="relative w-full h-full">
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <img src={val} alt="Signature" className="w-full h-full object-contain" />
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSignature(f.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onRemoveSignature(f.id);
                  }
                }}
                className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-20 cursor-pointer"
                title="Remove signature"
              >
                <svg
                  aria-hidden="true"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-blue-300 text-xs font-medium">
              {renderer.placeholder}
            </div>
          )}
        </button>
      )}

      {!isSig &&
        (activeField === f.id ? (
          <div>
            {(() => {
              if (isManualDate(f)) {
                // Mobile: native OS picker — no overlay trap, swipe/esc built-in
                if (isMobile) {
                  const nativeValue = parseDateValue(val, f.date_format) || '';
                  return (
                    <input
                      type="date"
                      value={nativeValue}
                      onChange={(e) => {
                        const iso = e.target.value;
                        onUpdate(f.id, iso ? formatDateTo(iso, f.date_format) : '');
                      }}
                      onBlur={() => onActivate(null)}
                      className={`w-full px-2 py-1 border-2 rounded-lg text-sm bg-white text-gray-900 shadow-lg outline-none transition-all duration-200 ${fieldErrors?.[f.id] ? 'border-red-500' : 'border-blue-500'}`}
                      style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
                    />
                  );
                }
                const selRaw = parseDateValue(val, f.date_format);
                const selectedDate = selRaw ? new Date(`${selRaw}T00:00:00`) : null;
                return (
                  <>
                    {dateOpen && (
                      <button
                        type="button"
                        aria-label="Close calendar"
                        onClick={() => {
                          setDateOpen(false);
                          onActivate?.(null);
                        }}
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                      />
                    )}
                    <DatePicker
                      open={dateOpen}
                      selected={selectedDate}
                      portalId="datepicker-portal"
                      popperPlacement="bottom"
                      showPopperArrow={false}
                      popperProps={{ strategy: 'fixed' }}
                      popperClassName="!z-[70]"
                      autoComplete="off"
                      shouldCloseOnSelect
                      dateFormat={DATE_FORMAT_TO_PICKER[f.date_format] || 'MMMM d, yyyy'}
                      placeholderText={renderer.placeholder}
                      onCalendarOpen={() => setDateOpen(true)}
                      onCalendarClose={() => setDateOpen(false)}
                      onChange={(d) => {
                        onUpdate(f.id, d ? formatDateTo(toISO(d), f.date_format) : '');
                        setDateOpen(false);
                        onActivate?.(null);
                      }}
                      onClickOutside={() => {
                        setDateOpen(false);
                        onActivate?.(null);
                      }}
                      calendarContainer={({ children }) => (
                        <div className="relative bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-neutral-700 sm:hidden">
                            <span className="text-sm font-medium text-gray-700 dark:text-neutral-200">Select date</span>
                            <button
                              type="button"
                              onClick={() => {
                                setDateOpen(false);
                                onActivate?.(null);
                              }}
                              className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-700 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600"
                            >
                              Done
                            </button>
                          </div>
                          <div className="bg-white dark:bg-neutral-900">{children}</div>
                        </div>
                      )}
                      customInput={
                        <input
                          type="text"
                          className={`w-full px-2 py-1 border-2 rounded-lg text-sm bg-white text-gray-900 shadow-lg outline-none transition-all duration-200 ${fieldErrors?.[f.id] ? 'border-red-500' : 'border-blue-500'}`}
                          style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
                        />
                      }
                    />
                  </>
                );
              }
              return (
                <input
                  type={f.field_type === 'email' ? 'email' : f.field_type === 'phone' ? 'tel' : 'text'}
                  value={val}
                  onChange={(e) => onUpdate(f.id, e.target.value)}
                  onBlur={() => onActivate(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onActivate(null);
                  }}
                  className={`w-full px-2 py-1 border-2 rounded-lg text-sm bg-white text-gray-900 shadow-lg outline-none transition-all duration-200 ${fieldErrors?.[f.id] ? 'border-red-500' : 'border-blue-500'}`}
                  style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
                  placeholder={renderer.placeholder}
                />
              );
            })()}
            {fieldErrors?.[f.id] && (
              <div className="text-red-500 text-xs mt-0.5" style={{ fontSize: `${Math.max(10, fs * scale * 0.8)}px` }}>
                {fieldErrors[f.id]}
              </div>
            )}
          </div>
        ) : (
          <div>
              <button
                type="button"
                onClick={() => {
                  onActivate(f.id);
                  if (isManualDate(f) && !window.matchMedia('(max-width: 640px)').matches) setDateOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onActivate(f.id);
                    if (isManualDate(f) && !window.matchMedia('(max-width: 640px)').matches) setDateOpen(true);
                  }
                }}
              className={`w-full text-left px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer ${fieldErrors?.[f.id] ? 'bg-red-50 border-2 border-red-300 text-red-700' : isFilled ? 'bg-green-50 border border-green-200 text-gray-900' : 'bg-yellow-50 border-2 border-dashed border-yellow-300 hover:border-yellow-500 text-gray-500'}`}
              style={{ fontSize: `${Math.max(12, fs * scale)}px` }}
            >
              {isFilled ? val : f.label || renderer.placeholder}
            </button>
            {fieldErrors?.[f.id] && (
              <div className="text-red-500 text-xs mt-0.5" style={{ fontSize: `${Math.max(10, fs * scale * 0.8)}px` }}>
                {fieldErrors[f.id]}
              </div>
            )}
          </div>
        ))}
     </div>
  );
}

export default memo(FieldOverlayInner);