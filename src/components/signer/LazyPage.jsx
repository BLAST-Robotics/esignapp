'use client';

import { useEffect, useRef, useState } from 'react';
import { Page } from 'react-pdf';

function useIntersection(threshold = 0) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

export default function LazyPage({ pageNumber, width, children }) {
  const [ref, visible] = useIntersection(0.01);
  // Reserve exact letter aspect (612x792 = 1/1.294) to eliminate CLS; no SSR/CSR width mismatch
  const aspect = 792 / 612;
  return (
    <div
      ref={ref}
      className="mb-4 last:mb-0 relative shadow-lg rounded-lg overflow-hidden border border-black/5 bg-gray-50"
      id={`page-${pageNumber}`}
      style={{ width, aspectRatio: `612 / 792`, minHeight: width ? width * aspect : undefined }}
    >
      {visible ? (
        <Page
          pageNumber={pageNumber}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          width={width}
          loading={<div className="absolute inset-0 bg-gray-50 animate-pulse" />}
        />
      ) : (
        <div className="absolute inset-0 bg-gray-50" />
      )}
      {children}
    </div>
  );
}